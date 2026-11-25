-- ============================================================================
-- S.I.G.A. — Módulo 1.8C: Asistente IA Editorial (Cuota y Auditoría sin PII)
-- Migración puramente DDL (cero INSERT/UPDATE/DELETE de datos)
-- Motor: Neon Serverless PostgreSQL 17+ | Código DEA: OD01340701
-- Seguridad: OWASP LLM02 (cero prompts/PII almacenados) y LLM10 (25 req/h)
-- ============================================================================

-- 1. TABLA DE AUDITORÍA Y CONTROL DE CUOTA HORARIA (SIN PROMPTS NI PII)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bulletin_ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  department_label TEXT NOT NULL CHECK (char_length(trim(department_label)) BETWEEN 2 AND 80),
  request_mode TEXT NOT NULL DEFAULT 'chat' CHECK (
    request_mode IN ('chat', 'draft', 'improve', 'summarize')
  ),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'completed', 'failed', 'timeout')
  ),
  latency_ms INTEGER CHECK (latency_ms IS NULL OR (latency_ms >= 0 AND latency_ms <= 120000)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_bulletin_ai_usage_user_created
  ON public.bulletin_ai_usage_logs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bulletin_ai_usage_pending_lookup
  ON public.bulletin_ai_usage_logs (id)
  WHERE status = 'pending';

-- 2. ROW LEVEL SECURITY + PRIVILEGIOS MÍNIMOS
-- ----------------------------------------------------------------------------
ALTER TABLE public.bulletin_ai_usage_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.bulletin_ai_usage_logs FROM PUBLIC, anon;
GRANT SELECT ON public.bulletin_ai_usage_logs TO authenticated;
GRANT ALL ON public.bulletin_ai_usage_logs TO service_role;

DROP POLICY IF EXISTS pol_bulletin_ai_usage_select ON public.bulletin_ai_usage_logs;
CREATE POLICY pol_bulletin_ai_usage_select
  ON public.bulletin_ai_usage_logs
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT siga_internal.current_user_id())
    OR (SELECT siga_internal.has_any_role(ARRAY['direccion']))
  );

-- 3. RPC 1: VERIFICAR ROL EDITORIAL Y CONSUMIR CUOTA ATÓMICAMENTE (25/HORA)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.siga_consume_bulletin_ai_quota(
  p_request_mode TEXT DEFAULT 'chat'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor_id UUID := siga_internal.current_user_id();
  v_is_editor BOOLEAN := false;
  v_department_label TEXT;
  v_safe_mode TEXT := COALESCE(NULLIF(trim(p_request_mode), ''), 'chat');
  v_limit CONSTANT INTEGER := 25;
  v_used INTEGER := 0;
  v_oldest_in_window TIMESTAMPTZ;
  v_retry_after INTEGER := 60;
  v_usage_id UUID;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Sesión institucional requerida' USING ERRCODE = '42501';
  END IF;

  v_is_editor :=
    siga_internal.has_any_role(
      ARRAY['direccion', 'control_estudios', 'coordinador_pasantias']
    )
    OR siga_internal.current_coord_mencion_id() IS NOT NULL;

  IF NOT v_is_editor THEN
    RAISE EXCEPTION 'Solo roles editoriales pueden utilizar el asistente de redacción'
      USING ERRCODE = '42501';
  END IF;

  IF v_safe_mode NOT IN ('chat', 'draft', 'improve', 'summarize') THEN
    v_safe_mode := 'chat';
  END IF;

  -- Bloqueo transaccional por usuario para impedir ráfagas concurrentes sobre la cuota
  PERFORM pg_advisory_xact_lock(hashtext('bulletin_ai_quota:' || v_actor_id::text));

  SELECT count(*)::INTEGER, min(l.created_at)
    INTO v_used, v_oldest_in_window
    FROM public.bulletin_ai_usage_logs l
   WHERE l.user_id = v_actor_id
     AND l.created_at >= now() - interval '1 hour'
     AND l.status IN ('pending', 'completed');

  IF v_used >= v_limit THEN
    IF v_oldest_in_window IS NOT NULL THEN
      v_retry_after := GREATEST(
        60,
        CEIL(EXTRACT(EPOCH FROM ((v_oldest_in_window + interval '1 hour') - now())))::INTEGER
      );
    END IF;

    RETURN jsonb_build_object(
      'allowed', false,
      'used_last_hour', v_used,
      'limit_per_hour', v_limit,
      'remaining', 0,
      'retry_after_seconds', v_retry_after
    );
  END IF;

  v_department_label := siga_internal.resolve_bulletin_department_label();

  INSERT INTO public.bulletin_ai_usage_logs (
    user_id,
    department_label,
    request_mode,
    status
  )
  VALUES (
    v_actor_id,
    v_department_label,
    v_safe_mode,
    'pending'
  )
  RETURNING id INTO v_usage_id;

  RETURN jsonb_build_object(
    'allowed', true,
    'usage_log_id', v_usage_id,
    'department_label', v_department_label,
    'used_last_hour', v_used + 1,
    'limit_per_hour', v_limit,
    'remaining', GREATEST(0, v_limit - (v_used + 1))
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.siga_consume_bulletin_ai_quota(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.siga_consume_bulletin_ai_quota(TEXT) TO authenticated, service_role;

-- 4. RPC 2: RECLAMAR TICKET PENDIENTE DESDE NEON FUNCTION (`service_role`)
-- ----------------------------------------------------------------------------
-- Garantiza que la Neon Function solo despache a n8n tickets recién emitidos
-- por PostgreSQL (máximo 2 minutos de antigüedad y estado `pending`).
CREATE OR REPLACE FUNCTION public.siga_service_verify_bulletin_ai_ticket(
  p_usage_log_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_row RECORD;
BEGIN
  IF current_user NOT IN ('service_role', 'neondb_owner', 'postgres')
     AND COALESCE(current_setting('request.jwt.claim.role', true), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Operación exclusiva del servicio interno' USING ERRCODE = '42501';
  END IF;

  IF p_usage_log_id IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'missing_ticket');
  END IF;

  SELECT id, department_label, request_mode, status, created_at
    INTO v_row
    FROM public.bulletin_ai_usage_logs
   WHERE id = p_usage_log_id
     AND status = 'pending'
     AND created_at >= now() - interval '2 minutes'
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'invalid_or_expired_ticket');
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'usage_log_id', v_row.id,
    'department_label', v_row.department_label,
    'request_mode', v_row.request_mode
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.siga_service_verify_bulletin_ai_ticket(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.siga_service_verify_bulletin_ai_ticket(UUID) TO service_role;

-- 5. RPC 3: CERRAR REGISTRO DE USO DE ASISTENTE IA
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.siga_finish_bulletin_ai_usage(
  p_usage_log_id UUID,
  p_status TEXT,
  p_latency_ms INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor_id UUID := siga_internal.current_user_id();
  v_is_service BOOLEAN :=
    current_user IN ('service_role', 'neondb_owner', 'postgres')
    OR COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role';
  v_safe_status TEXT := CASE
    WHEN p_status IN ('completed', 'failed', 'timeout') THEN p_status
    ELSE 'failed'
  END;
  v_safe_latency INTEGER := CASE
    WHEN p_latency_ms IS NULL THEN NULL
    ELSE LEAST(GREATEST(p_latency_ms, 0), 120000)
  END;
BEGIN
  IF p_usage_log_id IS NULL THEN
    RAISE EXCEPTION 'Identificador de uso requerido' USING ERRCODE = '22023';
  END IF;

  IF NOT v_is_service AND v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Sesión institucional requerida' USING ERRCODE = '42501';
  END IF;

  UPDATE public.bulletin_ai_usage_logs
     SET status = v_safe_status,
         latency_ms = v_safe_latency,
         completed_at = now()
   WHERE id = p_usage_log_id
     AND status = 'pending'
     AND (v_is_service OR user_id = v_actor_id);

  RETURN jsonb_build_object(
    'success', true,
    'usage_log_id', p_usage_log_id,
    'status', v_safe_status
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.siga_finish_bulletin_ai_usage(UUID, TEXT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.siga_finish_bulletin_ai_usage(UUID, TEXT, INTEGER) TO authenticated, service_role;

-- ============================================================================
-- S.I.G.A. — Esquema `workflows` y Automatización 01:
-- Solicitud de Trámite (`public.student_requests`) -> Edge Function -> n8n -> Mailtrap
-- (SOLO DDL — Cero INSERTs de datos, catálogos ni credenciales)
-- Motor: Supabase PostgreSQL 17+ | Código DEA: OD01340701
-- ============================================================================

-- 1. EXTENSIÓN DE DISPARO HTTP ASÍNCRONO (`pg_net` en esquema `net`)
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. ESQUEMA INTERNO `workflows` (NO EXPUESTO EN DATA API)
-- ----------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS workflows;

REVOKE ALL ON SCHEMA workflows FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA workflows TO service_role;

-- 3. BITÁCORA IDEMPOTENTE DE EJECUCIONES DE WORKFLOWS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS workflows.workflow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_code TEXT NOT NULL CHECK (length(trim(workflow_code)) >= 3),
  source_table TEXT NOT NULL CHECK (length(trim(source_table)) >= 3),
  source_record_id UUID NOT NULL,
  pg_net_request_id BIGINT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (
    status IN ('queued', 'dispatched', 'completed', 'partial', 'skipped', 'failed')
  ),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  result_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  dispatched_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_workflow_runs_code_record UNIQUE (workflow_code, source_record_id)
);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_status_created
  ON workflows.workflow_runs(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_source
  ON workflows.workflow_runs(source_table, source_record_id);

DROP TRIGGER IF EXISTS trg_workflow_runs_updated_at ON workflows.workflow_runs;
CREATE TRIGGER trg_workflow_runs_updated_at
  BEFORE UPDATE ON workflows.workflow_runs
  FOR EACH ROW
  WHEN (OLD.* IS DISTINCT FROM NEW.*)
  EXECUTE FUNCTION siga_internal.set_updated_at();

ALTER TABLE workflows.workflow_runs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE workflows.workflow_runs FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE workflows.workflow_runs TO service_role;

DROP POLICY IF EXISTS pol_workflow_runs_service_role ON workflows.workflow_runs;
CREATE POLICY pol_workflow_runs_service_role
  ON workflows.workflow_runs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 4. RPCs EXCLUSIVOS DE `service_role` PARA ORQUESTACIÓN DESDE EDGE FUNCTIONS
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.siga_service_claim_workflow_run(
  p_workflow_code TEXT,
  p_source_record_id UUID,
  p_source_table TEXT DEFAULT 'public.student_requests',
  p_expected_run_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, workflows
AS $$
DECLARE
  v_row workflows.workflow_runs%ROWTYPE;
BEGIN
  IF current_user NOT IN ('postgres', 'supabase_admin', 'service_role')
     AND COALESCE(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     AND COALESCE((auth.jwt() ->> 'role'), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Operación restringida a funciones internas del servidor'
      USING ERRCODE = '42501';
  END IF;

  IF p_workflow_code IS NULL OR length(trim(p_workflow_code)) < 3 OR p_source_record_id IS NULL THEN
    RAISE EXCEPTION 'Parámetros de ejecución de workflow inválidos'
      USING ERRCODE = '22023';
  END IF;

  IF p_expected_run_id IS NOT NULL THEN
    SELECT *
      INTO v_row
      FROM workflows.workflow_runs wr
     WHERE wr.id = p_expected_run_id
       AND wr.workflow_code = trim(p_workflow_code)
       AND wr.source_record_id = p_source_record_id
       FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Ejecución de workflow no autorizada o inexistente'
        USING ERRCODE = '42501';
    END IF;
  ELSE
    INSERT INTO workflows.workflow_runs (
      workflow_code,
      source_table,
      source_record_id,
      status
    )
    VALUES (
      trim(p_workflow_code),
      COALESCE(NULLIF(trim(p_source_table), ''), 'public.student_requests'),
      p_source_record_id,
      'queued'
    )
    ON CONFLICT (workflow_code, source_record_id) DO NOTHING;

    SELECT *
      INTO v_row
      FROM workflows.workflow_runs wr
     WHERE wr.workflow_code = trim(p_workflow_code)
       AND wr.source_record_id = p_source_record_id
       FOR UPDATE;
  END IF;

  IF v_row.status = 'completed' THEN
    RETURN jsonb_build_object(
      'run_id', v_row.id,
      'status', v_row.status,
      'already_completed', true,
      'attempt_count', v_row.attempt_count
    );
  END IF;

  UPDATE workflows.workflow_runs
     SET attempt_count = v_row.attempt_count + 1,
         dispatched_at = COALESCE(dispatched_at, now())
   WHERE id = v_row.id
   RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'run_id', v_row.id,
    'status', v_row.status,
    'already_completed', false,
    'attempt_count', v_row.attempt_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.siga_service_claim_workflow_run(TEXT, UUID, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.siga_service_claim_workflow_run(TEXT, UUID, TEXT, UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.siga_service_finish_workflow_run(
  p_workflow_run_id UUID,
  p_status TEXT,
  p_result_json JSONB DEFAULT '{}'::jsonb,
  p_error_message TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, workflows
AS $$
DECLARE
  v_updated_id UUID;
BEGIN
  IF current_user NOT IN ('postgres', 'supabase_admin', 'service_role')
     AND COALESCE(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     AND COALESCE((auth.jwt() ->> 'role'), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Operación restringida a funciones internas del servidor'
      USING ERRCODE = '42501';
  END IF;

  IF p_workflow_run_id IS NULL OR p_status NOT IN ('completed', 'partial', 'skipped', 'failed') THEN
    RAISE EXCEPTION 'Estado final de workflow inválido' USING ERRCODE = '22023';
  END IF;

  UPDATE workflows.workflow_runs
     SET status = p_status,
         result_json = COALESCE(p_result_json, '{}'::jsonb),
         error_message = p_error_message,
         completed_at = now()
   WHERE id = p_workflow_run_id
   RETURNING id INTO v_updated_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registro de ejecución de workflow no encontrado' USING ERRCODE = 'P0002';
  END IF;

  RETURN jsonb_build_object('success', true, 'run_id', v_updated_id, 'status', p_status);
END;
$$;

REVOKE ALL ON FUNCTION public.siga_service_finish_workflow_run(UUID, TEXT, JSONB, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.siga_service_finish_workflow_run(UUID, TEXT, JSONB, TEXT) TO service_role;

-- 5. DISPARADOR AUTOMÁTICO AL INSERTAR TRÁMITE PENDIENTE (`student_requests`)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION workflows.dispatch_student_request_email_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, workflows, net, vault
AS $$
DECLARE
  v_run_id UUID;
  v_base_url TEXT;
  v_webhook_secret TEXT;
  v_headers JSONB;
  v_net_req_id BIGINT;
  v_event_payload JSONB;
BEGIN
  v_event_payload := jsonb_build_object(
    'workflow_code', 'student_request_mailtrap',
    'event', TG_OP,
    'table', 'public.student_requests',
    'record_id', NEW.id,
    'request_type', NEW.request_type,
    'student_user_id', NEW.student_user_id,
    'status', NEW.status,
    'created_at', NEW.created_at
  );

  INSERT INTO workflows.workflow_runs (
    workflow_code,
    source_table,
    source_record_id,
    status,
    payload_json
  )
  VALUES (
    'student_request_mailtrap',
    'public.student_requests',
    NEW.id,
    'queued',
    v_event_payload
  )
  ON CONFLICT (workflow_code, source_record_id) DO NOTHING
  RETURNING id INTO v_run_id;

  IF v_run_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Nunca bloquear la creación de trámites si Vault o pg_net fallan o falta configurar la URL base
  BEGIN
    SELECT ds.decrypted_secret
      INTO v_base_url
      FROM vault.decrypted_secrets ds
     WHERE ds.name = 'siga_edge_functions_base_url'
     LIMIT 1;

    -- Secreto opcional (no requerido en desarrollo; `workflow_run_id` autentica la ejecución)
    SELECT ds.decrypted_secret
      INTO v_webhook_secret
      FROM vault.decrypted_secrets ds
     WHERE ds.name = 'siga_workflow_webhook_secret'
     LIMIT 1;

    IF v_base_url IS NOT NULL AND length(trim(v_base_url)) > 0 THEN
      v_headers := jsonb_build_object('Content-Type', 'application/json');
      IF v_webhook_secret IS NOT NULL AND length(trim(v_webhook_secret)) > 0 THEN
        v_headers := v_headers || jsonb_build_object('x-siga-workflow-secret', trim(v_webhook_secret));
      END IF;

      SELECT net.http_post(
        url := rtrim(trim(v_base_url), '/') || '/workflow-student-request-email',
        headers := v_headers,
        body := v_event_payload || jsonb_build_object('workflow_run_id', v_run_id),
        timeout_milliseconds := 5000
      )
      INTO v_net_req_id;

      UPDATE workflows.workflow_runs
         SET status = 'dispatched',
             pg_net_request_id = v_net_req_id,
             dispatched_at = now()
       WHERE id = v_run_id;
    ELSE
      UPDATE workflows.workflow_runs
         SET result_json = jsonb_build_object('reason', 'vault_base_url_pending')
       WHERE id = v_run_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    UPDATE workflows.workflow_runs
       SET status = 'failed',
           error_message = left(SQLERRM, 500)
     WHERE id = v_run_id;
  END;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION workflows.dispatch_student_request_email_trigger() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_student_requests_workflow_mailtrap ON public.student_requests;
CREATE TRIGGER trg_student_requests_workflow_mailtrap
  AFTER INSERT ON public.student_requests
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION workflows.dispatch_student_request_email_trigger();

NOTIFY pgrst, 'reload schema';

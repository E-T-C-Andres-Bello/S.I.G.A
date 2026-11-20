-- ============================================================================
-- S.I.G.A. — Módulo 1.6: Bandeja de Notificaciones Internas (In-App + Realtime)
-- Migración puramente DDL (cero INSERT/UPDATE/DELETE de datos)
-- Motor: Supabase PostgreSQL 17+ | Código DEA: OD01340701
-- ============================================================================

-- 1. ÍNDICE DE SOPORTE PARA BANDEJA COMPLETA ORDENADA POR FECHA
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created_desc
  ON public.notifications (recipient_user_id, created_at DESC);

-- 2. GUARDIA DE INTEGRIDAD: UN USUARIO SOLO PUEDE CAMBIAR `is_read` Y `read_at`
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION siga_internal.guard_notifications_self_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin', 'service_role')
     OR COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role'
     OR COALESCE((auth.jwt() ->> 'role'), '') = 'service_role'
     OR COALESCE(current_setting('siga.internal_rpc', true), '') = '1'
     OR siga_internal.has_any_role(ARRAY['direccion']) THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.recipient_user_id IS DISTINCT FROM OLD.recipient_user_id
     OR NEW.category IS DISTINCT FROM OLD.category
     OR NEW.title IS DISTINCT FROM OLD.title
     OR NEW.body IS DISTINCT FROM OLD.body
     OR NEW.action_url IS DISTINCT FROM OLD.action_url
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Solo se permite actualizar el estado de lectura de tus notificaciones'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.is_read = true AND NEW.read_at IS NULL THEN
    NEW.read_at := now();
  ELSIF NEW.is_read = false THEN
    NEW.read_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION siga_internal.guard_notifications_self_update() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION siga_internal.guard_notifications_self_update() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_notifications_guard_self_update ON public.notifications;
CREATE TRIGGER trg_notifications_guard_self_update
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION siga_internal.guard_notifications_self_update();

-- 3. RPC PROTEGIDO: MARCAR UNA NOTIFICACIÓN PROPIA COMO LEÍDA / NO LEÍDA
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.siga_marcar_notificacion_leida(
  p_notification_id UUID,
  p_is_read BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor_id UUID := siga_internal.current_user_id();
  v_updated RECORD;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Sesión institucional requerida' USING ERRCODE = '42501';
  END IF;

  IF p_notification_id IS NULL THEN
    RAISE EXCEPTION 'Identificador de notificación requerido' USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('siga.internal_rpc', '1', true);

  UPDATE public.notifications
     SET is_read = COALESCE(p_is_read, true),
         read_at = CASE WHEN COALESCE(p_is_read, true) THEN now() ELSE NULL END
   WHERE id = p_notification_id
     AND recipient_user_id = v_actor_id
   RETURNING id, is_read, read_at INTO v_updated;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La notificación solicitada no existe o no pertenece a tu cuenta'
      USING ERRCODE = 'P0002';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_updated.id,
    'is_read', v_updated.is_read,
    'read_at', v_updated.read_at
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.siga_marcar_notificacion_leida(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.siga_marcar_notificacion_leida(UUID, BOOLEAN) TO authenticated, service_role;

-- 4. RPC PROTEGIDO: MARCAR TODAS LAS NOTIFICACIONES PROPIAS COMO LEÍDAS
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.siga_marcar_todas_notificaciones_leidas()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor_id UUID := siga_internal.current_user_id();
  v_count INTEGER := 0;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Sesión institucional requerida' USING ERRCODE = '42501';
  END IF;

  PERFORM set_config('siga.internal_rpc', '1', true);

  UPDATE public.notifications
     SET is_read = true,
         read_at = now()
   WHERE recipient_user_id = v_actor_id
     AND is_read = false;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'updated_count', v_count
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.siga_marcar_todas_notificaciones_leidas() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.siga_marcar_todas_notificaciones_leidas() TO authenticated, service_role;

-- Asegurar publicación Realtime de forma idempotente (solo tabla operativa)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime'
       AND schemaname = 'public'
       AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END;
$$;

-- Recargar caché de esquema en PostgREST
NOTIFY pgrst, 'reload schema';

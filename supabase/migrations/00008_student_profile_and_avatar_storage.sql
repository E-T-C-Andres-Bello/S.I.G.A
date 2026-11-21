-- ============================================================================
-- S.I.G.A. — Perfil y Configuración del Estudiante + Auditoría y Storage Avatar
-- Migración puramente DDL (cero INSERT/UPDATE/DELETE de datos/catálogos)
-- Motor: Supabase PostgreSQL 17+ | Código DEA: OD01340701
-- ============================================================================

-- 1. BITÁCORA INMUTABLE DE CAMBIOS DE PERFIL (SIN PII EN TEXTO PLANO)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profile_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  actor_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  action TEXT NOT NULL CHECK (
    action IN (
      'profile_contact_updated',
      'avatar_updated',
      'avatar_removed'
    )
  ),
  changed_fields TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profile_audit_logs_user_created
  ON public.profile_audit_logs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_profile_audit_logs_actor
  ON public.profile_audit_logs (actor_user_id);

DROP TRIGGER IF EXISTS trg_profile_audit_logs_immutable ON public.profile_audit_logs;
CREATE TRIGGER trg_profile_audit_logs_immutable
  BEFORE UPDATE OR DELETE ON public.profile_audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION siga_internal.prevent_audit_tamper();

ALTER TABLE public.profile_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pol_profile_audit_logs_select ON public.profile_audit_logs;
CREATE POLICY pol_profile_audit_logs_select
  ON public.profile_audit_logs
  FOR SELECT
  TO authenticated
  USING (
    user_id = (select siga_internal.current_user_id())
    OR (select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios']))
  );

REVOKE ALL ON TABLE public.profile_audit_logs FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.profile_audit_logs TO authenticated;
GRANT ALL ON TABLE public.profile_audit_logs TO service_role;

-- 2. RPC PROTEGIDO: ACTUALIZAR CONTACTO Y EMERGENCIA DEL ESTUDIANTE
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.siga_actualizar_perfil_estudiante(
  p_phone TEXT DEFAULT NULL,
  p_recovery_email TEXT DEFAULT NULL,
  p_emergency_contact_name TEXT DEFAULT NULL,
  p_emergency_contact_cedula TEXT DEFAULT NULL,
  p_emergency_contact_phone TEXT DEFAULT NULL,
  p_emergency_contact_relationship TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor_id UUID := siga_internal.current_user_id();
  v_user RECORD;
  v_enrollment RECORD;
  v_clean_phone TEXT := NULLIF(trim(COALESCE(p_phone, '')), '');
  v_clean_recovery TEXT := NULLIF(lower(trim(COALESCE(p_recovery_email, ''))), '');
  v_clean_emg_name TEXT := NULLIF(trim(COALESCE(p_emergency_contact_name, '')), '');
  v_clean_emg_cedula TEXT := NULLIF(regexp_replace(upper(COALESCE(p_emergency_contact_cedula, '')), '[^VEJ0-9]', '', 'g'), '');
  v_clean_emg_phone TEXT := NULLIF(trim(COALESCE(p_emergency_contact_phone, '')), '');
  v_clean_emg_rel TEXT := NULLIF(trim(COALESCE(p_emergency_contact_relationship, '')), '');
  v_changed TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Sesión institucional requerida' USING ERRCODE = '42501';
  END IF;

  SELECT u.id, u.institutional_email, u.recovery_email, u.phone, u.access_tier
    INTO v_user
    FROM public.users u
   WHERE u.id = v_actor_id
     AND u.is_active = true
     AND u.deleted_at IS NULL;

  IF NOT FOUND OR v_user.access_tier = 'suspended' THEN
    RAISE EXCEPTION 'Tu cuenta institucional no se encuentra habilitada para esta operación'
      USING ERRCODE = '42501';
  END IF;

  IF v_clean_phone IS NOT NULL AND (length(v_clean_phone) < 7 OR length(v_clean_phone) > 24 OR v_clean_phone !~ '^[+0-9()\-\s]+$') THEN
    RAISE EXCEPTION 'Ingresa un número de teléfono válido (7 a 24 caracteres)'
      USING ERRCODE = '22023';
  END IF;

  IF v_clean_recovery IS NOT NULL THEN
    IF v_clean_recovery !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(v_clean_recovery) > 160 THEN
      RAISE EXCEPTION 'Ingresa un correo de recuperación válido'
        USING ERRCODE = '22023';
    END IF;
    IF v_clean_recovery ~* '@etcandresbello\.org$' OR (v_user.institutional_email IS NOT NULL AND lower(v_user.institutional_email) = v_clean_recovery) THEN
      RAISE EXCEPTION 'El correo de recuperación debe ser personal y distinto a @etcandresbello.org'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  IF v_clean_emg_cedula IS NOT NULL THEN
    IF v_clean_emg_cedula ~ '^[0-9]{6,9}$' THEN
      v_clean_emg_cedula := 'V' || v_clean_emg_cedula;
    END IF;
    IF v_clean_emg_cedula !~ '^[VEJ][0-9]{6,9}$' THEN
      RAISE EXCEPTION 'La cédula del contacto de emergencia debe tener formato válido (ej. V-12345678)'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  IF v_clean_emg_name IS NOT NULL AND (length(v_clean_emg_name) < 3 OR length(v_clean_emg_name) > 120) THEN
    RAISE EXCEPTION 'El nombre del contacto de emergencia debe tener entre 3 y 120 caracteres'
      USING ERRCODE = '22023';
  END IF;

  IF v_clean_emg_phone IS NOT NULL AND (length(v_clean_emg_phone) < 7 OR length(v_clean_emg_phone) > 24 OR v_clean_emg_phone !~ '^[+0-9()\-\s]+$') THEN
    RAISE EXCEPTION 'Ingresa un teléfono válido para el contacto de emergencia'
      USING ERRCODE = '22023';
  END IF;

  IF v_clean_emg_rel IS NOT NULL AND length(v_clean_emg_rel) > 60 THEN
    RAISE EXCEPTION 'El parentesco del contacto de emergencia es demasiado largo'
      USING ERRCODE = '22023';
  END IF;

  IF v_clean_phone IS DISTINCT FROM v_user.phone THEN
    v_changed := array_append(v_changed, 'phone');
  END IF;
  IF v_clean_recovery IS DISTINCT FROM v_user.recovery_email THEN
    v_changed := array_append(v_changed, 'recovery_email');
  END IF;

  PERFORM set_config('siga.internal_rpc', '1', true);

  UPDATE public.users
     SET phone = v_clean_phone,
         recovery_email = v_clean_recovery
   WHERE id = v_actor_id
     AND deleted_at IS NULL;

  SELECT e.id,
         e.emergency_contact_name,
         e.emergency_contact_cedula,
         e.emergency_contact_phone,
         e.emergency_contact_relationship
    INTO v_enrollment
    FROM public.enrollments e
    JOIN public.school_years sy ON sy.id = e.school_year_id
   WHERE e.student_user_id = v_actor_id
     AND e.deleted_at IS NULL
   ORDER BY sy.is_current DESC, e.created_at DESC
   LIMIT 1;

  IF FOUND THEN
    IF v_clean_emg_name IS DISTINCT FROM v_enrollment.emergency_contact_name
       OR v_clean_emg_cedula IS DISTINCT FROM v_enrollment.emergency_contact_cedula
       OR v_clean_emg_phone IS DISTINCT FROM v_enrollment.emergency_contact_phone
       OR v_clean_emg_rel IS DISTINCT FROM v_enrollment.emergency_contact_relationship THEN
      v_changed := array_append(v_changed, 'emergency_contact');

      UPDATE public.enrollments
         SET emergency_contact_name = v_clean_emg_name,
             emergency_contact_cedula = v_clean_emg_cedula,
             emergency_contact_phone = v_clean_emg_phone,
             emergency_contact_relationship = v_clean_emg_rel
       WHERE id = v_enrollment.id;
    END IF;
  END IF;

  IF array_length(v_changed, 1) > 0 THEN
    INSERT INTO public.profile_audit_logs (user_id, actor_user_id, action, changed_fields)
    VALUES (v_actor_id, v_actor_id, 'profile_contact_updated', v_changed);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'changed_fields', to_jsonb(v_changed),
    'phone', v_clean_phone,
    'recovery_email', v_clean_recovery,
    'emergency_contact', jsonb_build_object(
      'name', v_clean_emg_name,
      'cedula', v_clean_emg_cedula,
      'phone', v_clean_emg_phone,
      'relationship', v_clean_emg_rel
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.siga_actualizar_perfil_estudiante(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.siga_actualizar_perfil_estudiante(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

-- 3. RPC PROTEGIDO: ACTUALIZAR O QUITAR FOTO DE PERFIL / CARNET (.WEBP)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.siga_actualizar_avatar_estudiante(
  p_avatar_webp_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor_id UUID := siga_internal.current_user_id();
  v_auth_uid TEXT := auth.uid()::text;
  v_clean_url TEXT := NULLIF(trim(COALESCE(p_avatar_webp_url, '')), '');
  v_access_tier TEXT;
BEGIN
  IF v_actor_id IS NULL OR v_auth_uid IS NULL THEN
    RAISE EXCEPTION 'Sesión institucional requerida' USING ERRCODE = '42501';
  END IF;

  SELECT u.access_tier
    INTO v_access_tier
    FROM public.users u
   WHERE u.id = v_actor_id
     AND u.is_active = true
     AND u.deleted_at IS NULL;

  IF NOT FOUND OR v_access_tier = 'suspended' THEN
    RAISE EXCEPTION 'Tu cuenta institucional no se encuentra habilitada para esta operación'
      USING ERRCODE = '42501';
  END IF;

  IF v_clean_url IS NOT NULL THEN
    IF length(v_clean_url) > 512
       OR v_clean_url !~ ('^https://[a-z0-9.-]+/storage/v1/object/public/student-avatars/' || v_auth_uid || '/avatar\.webp(\?v=[0-9]{1,16})?$') THEN
      RAISE EXCEPTION 'La imagen de perfil no corresponde a una fotografía institucional válida en formato WebP'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  PERFORM set_config('siga.internal_rpc', '1', true);

  UPDATE public.users
     SET avatar_webp_url = v_clean_url
   WHERE id = v_actor_id
     AND deleted_at IS NULL;

  INSERT INTO public.profile_audit_logs (user_id, actor_user_id, action, changed_fields)
  VALUES (
    v_actor_id,
    v_actor_id,
    CASE WHEN v_clean_url IS NULL THEN 'avatar_removed' ELSE 'avatar_updated' END,
    ARRAY['avatar_webp_url']
  );

  RETURN jsonb_build_object(
    'success', true,
    'avatar_webp_url', v_clean_url
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.siga_actualizar_avatar_estudiante(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.siga_actualizar_avatar_estudiante(TEXT) TO authenticated, service_role;

-- 4. POLÍTICAS RLS EN STORAGE PARA EL BUCKET `student-avatars`
--    (Upsert en Storage requiere SELECT + INSERT + UPDATE sobre la carpeta del dueño)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS pol_student_avatars_select_own ON storage.objects;
CREATE POLICY pol_student_avatars_select_own
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'student-avatars'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

DROP POLICY IF EXISTS pol_student_avatars_insert_own ON storage.objects;
CREATE POLICY pol_student_avatars_insert_own
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'student-avatars'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

DROP POLICY IF EXISTS pol_student_avatars_update_own ON storage.objects;
CREATE POLICY pol_student_avatars_update_own
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'student-avatars'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'student-avatars'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

DROP POLICY IF EXISTS pol_student_avatars_delete_own ON storage.objects;
CREATE POLICY pol_student_avatars_delete_own
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'student-avatars'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Recargar caché de esquema en PostgREST
NOTIFY pgrst, 'reload schema';

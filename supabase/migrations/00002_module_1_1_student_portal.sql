-- ============================================================================
-- S.I.G.A. — Módulo 1.1: Portal del Estudiante, Horario, Simulador, Carnet QR
-- y Trámites Express (SOLO DDL — Cero INSERTs de datos/seeds/credenciales)
-- Motor: Supabase PostgreSQL 17+ | Código DEA: OD01340701
-- ============================================================================

-- 1. HELPERS BASE64URL EN `siga_internal` PARA FIRMA HMAC DE CARNET QR
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION siga_internal.base64url_encode(p_data BYTEA)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = pg_catalog
AS $$
  SELECT replace(
    replace(
      replace(rtrim(encode(p_data, 'base64'), '='), E'\n', ''),
      '+',
      '-'
    ),
    '/',
    '_'
  );
$$;

CREATE OR REPLACE FUNCTION siga_internal.base64url_decode(p_input TEXT)
RETURNS BYTEA
LANGUAGE plpgsql
IMMUTABLE
STRICT
SET search_path = pg_catalog
AS $$
DECLARE
  v_b64 TEXT := replace(replace(trim(p_input), '-', '+'), '_', '/');
  v_mod INTEGER := length(v_b64) % 4;
BEGIN
  IF v_mod = 2 THEN
    v_b64 := v_b64 || '==';
  ELSIF v_mod = 3 THEN
    v_b64 := v_b64 || '=';
  ELSIF v_mod = 1 THEN
    RAISE EXCEPTION 'Token Base64URL inválido' USING ERRCODE = '22023';
  END IF;

  RETURN decode(v_b64, 'base64');
END;
$$;

REVOKE ALL ON FUNCTION siga_internal.base64url_encode(BYTEA) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION siga_internal.base64url_encode(BYTEA) TO authenticated, service_role;

REVOKE ALL ON FUNCTION siga_internal.base64url_decode(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION siga_internal.base64url_decode(TEXT) TO authenticated, service_role;

-- 2. HORARIO ESCOLAR FIJO POR SECCIÓN (`section_schedules`)
-- ----------------------------------------------------------------------------
CREATE TABLE public.section_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_year_id UUID NOT NULL REFERENCES public.school_years(id) ON DELETE RESTRICT,
  section_id UUID NOT NULL REFERENCES public.sections(id) ON DELETE RESTRICT,
  teacher_assignment_id UUID NOT NULL REFERENCES public.teacher_assignments(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 5),
  block_label TEXT NOT NULL CHECK (length(trim(block_label)) >= 1),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  slot_range TSRANGE GENERATED ALWAYS AS (
    tsrange(
      (DATE '2000-01-03' + (day_of_week - 1)) + start_time,
      (DATE '2000-01-03' + (day_of_week - 1)) + end_time,
      '[)'
    )
  ) STORED,
  room_label TEXT NOT NULL DEFAULT 'Aula asignada' CHECK (length(trim(room_label)) >= 1),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_time > start_time),
  CHECK (start_time >= TIME '06:30:00' AND end_time <= TIME '18:00:00')
);

ALTER TABLE public.section_schedules
  ADD CONSTRAINT excl_section_schedules_no_overlap
  EXCLUDE USING gist (
    school_year_id WITH =,
    section_id WITH =,
    slot_range WITH &&
  )
  WHERE (is_active = true);

CREATE INDEX idx_section_schedules_section_day
  ON public.section_schedules(school_year_id, section_id, day_of_week, start_time)
  WHERE is_active = true;

CREATE INDEX idx_section_schedules_teacher_assignment
  ON public.section_schedules(teacher_assignment_id);

CREATE TRIGGER trg_section_schedules_updated_at
  BEFORE UPDATE ON public.section_schedules
  FOR EACH ROW
  WHEN (
    OLD.school_year_id IS DISTINCT FROM NEW.school_year_id
    OR OLD.section_id IS DISTINCT FROM NEW.section_id
    OR OLD.teacher_assignment_id IS DISTINCT FROM NEW.teacher_assignment_id
    OR OLD.day_of_week IS DISTINCT FROM NEW.day_of_week
    OR OLD.block_label IS DISTINCT FROM NEW.block_label
    OR OLD.start_time IS DISTINCT FROM NEW.start_time
    OR OLD.end_time IS DISTINCT FROM NEW.end_time
    OR OLD.room_label IS DISTINCT FROM NEW.room_label
    OR OLD.is_active IS DISTINCT FROM NEW.is_active
  )
  EXECUTE FUNCTION siga_internal.set_updated_at();

CREATE OR REPLACE FUNCTION siga_internal.validate_section_schedule_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_ta_school_year UUID;
  v_ta_section UUID;
  v_teacher_id UUID;
  v_ta_active BOOLEAN;
  v_new_range TSRANGE;
BEGIN
  SELECT ta.school_year_id, ta.section_id, ta.teacher_user_id, ta.is_active
    INTO v_ta_school_year, v_ta_section, v_teacher_id, v_ta_active
    FROM public.teacher_assignments ta
   WHERE ta.id = NEW.teacher_assignment_id;

  IF v_ta_school_year IS NULL OR NOT v_ta_active THEN
    RAISE EXCEPTION 'La asignación docente del horario no existe o está inactiva'
      USING ERRCODE = '22023';
  END IF;

  IF v_ta_school_year <> NEW.school_year_id OR v_ta_section <> NEW.section_id THEN
    RAISE EXCEPTION 'La asignación docente no corresponde al año escolar y sección indicados'
      USING ERRCODE = '22023';
  END IF;

  IF NEW.is_active THEN
    PERFORM pg_advisory_xact_lock(hashtext(NEW.section_id::text || ':' || NEW.day_of_week::text));
    PERFORM pg_advisory_xact_lock(hashtext(v_teacher_id::text || ':' || NEW.day_of_week::text));

    v_new_range := tsrange(
      (DATE '2000-01-03' + (NEW.day_of_week - 1)) + NEW.start_time,
      (DATE '2000-01-03' + (NEW.day_of_week - 1)) + NEW.end_time,
      '[)'
    );

    IF EXISTS (
      SELECT 1
        FROM public.section_schedules ss
        JOIN public.teacher_assignments ta ON ta.id = ss.teacher_assignment_id
       WHERE ss.id IS DISTINCT FROM NEW.id
         AND ss.school_year_id = NEW.school_year_id
         AND ss.is_active = true
         AND ta.teacher_user_id = v_teacher_id
         AND ss.slot_range && v_new_range
    ) THEN
      RAISE EXCEPTION 'El docente ya tiene otro bloque asignado en ese mismo horario'
        USING ERRCODE = '23P01';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION siga_internal.validate_section_schedule_consistency() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION siga_internal.validate_section_schedule_consistency() TO authenticated, service_role;

CREATE TRIGGER trg_section_schedules_consistency
  BEFORE INSERT OR UPDATE ON public.section_schedules
  FOR EACH ROW
  EXECUTE FUNCTION siga_internal.validate_section_schedule_consistency();

ALTER TABLE public.section_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_section_schedules_select ON public.section_schedules FOR SELECT TO authenticated
  USING (
    is_active = true AND (
      (select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios', 'orientacion']))
      OR (select siga_internal.teaches_assignment(teacher_assignment_id))
      OR EXISTS (
        SELECT 1
          FROM public.sections s
         WHERE s.id = section_schedules.section_id
           AND (select siga_internal.is_coord_of_mencion(s.mencion_id))
      )
      OR (
        (select siga_internal.is_verified_workspace())
        AND EXISTS (
          SELECT 1
            FROM public.enrollments e
           WHERE e.school_year_id = section_schedules.school_year_id
             AND e.section_id = section_schedules.section_id
             AND e.student_user_id = (select siga_internal.current_user_id())
             AND e.deleted_at IS NULL
        )
      )
    )
  );

CREATE POLICY pol_section_schedules_insert ON public.section_schedules FOR INSERT TO authenticated
  WITH CHECK (
    (select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios']))
    OR EXISTS (
      SELECT 1
        FROM public.sections s
       WHERE s.id = section_schedules.section_id
         AND (select siga_internal.is_coord_of_mencion(s.mencion_id))
    )
  );

CREATE POLICY pol_section_schedules_update ON public.section_schedules FOR UPDATE TO authenticated
  USING (
    (select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios']))
    OR EXISTS (
      SELECT 1
        FROM public.sections s
       WHERE s.id = section_schedules.section_id
         AND (select siga_internal.is_coord_of_mencion(s.mencion_id))
    )
  )
  WITH CHECK (
    (select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios']))
    OR EXISTS (
      SELECT 1
        FROM public.sections s
       WHERE s.id = section_schedules.section_id
         AND (select siga_internal.is_coord_of_mencion(s.mencion_id))
    )
  );

CREATE POLICY pol_section_schedules_delete ON public.section_schedules FOR DELETE TO authenticated
  USING (
    (select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios']))
    OR EXISTS (
      SELECT 1
        FROM public.sections s
       WHERE s.id = section_schedules.section_id
         AND (select siga_internal.is_coord_of_mencion(s.mencion_id))
    )
  );

REVOKE ALL ON TABLE public.section_schedules FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.section_schedules TO authenticated;
GRANT ALL ON TABLE public.section_schedules TO service_role;

-- 3. ENDURECIMIENTO DE SEGURIDAD Y RLS EN TABLAS EXISTENTES (00001)
-- ----------------------------------------------------------------------------

-- 3.1 Blindar columnas críticas de `public.users` frente a auto-edición directa
CREATE OR REPLACE FUNCTION siga_internal.guard_users_self_update()
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
     OR siga_internal.has_any_role(ARRAY['direccion', 'control_estudios']) THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id
     OR NEW.cedula IS DISTINCT FROM OLD.cedula
     OR NEW.first_name IS DISTINCT FROM OLD.first_name
     OR NEW.last_name IS DISTINCT FROM OLD.last_name
     OR NEW.institutional_email IS DISTINCT FROM OLD.institutional_email
     OR NEW.access_tier IS DISTINCT FROM OLD.access_tier
     OR NEW.workspace_verified_at IS DISTINCT FROM OLD.workspace_verified_at
     OR NEW.avatar_webp_url IS DISTINCT FROM OLD.avatar_webp_url
     OR NEW.qr_token_secret IS DISTINCT FROM OLD.qr_token_secret
     OR NEW.is_active IS DISTINCT FROM OLD.is_active
     OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
    RAISE EXCEPTION 'Solo Control de Estudios o Dirección puede modificar atributos de identidad o nivel de acceso'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION siga_internal.guard_users_self_update() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION siga_internal.guard_users_self_update() TO authenticated, service_role;

CREATE TRIGGER trg_users_guard_self_update
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION siga_internal.guard_users_self_update();

-- 3.2 Acotar lectura de `evaluation_items` al alumno matriculado en la sección
DROP POLICY IF EXISTS pol_eval_items_select ON public.evaluation_items;

CREATE POLICY pol_eval_items_select ON public.evaluation_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM public.evaluation_plans ep
        JOIN public.teacher_assignments ta ON ta.id = ep.teacher_assignment_id
        JOIN public.sections s ON s.id = ta.section_id
       WHERE ep.id = evaluation_items.evaluation_plan_id
         AND (
           (select siga_internal.teaches_assignment(ep.teacher_assignment_id))
           OR (select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios']))
           OR (select siga_internal.is_coord_of_mencion(s.mencion_id))
           OR (
             ep.status IN ('published', 'locked')
             AND (select siga_internal.is_verified_workspace())
             AND EXISTS (
               SELECT 1
                 FROM public.enrollments e
                WHERE e.section_id = ta.section_id
                  AND e.school_year_id = ta.school_year_id
                  AND e.student_user_id = (select siga_internal.current_user_id())
                  AND e.deleted_at IS NULL
             )
           )
         )
    )
  );

-- 3.3 Idempotencia, anti-duplicados y soporte `activacion_workspace` en `student_requests`
ALTER TABLE public.student_requests
  ALTER COLUMN enrollment_id DROP NOT NULL;

ALTER TABLE public.student_requests
  ADD COLUMN IF NOT EXISTS client_request_id UUID;

ALTER TABLE public.student_requests
  DROP CONSTRAINT IF EXISTS chk_student_requests_enrollment_required;

ALTER TABLE public.student_requests
  ADD CONSTRAINT chk_student_requests_enrollment_required
  CHECK (request_type = 'activacion_workspace' OR enrollment_id IS NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS uq_student_requests_client_request_id
  ON public.student_requests(client_request_id)
  WHERE client_request_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_student_requests_active_per_type
  ON public.student_requests(student_user_id, request_type)
  WHERE status IN ('pending', 'in_review');

DROP POLICY IF EXISTS pol_student_requests_insert ON public.student_requests;

CREATE POLICY pol_student_requests_insert ON public.student_requests FOR INSERT TO authenticated
  WITH CHECK (
    student_user_id = (select siga_internal.current_user_id())
    AND (
      (
        request_type = 'activacion_workspace'
        AND (
          enrollment_id IS NULL
          OR (select siga_internal.owns_enrollment(enrollment_id))
        )
      )
      OR (
        request_type <> 'activacion_workspace'
        AND (select siga_internal.is_verified_workspace())
        AND enrollment_id IS NOT NULL
        AND (select siga_internal.owns_enrollment(enrollment_id))
      )
    )
  );

CREATE POLICY pol_student_requests_delete ON public.student_requests FOR DELETE TO authenticated
  USING (
    (
      student_user_id = (select siga_internal.current_user_id())
      AND status = 'pending'
    )
    OR (select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios']))
  );

-- 4. RPCs PROTEGIDOS (`SECURITY DEFINER`) DEL MÓDULO 1.1 Y ONBOARDING
-- ----------------------------------------------------------------------------

-- 4.1 Generación de token QR temporal firmado con `users.qr_token_secret` (sin exponer secreto)
CREATE OR REPLACE FUNCTION public.siga_generar_token_carnet(
  p_ttl_seconds INTEGER DEFAULT 120
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_actor_id UUID := siga_internal.current_user_id();
  v_user RECORD;
  v_enrollment_id UUID;
  v_grade_year SMALLINT;
  v_enrollment_status TEXT;
  v_section_letter TEXT;
  v_mencion_code TEXT;
  v_mencion_name TEXT;
  v_school_year_code TEXT;
  v_school_year_name TEXT;
  v_ttl INTEGER;
  v_issued_at TIMESTAMPTZ := now();
  v_expires_at TIMESTAMPTZ;
  v_iat BIGINT;
  v_exp BIGINT;
  v_nonce TEXT;
  v_payload_json JSONB;
  v_payload_b64 TEXT;
  v_sig_b64 TEXT;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Sesión institucional requerida' USING ERRCODE = '42501';
  END IF;

  IF NOT (
    siga_internal.has_any_role(ARRAY['estudiante'])
    AND siga_internal.is_verified_workspace()
  ) THEN
    RAISE EXCEPTION 'El Carnet Digital QR requiere cuenta estudiantil verificada (@etcandresbello.org)'
      USING ERRCODE = '42501';
  END IF;

  SELECT u.id, u.cedula, u.first_name, u.last_name, u.institutional_email, u.avatar_webp_url, u.qr_token_secret
    INTO v_user
    FROM public.users u
   WHERE u.id = v_actor_id
     AND u.deleted_at IS NULL
     AND u.is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ficha de usuario no encontrada' USING ERRCODE = 'P0002';
  END IF;

  SELECT e.id,
         e.grade_year,
         e.enrollment_status,
         s.section_letter,
         m.code,
         m.name,
         sy.code,
         sy.name
    INTO v_enrollment_id,
         v_grade_year,
         v_enrollment_status,
         v_section_letter,
         v_mencion_code,
         v_mencion_name,
         v_school_year_code,
         v_school_year_name
    FROM public.enrollments e
    JOIN public.school_years sy ON sy.id = e.school_year_id
    JOIN public.sections s ON s.id = e.section_id
    JOIN public.menciones m ON m.id = e.mencion_id
   WHERE e.student_user_id = v_actor_id
     AND e.deleted_at IS NULL
   ORDER BY sy.is_current DESC, e.created_at DESC
   LIMIT 1;

  v_ttl := LEAST(GREATEST(COALESCE(p_ttl_seconds, 120), 60), 300);
  v_expires_at := v_issued_at + make_interval(secs => v_ttl);
  v_iat := floor(extract(epoch FROM v_issued_at))::BIGINT;
  v_exp := v_iat + v_ttl;
  v_nonce := encode(extensions.gen_random_bytes(8), 'hex');

  v_payload_json := jsonb_build_object(
    'v', 1,
    'uid', v_user.id,
    'eid', v_enrollment_id,
    'iat', v_iat,
    'exp', v_exp,
    'jti', v_nonce
  );

  v_payload_b64 := siga_internal.base64url_encode(convert_to(v_payload_json::text, 'UTF8'));
  v_sig_b64 := siga_internal.base64url_encode(
    extensions.hmac(
      convert_to(v_payload_b64, 'UTF8'),
      convert_to(v_user.qr_token_secret::text, 'UTF8'),
      'sha256'
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'token', 'SIGAQR1.' || v_payload_b64 || '.' || v_sig_b64,
    'issued_at', v_issued_at,
    'expires_at', v_expires_at,
    'ttl_seconds', v_ttl,
    'card', jsonb_build_object(
      'full_name', trim(v_user.first_name || ' ' || v_user.last_name),
      'cedula', v_user.cedula,
      'institutional_email', v_user.institutional_email,
      'avatar_webp_url', v_user.avatar_webp_url,
      'grade_year', v_grade_year,
      'section_letter', v_section_letter,
      'mencion_code', v_mencion_code,
      'mencion_name', v_mencion_name,
      'school_year_code', v_school_year_code,
      'school_year_name', v_school_year_name,
      'enrollment_status', v_enrollment_status
    )
  );
END;
$$;

-- 4.2 Verificación criptográfica de token Carnet QR para escáner interno (Biblioteca / Docentes / Control)
CREATE OR REPLACE FUNCTION public.siga_verificar_token_carnet(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_actor_id UUID := siga_internal.current_user_id();
  v_parts TEXT[];
  v_payload_json JSONB;
  v_uid UUID;
  v_exp BIGINT;
  v_now_epoch BIGINT := floor(extract(epoch FROM now()))::BIGINT;
  v_user RECORD;
  v_expected_sig TEXT;
  v_grade_year SMALLINT;
  v_enrollment_status TEXT;
  v_section_letter TEXT;
  v_mencion_name TEXT;
  v_school_year_name TEXT;
BEGIN
  IF v_actor_id IS NULL OR NOT siga_internal.has_any_role(
    ARRAY['docente', 'biblioteca', 'control_estudios', 'direccion', 'coordinador_mencion', 'orientacion', 'coordinador_pasantias']
  ) THEN
    RAISE EXCEPTION 'Solo personal institucional autorizado puede validar carnets QR'
      USING ERRCODE = '42501';
  END IF;

  IF p_token IS NULL OR p_token !~ '^SIGAQR1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$' THEN
    RETURN jsonb_build_object('valid', false, 'status', 'invalid_format');
  END IF;

  v_parts := string_to_array(p_token, '.');

  BEGIN
    v_payload_json := convert_from(siga_internal.base64url_decode(v_parts[2]), 'UTF8')::jsonb;
    v_uid := (v_payload_json ->> 'uid')::UUID;
    v_exp := (v_payload_json ->> 'exp')::BIGINT;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('valid', false, 'status', 'malformed_payload');
  END;

  IF v_uid IS NULL OR v_exp IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'status', 'malformed_payload');
  END IF;

  SELECT u.id, u.cedula, u.first_name, u.last_name, u.institutional_email,
         u.avatar_webp_url, u.qr_token_secret, u.access_tier, u.is_active
    INTO v_user
    FROM public.users u
   WHERE u.id = v_uid
     AND u.deleted_at IS NULL;

  IF NOT FOUND OR NOT v_user.is_active OR v_user.access_tier <> 'verified_workspace' THEN
    RETURN jsonb_build_object('valid', false, 'status', 'user_inactive');
  END IF;

  v_expected_sig := siga_internal.base64url_encode(
    extensions.hmac(
      convert_to(v_parts[2], 'UTF8'),
      convert_to(v_user.qr_token_secret::text, 'UTF8'),
      'sha256'
    )
  );

  IF extensions.digest(convert_to(v_expected_sig, 'UTF8'), 'sha256')
     IS DISTINCT FROM extensions.digest(convert_to(v_parts[3], 'UTF8'), 'sha256') THEN
    RETURN jsonb_build_object('valid', false, 'status', 'invalid_signature');
  END IF;

  IF v_exp < v_now_epoch THEN
    RETURN jsonb_build_object('valid', false, 'status', 'expired');
  END IF;

  SELECT e.grade_year,
         e.enrollment_status,
         s.section_letter,
         m.name,
         sy.name
    INTO v_grade_year,
         v_enrollment_status,
         v_section_letter,
         v_mencion_name,
         v_school_year_name
    FROM public.enrollments e
    JOIN public.school_years sy ON sy.id = e.school_year_id
    JOIN public.sections s ON s.id = e.section_id
    JOIN public.menciones m ON m.id = e.mencion_id
   WHERE e.student_user_id = v_user.id
     AND e.deleted_at IS NULL
   ORDER BY sy.is_current DESC, e.created_at DESC
   LIMIT 1;

  RETURN jsonb_build_object(
    'valid', true,
    'status', 'active',
    'expires_at', to_timestamp(v_exp),
    'student', jsonb_build_object(
      'id', v_user.id,
      'full_name', trim(v_user.first_name || ' ' || v_user.last_name),
      'cedula', v_user.cedula,
      'avatar_webp_url', v_user.avatar_webp_url,
      'grade_year', v_grade_year,
      'section_letter', v_section_letter,
      'mencion_name', v_mencion_name,
      'school_year_name', v_school_year_name,
      'enrollment_status', v_enrollment_status
    )
  );
END;
$$;

-- 4.3 Actualización segura del correo secundario de recuperación (habilitada en provisional y verified)
CREATE OR REPLACE FUNCTION public.siga_actualizar_correo_recuperacion(
  p_recovery_email TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor_id UUID := siga_internal.current_user_id();
  v_clean_email TEXT := lower(trim(COALESCE(p_recovery_email, '')));
  v_institutional_email TEXT;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Sesión institucional requerida' USING ERRCODE = '42501';
  END IF;

  IF v_clean_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Ingresa un correo de recuperación válido' USING ERRCODE = '22023';
  END IF;

  SELECT u.institutional_email
    INTO v_institutional_email
    FROM public.users u
   WHERE u.id = v_actor_id
     AND u.deleted_at IS NULL;

  IF v_institutional_email IS NOT NULL AND lower(v_institutional_email) = v_clean_email THEN
    RAISE EXCEPTION 'El correo de recuperación debe ser distinto a tu correo @etcandresbello.org'
      USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('siga.internal_rpc', '1', true);

  UPDATE public.users
     SET recovery_email = v_clean_email
   WHERE id = v_actor_id
     AND deleted_at IS NULL;

  RETURN jsonb_build_object(
    'success', true,
    'recovery_email', v_clean_email
  );
END;
$$;

-- 4.4 Creación idempotente de Trámites Express / Solicitud de Activación Workspace
CREATE OR REPLACE FUNCTION public.siga_crear_solicitud_estudiante(
  p_request_type TEXT,
  p_reason TEXT DEFAULT NULL,
  p_client_request_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor_id UUID := siga_internal.current_user_id();
  v_enrollment_id UUID;
  v_clean_reason TEXT := NULLIF(trim(COALESCE(p_reason, '')), '');
  v_existing RECORD;
  v_created RECORD;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Sesión institucional requerida' USING ERRCODE = '42501';
  END IF;

  IF NOT siga_internal.has_any_role(ARRAY['estudiante']) THEN
    RAISE EXCEPTION 'Solo los estudiantes pueden generar trámites estudiantiles'
      USING ERRCODE = '42501';
  END IF;

  IF p_request_type IS NULL OR p_request_type NOT IN (
    'constancia_estudio',
    'constancia_inscripcion',
    'solvencia',
    'revision_notas',
    'activacion_workspace'
  ) THEN
    RAISE EXCEPTION 'Tipo de trámite no permitido' USING ERRCODE = '22023';
  END IF;

  IF p_request_type <> 'activacion_workspace' AND NOT siga_internal.is_verified_workspace() THEN
    RAISE EXCEPTION 'Activa primero tu cuenta @etcandresbello.org para solicitar constancias o revisiones académicas'
      USING ERRCODE = '42501';
  END IF;

  IF p_client_request_id IS NOT NULL THEN
    SELECT sr.id, sr.request_type, sr.status, sr.reason, sr.created_at
      INTO v_existing
      FROM public.student_requests sr
     WHERE sr.client_request_id = p_client_request_id
       AND sr.student_user_id = v_actor_id;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true,
        'idempotent', true,
        'request', row_to_json(v_existing)
      );
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.student_requests sr
     WHERE sr.student_user_id = v_actor_id
       AND sr.request_type = p_request_type
       AND sr.status IN ('pending', 'in_review')
  ) THEN
    RAISE EXCEPTION 'Ya tienes una solicitud activa de este mismo tipo en proceso'
      USING ERRCODE = '23505';
  END IF;

  SELECT e.id
    INTO v_enrollment_id
    FROM public.enrollments e
    JOIN public.school_years sy ON sy.id = e.school_year_id
   WHERE e.student_user_id = v_actor_id
     AND e.deleted_at IS NULL
   ORDER BY sy.is_current DESC, e.created_at DESC
   LIMIT 1;

  IF p_request_type <> 'activacion_workspace' AND v_enrollment_id IS NULL THEN
    RAISE EXCEPTION 'Debes contar con una matrícula activa para emitir solicitudes académicas'
      USING ERRCODE = '22023';
  END IF;

  IF p_request_type = 'revision_notas' AND (v_clean_reason IS NULL OR length(v_clean_reason) < 10) THEN
    RAISE EXCEPTION 'Indica el motivo y la asignatura de la revisión (mínimo 10 caracteres)'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.student_requests (
    student_user_id,
    enrollment_id,
    request_type,
    reason,
    client_request_id
  )
  VALUES (
    v_actor_id,
    v_enrollment_id,
    p_request_type,
    v_clean_reason,
    p_client_request_id
  )
  RETURNING id, request_type, status, reason, sla_entered_at, created_at
    INTO v_created;

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'request', row_to_json(v_created)
  );
END;
$$;

-- 4.5 Cancelación de solicitud propia mientras continúe en estado `pending`
CREATE OR REPLACE FUNCTION public.siga_cancelar_solicitud_estudiante(
  p_request_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor_id UUID := siga_internal.current_user_id();
  v_deleted_id UUID;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Sesión institucional requerida' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.student_requests sr
   WHERE sr.id = p_request_id
     AND sr.student_user_id = v_actor_id
     AND sr.status = 'pending'
  RETURNING sr.id INTO v_deleted_id;

  IF v_deleted_id IS NULL THEN
    RAISE EXCEPTION 'Solo puedes cancelar solicitudes propias que sigan en estado pendiente'
      USING ERRCODE = 'P0002';
  END IF;

  RETURN jsonb_build_object('success', true, 'cancelled_id', v_deleted_id);
END;
$$;

-- 4.6 Horario escolar fijo de la sección del estudiante (sin exponer PII docente)
CREATE OR REPLACE FUNCTION public.siga_get_student_section_schedule()
RETURNS TABLE (
  id UUID,
  day_of_week SMALLINT,
  block_label TEXT,
  start_time TIME,
  end_time TIME,
  room_label TEXT,
  subject_code TEXT,
  subject_name TEXT,
  teacher_name TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor_id UUID := siga_internal.current_user_id();
  v_school_year_id UUID;
  v_section_id UUID;
BEGIN
  IF v_actor_id IS NULL OR NOT siga_internal.is_verified_workspace() THEN
    RETURN;
  END IF;

  SELECT e.school_year_id, e.section_id
    INTO v_school_year_id, v_section_id
    FROM public.enrollments e
    JOIN public.school_years sy ON sy.id = e.school_year_id
   WHERE e.student_user_id = v_actor_id
     AND e.deleted_at IS NULL
     AND sy.is_current = true
   ORDER BY e.created_at DESC
   LIMIT 1;

  IF v_section_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT ss.id,
         ss.day_of_week,
         ss.block_label,
         ss.start_time,
         ss.end_time,
         ss.room_label,
         sub.code AS subject_code,
         sub.name AS subject_name,
         trim(u.first_name || ' ' || u.last_name) AS teacher_name
    FROM public.section_schedules ss
    JOIN public.teacher_assignments ta ON ta.id = ss.teacher_assignment_id
    JOIN public.curriculum_subjects cs ON cs.id = ta.curriculum_subject_id
    JOIN public.subjects sub ON sub.id = cs.subject_id
    JOIN public.users u ON u.id = ta.teacher_user_id
   WHERE ss.school_year_id = v_school_year_id
     AND ss.section_id = v_section_id
     AND ss.is_active = true
     AND ta.is_active = true
     AND u.deleted_at IS NULL
   ORDER BY ss.day_of_week ASC, ss.start_time ASC;
END;
$$;

-- Permisos explícitos sobre los nuevos RPCs
REVOKE EXECUTE ON FUNCTION public.siga_generar_token_carnet(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.siga_generar_token_carnet(INTEGER) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.siga_verificar_token_carnet(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.siga_verificar_token_carnet(TEXT) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.siga_actualizar_correo_recuperacion(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.siga_actualizar_correo_recuperacion(TEXT) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.siga_crear_solicitud_estudiante(TEXT, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.siga_crear_solicitud_estudiante(TEXT, TEXT, UUID) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.siga_cancelar_solicitud_estudiante(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.siga_cancelar_solicitud_estudiante(UUID) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.siga_get_student_section_schedule() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.siga_get_student_section_schedule() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

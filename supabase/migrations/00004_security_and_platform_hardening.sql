-- ============================================================================
-- S.I.G.A. — Migración 00003: Hardening de Seguridad, Re-emisión Criptográfica
-- de Carnet QR, RLS Estricto por Sección, Bloqueo por Fecha Límite, Bitácora
-- con IP Hash, Cifrado PGP en Orientación, Anti-Duplicados y Magic Links
-- (SOLO DDL — Cero INSERTs de datos/catálogos/credenciales)
-- Motor: Supabase PostgreSQL 17+ | Código DEA: OD01340701
-- ============================================================================

-- 1. HELPER DE HASH DE IP DE ORIGEN EN POSTGREST Y VALIDACIÓN DE SECCIÓN
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION siga_internal.current_request_ip_hash()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_headers_raw TEXT;
  v_headers JSONB;
  v_forwarded TEXT;
  v_raw_ip TEXT;
BEGIN
  v_headers_raw := current_setting('request.headers', true);
  IF v_headers_raw IS NULL OR length(trim(v_headers_raw)) = 0 THEN
    RETURN NULL;
  END IF;

  BEGIN
    v_headers := v_headers_raw::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;

  v_forwarded := coalesce(
    v_headers ->> 'x-forwarded-for',
    v_headers ->> 'cf-connecting-ip',
    v_headers ->> 'x-real-ip'
  );

  IF v_forwarded IS NULL OR length(trim(v_forwarded)) = 0 THEN
    RETURN NULL;
  END IF;

  v_raw_ip := trim(split_part(v_forwarded, ',', 1));
  IF length(v_raw_ip) = 0 THEN
    RETURN NULL;
  END IF;

  RETURN 'sha256:' || encode(
    extensions.digest(convert_to('siga-ip-v1:' || v_raw_ip, 'UTF8'), 'sha256'),
    'hex'
  );
END;
$$;

REVOKE ALL ON FUNCTION siga_internal.current_request_ip_hash() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION siga_internal.current_request_ip_hash() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION siga_internal.is_student_in_teacher_assignment(p_teacher_assignment_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.teacher_assignments ta
      JOIN public.enrollments e
        ON e.section_id = ta.section_id
       AND e.school_year_id = ta.school_year_id
     WHERE ta.id = p_teacher_assignment_id
       AND e.student_user_id = siga_internal.current_user_id()
       AND e.enrollment_status = 'active'
       AND e.deleted_at IS NULL
  );
$$;

REVOKE ALL ON FUNCTION siga_internal.is_student_in_teacher_assignment(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION siga_internal.is_student_in_teacher_assignment(UUID) TO authenticated, service_role;

-- 2. RE-EMISIÓN CRIPTOGRÁFICA DEL TOKEN QR DE CARNET (INVALIDACIÓN DE ANTERIORES)
-- ----------------------------------------------------------------------------
-- Cada vez que se re-emite el token del Carnet Digital QR, se rota
-- `users.qr_token_secret` para invalidar inmediatamente cualquier token previo.
CREATE OR REPLACE FUNCTION public.siga_generar_token_carnet(
  p_ttl_seconds INTEGER DEFAULT 120
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
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

  -- Re-emisión real: rota `qr_token_secret` en el acto para revocar cualquier QR anterior
  UPDATE public.users u
     SET qr_token_secret = extensions.gen_random_uuid()
   WHERE u.id = v_actor_id
     AND u.deleted_at IS NULL
     AND u.is_active = true
  RETURNING u.id, u.cedula, u.first_name, u.last_name, u.institutional_email, u.avatar_webp_url, u.qr_token_secret
    INTO v_user;

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
    'reissued', true,
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

REVOKE EXECUTE ON FUNCTION public.siga_generar_token_carnet(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.siga_generar_token_carnet(INTEGER) TO authenticated, service_role;

-- 3. ENDURECIMIENTO RLS EN PLANES DE EVALUACIÓN Y AULA VIRTUAL UNIFICADA
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS pol_eval_items_select ON public.evaluation_items;
CREATE POLICY pol_eval_items_select ON public.evaluation_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM public.evaluation_plans ep
        JOIN public.teacher_assignments ta ON ta.id = ep.teacher_assignment_id
        JOIN public.sections s ON s.id = ta.section_id
       WHERE ep.id = evaluation_items.evaluation_plan_id
         AND (
           (SELECT siga_internal.teaches_assignment(ep.teacher_assignment_id))
           OR (SELECT siga_internal.has_any_role(ARRAY['direccion', 'control_estudios']))
           OR (SELECT siga_internal.is_coord_of_mencion(s.mencion_id))
           OR (
             ep.status IN ('published', 'locked')
             AND (SELECT siga_internal.is_verified_workspace())
             AND (SELECT siga_internal.is_student_in_teacher_assignment(ep.teacher_assignment_id))
           )
         )
    )
  );

DROP POLICY IF EXISTS pol_course_modules_select ON public.course_modules;
CREATE POLICY pol_course_modules_select ON public.course_modules
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM public.virtual_courses vc
        JOIN public.teacher_assignments ta ON ta.id = vc.teacher_assignment_id
        JOIN public.sections s ON s.id = ta.section_id
       WHERE vc.id = course_modules.virtual_course_id
         AND (
           (SELECT siga_internal.teaches_assignment(vc.teacher_assignment_id))
           OR (SELECT siga_internal.has_any_role(ARRAY['direccion', 'control_estudios']))
           OR (SELECT siga_internal.is_coord_of_mencion(s.mencion_id))
           OR (
             vc.is_published = true
             AND course_modules.is_visible = true
             AND (SELECT siga_internal.is_verified_workspace())
             AND (SELECT siga_internal.is_student_in_teacher_assignment(vc.teacher_assignment_id))
           )
         )
    )
  );

DROP POLICY IF EXISTS pol_course_materials_select ON public.course_materials;
CREATE POLICY pol_course_materials_select ON public.course_materials
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM public.course_modules cm
        JOIN public.virtual_courses vc ON vc.id = cm.virtual_course_id
        JOIN public.teacher_assignments ta ON ta.id = vc.teacher_assignment_id
        JOIN public.sections s ON s.id = ta.section_id
       WHERE cm.id = course_materials.course_module_id
         AND (
           (SELECT siga_internal.teaches_assignment(vc.teacher_assignment_id))
           OR (SELECT siga_internal.has_any_role(ARRAY['direccion', 'control_estudios']))
           OR (SELECT siga_internal.is_coord_of_mencion(s.mencion_id))
           OR (
             vc.is_published = true
             AND cm.is_visible = true
             AND (SELECT siga_internal.is_verified_workspace())
             AND (SELECT siga_internal.is_student_in_teacher_assignment(vc.teacher_assignment_id))
           )
         )
    )
  );

DROP POLICY IF EXISTS pol_assignments_select ON public.assignments;
CREATE POLICY pol_assignments_select ON public.assignments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM public.course_modules cm
        JOIN public.virtual_courses vc ON vc.id = cm.virtual_course_id
        JOIN public.teacher_assignments ta ON ta.id = vc.teacher_assignment_id
        JOIN public.sections s ON s.id = ta.section_id
       WHERE cm.id = assignments.course_module_id
         AND (
           (SELECT siga_internal.teaches_assignment(vc.teacher_assignment_id))
           OR (SELECT siga_internal.has_any_role(ARRAY['direccion', 'control_estudios']))
           OR (SELECT siga_internal.is_coord_of_mencion(s.mencion_id))
           OR (
             vc.is_published = true
             AND cm.is_visible = true
             AND (SELECT siga_internal.is_verified_workspace())
             AND (SELECT siga_internal.is_student_in_teacher_assignment(vc.teacher_assignment_id))
           )
         )
    )
  );

DROP POLICY IF EXISTS pol_online_exams_select ON public.online_exams;
CREATE POLICY pol_online_exams_select ON public.online_exams
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM public.virtual_courses vc
        JOIN public.teacher_assignments ta ON ta.id = vc.teacher_assignment_id
        JOIN public.sections s ON s.id = ta.section_id
       WHERE vc.id = online_exams.virtual_course_id
         AND (
           (SELECT siga_internal.teaches_assignment(vc.teacher_assignment_id))
           OR (SELECT siga_internal.has_any_role(ARRAY['direccion', 'control_estudios']))
           OR (SELECT siga_internal.is_coord_of_mencion(s.mencion_id))
           OR (
             vc.is_published = true
             AND (SELECT siga_internal.is_verified_workspace())
             AND (SELECT siga_internal.is_student_in_teacher_assignment(vc.teacher_assignment_id))
           )
         )
    )
  );

-- 4. BLOQUEO AUTOMÁTICO FUERA DE FECHA LÍMITE Y BITÁCORA CON IP HASH
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.siga_registrar_nota(
  p_evaluation_item_id UUID,
  p_enrollment_id UUID,
  p_numeric_score NUMERIC DEFAULT NULL,
  p_literal_grade TEXT DEFAULT NULL,
  p_source TEXT DEFAULT 'manual',
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor_id UUID := siga_internal.current_user_id();
  v_plan_id UUID;
  v_assignment_id UUID;
  v_momento_id UUID;
  v_moment_status TEXT;
  v_open_at TIMESTAMPTZ;
  v_close_at TIMESTAMPTZ;
  v_curr_subject_id UUID;
  v_grading_scale TEXT;
  v_prev_score JSONB;
  v_score_id UUID;
  v_weighted_avg NUMERIC(5,2);
  v_final_numeric SMALLINT;
  v_reopened_until TIMESTAMPTZ;
  v_ip_hash TEXT := siga_internal.current_request_ip_hash();
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Sesión institucional requerida' USING ERRCODE = '42501';
  END IF;

  SELECT ei.evaluation_plan_id,
         ep.teacher_assignment_id,
         ep.momento_id,
         m.status,
         m.grade_entry_open_at,
         m.grade_entry_close_at,
         ta.curriculum_subject_id,
         s.grading_scale
    INTO v_plan_id,
         v_assignment_id,
         v_momento_id,
         v_moment_status,
         v_open_at,
         v_close_at,
         v_curr_subject_id,
         v_grading_scale
    FROM public.evaluation_items ei
    JOIN public.evaluation_plans ep ON ep.id = ei.evaluation_plan_id
    JOIN public.momentos m ON m.id = ep.momento_id
    JOIN public.teacher_assignments ta ON ta.id = ep.teacher_assignment_id
    JOIN public.curriculum_subjects cs ON cs.id = ta.curriculum_subject_id
    JOIN public.subjects s ON s.id = cs.subject_id
   WHERE ei.id = p_evaluation_item_id;

  IF v_assignment_id IS NULL THEN
    RAISE EXCEPTION 'Ítem de evaluación inexistente' USING ERRCODE = 'P0002';
  END IF;

  IF NOT (
    siga_internal.teaches_assignment(v_assignment_id)
    OR siga_internal.has_any_role(ARRAY['control_estudios', 'direccion'])
  ) THEN
    RAISE EXCEPTION 'No autorizado para calificar esta sección' USING ERRCODE = '42501';
  END IF;

  SELECT mfg.reopened_until
    INTO v_reopened_until
    FROM public.moment_final_grades mfg
   WHERE mfg.enrollment_id = p_enrollment_id
     AND mfg.curriculum_subject_id = v_curr_subject_id
     AND mfg.momento_id = v_momento_id;

  -- Bloqueo fuera de fecha límite (tanto por estado del Momento como por ventana horaria)
  IF (
    v_moment_status <> 'open'
    OR (v_open_at IS NOT NULL AND now() < v_open_at)
    OR (v_close_at IS NOT NULL AND now() > v_close_at)
  ) AND NOT (
    siga_internal.has_any_role(ARRAY['control_estudios', 'direccion'])
    OR (v_reopened_until IS NOT NULL AND v_reopened_until > now())
  ) THEN
    RAISE EXCEPTION 'La ventana de carga de notas para este Momento Pedagógico se encuentra cerrada'
      USING ERRCODE = '42501';
  END IF;

  IF v_grading_scale = 'NUMERIC_1_20' THEN
    IF p_numeric_score IS NULL OR p_numeric_score < 1 OR p_numeric_score > 20 THEN
      RAISE EXCEPTION 'Calificación fuera de rango reglamentario MPPE (1-20)' USING ERRCODE = '22023';
    END IF;
  ELSE
    IF p_literal_grade IS NULL OR p_literal_grade NOT IN ('A', 'B', 'C', 'D', 'E') THEN
      RAISE EXCEPTION 'Literal fuera de rango reglamentario MPPE (A-E)' USING ERRCODE = '22023';
    END IF;
  END IF;

  SELECT jsonb_build_object('numeric_score', ss.numeric_score, 'literal_grade', ss.literal_grade)
    INTO v_prev_score
    FROM public.student_scores ss
   WHERE ss.evaluation_item_id = p_evaluation_item_id
     AND ss.enrollment_id = p_enrollment_id
     AND ss.deleted_at IS NULL;

  INSERT INTO public.student_scores (
    evaluation_item_id, enrollment_id, numeric_score, literal_grade, source, recorded_by
  )
  VALUES (
    p_evaluation_item_id, p_enrollment_id, p_numeric_score, p_literal_grade, COALESCE(p_source, 'manual'), v_actor_id
  )
  ON CONFLICT (evaluation_item_id, enrollment_id) WHERE deleted_at IS NULL
  DO UPDATE SET
    numeric_score = EXCLUDED.numeric_score,
    literal_grade = EXCLUDED.literal_grade,
    source = EXCLUDED.source,
    recorded_by = EXCLUDED.recorded_by,
    updated_at = now()
  RETURNING id INTO v_score_id;

  INSERT INTO public.grade_audit_logs (
    target_table,
    target_record_id,
    enrollment_id,
    actor_user_id,
    action,
    previous_value,
    new_value,
    reason,
    ip_hash
  )
  VALUES (
    'student_scores',
    v_score_id,
    p_enrollment_id,
    v_actor_id,
    CASE WHEN v_prev_score IS NULL THEN 'insert' ELSE 'update' END,
    v_prev_score,
    jsonb_build_object(
      'numeric_score', p_numeric_score,
      'literal_grade', p_literal_grade,
      'source', p_source,
      'recorded_at', now()
    ),
    p_reason,
    v_ip_hash
  );

  IF v_grading_scale = 'NUMERIC_1_20' THEN
    SELECT ROUND(SUM(COALESCE(ss.numeric_score, 0) * ei.weight_percent / 100.0), 2)
      INTO v_weighted_avg
      FROM public.evaluation_items ei
      LEFT JOIN public.student_scores ss
        ON ss.evaluation_item_id = ei.id
       AND ss.enrollment_id = p_enrollment_id
       AND ss.deleted_at IS NULL
     WHERE ei.evaluation_plan_id = v_plan_id;

    v_final_numeric := GREATEST(1, LEAST(20, ROUND(COALESCE(v_weighted_avg, 1))::SMALLINT));

    INSERT INTO public.moment_final_grades (
      enrollment_id, curriculum_subject_id, momento_id, raw_weighted_avg, final_numeric, approved_by
    )
    VALUES (
      p_enrollment_id, v_curr_subject_id, v_momento_id, v_weighted_avg, v_final_numeric, v_actor_id
    )
    ON CONFLICT (enrollment_id, curriculum_subject_id, momento_id)
    DO UPDATE SET
      raw_weighted_avg = EXCLUDED.raw_weighted_avg,
      final_numeric = EXCLUDED.final_numeric,
      approved_by = EXCLUDED.approved_by,
      updated_at = now();
  ELSE
    INSERT INTO public.moment_final_grades (
      enrollment_id, curriculum_subject_id, momento_id, final_literal, approved_by
    )
    VALUES (
      p_enrollment_id, v_curr_subject_id, v_momento_id, p_literal_grade, v_actor_id
    )
    ON CONFLICT (enrollment_id, curriculum_subject_id, momento_id)
    DO UPDATE SET
      final_literal = EXCLUDED.final_literal,
      approved_by = EXCLUDED.approved_by,
      updated_at = now();
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'score_id', v_score_id,
    'weighted_avg', v_weighted_avg,
    'final_numeric', v_final_numeric
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.siga_registrar_nota(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.siga_registrar_nota(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT) TO authenticated, service_role;

-- 5. CIFRADO SIMÉTRICO PGP DE EXPEDIENTES CONFIDENCIALES DE ORIENTACIÓN (K12)
-- ----------------------------------------------------------------------------
ALTER TABLE public.orientation_followups
  ADD COLUMN IF NOT EXISTS confidential_observations_encrypted TEXT;

CREATE OR REPLACE FUNCTION siga_internal.resolve_orientation_cipher_key(p_override_key TEXT DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_key TEXT := coalesce(
    nullif(trim(p_override_key), ''),
    nullif(trim(current_setting('app.orientation_encryption_key', true)), '')
  );
BEGIN
  IF v_key IS NULL OR length(v_key) < 16 THEN
    RAISE EXCEPTION 'Llave de cifrado de Orientación no configurada o demasiado corta'
      USING ERRCODE = '42501';
  END IF;
  RETURN v_key;
END;
$$;

REVOKE ALL ON FUNCTION siga_internal.resolve_orientation_cipher_key(TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.siga_guardar_expediente_orientacion(
  p_student_user_id UUID,
  p_school_year_id UUID,
  p_case_code TEXT,
  p_record_category TEXT,
  p_summary TEXT,
  p_confidential_notes TEXT,
  p_risk_level TEXT DEFAULT 'low',
  p_encryption_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_actor_id UUID := siga_internal.current_user_id();
  v_cipher_key TEXT;
  v_encrypted_b64 TEXT := NULL;
  v_record_id UUID;
BEGIN
  IF v_actor_id IS NULL OR NOT siga_internal.has_any_role(ARRAY['orientacion', 'direccion']) THEN
    RAISE EXCEPTION 'Acceso restringido al Departamento de Orientación y Dirección'
      USING ERRCODE = '42501';
  END IF;

  IF p_confidential_notes IS NOT NULL AND length(trim(p_confidential_notes)) > 0 THEN
    v_cipher_key := siga_internal.resolve_orientation_cipher_key(p_encryption_key);
    v_encrypted_b64 := encode(
      extensions.pgp_sym_encrypt(
        trim(p_confidential_notes),
        v_cipher_key,
        'cipher-algo=aes256, compress-algo=0'
      ),
      'base64'
    );
  END IF;

  INSERT INTO public.orientation_records (
    student_user_id,
    school_year_id,
    case_code,
    record_category,
    summary,
    confidential_notes_encrypted,
    risk_level,
    opened_by,
    status
  )
  VALUES (
    p_student_user_id,
    p_school_year_id,
    upper(trim(p_case_code)),
    p_record_category,
    trim(p_summary),
    v_encrypted_b64,
    coalesce(p_risk_level, 'low'),
    v_actor_id,
    'open'
  )
  RETURNING id INTO v_record_id;

  RETURN jsonb_build_object(
    'success', true,
    'record_id', v_record_id,
    'encrypted', (v_encrypted_b64 IS NOT NULL)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.siga_guardar_expediente_orientacion(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.siga_guardar_expediente_orientacion(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.siga_leer_expediente_orientacion(
  p_record_id UUID,
  p_encryption_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_actor_id UUID := siga_internal.current_user_id();
  v_rec RECORD;
  v_cipher_key TEXT;
  v_decrypted_notes TEXT := NULL;
BEGIN
  IF v_actor_id IS NULL OR NOT siga_internal.has_any_role(ARRAY['orientacion', 'direccion']) THEN
    RAISE EXCEPTION 'Acceso restringido al Departamento de Orientación y Dirección'
      USING ERRCODE = '42501';
  END IF;

  SELECT r.id,
         r.student_user_id,
         r.school_year_id,
         r.case_code,
         r.record_category,
         r.summary,
         r.confidential_notes_encrypted,
         r.risk_level,
         r.status,
         r.created_at,
         r.updated_at
    INTO v_rec
    FROM public.orientation_records r
   WHERE r.id = p_record_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expediente confidencial no encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF v_rec.confidential_notes_encrypted IS NOT NULL THEN
    v_cipher_key := siga_internal.resolve_orientation_cipher_key(p_encryption_key);
    v_decrypted_notes := extensions.pgp_sym_decrypt(
      decode(v_rec.confidential_notes_encrypted, 'base64'),
      v_cipher_key
    );
  END IF;

  RETURN jsonb_build_object(
    'id', v_rec.id,
    'student_user_id', v_rec.student_user_id,
    'school_year_id', v_rec.school_year_id,
    'case_code', v_rec.case_code,
    'record_category', v_rec.record_category,
    'summary', v_rec.summary,
    'confidential_notes', v_decrypted_notes,
    'risk_level', v_rec.risk_level,
    'status', v_rec.status,
    'created_at', v_rec.created_at,
    'updated_at', v_rec.updated_at
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.siga_leer_expediente_orientacion(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.siga_leer_expediente_orientacion(UUID, TEXT) TO authenticated, service_role;

-- 6. DETECCIÓN ANTI-FRAUDE DE ENTREGAS Y ARCHIVOS DUPLICADOS EN AULA VIRTUAL
-- ----------------------------------------------------------------------------
ALTER TABLE public.assignment_submissions
  ADD COLUMN IF NOT EXISTS content_sha256 TEXT
  CHECK (content_sha256 IS NULL OR content_sha256 ~ '^[a-f0-9]{64}$');

CREATE INDEX IF NOT EXISTS idx_assignment_submissions_sha256
  ON public.assignment_submissions(assignment_id, content_sha256)
  WHERE content_sha256 IS NOT NULL;

CREATE OR REPLACE FUNCTION public.siga_verificar_duplicado_entrega(
  p_assignment_id UUID,
  p_content_sha256 TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor_id UUID := siga_internal.current_user_id();
  v_normalized_hash TEXT := lower(trim(coalesce(p_content_sha256, '')));
  v_matches INTEGER := 0;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Sesión institucional requerida' USING ERRCODE = '42501';
  END IF;

  IF v_normalized_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Huella SHA-256 inválida' USING ERRCODE = '22023';
  END IF;

  SELECT count(*)::INTEGER
    INTO v_matches
    FROM public.assignment_submissions sub
    JOIN public.enrollments e ON e.id = sub.enrollment_id
   WHERE sub.assignment_id = p_assignment_id
     AND sub.content_sha256 = v_normalized_hash
     AND e.student_user_id <> v_actor_id;

  RETURN jsonb_build_object(
    'is_duplicate', (v_matches > 0),
    'duplicate_count', v_matches
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.siga_verificar_duplicado_entrega(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.siga_verificar_duplicado_entrega(UUID, TEXT) TO authenticated, service_role;

-- 7. MAGIC LINK CONTROLADO PARA TUTORES EMPRESARIALES DE PASANTÍAS (6.º AÑO)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.siga_public_validar_magic_link_pasantia(
  p_raw_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_clean TEXT := trim(coalesce(p_raw_token, ''));
  v_hash TEXT;
  v_row RECORD;
BEGIN
  IF length(v_clean) < 24 OR length(v_clean) > 256 THEN
    RETURN jsonb_build_object('valid', false, 'status', 'invalid_token');
  END IF;

  v_hash := encode(
    extensions.digest(convert_to(v_clean, 'UTF8'), 'sha256'),
    'hex'
  );

  SELECT ml.id AS magic_link_id,
         ml.placement_id,
         ml.expires_at,
         ml.used_at,
         ip.status AS placement_status,
         ic.legal_name AS company_name,
         u.first_name,
         u.last_name,
         m.name AS mencion_name
    INTO v_row
    FROM public.internship_magic_links ml
    JOIN public.internship_placements ip ON ip.id = ml.placement_id
    JOIN public.internship_companies ic ON ic.id = ip.company_id
    JOIN public.enrollments e ON e.id = ip.enrollment_id
    JOIN public.users u ON u.id = e.student_user_id
    JOIN public.menciones m ON m.id = e.mencion_id
   WHERE ml.token_hash = v_hash;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'status', 'not_found');
  END IF;

  IF v_row.used_at IS NOT NULL THEN
    RETURN jsonb_build_object('valid', false, 'status', 'already_used');
  END IF;

  IF v_row.expires_at <= now() THEN
    RETURN jsonb_build_object('valid', false, 'status', 'expired');
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'status', 'active',
    'placement_id', v_row.placement_id,
    'company_name', v_row.company_name,
    'student_display_name', trim(v_row.first_name || ' ' || left(v_row.last_name, 1) || '.'),
    'mencion_name', v_row.mencion_name,
    'expires_at', v_row.expires_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.siga_public_validar_magic_link_pasantia(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.siga_public_validar_magic_link_pasantia(TEXT) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

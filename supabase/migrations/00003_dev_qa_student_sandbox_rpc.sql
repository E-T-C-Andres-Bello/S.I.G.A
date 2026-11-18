-- ============================================================================
-- S.I.G.A. — Entorno QA Controlado para cuenta estudiante@etcandresbello.org
-- (SOLO DDL — Cero INSERTs de datos/seeds/credenciales)
-- Motor: Supabase PostgreSQL 17+ | Código DEA: OD01340701
-- ============================================================================

-- 1. VERIFICACIÓN ESTRICTA DE IDENTIDAD QA (DEFENSA EN PROFUNDIDAD)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION siga_internal.assert_qa_student_sandbox_actor()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor_id UUID := siga_internal.current_user_id();
  v_auth_email TEXT := lower(trim(COALESCE(auth.jwt() ->> 'email', '')));
  v_cedula TEXT;
  v_inst_email TEXT;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Sesión institucional requerida' USING ERRCODE = '42501';
  END IF;

  SELECT u.cedula, lower(trim(COALESCE(u.institutional_email, '')))
    INTO v_cedula, v_inst_email
    FROM public.users u
   WHERE u.id = v_actor_id
     AND u.deleted_at IS NULL
     AND u.is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ficha de usuario no encontrada' USING ERRCODE = '42501';
  END IF;

  IF v_cedula <> 'V99999996'
     OR (v_inst_email <> 'estudiante@etcandresbello.org' AND v_auth_email <> 'estudiante@etcandresbello.org')
     OR NOT siga_internal.has_any_role(ARRAY['estudiante']) THEN
    RAISE EXCEPTION 'Herramienta de pruebas habilitada únicamente para la cuenta QA estudiante@etcandresbello.org'
      USING ERRCODE = '42501';
  END IF;

  RETURN v_actor_id;
END;
$$;

REVOKE ALL ON FUNCTION siga_internal.assert_qa_student_sandbox_actor() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION siga_internal.assert_qa_student_sandbox_actor() TO authenticated, service_role;

-- 2. LECTURA DE ESTADO DEL SANDBOX QA ESTUDIANTIL
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.siga_dev_get_student_sandbox_state()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor_id UUID := siga_internal.assert_qa_student_sandbox_actor();
  v_access_tier TEXT;
  v_inst_email TEXT;
  v_cedula TEXT;
  v_enrollment_id UUID;
  v_school_year_id UUID;
  v_school_year_code TEXT;
  v_school_year_name TEXT;
  v_mencion_id UUID;
  v_mencion_code TEXT;
  v_mencion_name TEXT;
  v_grade_year SMALLINT;
  v_section_id UUID;
  v_section_letter TEXT;
  v_menciones_json JSONB;
  v_school_years_json JSONB;
  v_momentos_json JSONB;
  v_schedule_count INTEGER := 0;
  v_scores_count INTEGER := 0;
  v_attendance_count INTEGER := 0;
  v_requests_count INTEGER := 0;
  v_docs_count INTEGER := 0;
  v_pending_count INTEGER := 0;
BEGIN
  SELECT u.access_tier, u.institutional_email, u.cedula
    INTO v_access_tier, v_inst_email, v_cedula
    FROM public.users u
   WHERE u.id = v_actor_id;

  SELECT COALESCE(
           jsonb_agg(
             jsonb_build_object(
               'id', m.id,
               'code', m.code,
               'name', m.name
             )
             ORDER BY m.name ASC
           ),
           '[]'::jsonb
         )
    INTO v_menciones_json
    FROM public.menciones m
   WHERE m.is_active = true;

  SELECT COALESCE(
           jsonb_agg(
             jsonb_build_object(
               'id', sy.id,
               'code', sy.code,
               'name', sy.name,
               'status', sy.status,
               'is_current', sy.is_current
             )
             ORDER BY sy.start_date DESC
           ),
           '[]'::jsonb
         )
    INTO v_school_years_json
    FROM public.school_years sy;

  SELECT sy.id, sy.code, sy.name
    INTO v_school_year_id, v_school_year_code, v_school_year_name
    FROM public.school_years sy
   WHERE sy.is_current = true
   LIMIT 1;

  IF v_school_year_id IS NOT NULL THEN
    SELECT COALESCE(
             jsonb_agg(
               jsonb_build_object(
                 'id', mom.id,
                 'moment_number', mom.moment_number,
                 'name', mom.name,
                 'status', mom.status
               )
               ORDER BY mom.moment_number ASC
             ),
             '[]'::jsonb
           )
      INTO v_momentos_json
      FROM public.momentos mom
     WHERE mom.school_year_id = v_school_year_id;

    SELECT e.id, e.mencion_id, m.code, m.name, e.grade_year, e.section_id, s.section_letter
      INTO v_enrollment_id, v_mencion_id, v_mencion_code, v_mencion_name, v_grade_year, v_section_id, v_section_letter
      FROM public.enrollments e
      JOIN public.menciones m ON m.id = e.mencion_id
      JOIN public.sections s ON s.id = e.section_id
     WHERE e.student_user_id = v_actor_id
       AND e.school_year_id = v_school_year_id
       AND e.deleted_at IS NULL
     LIMIT 1;
  ELSE
    v_momentos_json := '[]'::jsonb;
  END IF;

  IF v_enrollment_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_scores_count
      FROM public.student_scores sc
     WHERE sc.enrollment_id = v_enrollment_id
       AND sc.deleted_at IS NULL;

    SELECT COUNT(*) INTO v_attendance_count
      FROM public.attendance_records ar
     WHERE ar.enrollment_id = v_enrollment_id;

    SELECT COUNT(*) INTO v_schedule_count
      FROM public.section_schedules ss
     WHERE ss.school_year_id = v_school_year_id
       AND ss.section_id = v_section_id
       AND ss.is_active = true;
  END IF;

  SELECT COUNT(*) INTO v_requests_count
    FROM public.student_requests sr
   WHERE sr.student_user_id = v_actor_id;

  SELECT COUNT(*) INTO v_docs_count
    FROM public.official_documents od
   WHERE od.student_user_id = v_actor_id;

  SELECT COUNT(*) INTO v_pending_count
    FROM public.pending_subject_attempts psa
   WHERE psa.student_user_id = v_actor_id;

  RETURN jsonb_build_object(
    'access_tier', v_access_tier,
    'institutional_email', v_inst_email,
    'cedula', v_cedula,
    'menciones', v_menciones_json,
    'school_years', v_school_years_json,
    'momentos', v_momentos_json,
    'current_enrollment', CASE
      WHEN v_enrollment_id IS NOT NULL THEN jsonb_build_object(
        'id', v_enrollment_id,
        'school_year_id', v_school_year_id,
        'school_year_code', v_school_year_code,
        'school_year_name', v_school_year_name,
        'mencion_id', v_mencion_id,
        'mencion_code', v_mencion_code,
        'mencion_name', v_mencion_name,
        'grade_year', v_grade_year,
        'section_id', v_section_id,
        'section_letter', v_section_letter
      )
      ELSE NULL
    END,
    'stats', jsonb_build_object(
      'schedule_blocks', v_schedule_count,
      'scores', v_scores_count,
      'attendance', v_attendance_count,
      'requests', v_requests_count,
      'official_documents', v_docs_count,
      'pending_attempts', v_pending_count
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.siga_dev_get_student_sandbox_state() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.siga_dev_get_student_sandbox_state() TO authenticated, service_role;

-- 3. POBLAR O LIMPIAR DATOS SINTÉTICOS DE PRUEBA PARA EL ESTUDIANTE QA
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.siga_dev_manage_student_synthetic_data(
  p_action TEXT DEFAULT 'populate',
  p_reference_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_actor_id UUID := siga_internal.assert_qa_student_sandbox_actor();
  v_clean_action TEXT := lower(trim(COALESCE(p_action, 'populate')));
  v_ref_date DATE := COALESCE(p_reference_date, CURRENT_DATE);
  v_school_year_id UUID;
  v_school_year_name TEXT;
  v_enrollment_id UUID;
  v_section_id UUID;
  v_section_letter TEXT;
  v_mencion_id UUID;
  v_mencion_name TEXT;
  v_grade_year SMALLINT;
  v_teacher_id UUID;
  v_active_moment_id UUID;
  v_active_moment_num SMALLINT := 1;
  v_ta_id UUID;
  v_plan_id UUID;
  v_item_1 UUID;
  v_item_2 UUID;
  v_item_3 UUID;
  v_item_4 UUID;
  v_sub RECORD;
  v_mom RECORD;
  v_idx INTEGER := 0;
  v_slot_day SMALLINT;
  v_slot_pair SMALLINT;
  v_start_time TIME;
  v_end_time TIME;
  v_block_label TEXT;
  v_room_label TEXT;
  v_att_ta_id UUID;
  v_att_session_id UUID;
  v_att_date DATE;
  v_att_status TEXT;
  v_pending_cs_id UUID;
  v_verif_code TEXT;
  v_doc_id UUID;
  v_first_name TEXT;
  v_last_name TEXT;
  v_cedula TEXT;
  v_section_is_qa_only BOOLEAN := false;
BEGIN
  IF v_clean_action NOT IN ('populate', 'clear') THEN
    RAISE EXCEPTION 'Acción de sandbox inválida (usa populate o clear)' USING ERRCODE = '22023';
  END IF;

  SELECT u.first_name, u.last_name, u.cedula
    INTO v_first_name, v_last_name, v_cedula
    FROM public.users u
   WHERE u.id = v_actor_id;

  SELECT sy.id, sy.name
    INTO v_school_year_id, v_school_year_name
    FROM public.school_years sy
   WHERE sy.is_current = true
   LIMIT 1;

  IF v_school_year_id IS NULL THEN
    RAISE EXCEPTION 'No hay ningún año escolar activo en la base de datos' USING ERRCODE = 'P0002';
  END IF;

  SELECT e.id, e.section_id, s.section_letter, e.mencion_id, m.name, e.grade_year
    INTO v_enrollment_id, v_section_id, v_section_letter, v_mencion_id, v_mencion_name, v_grade_year
    FROM public.enrollments e
    JOIN public.sections s ON s.id = e.section_id
    JOIN public.menciones m ON m.id = e.mencion_id
   WHERE e.student_user_id = v_actor_id
     AND e.school_year_id = v_school_year_id
     AND e.deleted_at IS NULL
   LIMIT 1;

  IF v_enrollment_id IS NULL THEN
    RAISE EXCEPTION 'El estudiante QA no posee matrícula asignada en el período activo'
      USING ERRCODE = 'P0002';
  END IF;

  v_section_is_qa_only := NOT EXISTS (
    SELECT 1
      FROM public.enrollments e2
     WHERE e2.section_id = v_section_id
       AND e2.school_year_id = v_school_year_id
       AND e2.student_user_id <> v_actor_id
       AND e2.deleted_at IS NULL
  );

  -- Limpieza ordenada respetando restricciones FK del estudiante QA
  DELETE FROM public.student_requests sr
   WHERE sr.student_user_id = v_actor_id;

  DELETE FROM public.official_documents od
   WHERE od.student_user_id = v_actor_id;

  DELETE FROM public.pending_subject_attempts psa
   WHERE psa.student_user_id = v_actor_id;

  DELETE FROM public.attendance_records ar
   WHERE ar.enrollment_id = v_enrollment_id;

  DELETE FROM public.moment_final_grades mfg
   WHERE mfg.enrollment_id = v_enrollment_id;

  DELETE FROM public.student_scores sc
   WHERE sc.enrollment_id = v_enrollment_id;

  IF v_section_is_qa_only THEN
    DELETE FROM public.section_schedules ss
     WHERE ss.school_year_id = v_school_year_id
       AND ss.section_id = v_section_id;
  END IF;

  IF v_clean_action = 'clear' THEN
    RETURN jsonb_build_object('success', true, 'action', 'clear');
  END IF;

  -- Resolver docente de prueba para FKs de asignación y registro de notas
  SELECT u.id
    INTO v_teacher_id
    FROM public.users u
   WHERE u.deleted_at IS NULL
     AND u.is_active = true
     AND lower(COALESCE(u.institutional_email, '')) = 'docente@etcandresbello.org'
   LIMIT 1;

  IF v_teacher_id IS NULL THEN
    SELECT ur.user_id
      INTO v_teacher_id
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      JOIN public.users u ON u.id = ur.user_id
     WHERE r.code IN ('docente', 'control_estudios', 'direccion')
       AND ur.is_active = true
       AND u.deleted_at IS NULL
       AND u.is_active = true
     LIMIT 1;
  END IF;

  IF v_teacher_id IS NULL THEN
    v_teacher_id := v_actor_id;
  END IF;

  -- Liberar bloques horarios QA de otras secciones vacías del mismo docente para evitar 23P01
  DELETE FROM public.section_schedules ss
   USING public.teacher_assignments ta
   WHERE ss.teacher_assignment_id = ta.id
     AND ss.school_year_id = v_school_year_id
     AND ta.teacher_user_id = v_teacher_id
     AND NOT EXISTS (
       SELECT 1
         FROM public.enrollments e2
        WHERE e2.section_id = ss.section_id
          AND e2.school_year_id = ss.school_year_id
          AND e2.student_user_id <> v_actor_id
          AND e2.deleted_at IS NULL
     );

  -- Determinar momento activo del período escolar
  SELECT mom.id, mom.moment_number
    INTO v_active_moment_id, v_active_moment_num
    FROM public.momentos mom
   WHERE mom.school_year_id = v_school_year_id
     AND mom.status = 'open'
   ORDER BY mom.moment_number ASC
   LIMIT 1;

  IF v_active_moment_id IS NULL THEN
    SELECT mom.id, mom.moment_number
      INTO v_active_moment_id, v_active_moment_num
      FROM public.momentos mom
     WHERE mom.school_year_id = v_school_year_id
     ORDER BY mom.moment_number ASC
     LIMIT 1;

    IF v_active_moment_id IS NOT NULL THEN
      UPDATE public.momentos
         SET status = 'open'
       WHERE id = v_active_moment_id;
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.curriculum_subjects cs
     WHERE cs.mencion_id = v_mencion_id
       AND cs.grade_year = v_grade_year
       AND cs.is_active = true
  ) THEN
    RAISE EXCEPTION 'Falta poblar el catálogo base de materias para la mención y año seleccionados'
      USING ERRCODE = 'P0002';
  END IF;

  -- Poblar asignaciones docentes, horario fijo Lun-Vie, planes 100%, evaluaciones y calificaciones
  FOR v_sub IN
    SELECT cs.id AS curriculum_subject_id,
           sub.code AS subject_code,
           sub.name AS subject_name,
           sub.grading_scale,
           sub.is_technical_core
      FROM public.curriculum_subjects cs
      JOIN public.subjects sub ON sub.id = cs.subject_id
     WHERE cs.mencion_id = v_mencion_id
       AND cs.grade_year = v_grade_year
       AND cs.is_active = true
     ORDER BY sub.is_technical_core DESC, sub.grading_scale ASC, sub.code ASC
     LIMIT 6
  LOOP
    v_idx := v_idx + 1;

    SELECT ta.id
      INTO v_ta_id
      FROM public.teacher_assignments ta
     WHERE ta.school_year_id = v_school_year_id
       AND ta.section_id = v_section_id
       AND ta.curriculum_subject_id = v_sub.curriculum_subject_id
       AND ta.is_active = true
     LIMIT 1;

    IF v_ta_id IS NULL THEN
      INSERT INTO public.teacher_assignments (
        school_year_id,
        section_id,
        curriculum_subject_id,
        teacher_user_id,
        is_active
      )
      VALUES (
        v_school_year_id,
        v_section_id,
        v_sub.curriculum_subject_id,
        v_teacher_id,
        true
      )
      RETURNING id INTO v_ta_id;
    END IF;

    IF v_att_ta_id IS NULL THEN
      v_att_ta_id := v_ta_id;
    END IF;

    -- 1 o 2 bloques semanales en Lun-Vie sin solapamientos
    v_slot_day := ((v_idx - 1) % 5) + 1;
    v_slot_pair := ((v_idx - 1) / 5);
    IF v_slot_pair = 0 THEN
      v_start_time := TIME '07:00:00';
      v_end_time := TIME '08:30:00';
      v_block_label := 'Bloque 1-2';
    ELSE
      v_start_time := TIME '09:00:00';
      v_end_time := TIME '10:30:00';
      v_block_label := 'Bloque 3-4';
    END IF;

    v_room_label := CASE
      WHEN v_sub.is_technical_core AND v_mencion_name ILIKE '%Telem%' THEN 'Lab. Informática'
      WHEN v_sub.is_technical_core AND v_mencion_name ILIKE '%Aduan%' THEN 'Bloque Comercial'
      WHEN v_sub.is_technical_core THEN 'Salón Protocolo y Turismo'
      ELSE 'Aula ' || v_grade_year::text || '-' || v_section_letter
    END;

    IF v_section_is_qa_only THEN
      INSERT INTO public.section_schedules (
        school_year_id,
        section_id,
        teacher_assignment_id,
        day_of_week,
        block_label,
        start_time,
        end_time,
        room_label,
        is_active
      )
      VALUES (
        v_school_year_id,
        v_section_id,
        v_ta_id,
        v_slot_day,
        v_block_label,
        v_start_time,
        v_end_time,
        v_room_label,
        true
      );
    END IF;

    -- Planes de evaluación (sumando exactamente 100.00%) y notas parciales/finales
    FOR v_mom IN
      SELECT mom.id, mom.moment_number, mom.name, mom.status
        FROM public.momentos mom
       WHERE mom.school_year_id = v_school_year_id
         AND mom.moment_number <= v_active_moment_num
       ORDER BY mom.moment_number ASC
    LOOP
      SELECT ep.id
        INTO v_plan_id
        FROM public.evaluation_plans ep
       WHERE ep.teacher_assignment_id = v_ta_id
         AND ep.momento_id = v_mom.id
       LIMIT 1;

      IF v_plan_id IS NULL THEN
        INSERT INTO public.evaluation_plans (
          teacher_assignment_id,
          momento_id,
          title,
          status
        )
        VALUES (
          v_ta_id,
          v_mom.id,
          'Plan ' || v_mom.name || ' · ' || v_sub.subject_name,
          'draft'
        )
        RETURNING id INTO v_plan_id;

        INSERT INTO public.evaluation_items (
          evaluation_plan_id, title, evaluation_type, weight_percent, max_points, scheduled_date
        )
        VALUES (
          v_plan_id,
          'Taller práctico I',
          'classroom_activity',
          25.00,
          20.00,
          v_ref_date - (12 - v_idx)
        )
        RETURNING id INTO v_item_1;

        INSERT INTO public.evaluation_items (
          evaluation_plan_id, title, evaluation_type, weight_percent, max_points, scheduled_date
        )
        VALUES (
          v_plan_id,
          CASE WHEN v_sub.is_technical_core THEN 'Práctica de mención' ELSE 'Actividad evaluada' END,
          CASE WHEN v_sub.is_technical_core THEN 'lab_mention' ELSE 'assignment_lms' END,
          25.00,
          20.00,
          v_ref_date - (6 - LEAST(v_idx, 5))
        )
        RETURNING id INTO v_item_2;

        INSERT INTO public.evaluation_items (
          evaluation_plan_id, title, evaluation_type, weight_percent, max_points, scheduled_date
        )
        VALUES (
          v_plan_id,
          'Guía evaluativa',
          'assignment_lms',
          25.00,
          20.00,
          v_ref_date + v_idx
        )
        RETURNING id INTO v_item_3;

        INSERT INTO public.evaluation_items (
          evaluation_plan_id, title, evaluation_type, weight_percent, max_points, scheduled_date
        )
        VALUES (
          v_plan_id,
          'Evaluación integral',
          'exam_online',
          25.00,
          20.00,
          v_ref_date + (6 + v_idx)
        )
        RETURNING id INTO v_item_4;

        UPDATE public.evaluation_plans
           SET status = 'published'
         WHERE id = v_plan_id;
      ELSE
        SELECT ei.id INTO v_item_1
          FROM public.evaluation_items ei
         WHERE ei.evaluation_plan_id = v_plan_id
         ORDER BY ei.created_at ASC
         LIMIT 1 OFFSET 0;

        SELECT ei.id INTO v_item_2
          FROM public.evaluation_items ei
         WHERE ei.evaluation_plan_id = v_plan_id
         ORDER BY ei.created_at ASC
         LIMIT 1 OFFSET 1;

        SELECT ei.id INTO v_item_3
          FROM public.evaluation_items ei
         WHERE ei.evaluation_plan_id = v_plan_id
         ORDER BY ei.created_at ASC
         LIMIT 1 OFFSET 2;

        SELECT ei.id INTO v_item_4
          FROM public.evaluation_items ei
         WHERE ei.evaluation_plan_id = v_plan_id
         ORDER BY ei.created_at ASC
         LIMIT 1 OFFSET 3;

        IF v_mom.id = v_active_moment_id THEN
          IF v_item_3 IS NOT NULL THEN
            UPDATE public.evaluation_items
               SET scheduled_date = v_ref_date + v_idx
             WHERE id = v_item_3;
          END IF;
          IF v_item_4 IS NOT NULL THEN
            UPDATE public.evaluation_items
               SET scheduled_date = v_ref_date + (6 + v_idx)
             WHERE id = v_item_4;
          END IF;
        END IF;
      END IF;

      -- Registrar calificaciones parciales en el momento activo (para Simulador) y cerradas en momentos previos
      IF v_sub.grading_scale = 'NUMERIC_1_20' THEN
        DECLARE
          v_s1 NUMERIC(5,2);
          v_s2 NUMERIC(5,2);
          v_final SMALLINT;
        BEGIN
          v_s1 := CASE (v_idx % 4)
            WHEN 1 THEN 18.00
            WHEN 2 THEN 12.50
            WHEN 3 THEN 8.00
            ELSE 15.00
          END;
          v_s2 := CASE (v_idx % 4)
            WHEN 1 THEN 17.50
            WHEN 2 THEN 11.50
            WHEN 3 THEN 7.50
            ELSE 14.50
          END;

          IF v_mom.moment_number < v_active_moment_num THEN
            v_final := LEAST(20, GREATEST(1, round((v_s1 + v_s2) / 2.0)::SMALLINT));
            INSERT INTO public.moment_final_grades (
              enrollment_id, curriculum_subject_id, momento_id, raw_weighted_avg, final_numeric, is_locked, approved_by
            )
            VALUES (
              v_enrollment_id, v_sub.curriculum_subject_id, v_mom.id, v_final, v_final, true, v_teacher_id
            )
            ON CONFLICT (enrollment_id, curriculum_subject_id, momento_id) DO UPDATE
              SET raw_weighted_avg = EXCLUDED.raw_weighted_avg,
                  final_numeric = EXCLUDED.final_numeric;
          ELSE
            IF v_item_1 IS NOT NULL THEN
              INSERT INTO public.student_scores (
                evaluation_item_id, enrollment_id, numeric_score, source, recorded_by
              )
              VALUES (v_item_1, v_enrollment_id, v_s1, 'manual', v_teacher_id)
              ON CONFLICT (evaluation_item_id, enrollment_id) WHERE deleted_at IS NULL
              DO UPDATE SET numeric_score = EXCLUDED.numeric_score;
            END IF;

            IF v_item_2 IS NOT NULL THEN
              INSERT INTO public.student_scores (
                evaluation_item_id, enrollment_id, numeric_score, source, recorded_by
              )
              VALUES (v_item_2, v_enrollment_id, v_s2, 'manual', v_teacher_id)
              ON CONFLICT (evaluation_item_id, enrollment_id) WHERE deleted_at IS NULL
              DO UPDATE SET numeric_score = EXCLUDED.numeric_score;
            END IF;

            IF v_idx <= 4 THEN
              v_final := LEAST(20, GREATEST(1, round((v_s1 + v_s2) / 2.0)::SMALLINT));
              INSERT INTO public.moment_final_grades (
                enrollment_id, curriculum_subject_id, momento_id, raw_weighted_avg, final_numeric, is_locked, approved_by
              )
              VALUES (
                v_enrollment_id, v_sub.curriculum_subject_id, v_mom.id, v_final, v_final, false, v_teacher_id
              )
              ON CONFLICT (enrollment_id, curriculum_subject_id, momento_id) DO UPDATE
                SET raw_weighted_avg = EXCLUDED.raw_weighted_avg,
                    final_numeric = EXCLUDED.final_numeric;
            END IF;
          END IF;
        END;
      ELSE
        -- Asignatura literal (CRP A-E)
        IF v_item_1 IS NOT NULL AND v_mom.moment_number = v_active_moment_num THEN
          INSERT INTO public.student_scores (
            evaluation_item_id, enrollment_id, literal_grade, source, recorded_by
          )
          VALUES (v_item_1, v_enrollment_id, 'A', 'manual', v_teacher_id)
          ON CONFLICT (evaluation_item_id, enrollment_id) WHERE deleted_at IS NULL
          DO UPDATE SET literal_grade = EXCLUDED.literal_grade;
        END IF;

        INSERT INTO public.moment_final_grades (
          enrollment_id, curriculum_subject_id, momento_id, final_literal, qualitative_observation, is_locked, approved_by
        )
        VALUES (
          v_enrollment_id,
          v_sub.curriculum_subject_id,
          v_mom.id,
          'A',
          'Participación destacada en proyectos socioproductivos.',
          v_mom.moment_number < v_active_moment_num,
          v_teacher_id
        )
        ON CONFLICT (enrollment_id, curriculum_subject_id, momento_id) DO UPDATE
          SET final_literal = EXCLUDED.final_literal;
      END IF;
    END LOOP;
  END LOOP;

  -- Poblar sesiones y pases de asistencia reales (10 sesiones -> 90%)
  IF v_att_ta_id IS NOT NULL AND v_active_moment_id IS NOT NULL THEN
    FOR v_idx IN 1..10 LOOP
      v_att_date := v_ref_date - (15 - v_idx);
      v_att_status := CASE
        WHEN v_idx = 4 THEN 'absent'
        WHEN v_idx = 7 THEN 'late'
        ELSE 'present'
      END;

      INSERT INTO public.attendance_sessions (
        teacher_assignment_id, momento_id, session_date, block_label, recorded_mode, created_by
      )
      VALUES (
        v_att_ta_id, v_active_moment_id, v_att_date, 'Bloque 1-2', 'online', v_teacher_id
      )
      ON CONFLICT (teacher_assignment_id, session_date, block_label)
      DO UPDATE SET synced_at = now()
      RETURNING id INTO v_att_session_id;

      INSERT INTO public.attendance_records (
        attendance_session_id, enrollment_id, status, client_mutation_id
      )
      VALUES (
        v_att_session_id, v_enrollment_id, v_att_status, gen_random_uuid()
      )
      ON CONFLICT (attendance_session_id, enrollment_id)
      DO UPDATE SET status = EXCLUDED.status;
    END LOOP;
  END IF;

  -- Materia pendiente de prueba cuando cursa >= 2.º año
  IF v_grade_year >= 2 THEN
    SELECT cs.id
      INTO v_pending_cs_id
      FROM public.curriculum_subjects cs
      JOIN public.subjects sub ON sub.id = cs.subject_id
     WHERE cs.mencion_id = v_mencion_id
       AND cs.grade_year = v_grade_year - 1
       AND cs.is_active = true
       AND sub.grading_scale = 'NUMERIC_1_20'
     ORDER BY cs.id ASC
     LIMIT 1;

    IF v_pending_cs_id IS NOT NULL THEN
      INSERT INTO public.pending_subject_attempts (
        student_user_id, school_year_id, curriculum_subject_id, attempt_number, exam_date, final_numeric, evaluator_user_id
      )
      VALUES (
        v_actor_id, v_school_year_id, v_pending_cs_id, 1, v_ref_date - 5, 13, v_teacher_id
      )
      ON CONFLICT (student_user_id, school_year_id, curriculum_subject_id, attempt_number)
      DO UPDATE SET final_numeric = EXCLUDED.final_numeric;
    END IF;
  END IF;

  -- Constancia oficial + código QR verificable + trámite pendiente de muestra
  v_verif_code := 'SIGA-QA-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

  INSERT INTO public.official_documents (
    verification_code,
    document_hash,
    document_type,
    student_user_id,
    issued_by,
    payload_snapshot,
    status
  )
  VALUES (
    v_verif_code,
    encode(extensions.digest(convert_to(v_verif_code || ':' || v_actor_id::text || ':' || now()::text, 'UTF8'), 'sha256'), 'hex'),
    'constancia_estudio',
    v_actor_id,
    v_teacher_id,
    jsonb_build_object(
      'estudiante', trim(v_first_name || ' ' || v_last_name),
      'anio_cursante', v_grade_year::text || '.º Año',
      'mencion', v_mencion_name,
      'seccion', v_section_letter,
      'periodo_escolar', v_school_year_name,
      'estado_matricula', 'Activa'
    ),
    'valid'
  )
  RETURNING id INTO v_doc_id;

  INSERT INTO public.student_requests (
    student_user_id,
    enrollment_id,
    request_type,
    reason,
    status,
    resolved_at,
    resolved_by,
    official_document_id,
    client_request_id
  )
  VALUES
  (
    v_actor_id,
    v_enrollment_id,
    'constancia_estudio',
    'Constancia generada para validación de descarga PDF y QR.',
    'delivered',
    now(),
    v_teacher_id,
    v_doc_id,
    gen_random_uuid()
  ),
  (
    v_actor_id,
    v_enrollment_id,
    'solvencia',
    'Solicitud de solvencia institucional para seguimiento en vivo.',
    'pending',
    NULL,
    NULL,
    NULL,
    gen_random_uuid()
  );

  RETURN jsonb_build_object(
    'success', true,
    'action', 'populate',
    'verification_code', v_verif_code
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.siga_dev_manage_student_synthetic_data(TEXT, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.siga_dev_manage_student_synthetic_data(TEXT, DATE) TO authenticated, service_role;

-- 4. CAMBIO RÁPIDO DE CONTEXTO ACADÉMICO DEL ESTUDIANTE QA
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.siga_dev_switch_student_context(
  p_mencion_code TEXT DEFAULT NULL,
  p_grade_year SMALLINT DEFAULT NULL,
  p_section_letter TEXT DEFAULT NULL,
  p_school_year_code TEXT DEFAULT NULL,
  p_active_moment SMALLINT DEFAULT NULL,
  p_access_tier TEXT DEFAULT NULL,
  p_reference_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor_id UUID := siga_internal.assert_qa_student_sandbox_actor();
  v_school_year_id UUID;
  v_sy_start DATE;
  v_sy_end DATE;
  v_cur_enrollment_id UUID;
  v_cur_mencion_id UUID;
  v_cur_grade SMALLINT;
  v_cur_section_id UUID;
  v_cur_section_letter TEXT;
  v_target_mencion_id UUID;
  v_target_grade SMALLINT;
  v_target_section_letter TEXT;
  v_target_section_id UUID;
  v_had_synthetic BOOLEAN := false;
  v_context_changed BOOLEAN := false;
BEGIN
  IF p_grade_year IS NOT NULL AND (p_grade_year < 1 OR p_grade_year > 6) THEN
    RAISE EXCEPTION 'El año cursante debe estar entre 1.º y 6.º Año' USING ERRCODE = '22023';
  END IF;

  IF p_section_letter IS NOT NULL AND upper(trim(p_section_letter)) !~ '^[A-Z]{1,3}$' THEN
    RAISE EXCEPTION 'Letra de sección inválida' USING ERRCODE = '22023';
  END IF;

  IF p_active_moment IS NOT NULL AND p_active_moment NOT IN (1, 2, 3) THEN
    RAISE EXCEPTION 'Momento pedagógico inválido (1, 2 o 3)' USING ERRCODE = '22023';
  END IF;

  IF p_access_tier IS NOT NULL AND p_access_tier NOT IN ('verified_workspace', 'provisional_cedula') THEN
    RAISE EXCEPTION 'Nivel de acceso inválido' USING ERRCODE = '22023';
  END IF;

  IF p_access_tier IS NOT NULL THEN
    PERFORM set_config('siga.internal_rpc', '1', true);

    UPDATE public.users
       SET access_tier = p_access_tier,
           workspace_verified_at = CASE
             WHEN p_access_tier = 'verified_workspace' THEN COALESCE(workspace_verified_at, now())
             ELSE workspace_verified_at
           END
     WHERE id = v_actor_id;
  END IF;

  -- Resolver período escolar destino (o mantener el actual)
  IF p_school_year_code IS NOT NULL AND length(trim(p_school_year_code)) > 0 THEN
    SELECT sy.id, sy.start_date, sy.end_date
      INTO v_school_year_id, v_sy_start, v_sy_end
      FROM public.school_years sy
     WHERE sy.code = trim(p_school_year_code)
     LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Período escolar no encontrado' USING ERRCODE = 'P0002';
    END IF;

    UPDATE public.school_years
       SET is_current = false
     WHERE is_current = true
       AND id <> v_school_year_id;

    UPDATE public.school_years
       SET is_current = true,
           status = CASE WHEN status = 'draft' THEN 'active' ELSE status END
     WHERE id = v_school_year_id;
  ELSE
    SELECT sy.id, sy.start_date, sy.end_date
      INTO v_school_year_id, v_sy_start, v_sy_end
      FROM public.school_years sy
     WHERE sy.is_current = true
     LIMIT 1;

    IF NOT FOUND THEN
      SELECT sy.id, sy.start_date, sy.end_date
        INTO v_school_year_id, v_sy_start, v_sy_end
        FROM public.school_years sy
       ORDER BY sy.start_date DESC
       LIMIT 1;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'No hay períodos escolares disponibles en la base de datos'
          USING ERRCODE = 'P0002';
      END IF;

      UPDATE public.school_years
         SET is_current = true,
             status = 'active'
       WHERE id = v_school_year_id;
    END IF;
  END IF;

  -- Garantizar 3 momentos si el período aún no los tiene
  IF NOT EXISTS (
    SELECT 1 FROM public.momentos mom WHERE mom.school_year_id = v_school_year_id
  ) THEN
    INSERT INTO public.momentos (school_year_id, moment_number, name, start_date, end_date, status)
    VALUES
      (v_school_year_id, 1, 'I Momento Pedagógico', v_sy_start, LEAST(v_sy_end, (v_sy_start + 90)::DATE), 'open'),
      (v_school_year_id, 2, 'II Momento Pedagógico', LEAST(v_sy_end, (v_sy_start + 91)::DATE), LEAST(v_sy_end, (v_sy_start + 185)::DATE), 'scheduled'),
      (v_school_year_id, 3, 'III Momento Pedagógico', LEAST(v_sy_end, (v_sy_start + 186)::DATE), v_sy_end, 'scheduled');
  END IF;

  IF p_active_moment IS NOT NULL THEN
    UPDATE public.momentos
       SET status = CASE
         WHEN moment_number < p_active_moment THEN 'closed'
         WHEN moment_number = p_active_moment THEN 'open'
         ELSE 'scheduled'
       END
     WHERE school_year_id = v_school_year_id;
  END IF;

  -- Leer matrícula previa en ese período (si existe)
  SELECT e.id, e.mencion_id, e.grade_year, e.section_id, s.section_letter
    INTO v_cur_enrollment_id, v_cur_mencion_id, v_cur_grade, v_cur_section_id, v_cur_section_letter
    FROM public.enrollments e
    JOIN public.sections s ON s.id = e.section_id
   WHERE e.student_user_id = v_actor_id
     AND e.school_year_id = v_school_year_id
     AND e.deleted_at IS NULL
   LIMIT 1;

  -- Determinar si el estudiante tenía datos sintéticos antes del cambio
  v_had_synthetic := EXISTS (
    SELECT 1
      FROM public.enrollments e_any
      JOIN public.student_scores sc ON sc.enrollment_id = e_any.id AND sc.deleted_at IS NULL
     WHERE e_any.student_user_id = v_actor_id
       AND e_any.deleted_at IS NULL
  ) OR EXISTS (
    SELECT 1
      FROM public.enrollments e_any
      JOIN public.section_schedules ss ON ss.section_id = e_any.section_id AND ss.school_year_id = e_any.school_year_id AND ss.is_active = true
     WHERE e_any.student_user_id = v_actor_id
       AND e_any.deleted_at IS NULL
  );

  -- Resolver mención destino
  IF p_mencion_code IS NOT NULL AND length(trim(p_mencion_code)) > 0 THEN
    SELECT m.id
      INTO v_target_mencion_id
      FROM public.menciones m
     WHERE upper(m.code) = upper(trim(p_mencion_code))
       AND m.is_active = true
     LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Mención técnica no encontrada en el catálogo' USING ERRCODE = 'P0002';
    END IF;
  ELSIF v_cur_mencion_id IS NOT NULL THEN
    v_target_mencion_id := v_cur_mencion_id;
  ELSE
    SELECT m.id
      INTO v_target_mencion_id
      FROM public.menciones m
     WHERE m.is_active = true
     ORDER BY (m.code = 'TELEMATICA') DESC, m.name ASC
     LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Aún no hay menciones cargadas en el catálogo escolar' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  v_target_grade := COALESCE(p_grade_year, v_cur_grade, 5);
  v_target_section_letter := COALESCE(NULLIF(upper(trim(COALESCE(p_section_letter, ''))), ''), v_cur_section_letter, 'A');

  -- Buscar o crear sección en el período destino
  SELECT s.id
    INTO v_target_section_id
    FROM public.sections s
   WHERE s.school_year_id = v_school_year_id
     AND s.mencion_id = v_target_mencion_id
     AND s.grade_year = v_target_grade
     AND s.section_letter = v_target_section_letter
     AND s.deleted_at IS NULL
   LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO public.sections (school_year_id, mencion_id, grade_year, section_letter, capacity)
    VALUES (v_school_year_id, v_target_mencion_id, v_target_grade, v_target_section_letter, 38)
    RETURNING id INTO v_target_section_id;
  END IF;

  IF v_cur_enrollment_id IS NULL THEN
    INSERT INTO public.enrollments (
      student_user_id,
      school_year_id,
      section_id,
      mencion_id,
      grade_year,
      enrollment_status,
      enrollment_type
    )
    VALUES (
      v_actor_id,
      v_school_year_id,
      v_target_section_id,
      v_target_mencion_id,
      v_target_grade,
      'active',
      'regular'
    )
    RETURNING id INTO v_cur_enrollment_id;

    v_context_changed := true;
  ELSE
    v_context_changed := (
      v_cur_mencion_id IS DISTINCT FROM v_target_mencion_id
      OR v_cur_grade IS DISTINCT FROM v_target_grade
      OR v_cur_section_id IS DISTINCT FROM v_target_section_id
    );

    IF v_context_changed THEN
      DELETE FROM public.attendance_records ar WHERE ar.enrollment_id = v_cur_enrollment_id;
      DELETE FROM public.moment_final_grades mfg WHERE mfg.enrollment_id = v_cur_enrollment_id;
      DELETE FROM public.student_scores sc WHERE sc.enrollment_id = v_cur_enrollment_id;

      UPDATE public.enrollments
         SET mencion_id = v_target_mencion_id,
             grade_year = v_target_grade,
             section_id = v_target_section_id,
             enrollment_status = 'active'
       WHERE id = v_cur_enrollment_id;
    END IF;
  END IF;

  -- Si cambió malla/sección o momento y ya usaba datos sintéticos, re-sincronizar los datos de prueba al nuevo contexto
  IF (v_context_changed OR p_active_moment IS NOT NULL) AND v_had_synthetic THEN
    PERFORM public.siga_dev_manage_student_synthetic_data('populate', p_reference_date);
  END IF;

  RETURN public.siga_dev_get_student_sandbox_state();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.siga_dev_switch_student_context(TEXT, SMALLINT, TEXT, TEXT, SMALLINT, TEXT, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.siga_dev_switch_student_context(TEXT, SMALLINT, TEXT, TEXT, SMALLINT, TEXT, DATE) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

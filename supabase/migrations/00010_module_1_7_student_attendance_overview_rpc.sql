-- ============================================================================
-- S.I.G.A. — Módulo 1.7: Mi Día Escolar, Alertas de Ausencia Docente y
-- Semáforo de Asistencia (75 % MPPE)
-- (SOLO DDL — Cero INSERTs de datos, catálogos ni credenciales)
-- Motor: Supabase PostgreSQL 17+ | Código DEA: OD01340701
-- ============================================================================

-- 1. RPC ligero para Home (`/estudiante`): devuelve únicamente las ausencias
--    docentes reportadas para la sección vigente del estudiante en la ventana
--    de hoy a +7 días (hora de Venezuela), OMITIENDO motivos médicos y notas
--    privadas (`reason_category`, `observation`, `reviewed_by`, `teacher_user_id`).
CREATE OR REPLACE FUNCTION public.siga_get_student_section_absence_alerts()
RETURNS TABLE (
  absence_id UUID,
  absence_date DATE,
  teacher_name TEXT,
  subject_codes TEXT[],
  subject_names TEXT[],
  affected_blocks JSONB,
  status TEXT
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
  v_today DATE := (now() AT TIME ZONE 'America/Caracas')::date;
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
  SELECT tabs.id AS absence_id,
         tabs.absence_date,
         trim(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')) AS teacher_name,
         ARRAY_AGG(DISTINCT sub.code ORDER BY sub.code) AS subject_codes,
         ARRAY_AGG(DISTINCT sub.name ORDER BY sub.name) AS subject_names,
         tabs.affected_blocks,
         tabs.status
    FROM public.teacher_absences tabs
    JOIN public.teacher_assignments ta
      ON ta.teacher_user_id = tabs.teacher_user_id
     AND ta.school_year_id = v_school_year_id
     AND ta.section_id = v_section_id
     AND ta.is_active = true
    JOIN public.curriculum_subjects cs ON cs.id = ta.curriculum_subject_id
    JOIN public.subjects sub ON sub.id = cs.subject_id
    JOIN public.users u
      ON u.id = tabs.teacher_user_id
     AND u.deleted_at IS NULL
   WHERE tabs.absence_date BETWEEN v_today AND (v_today + 7)
   GROUP BY tabs.id, tabs.absence_date, u.first_name, u.last_name, tabs.affected_blocks, tabs.status
   ORDER BY tabs.absence_date ASC, teacher_name ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.siga_get_student_section_absence_alerts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.siga_get_student_section_absence_alerts() TO authenticated, service_role;

-- 2. RPC integral para `/estudiante/asistencia`: devuelve en una sola llamada
--    atómica la matrícula vigente, horario de sección, resumen de asistencia
--    por área de formación, pases detallados por fecha y avisos de ausencia
--    docente (respetando la privacidad laboral del docente).
CREATE OR REPLACE FUNCTION public.siga_get_student_attendance_overview()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor_id UUID := siga_internal.current_user_id();
  v_today DATE := (now() AT TIME ZONE 'America/Caracas')::date;
  v_enrollment_id UUID;
  v_school_year_id UUID;
  v_section_id UUID;
  v_mencion_id UUID;
  v_grade_year SMALLINT;
  v_school_year_name TEXT;
  v_mencion_name TEXT;
  v_section_letter TEXT;
  v_subjects JSONB := '[]'::jsonb;
  v_sessions JSONB := '[]'::jsonb;
  v_absences JSONB := '[]'::jsonb;
  v_schedule JSONB := '[]'::jsonb;
BEGIN
  IF v_actor_id IS NULL OR NOT siga_internal.is_verified_workspace() THEN
    RETURN jsonb_build_object(
      'has_enrollment', false,
      'today_iso', to_char(v_today, 'YYYY-MM-DD'),
      'school_year_name', null,
      'mencion_name', null,
      'grade_year', null,
      'section_letter', null,
      'subjects', '[]'::jsonb,
      'sessions', '[]'::jsonb,
      'teacher_absences', '[]'::jsonb,
      'schedule_blocks', '[]'::jsonb
    );
  END IF;

  SELECT e.id,
         e.school_year_id,
         e.section_id,
         e.mencion_id,
         e.grade_year,
         sy.name,
         m.name,
         sec.section_letter
    INTO v_enrollment_id,
         v_school_year_id,
         v_section_id,
         v_mencion_id,
         v_grade_year,
         v_school_year_name,
         v_mencion_name,
         v_section_letter
    FROM public.enrollments e
    JOIN public.school_years sy ON sy.id = e.school_year_id
    LEFT JOIN public.menciones m ON m.id = e.mencion_id
    LEFT JOIN public.sections sec ON sec.id = e.section_id
   WHERE e.student_user_id = v_actor_id
     AND e.deleted_at IS NULL
     AND sy.is_current = true
   ORDER BY e.created_at DESC
   LIMIT 1;

  IF v_enrollment_id IS NULL THEN
    RETURN jsonb_build_object(
      'has_enrollment', false,
      'today_iso', to_char(v_today, 'YYYY-MM-DD'),
      'school_year_name', null,
      'mencion_name', null,
      'grade_year', null,
      'section_letter', null,
      'subjects', '[]'::jsonb,
      'sessions', '[]'::jsonb,
      'teacher_absences', '[]'::jsonb,
      'schedule_blocks', '[]'::jsonb
    );
  END IF;

  -- Resumen por área de formación del año vigente
  SELECT COALESCE(
           jsonb_agg(
             jsonb_build_object(
               'curriculum_subject_id', s.curriculum_subject_id,
               'subject_code', s.subject_code,
               'subject_name', s.subject_name,
               'weekly_hours', s.weekly_hours,
               'is_technical_core', s.is_technical_core,
               'teacher_name', s.teacher_name,
               'total_sessions', s.total_sessions,
               'present_count', s.present_count,
               'late_count', s.late_count,
               'justified_count', s.justified_count,
               'absent_count', s.absent_count
             )
             ORDER BY s.display_order ASC, s.subject_name ASC
           ),
           '[]'::jsonb
         )
    INTO v_subjects
    FROM (
      SELECT cs.id AS curriculum_subject_id,
             sub.code AS subject_code,
             sub.name AS subject_name,
             cs.weekly_hours,
             COALESCE(cs.display_order, 10) AS display_order,
             sub.is_technical_core,
             NULLIF(trim(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')), '') AS teacher_name,
             COUNT(ar.id)::INTEGER AS total_sessions,
             COUNT(*) FILTER (WHERE ar.status = 'present')::INTEGER AS present_count,
             COUNT(*) FILTER (WHERE ar.status = 'late')::INTEGER AS late_count,
             COUNT(*) FILTER (WHERE ar.status = 'justified')::INTEGER AS justified_count,
             COUNT(*) FILTER (WHERE ar.status = 'absent')::INTEGER AS absent_count
        FROM public.curriculum_subjects cs
        JOIN public.subjects sub ON sub.id = cs.subject_id
        LEFT JOIN public.teacher_assignments ta
          ON ta.school_year_id = v_school_year_id
         AND ta.section_id = v_section_id
         AND ta.curriculum_subject_id = cs.id
         AND ta.is_active = true
        LEFT JOIN public.users u
          ON u.id = ta.teacher_user_id
         AND u.deleted_at IS NULL
        LEFT JOIN public.attendance_sessions ats
          ON ats.teacher_assignment_id = ta.id
        LEFT JOIN public.attendance_records ar
          ON ar.attendance_session_id = ats.id
         AND ar.enrollment_id = v_enrollment_id
       WHERE cs.mencion_id = v_mencion_id
         AND cs.grade_year = v_grade_year
         AND cs.is_active = true
       GROUP BY cs.id, sub.code, sub.name, cs.weekly_hours, cs.display_order, sub.is_technical_core, u.first_name, u.last_name
    ) s;

  -- Historial detallado de sesiones de asistencia para calendario mensual
  SELECT COALESCE(
           jsonb_agg(
             jsonb_build_object(
               'record_id', sess.record_id,
               'session_date', to_char(sess.session_date, 'YYYY-MM-DD'),
               'block_label', sess.block_label,
               'moment_number', sess.moment_number,
               'moment_name', sess.moment_name,
               'subject_code', sess.subject_code,
               'subject_name', sess.subject_name,
               'teacher_name', sess.teacher_name,
               'status', sess.status,
               'note', sess.note
             )
             ORDER BY sess.session_date DESC, sess.block_label ASC
           ),
           '[]'::jsonb
         )
    INTO v_sessions
    FROM (
      SELECT ar.id AS record_id,
             ats.session_date,
             ats.block_label,
             mom.moment_number,
             mom.name AS moment_name,
             sub.code AS subject_code,
             sub.name AS subject_name,
             NULLIF(trim(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')), '') AS teacher_name,
             ar.status,
             ar.note
        FROM public.attendance_records ar
        JOIN public.attendance_sessions ats ON ats.id = ar.attendance_session_id
        JOIN public.momentos mom ON mom.id = ats.momento_id
        JOIN public.teacher_assignments ta ON ta.id = ats.teacher_assignment_id
        JOIN public.curriculum_subjects cs ON cs.id = ta.curriculum_subject_id
        JOIN public.subjects sub ON sub.id = cs.subject_id
        LEFT JOIN public.users u
          ON u.id = ta.teacher_user_id
         AND u.deleted_at IS NULL
       WHERE ar.enrollment_id = v_enrollment_id
    ) sess;

  -- Avisos verificados de ausencia docente (hoy + 7 días, sin motivos médicos ni notas privadas)
  SELECT COALESCE(
           jsonb_agg(
             jsonb_build_object(
               'absence_id', a.absence_id,
               'absence_date', to_char(a.absence_date, 'YYYY-MM-DD'),
               'teacher_name', a.teacher_name,
               'subject_codes', a.subject_codes,
               'subject_names', a.subject_names,
               'affected_blocks', a.affected_blocks,
               'status', a.status
             )
             ORDER BY a.absence_date ASC, a.teacher_name ASC
           ),
           '[]'::jsonb
         )
    INTO v_absences
    FROM public.siga_get_student_section_absence_alerts() a;

  -- Horario semanal activo de la sección
  SELECT COALESCE(
           jsonb_agg(
             jsonb_build_object(
               'id', sc.id,
               'day_of_week', sc.day_of_week,
               'block_label', sc.block_label,
               'start_time', to_char(sc.start_time, 'HH24:MI'),
               'end_time', to_char(sc.end_time, 'HH24:MI'),
               'room_label', sc.room_label,
               'subject_code', sc.subject_code,
               'subject_name', sc.subject_name,
               'teacher_name', sc.teacher_name
             )
             ORDER BY sc.day_of_week ASC, sc.start_time ASC
           ),
           '[]'::jsonb
         )
    INTO v_schedule
    FROM public.siga_get_student_section_schedule() sc;

  RETURN jsonb_build_object(
    'has_enrollment', true,
    'today_iso', to_char(v_today, 'YYYY-MM-DD'),
    'school_year_name', v_school_year_name,
    'mencion_name', v_mencion_name,
    'grade_year', v_grade_year,
    'section_letter', v_section_letter,
    'subjects', v_subjects,
    'sessions', v_sessions,
    'teacher_absences', v_absences,
    'schedule_blocks', v_schedule
  );
END;
$$;

REVOKE ALL ON FUNCTION public.siga_get_student_attendance_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.siga_get_student_attendance_overview() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

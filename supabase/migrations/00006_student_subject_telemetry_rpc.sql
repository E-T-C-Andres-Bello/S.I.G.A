-- ============================================================================
-- S.I.G.A. — Telemetría Académica y Docente por Asignatura (Vista Estudiante)
-- (SOLO DDL — Cero INSERTs de datos, catálogos ni credenciales)
-- Motor: Supabase PostgreSQL 17+ | Código DEA: OD01340701
-- ============================================================================

-- Expone de forma segura (sin PII docente ni apertura global de `attendance_sessions`)
-- el docente titular asignado y el desglose real de asistencia por asignatura
-- exclusivamente para la matrícula vigente del estudiante verificado que consulta.
CREATE OR REPLACE FUNCTION public.siga_get_student_subject_telemetry()
RETURNS TABLE (
  curriculum_subject_id UUID,
  subject_code TEXT,
  teacher_name TEXT,
  total_sessions INTEGER,
  present_count INTEGER,
  late_count INTEGER,
  justified_count INTEGER,
  absent_count INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor_id UUID := siga_internal.current_user_id();
  v_enrollment_id UUID;
  v_school_year_id UUID;
  v_section_id UUID;
  v_mencion_id UUID;
  v_grade_year SMALLINT;
BEGIN
  IF v_actor_id IS NULL OR NOT siga_internal.is_verified_workspace() THEN
    RETURN;
  END IF;

  SELECT e.id, e.school_year_id, e.section_id, e.mencion_id, e.grade_year
    INTO v_enrollment_id, v_school_year_id, v_section_id, v_mencion_id, v_grade_year
    FROM public.enrollments e
    JOIN public.school_years sy ON sy.id = e.school_year_id
   WHERE e.student_user_id = v_actor_id
     AND e.deleted_at IS NULL
     AND sy.is_current = true
   ORDER BY e.created_at DESC
   LIMIT 1;

  IF v_enrollment_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT cs.id AS curriculum_subject_id,
         sub.code AS subject_code,
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
   GROUP BY cs.id, sub.code, u.first_name, u.last_name
   ORDER BY sub.code ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.siga_get_student_subject_telemetry() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.siga_get_student_subject_telemetry() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

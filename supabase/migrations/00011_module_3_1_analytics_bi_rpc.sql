-- ============================================================================
-- S.I.G.A. · Módulo 3.1 — Dirección y Analítica Avanzada (BI Institucional)
-- Migración 00011 (100% DDL pura, sin INSERTs)
-- Provee el RPC protegido `siga_get_analytics_bi_overview` para consultas
-- agregadas en tiempo real bajo RBAC estricto y aislamiento por mención.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.siga_get_analytics_bi_overview(
  p_school_year_id UUID DEFAULT NULL,
  p_momento_number SMALLINT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID := siga_internal.current_user_id();
  v_is_full_admin BOOLEAN := false;
  v_coord_mencion_id UUID := NULL;
  v_school_year RECORD;
  v_momento RECORD;
  v_summary JSONB;
  v_teacher_sla JSONB;
  v_secretariat_sla JSONB;
  v_section_saturation JSONB;
  v_filter_subjects JSONB;
  v_risk_alerts JSONB;
  v_cdce_matrix JSONB;
  v_school_years JSONB;
  v_menciones JSONB;
BEGIN
  -- 1. Validación estricta de sesión y rol institucional
  IF v_actor_id IS NULL OR NOT siga_internal.is_verified_workspace() THEN
    RAISE EXCEPTION 'Acceso denegado: requiere sesión institucional verificada'
      USING ERRCODE = '42501';
  END IF;

  IF NOT siga_internal.has_any_role(ARRAY['direccion', 'control_estudios', 'coordinador_mencion']) THEN
    RAISE EXCEPTION 'Acceso denegado: rol sin privilegios de analítica institucional'
      USING ERRCODE = '42501';
  END IF;

  v_is_full_admin := siga_internal.has_any_role(ARRAY['direccion', 'control_estudios']);

  IF NOT v_is_full_admin THEN
    SELECT ur.mencion_id
      INTO v_coord_mencion_id
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
     WHERE ur.user_id = v_actor_id
       AND ur.is_active = true
       AND r.code = 'coordinador_mencion'
       AND ur.valid_from <= CURRENT_DATE
       AND (ur.valid_until IS NULL OR ur.valid_until >= CURRENT_DATE)
     ORDER BY ur.created_at DESC
     LIMIT 1;

    IF v_coord_mencion_id IS NULL THEN
      RAISE EXCEPTION 'Acceso denegado: coordinación sin mención asignada'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- 2. Resolver año escolar objetivo
  IF p_school_year_id IS NOT NULL THEN
    SELECT id, code, name, status, is_current, start_date, end_date
      INTO v_school_year
      FROM public.school_years
     WHERE id = p_school_year_id
     LIMIT 1;
  END IF;

  IF v_school_year.id IS NULL THEN
    SELECT id, code, name, status, is_current, start_date, end_date
      INTO v_school_year
      FROM public.school_years
     ORDER BY is_current DESC, (status = 'active') DESC, start_date DESC
     LIMIT 1;
  END IF;

  -- Catálogo de años escolares y menciones permitidas para filtros de UI
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', sy.id,
        'code', sy.code,
        'name', sy.name,
        'status', sy.status,
        'isCurrent', sy.is_current
      )
      ORDER BY sy.is_current DESC, sy.start_date DESC
    ),
    '[]'::jsonb
  )
  INTO v_school_years
  FROM public.school_years sy;

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
  INTO v_menciones
  FROM public.menciones m
  WHERE m.is_active = true
    AND (v_coord_mencion_id IS NULL OR m.id = v_coord_mencion_id);

  IF v_school_year.id IS NULL THEN
    RETURN jsonb_build_object(
      'source', 'supabase_oltp',
      'scopedMencionId', v_coord_mencion_id,
      'schoolYears', v_school_years,
      'menciones', v_menciones,
      'activeSchoolYear', NULL,
      'activeMomento', NULL,
      'summary', jsonb_build_object(
        'activeStudents', 0,
        'totalSections', 0,
        'totalAssignments', 0,
        'attendanceRatePct', NULL,
        'passingRatePct', NULL,
        'pendingRequests', 0
      ),
      'teacherSla', '[]'::jsonb,
      'secretariatSla', jsonb_build_object(
        'totalRequests', 0,
        'pendingCount', 0,
        'inReviewCount', 0,
        'approvedCount', 0,
        'deliveredCount', 0,
        'rejectedCount', 0,
        'avgResolutionHours', NULL,
        'oldestPendingHours', NULL,
        'officialDocumentsIssued', 0
      ),
      'sectionSaturation', '[]'::jsonb,
      'filterSubjects', '[]'::jsonb,
      'riskAlerts', '[]'::jsonb,
      'cdceMatrix', '[]'::jsonb,
      'generatedAt', now()
    );
  END IF;

  -- 3. Resolver momento pedagógico objetivo
  IF p_momento_number IS NOT NULL THEN
    SELECT id, moment_number, name, status, start_date, end_date, grade_entry_close_at
      INTO v_momento
      FROM public.momentos
     WHERE school_year_id = v_school_year.id
       AND moment_number = p_momento_number
     LIMIT 1;
  END IF;

  IF v_momento.id IS NULL THEN
    SELECT id, moment_number, name, status, start_date, end_date, grade_entry_close_at
      INTO v_momento
      FROM public.momentos
     WHERE school_year_id = v_school_year.id
     ORDER BY (status = 'open') DESC, moment_number DESC
     LIMIT 1;
  END IF;

  -- 4. Resumen ejecutivo
  WITH scoped_enrollments AS (
    SELECT e.id, e.student_user_id, e.section_id, e.mencion_id, e.grade_year, e.enrollment_status
      FROM public.enrollments e
     WHERE e.school_year_id = v_school_year.id
       AND e.deleted_at IS NULL
       AND (v_coord_mencion_id IS NULL OR e.mencion_id = v_coord_mencion_id)
  ),
  scoped_sections AS (
    SELECT s.id
      FROM public.sections s
     WHERE s.school_year_id = v_school_year.id
       AND s.deleted_at IS NULL
       AND (v_coord_mencion_id IS NULL OR s.mencion_id = v_coord_mencion_id)
  ),
  scoped_assignments AS (
    SELECT ta.id
      FROM public.teacher_assignments ta
      JOIN public.sections s ON s.id = ta.section_id
     WHERE ta.school_year_id = v_school_year.id
       AND ta.is_active = true
       AND s.deleted_at IS NULL
       AND (v_coord_mencion_id IS NULL OR s.mencion_id = v_coord_mencion_id)
  ),
  att_stats AS (
    SELECT
      COUNT(*) AS total_marks,
      COUNT(*) FILTER (WHERE ar.status IN ('present', 'late', 'justified')) AS attended_marks
    FROM public.attendance_records ar
    JOIN scoped_enrollments se ON se.id = ar.enrollment_id
  ),
  grade_stats AS (
    SELECT
      COUNT(*) AS total_grades,
      COUNT(*) FILTER (
        WHERE (mfg.final_numeric IS NOT NULL AND mfg.final_numeric >= sub.passing_threshold)
           OR (mfg.final_literal IS NOT NULL AND mfg.final_literal IN ('A', 'B', 'C'))
      ) AS passed_grades
    FROM public.moment_final_grades mfg
    JOIN scoped_enrollments se ON se.id = mfg.enrollment_id
    JOIN public.curriculum_subjects cs ON cs.id = mfg.curriculum_subject_id
    JOIN public.subjects sub ON sub.id = cs.subject_id
    WHERE v_momento.id IS NULL OR mfg.momento_id = v_momento.id
  ),
  req_pending AS (
    SELECT COUNT(*) AS cnt
      FROM public.student_requests sr
      JOIN scoped_enrollments se ON se.id = sr.enrollment_id
     WHERE sr.status IN ('pending', 'in_review')
  )
  SELECT jsonb_build_object(
    'activeStudents', (SELECT COUNT(*) FROM scoped_enrollments WHERE enrollment_status = 'active'),
    'totalSections', (SELECT COUNT(*) FROM scoped_sections),
    'totalAssignments', (SELECT COUNT(*) FROM scoped_assignments),
    'attendanceRatePct', (
      SELECT CASE WHEN total_marks > 0 THEN ROUND((attended_marks::numeric / total_marks) * 100, 1) ELSE NULL END
        FROM att_stats
    ),
    'passingRatePct', (
      SELECT CASE WHEN total_grades > 0 THEN ROUND((passed_grades::numeric / total_grades) * 100, 1) ELSE NULL END
        FROM grade_stats
    ),
    'pendingRequests', (SELECT cnt FROM req_pending)
  )
  INTO v_summary;

  -- 5. Semáforo de Carga Docente (SLA)
  WITH section_counts AS (
    SELECT e.section_id, COUNT(*) AS enrolled_count
      FROM public.enrollments e
     WHERE e.school_year_id = v_school_year.id
       AND e.deleted_at IS NULL
       AND e.enrollment_status = 'active'
     GROUP BY e.section_id
  ),
  assignment_rows AS (
    SELECT
      ta.id AS assignment_id,
      u.first_name || ' ' || u.last_name AS teacher_name,
      sub.name AS subject_name,
      sub.code AS subject_code,
      m.id AS mencion_id,
      m.name AS mencion_name,
      s.grade_year,
      s.section_letter,
      COALESCE(sc.enrolled_count, 0) AS enrolled_count,
      COALESCE(ep.status, 'missing') AS plan_status,
      (
        SELECT COUNT(*)
          FROM public.moment_final_grades mfg
          JOIN public.enrollments e2 ON e2.id = mfg.enrollment_id
         WHERE e2.section_id = ta.section_id
           AND e2.deleted_at IS NULL
           AND e2.enrollment_status = 'active'
           AND mfg.curriculum_subject_id = ta.curriculum_subject_id
           AND (v_momento.id IS NULL OR mfg.momento_id = v_momento.id)
           AND (mfg.final_numeric IS NOT NULL OR mfg.final_literal IS NOT NULL)
      ) AS graded_count
    FROM public.teacher_assignments ta
    JOIN public.users u ON u.id = ta.teacher_user_id
    JOIN public.sections s ON s.id = ta.section_id
    JOIN public.menciones m ON m.id = s.mencion_id
    JOIN public.curriculum_subjects cs ON cs.id = ta.curriculum_subject_id
    JOIN public.subjects sub ON sub.id = cs.subject_id
    LEFT JOIN section_counts sc ON sc.section_id = ta.section_id
    LEFT JOIN public.evaluation_plans ep
      ON ep.teacher_assignment_id = ta.id
     AND (v_momento.id IS NULL OR ep.momento_id = v_momento.id)
    WHERE ta.school_year_id = v_school_year.id
      AND ta.is_active = true
      AND s.deleted_at IS NULL
      AND (v_coord_mencion_id IS NULL OR s.mencion_id = v_coord_mencion_id)
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'assignmentId', ar.assignment_id,
        'teacherName', ar.teacher_name,
        'subjectName', ar.subject_name,
        'subjectCode', ar.subject_code,
        'mencionId', ar.mencion_id,
        'mencionName', ar.mencion_name,
        'gradeYear', ar.grade_year,
        'sectionLetter', ar.section_letter,
        'enrolledCount', ar.enrolled_count,
        'gradedCount', ar.graded_count,
        'planStatus', ar.plan_status,
        'completionPct', CASE
          WHEN ar.enrolled_count > 0 THEN LEAST(100, ROUND((ar.graded_count::numeric / ar.enrolled_count) * 100, 1))
          ELSE 0
        END,
        'slaStatus', CASE
          WHEN ar.enrolled_count = 0 THEN 'on_track'
          WHEN (ar.graded_count::numeric / ar.enrolled_count) >= 0.8 AND ar.plan_status IN ('published', 'locked') THEN 'on_track'
          WHEN (ar.graded_count::numeric / ar.enrolled_count) >= 0.4 THEN 'warning'
          ELSE 'critical'
        END
      )
      ORDER BY (
        CASE WHEN ar.enrolled_count > 0 THEN (ar.graded_count::numeric / ar.enrolled_count) ELSE 1 END
      ) ASC, ar.grade_year ASC, ar.section_letter ASC
    ),
    '[]'::jsonb
  )
  INTO v_teacher_sla
  FROM assignment_rows ar;

  -- 6. Monitor de Tiempos de Secretaría
  WITH scoped_reqs AS (
    SELECT sr.id, sr.status, sr.sla_entered_at, sr.resolved_at
      FROM public.student_requests sr
      JOIN public.enrollments e ON e.id = sr.enrollment_id
     WHERE e.school_year_id = v_school_year.id
       AND e.deleted_at IS NULL
       AND (v_coord_mencion_id IS NULL OR e.mencion_id = v_coord_mencion_id)
  ),
  scoped_docs AS (
    SELECT COUNT(*) AS cnt
      FROM public.official_documents od
     WHERE od.status = 'valid'
       AND od.issued_at >= v_school_year.start_date::timestamptz
  )
  SELECT jsonb_build_object(
    'totalRequests', (SELECT COUNT(*) FROM scoped_reqs),
    'pendingCount', (SELECT COUNT(*) FROM scoped_reqs WHERE status = 'pending'),
    'inReviewCount', (SELECT COUNT(*) FROM scoped_reqs WHERE status = 'in_review'),
    'approvedCount', (SELECT COUNT(*) FROM scoped_reqs WHERE status = 'approved'),
    'deliveredCount', (SELECT COUNT(*) FROM scoped_reqs WHERE status = 'delivered'),
    'rejectedCount', (SELECT COUNT(*) FROM scoped_reqs WHERE status = 'rejected'),
    'avgResolutionHours', (
      SELECT ROUND(AVG(EXTRACT(EPOCH FROM (resolved_at - sla_entered_at)) / 3600.0)::numeric, 1)
        FROM scoped_reqs
       WHERE resolved_at IS NOT NULL
    ),
    'oldestPendingHours', (
      SELECT ROUND(MAX(EXTRACT(EPOCH FROM (now() - sla_entered_at)) / 3600.0)::numeric, 1)
        FROM scoped_reqs
       WHERE status IN ('pending', 'in_review')
    ),
    'officialDocumentsIssued', (SELECT cnt FROM scoped_docs)
  )
  INTO v_secretariat_sla;

  -- 7. Detector de Saturación en Inscripciones por Sección
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'sectionId', sec.id,
        'mencionId', m.id,
        'mencionName', m.name,
        'gradeYear', sec.grade_year,
        'sectionLetter', sec.section_letter,
        'capacity', sec.capacity,
        'enrolledCount', sec.active_cnt,
        'preEnrolledCount', sec.pre_cnt,
        'occupancyPct', ROUND((sec.active_cnt::numeric / GREATEST(sec.capacity, 1)) * 100, 1),
        'saturationStatus', CASE
          WHEN (sec.active_cnt::numeric / GREATEST(sec.capacity, 1)) >= 0.95 THEN 'saturated'
          WHEN (sec.active_cnt::numeric / GREATEST(sec.capacity, 1)) >= 0.80 THEN 'high'
          ELSE 'normal'
        END
      )
      ORDER BY (sec.active_cnt::numeric / GREATEST(sec.capacity, 1)) DESC, sec.grade_year ASC, sec.section_letter ASC
    ),
    '[]'::jsonb
  )
  INTO v_section_saturation
  FROM (
    SELECT
      s.id,
      s.mencion_id,
      s.grade_year,
      s.section_letter,
      s.capacity,
      COUNT(e.id) FILTER (WHERE e.enrollment_status = 'active') AS active_cnt,
      COUNT(e.id) FILTER (WHERE e.enrollment_status = 'pre_enrolled') AS pre_cnt
    FROM public.sections s
    LEFT JOIN public.enrollments e
      ON e.section_id = s.id
     AND e.deleted_at IS NULL
    WHERE s.school_year_id = v_school_year.id
      AND s.deleted_at IS NULL
      AND (v_coord_mencion_id IS NULL OR s.mencion_id = v_coord_mencion_id)
    GROUP BY s.id, s.mencion_id, s.grade_year, s.section_letter, s.capacity
  ) sec
  JOIN public.menciones m ON m.id = sec.mencion_id;

  -- 8. Auditoría de "Materias Filtro"
  WITH subject_agg AS (
    SELECT
      cs.id AS curriculum_subject_id,
      sub.code AS subject_code,
      sub.name AS subject_name,
      sub.grading_scale,
      sub.passing_threshold,
      m.id AS mencion_id,
      m.name AS mencion_name,
      cs.grade_year,
      COUNT(mfg.id) AS total_graded,
      COUNT(mfg.id) FILTER (
        WHERE (mfg.final_numeric IS NOT NULL AND mfg.final_numeric < sub.passing_threshold)
           OR (mfg.final_literal IS NOT NULL AND mfg.final_literal IN ('D', 'E'))
      ) AS failed_count,
      ROUND(AVG(mfg.final_numeric)::numeric, 2) AS avg_numeric
    FROM public.curriculum_subjects cs
    JOIN public.subjects sub ON sub.id = cs.subject_id
    JOIN public.menciones m ON m.id = cs.mencion_id
    JOIN public.enrollments e
      ON e.mencion_id = cs.mencion_id
     AND e.grade_year = cs.grade_year
     AND e.school_year_id = v_school_year.id
     AND e.deleted_at IS NULL
     AND e.enrollment_status = 'active'
    JOIN public.moment_final_grades mfg
      ON mfg.enrollment_id = e.id
     AND mfg.curriculum_subject_id = cs.id
     AND (v_momento.id IS NULL OR mfg.momento_id = v_momento.id)
    WHERE cs.is_active = true
      AND (v_coord_mencion_id IS NULL OR cs.mencion_id = v_coord_mencion_id)
    GROUP BY cs.id, sub.code, sub.name, sub.grading_scale, sub.passing_threshold, m.id, m.name, cs.grade_year
  ),
  pending_agg AS (
    SELECT
      psa.curriculum_subject_id,
      COUNT(DISTINCT psa.student_user_id) FILTER (WHERE psa.passed = false) AS pending_students
    FROM public.pending_subject_attempts psa
    WHERE psa.school_year_id = v_school_year.id
    GROUP BY psa.curriculum_subject_id
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'curriculumSubjectId', sa.curriculum_subject_id,
        'subjectCode', sa.subject_code,
        'subjectName', sa.subject_name,
        'mencionId', sa.mencion_id,
        'mencionName', sa.mencion_name,
        'gradeYear', sa.grade_year,
        'totalGraded', sa.total_graded,
        'failedCount', sa.failed_count,
        'failureRatePct', CASE
          WHEN sa.total_graded > 0 THEN ROUND((sa.failed_count::numeric / sa.total_graded) * 100, 1)
          ELSE 0
        END,
        'avgNumeric', sa.avg_numeric,
        'pendingStudents', COALESCE(pa.pending_students, 0)
      )
      ORDER BY (
        CASE WHEN sa.total_graded > 0 THEN (sa.failed_count::numeric / sa.total_graded) ELSE 0 END
      ) DESC, sa.failed_count DESC
    ),
    '[]'::jsonb
  )
  INTO v_filter_subjects
  FROM subject_agg sa
  LEFT JOIN pending_agg pa ON pa.curriculum_subject_id = sa.curriculum_subject_id;

  -- 9. Alerta Temprana de Deserción y Riesgo Académico (calculado 100% desde registros reales)
  WITH student_metrics AS (
    SELECT
      e.id AS enrollment_id,
      u.id AS student_user_id,
      u.first_name || ' ' || u.last_name AS full_name,
      RIGHT(u.cedula, 4) AS cedula_last4,
      m.id AS mencion_id,
      m.name AS mencion_name,
      s.grade_year,
      s.section_letter,
      COALESCE(att.total_sessions, 0) AS total_sessions,
      COALESCE(att.absent_sessions, 0) AS absent_sessions,
      CASE
        WHEN COALESCE(att.total_sessions, 0) > 0
          THEN ROUND((att.absent_sessions::numeric / att.total_sessions) * 100, 1)
        ELSE 0
      END AS absence_rate_pct,
      COALESCE(grd.failed_subjects, 0) AS failed_subjects,
      grd.avg_grade,
      COALESCE(pend.pending_count, 0) AS pending_count
    FROM public.enrollments e
    JOIN public.users u ON u.id = e.student_user_id
    JOIN public.sections s ON s.id = e.section_id
    JOIN public.menciones m ON m.id = e.mencion_id
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*) AS total_sessions,
        COUNT(*) FILTER (WHERE ar.status = 'absent') AS absent_sessions
      FROM public.attendance_records ar
      WHERE ar.enrollment_id = e.id
    ) att ON true
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*) FILTER (
          WHERE (mfg.final_numeric IS NOT NULL AND mfg.final_numeric < sub.passing_threshold)
             OR (mfg.final_literal IS NOT NULL AND mfg.final_literal IN ('D', 'E'))
        ) AS failed_subjects,
        ROUND(AVG(mfg.final_numeric)::numeric, 1) AS avg_grade
      FROM public.moment_final_grades mfg
      JOIN public.curriculum_subjects cs ON cs.id = mfg.curriculum_subject_id
      JOIN public.subjects sub ON sub.id = cs.subject_id
      WHERE mfg.enrollment_id = e.id
        AND (v_momento.id IS NULL OR mfg.momento_id = v_momento.id)
    ) grd ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(DISTINCT psa.curriculum_subject_id) AS pending_count
      FROM public.pending_subject_attempts psa
      WHERE psa.student_user_id = e.student_user_id
        AND psa.school_year_id = v_school_year.id
        AND psa.passed = false
    ) pend ON true
    WHERE e.school_year_id = v_school_year.id
      AND e.deleted_at IS NULL
      AND e.enrollment_status = 'active'
      AND u.deleted_at IS NULL
      AND (v_coord_mencion_id IS NULL OR e.mencion_id = v_coord_mencion_id)
  ),
  scored_students AS (
    SELECT
      sm.*,
      LEAST(
        100,
        ROUND(
          (CASE WHEN sm.absence_rate_pct >= 10 THEN LEAST(50, sm.absence_rate_pct * 1.4) ELSE 0 END) +
          (sm.failed_subjects * 16) +
          (sm.pending_count * 10) +
          (CASE WHEN sm.avg_grade IS NOT NULL AND sm.avg_grade < 10 THEN 15 ELSE 0 END)
        )
      )::int AS risk_score
    FROM student_metrics sm
    WHERE sm.absence_rate_pct >= 15
       OR sm.failed_subjects >= 2
       OR sm.pending_count >= 1
       OR (sm.avg_grade IS NOT NULL AND sm.avg_grade < 10)
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'studentUserId', ss.student_user_id,
        'fullName', ss.full_name,
        'cedulaLast4', ss.cedula_last4,
        'mencionId', ss.mencion_id,
        'mencionName', ss.mencion_name,
        'gradeYear', ss.grade_year,
        'sectionLetter', ss.section_letter,
        'absenceRatePct', ss.absence_rate_pct,
        'failedSubjects', ss.failed_subjects,
        'pendingCount', ss.pending_count,
        'avgGrade', ss.avg_grade,
        'riskScore', ss.risk_score,
        'riskLevel', CASE
          WHEN ss.risk_score >= 60 OR ss.absence_rate_pct >= 25 OR ss.failed_subjects >= 3 THEN 'high'
          ELSE 'medium'
        END
      )
      ORDER BY ss.risk_score DESC, ss.absence_rate_pct DESC, ss.failed_subjects DESC
    ),
    '[]'::jsonb
  )
  INTO v_risk_alerts
  FROM (SELECT * FROM scored_students LIMIT 50) ss;

  -- 10. Matriz Estadística Oficial CDCE / Zona Educativa
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'mencionId', cdce.mencion_id,
        'mencionCode', cdce.mencion_code,
        'mencionName', cdce.mencion_name,
        'gradeYear', cdce.grade_year,
        'totalSections', cdce.total_sections,
        'activeStudents', cdce.active_students,
        'preEnrolledStudents', cdce.pre_enrolled_students,
        'withdrawnStudents', cdce.withdrawn_students,
        'promotedStudents', cdce.promoted_students,
        'avgGrade', cdce.avg_grade,
        'attendancePct', cdce.attendance_pct
      )
      ORDER BY cdce.mencion_name ASC, cdce.grade_year ASC
    ),
    '[]'::jsonb
  )
  INTO v_cdce_matrix
  FROM (
    SELECT
      m.id AS mencion_id,
      m.code AS mencion_code,
      m.name AS mencion_name,
      s.grade_year,
      COUNT(DISTINCT s.id) AS total_sections,
      COUNT(DISTINCT e.id) FILTER (WHERE e.enrollment_status = 'active') AS active_students,
      COUNT(DISTINCT e.id) FILTER (WHERE e.enrollment_status = 'pre_enrolled') AS pre_enrolled_students,
      COUNT(DISTINCT e.id) FILTER (WHERE e.enrollment_status = 'withdrawn') AS withdrawn_students,
      COUNT(DISTINCT e.id) FILTER (WHERE e.enrollment_status IN ('promoted', 'graduated')) AS promoted_students,
      ROUND(AVG(mfg.final_numeric)::numeric, 2) AS avg_grade,
      CASE
        WHEN COUNT(ar.id) > 0
          THEN ROUND((COUNT(ar.id) FILTER (WHERE ar.status IN ('present', 'late', 'justified'))::numeric / COUNT(ar.id)) * 100, 1)
        ELSE NULL
      END AS attendance_pct
    FROM public.sections s
    JOIN public.menciones m ON m.id = s.mencion_id
    LEFT JOIN public.enrollments e
      ON e.section_id = s.id
     AND e.deleted_at IS NULL
    LEFT JOIN public.moment_final_grades mfg
      ON mfg.enrollment_id = e.id
     AND (v_momento.id IS NULL OR mfg.momento_id = v_momento.id)
    LEFT JOIN public.attendance_records ar
      ON ar.enrollment_id = e.id
    WHERE s.school_year_id = v_school_year.id
      AND s.deleted_at IS NULL
      AND (v_coord_mencion_id IS NULL OR s.mencion_id = v_coord_mencion_id)
    GROUP BY m.id, m.code, m.name, s.grade_year
  ) cdce;

  RETURN jsonb_build_object(
    'source', 'supabase_oltp',
    'scopedMencionId', v_coord_mencion_id,
    'schoolYears', v_school_years,
    'menciones', v_menciones,
    'activeSchoolYear', jsonb_build_object(
      'id', v_school_year.id,
      'code', v_school_year.code,
      'name', v_school_year.name,
      'status', v_school_year.status,
      'isCurrent', v_school_year.is_current
    ),
    'activeMomento', CASE
      WHEN v_momento.id IS NOT NULL THEN jsonb_build_object(
        'id', v_momento.id,
        'momentNumber', v_momento.moment_number,
        'name', v_momento.name,
        'status', v_momento.status,
        'startDate', v_momento.start_date,
        'endDate', v_momento.end_date,
        'gradeEntryCloseAt', v_momento.grade_entry_close_at
      )
      ELSE NULL
    END,
    'summary', v_summary,
    'teacherSla', v_teacher_sla,
    'secretariatSla', v_secretariat_sla,
    'sectionSaturation', v_section_saturation,
    'filterSubjects', v_filter_subjects,
    'riskAlerts', v_risk_alerts,
    'cdceMatrix', v_cdce_matrix,
    'generatedAt', now()
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.siga_get_analytics_bi_overview(UUID, SMALLINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.siga_get_analytics_bi_overview(UUID, SMALLINT) TO authenticated, service_role;


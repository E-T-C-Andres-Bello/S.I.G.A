-- ============================================================================
-- S.I.G.A. — Migración 00019: Aceleración de Rendimiento, Índices Compuestos
-- y Contexto Atómico de Sesión (100 % DDL pura — cero INSERTs/UPDATEs/DELETEs)
-- ============================================================================

-- 1. ÍNDICES COMPUESTOS PARA ELIMINAR ESCANEOS SECUENCIALES Y HABILITAR INDEX-ONLY SCANS
-- ----------------------------------------------------------------------------

-- Materias pendientes por estudiante y año escolar (faltaba índice por student_user_id)
CREATE INDEX IF NOT EXISTS idx_pending_attempts_student_year_date
  ON public.pending_subject_attempts (student_user_id, school_year_id, exam_date DESC);

-- Planes de evaluación filtrados por asignación docente y estado ('published', 'locked')
CREATE INDEX IF NOT EXISTS idx_evaluation_plans_assignment_status
  ON public.evaluation_plans (teacher_assignment_id, status);

-- Ítems de evaluación ordenados por fecha programada dentro de cada plan
CREATE INDEX IF NOT EXISTS idx_evaluation_items_plan_scheduled
  ON public.evaluation_items (evaluation_plan_id, scheduled_date ASC NULLS LAST);

-- Conteo de asistencia por matrícula y estatus (permite Index-Only Scan en agregaciones)
CREATE INDEX IF NOT EXISTS idx_attendance_records_enrollment_status
  ON public.attendance_records (enrollment_id, status);

-- Préstamos activos/vencidos de biblioteca por prestatario
CREATE INDEX IF NOT EXISTS idx_library_loans_borrower_status_active
  ON public.library_loans (borrower_user_id, status)
  WHERE deleted_at IS NULL;

-- Trámites estudiantiles ordenados cronológicamente por estudiante
CREATE INDEX IF NOT EXISTS idx_student_requests_student_created_desc
  ON public.student_requests (student_user_id, created_at DESC);

-- Documentos oficiales emitidos ordenados por fecha para el expediente estudiantil
CREATE INDEX IF NOT EXISTS idx_official_documents_student_issued_desc
  ON public.official_documents (student_user_id, issued_at DESC);

-- Resolución rápida de roles activos por usuario en cada validación de sesión
CREATE INDEX IF NOT EXISTS idx_user_roles_user_active_lookup
  ON public.user_roles (user_id, role_id)
  WHERE is_active = true;

-- Tareas del Aula Virtual con fecha de entrega activa
CREATE INDEX IF NOT EXISTS idx_assignments_module_due_asc
  ON public.assignments (course_module_id, due_at ASC)
  WHERE due_at IS NOT NULL;

-- 2. RPC CONSOLIDADO DE CONTEXTO DE SESIÓN PARA EL PANEL PRIVADO
-- ----------------------------------------------------------------------------
-- Resuelve en una sola consulta SQL bajo transacción RLS:
--   a) Ficha activa en public.users vinculada a auth.uid()
--   b) Jerarquía de roles activos en public.user_roles + public.roles
--   c) Exigencia de cuenta Google Workspace (@etcandresbello.org)
--   d) Conteo de notificaciones sin leer en public.notifications

CREATE OR REPLACE FUNCTION public.siga_get_dashboard_session_context()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_auth_uid UUID := auth.uid();
  v_auth_email TEXT := lower(trim(COALESCE(auth.jwt() ->> 'email', '')));
  v_user RECORD;
  v_primary_role TEXT;
  v_any_requires_workspace BOOLEAN := false;
  v_unread_count INTEGER := 0;
BEGIN
  IF v_auth_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'not_enrolled');
  END IF;

  SELECT u.id,
         u.first_name,
         u.last_name,
         u.cedula,
         u.institutional_email,
         u.recovery_email,
         u.phone,
         u.access_tier,
         u.avatar_webp_url,
         u.is_active
    INTO v_user
    FROM public.users u
   WHERE u.auth_user_id = v_auth_uid
     AND u.deleted_at IS NULL
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'not_enrolled');
  END IF;

  IF NOT v_user.is_active OR v_user.access_tier = 'suspended' THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'account_suspended');
  END IF;

  IF v_user.access_tier <> 'provisional_cedula'
     AND v_auth_email !~* '^[^@\s]+@etcandresbello\.org$' THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'domain_not_allowed');
  END IF;

  SELECT (array_agg(r.code ORDER BY r.hierarchy_level DESC))[1],
         COALESCE(bool_or(r.requires_workspace), false)
    INTO v_primary_role,
         v_any_requires_workspace
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
   WHERE ur.user_id = v_user.id
     AND ur.is_active = true
     AND r.is_active = true
     AND r.code = ANY(ARRAY[
       'direccion',
       'control_estudios',
       'orientacion',
       'coordinador_pasantias',
       'coordinador_mencion',
       'biblioteca',
       'docente',
       'estudiante'
     ]);

  IF v_primary_role IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'role_missing');
  END IF;

  IF v_user.access_tier = 'provisional_cedula' AND v_any_requires_workspace THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'domain_not_allowed');
  END IF;

  SELECT count(*)::integer
    INTO v_unread_count
    FROM public.notifications n
   WHERE n.recipient_user_id = v_user.id
     AND n.is_read = false;

  RETURN jsonb_build_object(
    'ok', true,
    'internal_user_id', v_user.id,
    'first_name', v_user.first_name,
    'last_name', v_user.last_name,
    'cedula', v_user.cedula,
    'institutional_email', v_user.institutional_email,
    'recovery_email', v_user.recovery_email,
    'phone', v_user.phone,
    'access_tier', v_user.access_tier,
    'avatar_webp_url', v_user.avatar_webp_url,
    'primary_role', v_primary_role,
    'unread_notifications_count', COALESCE(v_unread_count, 0)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.siga_get_dashboard_session_context() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.siga_get_dashboard_session_context() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- S.I.G.A. — Sistema Integral de Gestión Académica (E.T.C. "Andrés Bello")
-- Baseline SQL Monolítico (SOLO DDL — Cero INSERTs de datos/seeds/credenciales)
-- Motor: Supabase PostgreSQL 17+ | Código DEA: OD01340701
-- ============================================================================

-- 1. ESQUEMAS Y EXTENSIONES
-- ----------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE SCHEMA IF NOT EXISTS siga_internal;

REVOKE ALL ON SCHEMA siga_internal FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA extensions TO authenticated, service_role;
GRANT USAGE ON SCHEMA siga_internal TO authenticated, service_role;

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;

-- 2. FUNCIONES UTILITARIAS DE TRIGGER (SIN REFERENCIAS A TABLAS)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION siga_internal.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION siga_internal.prevent_audit_tamper()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  RAISE EXCEPTION 'Los registros de auditoría de S.I.G.A. son inmutables (prohibido UPDATE/DELETE).'
    USING ERRCODE = '42501';
END;
$$;

-- ============================================================================
-- 3. DOMINIO 1 — IDENTIDAD, ACCESO HÍBRIDO Y TABLA EXCLUSIVA DE ROLES (RBAC)
-- ============================================================================

CREATE TABLE public.menciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9_]{2,32}$'),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE CHECK (code ~ '^[a-z][a-z0-9_]{2,40}$'),
  name TEXT NOT NULL,
  description TEXT,
  hierarchy_level SMALLINT NOT NULL DEFAULT 10 CHECK (hierarchy_level BETWEEN 1 AND 100),
  requires_workspace BOOLEAN NOT NULL DEFAULT true,
  is_system BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE CHECK (code ~ '^[a-z0-9_.]{3,80}$'),
  module TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.role_permissions (
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_id)
);

CREATE INDEX idx_role_permissions_permission_id ON public.role_permissions(permission_id);

CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  cedula TEXT NOT NULL CHECK (cedula ~ '^[VEJ][0-9]{6,9}$'),
  first_name TEXT NOT NULL CHECK (length(trim(first_name)) >= 1),
  last_name TEXT NOT NULL CHECK (length(trim(last_name)) >= 1),
  institutional_email TEXT CHECK (
    institutional_email IS NULL OR institutional_email ~* '^[^@\s]+@etcandresbello\.org$'
  ),
  recovery_email TEXT CHECK (
    recovery_email IS NULL OR recovery_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  ),
  access_tier TEXT NOT NULL DEFAULT 'provisional_cedula' CHECK (
    access_tier IN ('provisional_cedula', 'verified_workspace', 'suspended')
  ),
  workspace_verified_at TIMESTAMPTZ,
  phone TEXT,
  avatar_webp_url TEXT,
  qr_token_secret UUID NOT NULL DEFAULT gen_random_uuid(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX uq_users_cedula_active
  ON public.users(cedula)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX uq_users_institutional_email_active
  ON public.users(lower(institutional_email))
  WHERE institutional_email IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX idx_users_auth_user_id ON public.users(auth_user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_access_tier ON public.users(access_tier) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  WHEN (OLD.* IS DISTINCT FROM NEW.*)
  EXECUTE FUNCTION siga_internal.set_updated_at();

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE RESTRICT,
  mencion_id UUID REFERENCES public.menciones(id) ON DELETE RESTRICT,
  assigned_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (valid_until IS NULL OR valid_until >= valid_from)
);

CREATE UNIQUE INDEX uq_user_roles_active_scope
  ON public.user_roles(
    user_id,
    role_id,
    COALESCE(mencion_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  WHERE is_active = true;

CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_role_id ON public.user_roles(role_id);
CREATE INDEX idx_user_roles_mencion_id ON public.user_roles(mencion_id) WHERE mencion_id IS NOT NULL;
CREATE INDEX idx_user_roles_assigned_by ON public.user_roles(assigned_by) WHERE assigned_by IS NOT NULL;

CREATE TABLE public.identity_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  verification_type TEXT NOT NULL CHECK (
    verification_type IN ('workspace_link', 'recovery_email', 'provisional_pin_reset')
  ),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_identity_verifications_user_id ON public.identity_verifications(user_id);

-- ============================================================================
-- 4. DOMINIO 2 — ESTRUCTURA ACADÉMICA MPPE, MATRÍCULA Y EXPEDIENTE
-- ============================================================================

CREATE TABLE public.school_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'closed')),
  is_current BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_date > start_date)
);

CREATE UNIQUE INDEX uq_school_years_single_current
  ON public.school_years(is_current)
  WHERE is_current = true;

CREATE TRIGGER trg_school_years_updated_at
  BEFORE UPDATE ON public.school_years
  FOR EACH ROW
  WHEN (OLD.* IS DISTINCT FROM NEW.*)
  EXECUTE FUNCTION siga_internal.set_updated_at();

CREATE TABLE public.momentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_year_id UUID NOT NULL REFERENCES public.school_years(id) ON DELETE RESTRICT,
  moment_number SMALLINT NOT NULL CHECK (moment_number IN (1, 2, 3)),
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  grade_entry_open_at TIMESTAMPTZ,
  grade_entry_close_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (
    status IN ('scheduled', 'open', 'locked', 'closed')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_year_id, moment_number),
  CHECK (end_date >= start_date)
);

CREATE INDEX idx_momentos_school_year_id ON public.momentos(school_year_id);

CREATE TABLE public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  grading_scale TEXT NOT NULL DEFAULT 'NUMERIC_1_20' CHECK (
    grading_scale IN ('NUMERIC_1_20', 'LITERAL_A_E')
  ),
  passing_threshold SMALLINT NOT NULL DEFAULT 10 CHECK (passing_threshold BETWEEN 1 AND 20),
  is_technical_core BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.curriculum_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mencion_id UUID NOT NULL REFERENCES public.menciones(id) ON DELETE RESTRICT,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
  grade_year SMALLINT NOT NULL CHECK (grade_year BETWEEN 1 AND 6),
  weekly_hours SMALLINT NOT NULL DEFAULT 2 CHECK (weekly_hours BETWEEN 1 AND 30),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (mencion_id, subject_id, grade_year)
);

CREATE INDEX idx_curriculum_subjects_mencion_grade ON public.curriculum_subjects(mencion_id, grade_year);
CREATE INDEX idx_curriculum_subjects_subject_id ON public.curriculum_subjects(subject_id);

CREATE TABLE public.sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_year_id UUID NOT NULL REFERENCES public.school_years(id) ON DELETE RESTRICT,
  mencion_id UUID NOT NULL REFERENCES public.menciones(id) ON DELETE RESTRICT,
  grade_year SMALLINT NOT NULL CHECK (grade_year BETWEEN 1 AND 6),
  section_letter TEXT NOT NULL CHECK (section_letter ~ '^[A-Z]{1,3}$'),
  capacity SMALLINT NOT NULL DEFAULT 38 CHECK (capacity BETWEEN 1 AND 80),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX uq_sections_year_mencion_grade_letter
  ON public.sections(school_year_id, mencion_id, grade_year, section_letter)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_sections_mencion_id ON public.sections(mencion_id);

CREATE TABLE public.teacher_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_year_id UUID NOT NULL REFERENCES public.school_years(id) ON DELETE RESTRICT,
  section_id UUID NOT NULL REFERENCES public.sections(id) ON DELETE RESTRICT,
  curriculum_subject_id UUID NOT NULL REFERENCES public.curriculum_subjects(id) ON DELETE RESTRICT,
  teacher_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_teacher_assignments_active
  ON public.teacher_assignments(school_year_id, section_id, curriculum_subject_id)
  WHERE is_active = true;

CREATE INDEX idx_teacher_assignments_teacher_id ON public.teacher_assignments(teacher_user_id) WHERE is_active = true;
CREATE INDEX idx_teacher_assignments_section_id ON public.teacher_assignments(section_id);
CREATE INDEX idx_teacher_assignments_curriculum_subject_id ON public.teacher_assignments(curriculum_subject_id);

CREATE TRIGGER trg_teacher_assignments_updated_at
  BEFORE UPDATE ON public.teacher_assignments
  FOR EACH ROW
  WHEN (OLD.* IS DISTINCT FROM NEW.*)
  EXECUTE FUNCTION siga_internal.set_updated_at();

CREATE TABLE public.enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  school_year_id UUID NOT NULL REFERENCES public.school_years(id) ON DELETE RESTRICT,
  section_id UUID NOT NULL REFERENCES public.sections(id) ON DELETE RESTRICT,
  mencion_id UUID NOT NULL REFERENCES public.menciones(id) ON DELETE RESTRICT,
  grade_year SMALLINT NOT NULL CHECK (grade_year BETWEEN 1 AND 6),
  enrollment_status TEXT NOT NULL DEFAULT 'active' CHECK (
    enrollment_status IN ('pre_enrolled', 'active', 'promoted', 'withdrawn', 'graduated')
  ),
  enrollment_type TEXT NOT NULL DEFAULT 'regular' CHECK (
    enrollment_type IN ('regular', 'new_entry', 'transfer_equivalence')
  ),
  emergency_contact_name TEXT,
  emergency_contact_cedula TEXT CHECK (
    emergency_contact_cedula IS NULL OR emergency_contact_cedula ~ '^[VEJ][0-9]{6,9}$'
  ),
  emergency_contact_phone TEXT,
  emergency_contact_relationship TEXT,
  ocr_extracted_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX uq_enrollments_student_year
  ON public.enrollments(student_user_id, school_year_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_enrollments_section_id ON public.enrollments(section_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_enrollments_school_year_id ON public.enrollments(school_year_id);
CREATE INDEX idx_enrollments_mencion_grade ON public.enrollments(mencion_id, grade_year);

CREATE TRIGGER trg_enrollments_updated_at
  BEFORE UPDATE ON public.enrollments
  FOR EACH ROW
  WHEN (OLD.* IS DISTINCT FROM NEW.*)
  EXECUTE FUNCTION siga_internal.set_updated_at();

CREATE TABLE public.student_dossier_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (
    document_type IN ('cedula', 'birth_certificate', 'grade_certification', 'photo', 'medical_note', 'other')
  ),
  storage_path TEXT NOT NULL,
  ocr_verified BOOLEAN NOT NULL DEFAULT false,
  verified_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_student_dossier_docs_student ON public.student_dossier_documents(student_user_id);
CREATE INDEX idx_student_dossier_docs_verifier ON public.student_dossier_documents(verified_by) WHERE verified_by IS NOT NULL;

CREATE TABLE public.official_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_code TEXT NOT NULL UNIQUE CHECK (verification_code ~ '^SIGA-[A-Z0-9-]{6,32}$'),
  document_hash TEXT NOT NULL UNIQUE,
  document_type TEXT NOT NULL CHECK (
    document_type IN (
      'boletin_momento',
      'constancia_estudio',
      'constancia_inscripcion',
      'certificacion_notas',
      'carta_postulacion_pasantia',
      'carta_aceptacion_pasantia',
      'solvencia_biblioteca'
    )
  ),
  student_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  issued_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  payload_snapshot JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'valid' CHECK (status IN ('valid', 'revoked')),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX idx_official_documents_student_id ON public.official_documents(student_user_id);
CREATE INDEX idx_official_documents_issued_by ON public.official_documents(issued_by);

CREATE TABLE public.student_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  enrollment_id UUID NOT NULL REFERENCES public.enrollments(id) ON DELETE RESTRICT,
  request_type TEXT NOT NULL CHECK (
    request_type IN (
      'constancia_estudio',
      'constancia_inscripcion',
      'solvencia',
      'revision_notas',
      'activacion_workspace'
    )
  ),
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'in_review', 'approved', 'rejected', 'delivered')
  ),
  sla_entered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  official_document_id UUID REFERENCES public.official_documents(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_student_requests_student_id ON public.student_requests(student_user_id);
CREATE INDEX idx_student_requests_enrollment_id ON public.student_requests(enrollment_id);
CREATE INDEX idx_student_requests_status ON public.student_requests(status);
CREATE INDEX idx_student_requests_resolved_by ON public.student_requests(resolved_by) WHERE resolved_by IS NOT NULL;
CREATE INDEX idx_student_requests_official_doc_id ON public.student_requests(official_document_id) WHERE official_document_id IS NOT NULL;

CREATE TRIGGER trg_student_requests_updated_at
  BEFORE UPDATE ON public.student_requests
  FOR EACH ROW
  WHEN (OLD.* IS DISTINCT FROM NEW.*)
  EXECUTE FUNCTION siga_internal.set_updated_at();

-- ============================================================================
-- 5. DOMINIO 5A — AULA VIRTUAL (LMS) Y RAG PGVECTOR (Creado antes de enlaces de evaluación)
-- ============================================================================

CREATE TABLE public.virtual_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_assignment_id UUID NOT NULL UNIQUE REFERENCES public.teacher_assignments(id) ON DELETE RESTRICT,
  welcome_message TEXT,
  ai_tutor_enabled BOOLEAN NOT NULL DEFAULT true,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_virtual_courses_updated_at
  BEFORE UPDATE ON public.virtual_courses
  FOR EACH ROW
  WHEN (OLD.* IS DISTINCT FROM NEW.*)
  EXECUTE FUNCTION siga_internal.set_updated_at();

CREATE TABLE public.course_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  virtual_course_id UUID NOT NULL REFERENCES public.virtual_courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_course_modules_course_id ON public.course_modules(virtual_course_id, sort_order);

CREATE TABLE public.course_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_module_id UUID NOT NULL REFERENCES public.course_modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  material_type TEXT NOT NULL CHECK (
    material_type IN ('pdf', 'slides', 'video_link', 'code_snippet', 'guide')
  ),
  storage_path_or_url TEXT NOT NULL,
  rag_status TEXT NOT NULL DEFAULT 'not_applicable' CHECK (
    rag_status IN ('pending', 'indexed', 'failed', 'not_applicable')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_course_materials_module_id ON public.course_materials(course_module_id);

CREATE TABLE public.rag_material_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_material_id UUID NOT NULL REFERENCES public.course_materials(id) ON DELETE CASCADE,
  virtual_course_id UUID NOT NULL REFERENCES public.virtual_courses(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL CHECK (chunk_index >= 0),
  content TEXT NOT NULL,
  embedding extensions.vector(768) NOT NULL,
  token_count INTEGER NOT NULL DEFAULT 0 CHECK (token_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (course_material_id, chunk_index)
);

CREATE INDEX idx_rag_chunks_course_id ON public.rag_material_chunks(virtual_course_id);
CREATE INDEX idx_rag_chunks_hnsw_cosine
  ON public.rag_material_chunks
  USING hnsw (embedding extensions.vector_cosine_ops);

CREATE TABLE public.assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_module_id UUID NOT NULL REFERENCES public.course_modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  instructions TEXT NOT NULL,
  due_at TIMESTAMPTZ,
  allow_late BOOLEAN NOT NULL DEFAULT true,
  rubric_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_assignments_module_id ON public.assignments(course_module_id);

CREATE TRIGGER trg_assignments_updated_at
  BEFORE UPDATE ON public.assignments
  FOR EACH ROW
  WHEN (OLD.* IS DISTINCT FROM NEW.*)
  EXECUTE FUNCTION siga_internal.set_updated_at();

CREATE TABLE public.online_exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  virtual_course_id UUID NOT NULL REFERENCES public.virtual_courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  opens_at TIMESTAMPTZ NOT NULL,
  closes_at TIMESTAMPTZ NOT NULL,
  duration_minutes SMALLINT NOT NULL DEFAULT 45 CHECK (duration_minutes BETWEEN 5 AND 240),
  max_attempts SMALLINT NOT NULL DEFAULT 1 CHECK (max_attempts BETWEEN 1 AND 5),
  sync_to_evaluation_item_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (closes_at > opens_at)
);

CREATE INDEX idx_online_exams_course_id ON public.online_exams(virtual_course_id);
CREATE INDEX idx_online_exams_sync_item_id ON public.online_exams(sync_to_evaluation_item_id)
  WHERE sync_to_evaluation_item_id IS NOT NULL;

-- ============================================================================
-- 6. DOMINIO 3 — EVALUACIÓN PONDERADA, CALIFICACIONES MPPE Y AUDITORÍA INMUTABLE
-- ============================================================================

CREATE TABLE public.evaluation_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_assignment_id UUID NOT NULL REFERENCES public.teacher_assignments(id) ON DELETE RESTRICT,
  momento_id UUID NOT NULL REFERENCES public.momentos(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  planning_ai_notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'locked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (teacher_assignment_id, momento_id)
);

CREATE INDEX idx_evaluation_plans_momento_id ON public.evaluation_plans(momento_id);

CREATE TRIGGER trg_evaluation_plans_updated_at
  BEFORE UPDATE ON public.evaluation_plans
  FOR EACH ROW
  WHEN (OLD.* IS DISTINCT FROM NEW.*)
  EXECUTE FUNCTION siga_internal.set_updated_at();

CREATE TABLE public.evaluation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_plan_id UUID NOT NULL REFERENCES public.evaluation_plans(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  evaluation_type TEXT NOT NULL CHECK (
    evaluation_type IN ('exam_online', 'assignment_lms', 'lab_mention', 'classroom_activity', 'project')
  ),
  weight_percent NUMERIC(5,2) NOT NULL CHECK (weight_percent > 0 AND weight_percent <= 100),
  max_points NUMERIC(5,2) NOT NULL DEFAULT 20 CHECK (max_points > 0 AND max_points <= 20),
  scheduled_date DATE,
  linked_assignment_id UUID REFERENCES public.assignments(id) ON DELETE SET NULL,
  linked_exam_id UUID REFERENCES public.online_exams(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_evaluation_items_plan_id ON public.evaluation_items(evaluation_plan_id);
CREATE INDEX idx_evaluation_items_assignment_id ON public.evaluation_items(linked_assignment_id)
  WHERE linked_assignment_id IS NOT NULL;
CREATE INDEX idx_evaluation_items_exam_id ON public.evaluation_items(linked_exam_id)
  WHERE linked_exam_id IS NOT NULL;

ALTER TABLE public.online_exams
  ADD CONSTRAINT fk_online_exams_sync_evaluation_item
  FOREIGN KEY (sync_to_evaluation_item_id)
  REFERENCES public.evaluation_items(id)
  ON DELETE SET NULL;

-- Garantizar que un Plan de Evaluación sume exactamente 100.00% al publicarse o bloquearse
CREATE OR REPLACE FUNCTION siga_internal.assert_eval_plan_100pct()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_total NUMERIC(6,2);
BEGIN
  IF NEW.status IN ('published', 'locked') AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    SELECT COALESCE(SUM(ei.weight_percent), 0)
      INTO v_total
      FROM public.evaluation_items ei
     WHERE ei.evaluation_plan_id = NEW.id;

    IF v_total <> 100.00 THEN
      RAISE EXCEPTION 'El plan de evaluación debe sumar exactamente 100%% antes de publicarse (actual: %).', v_total
        USING ERRCODE = '22023';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_evaluation_plans_validate_100pct
  BEFORE UPDATE OF status ON public.evaluation_plans
  FOR EACH ROW
  EXECUTE FUNCTION siga_internal.assert_eval_plan_100pct();

CREATE TABLE public.student_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_item_id UUID NOT NULL REFERENCES public.evaluation_items(id) ON DELETE RESTRICT,
  enrollment_id UUID NOT NULL REFERENCES public.enrollments(id) ON DELETE RESTRICT,
  numeric_score NUMERIC(5,2) CHECK (numeric_score IS NULL OR (numeric_score >= 0 AND numeric_score <= 20)),
  literal_grade TEXT CHECK (literal_grade IS NULL OR literal_grade IN ('A', 'B', 'C', 'D', 'E')),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (
    source IN ('manual', 'lms_exam_sync', 'lms_assignment', 'mention_lab')
  ),
  recorded_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CHECK (numeric_score IS NOT NULL OR literal_grade IS NOT NULL)
);

CREATE UNIQUE INDEX uq_student_scores_active
  ON public.student_scores(evaluation_item_id, enrollment_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_student_scores_enrollment_id ON public.student_scores(enrollment_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_student_scores_recorded_by ON public.student_scores(recorded_by);

CREATE TRIGGER trg_student_scores_updated_at
  BEFORE UPDATE ON public.student_scores
  FOR EACH ROW
  WHEN (OLD.* IS DISTINCT FROM NEW.*)
  EXECUTE FUNCTION siga_internal.set_updated_at();

CREATE TABLE public.moment_final_grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES public.enrollments(id) ON DELETE RESTRICT,
  curriculum_subject_id UUID NOT NULL REFERENCES public.curriculum_subjects(id) ON DELETE RESTRICT,
  momento_id UUID NOT NULL REFERENCES public.momentos(id) ON DELETE RESTRICT,
  raw_weighted_avg NUMERIC(5,2),
  final_numeric SMALLINT CHECK (final_numeric IS NULL OR (final_numeric BETWEEN 1 AND 20)),
  final_literal TEXT CHECK (final_literal IS NULL OR final_literal IN ('A', 'B', 'C', 'D', 'E')),
  qualitative_observation TEXT,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  reopened_until TIMESTAMPTZ,
  approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (enrollment_id, curriculum_subject_id, momento_id)
);

CREATE INDEX idx_moment_final_grades_enrollment_momento ON public.moment_final_grades(enrollment_id, momento_id);
CREATE INDEX idx_moment_final_grades_subject_momento ON public.moment_final_grades(curriculum_subject_id, momento_id);
CREATE INDEX idx_moment_final_grades_approved_by ON public.moment_final_grades(approved_by) WHERE approved_by IS NOT NULL;

CREATE TRIGGER trg_moment_final_grades_updated_at
  BEFORE UPDATE ON public.moment_final_grades
  FOR EACH ROW
  WHEN (OLD.* IS DISTINCT FROM NEW.*)
  EXECUTE FUNCTION siga_internal.set_updated_at();

CREATE TABLE public.pending_subject_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  school_year_id UUID NOT NULL REFERENCES public.school_years(id) ON DELETE RESTRICT,
  curriculum_subject_id UUID NOT NULL REFERENCES public.curriculum_subjects(id) ON DELETE RESTRICT,
  attempt_number SMALLINT NOT NULL CHECK (attempt_number BETWEEN 1 AND 4),
  exam_date DATE NOT NULL DEFAULT CURRENT_DATE,
  final_numeric SMALLINT NOT NULL CHECK (final_numeric BETWEEN 1 AND 20),
  passed BOOLEAN GENERATED ALWAYS AS (final_numeric >= 10) STORED,
  evaluator_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_user_id, school_year_id, curriculum_subject_id, attempt_number)
);

CREATE INDEX idx_pending_attempts_school_year ON public.pending_subject_attempts(school_year_id);
CREATE INDEX idx_pending_attempts_subject ON public.pending_subject_attempts(curriculum_subject_id);
CREATE INDEX idx_pending_attempts_evaluator ON public.pending_subject_attempts(evaluator_user_id);

CREATE TABLE public.grade_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_table TEXT NOT NULL,
  target_record_id UUID NOT NULL,
  enrollment_id UUID REFERENCES public.enrollments(id) ON DELETE RESTRICT,
  actor_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  action TEXT NOT NULL CHECK (
    action IN ('insert', 'update', 'reopen_moment', 'lock_moment', 'equivalence', 'role_change')
  ),
  previous_value JSONB,
  new_value JSONB NOT NULL,
  reason TEXT,
  ip_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_grade_audit_logs_enrollment_id ON public.grade_audit_logs(enrollment_id) WHERE enrollment_id IS NOT NULL;
CREATE INDEX idx_grade_audit_logs_actor_id ON public.grade_audit_logs(actor_user_id);
CREATE INDEX idx_grade_audit_logs_created_at ON public.grade_audit_logs(created_at DESC);

CREATE TRIGGER trg_grade_audit_logs_immutable
  BEFORE UPDATE OR DELETE ON public.grade_audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION siga_internal.prevent_audit_tamper();

-- ============================================================================
-- 7. DOMINIO 5B — ENTREGAS LMS, EXÁMENES, TUTOR IA Y MENCIONES TÉCNICAS
-- ============================================================================

CREATE TABLE public.assignment_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  enrollment_id UUID NOT NULL REFERENCES public.enrollments(id) ON DELETE RESTRICT,
  file_path TEXT,
  text_answer TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_late BOOLEAN NOT NULL DEFAULT false,
  ai_pre_evaluation JSONB,
  teacher_feedback TEXT,
  UNIQUE (assignment_id, enrollment_id),
  CHECK (file_path IS NOT NULL OR text_answer IS NOT NULL)
);

CREATE INDEX idx_assignment_submissions_enrollment ON public.assignment_submissions(enrollment_id);

CREATE TABLE public.exam_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  online_exam_id UUID NOT NULL REFERENCES public.online_exams(id) ON DELETE CASCADE,
  question_type TEXT NOT NULL CHECK (question_type IN ('single_choice', 'multiple_choice', 'true_false')),
  prompt TEXT NOT NULL,
  options_json JSONB NOT NULL,
  correct_answer_json JSONB NOT NULL,
  points NUMERIC(5,2) NOT NULL DEFAULT 1 CHECK (points > 0),
  generated_by_ai BOOLEAN NOT NULL DEFAULT false,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_exam_questions_exam_id ON public.exam_questions(online_exam_id, sort_order);

CREATE TABLE public.exam_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  online_exam_id UUID NOT NULL REFERENCES public.online_exams(id) ON DELETE RESTRICT,
  enrollment_id UUID NOT NULL REFERENCES public.enrollments(id) ON DELETE RESTRICT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  answers_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  computed_score NUMERIC(5,2),
  attempt_number SMALLINT NOT NULL DEFAULT 1 CHECK (attempt_number BETWEEN 1 AND 5),
  UNIQUE (online_exam_id, enrollment_id, attempt_number)
);

CREATE INDEX idx_exam_attempts_enrollment_id ON public.exam_attempts(enrollment_id);

CREATE TABLE public.ai_tutor_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  virtual_course_id UUID NOT NULL REFERENCES public.virtual_courses(id) ON DELETE CASCADE,
  student_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Consulta Socrática',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_tutor_threads_student_course ON public.ai_tutor_threads(student_user_id, virtual_course_id);
CREATE INDEX idx_ai_tutor_threads_course_id ON public.ai_tutor_threads(virtual_course_id);

CREATE TRIGGER trg_ai_tutor_threads_updated_at
  BEFORE UPDATE ON public.ai_tutor_threads
  FOR EACH ROW
  WHEN (OLD.* IS DISTINCT FROM NEW.*)
  EXECUTE FUNCTION siga_internal.set_updated_at();

CREATE TABLE public.ai_tutor_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.ai_tutor_threads(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('student', 'assistant')),
  content TEXT NOT NULL,
  citations_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_tutor_messages_thread_created ON public.ai_tutor_messages(thread_id, created_at);

CREATE TABLE public.mention_lab_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mencion_id UUID NOT NULL REFERENCES public.menciones(id) ON DELETE RESTRICT,
  grade_year SMALLINT NOT NULL CHECK (grade_year BETWEEN 1 AND 6),
  tool_type TEXT NOT NULL CHECK (
    tool_type IN (
      'telematica_sql',
      'telematica_network',
      'telematica_support_log',
      'aduanas_tariff',
      'aduanas_cif_fob',
      'aduanas_documentary',
      'turismo_routes',
      'turismo_events',
      'turismo_reception'
    )
  ),
  title TEXT NOT NULL,
  instructions TEXT NOT NULL,
  is_base_catalog BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  evaluation_item_id UUID REFERENCES public.evaluation_items(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mention_lab_scenarios_mencion_grade ON public.mention_lab_scenarios(mencion_id, grade_year);
CREATE INDEX idx_mention_lab_scenarios_created_by ON public.mention_lab_scenarios(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX idx_mention_lab_scenarios_eval_item ON public.mention_lab_scenarios(evaluation_item_id)
  WHERE evaluation_item_id IS NOT NULL;

CREATE TRIGGER trg_mention_lab_scenarios_updated_at
  BEFORE UPDATE ON public.mention_lab_scenarios
  FOR EACH ROW
  WHEN (OLD.* IS DISTINCT FROM NEW.*)
  EXECUTE FUNCTION siga_internal.set_updated_at();

CREATE TABLE public.mention_lab_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID NOT NULL REFERENCES public.mention_lab_scenarios(id) ON DELETE RESTRICT,
  enrollment_id UUID NOT NULL REFERENCES public.enrollments(id) ON DELETE RESTRICT,
  submission_payload JSONB NOT NULL,
  auto_check_result JSONB,
  teacher_score NUMERIC(5,2) CHECK (teacher_score IS NULL OR (teacher_score >= 0 AND teacher_score <= 20)),
  feedback TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mention_lab_submissions_scenario ON public.mention_lab_submissions(scenario_id);
CREATE INDEX idx_mention_lab_submissions_enrollment ON public.mention_lab_submissions(enrollment_id);

-- ============================================================================
-- 8. DOMINIO 4 — ASISTENCIA OFFLINE-FIRST, DIARIO E INASISTENCIA DOCENTE
-- ============================================================================

CREATE TABLE public.attendance_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_assignment_id UUID NOT NULL REFERENCES public.teacher_assignments(id) ON DELETE RESTRICT,
  momento_id UUID NOT NULL REFERENCES public.momentos(id) ON DELETE RESTRICT,
  session_date DATE NOT NULL,
  block_label TEXT NOT NULL,
  recorded_mode TEXT NOT NULL DEFAULT 'online' CHECK (
    recorded_mode IN ('online', 'offline_pwa', 'qr_scan')
  ),
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (teacher_assignment_id, session_date, block_label)
);

CREATE INDEX idx_attendance_sessions_momento_id ON public.attendance_sessions(momento_id);
CREATE INDEX idx_attendance_sessions_created_by ON public.attendance_sessions(created_by);

CREATE TABLE public.attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_session_id UUID NOT NULL REFERENCES public.attendance_sessions(id) ON DELETE CASCADE,
  enrollment_id UUID NOT NULL REFERENCES public.enrollments(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late', 'justified')),
  note TEXT,
  client_mutation_id UUID NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (attendance_session_id, enrollment_id)
);

CREATE INDEX idx_attendance_records_enrollment_id ON public.attendance_records(enrollment_id);

CREATE TABLE public.class_diary_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_assignment_id UUID NOT NULL REFERENCES public.teacher_assignments(id) ON DELETE RESTRICT,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  topic_covered TEXT NOT NULL,
  classroom_incidents TEXT,
  derive_to_orientation BOOLEAN NOT NULL DEFAULT false,
  author_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_class_diary_assignment_date ON public.class_diary_entries(teacher_assignment_id, entry_date DESC);
CREATE INDEX idx_class_diary_author ON public.class_diary_entries(author_user_id);

CREATE TABLE public.teacher_absences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  absence_date DATE NOT NULL,
  affected_blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
  reason_category TEXT NOT NULL CHECK (reason_category IN ('medical', 'personal', 'institutional')),
  observation TEXT,
  status TEXT NOT NULL DEFAULT 'reported' CHECK (status IN ('reported', 'acknowledged', 'reorganized')),
  reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_teacher_absences_teacher_date ON public.teacher_absences(teacher_user_id, absence_date DESC);
CREATE INDEX idx_teacher_absences_reviewed_by ON public.teacher_absences(reviewed_by) WHERE reviewed_by IS NOT NULL;

CREATE TRIGGER trg_teacher_absences_updated_at
  BEFORE UPDATE ON public.teacher_absences
  FOR EACH ROW
  WHEN (OLD.* IS DISTINCT FROM NEW.*)
  EXECUTE FUNCTION siga_internal.set_updated_at();

-- ============================================================================
-- 9. DOMINIO 6 — ORIENTACIÓN Y PSICOPEDAGOGÍA (CONFIDENCIALIDAD K12)
-- ============================================================================

CREATE TABLE public.orientation_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  school_year_id UUID NOT NULL REFERENCES public.school_years(id) ON DELETE RESTRICT,
  case_code TEXT NOT NULL UNIQUE,
  record_category TEXT NOT NULL CHECK (
    record_category IN (
      'acta_compromiso',
      'acuerdo_convivencia',
      'vulnerabilidad_socioeconomica',
      'seguimiento_psicopedagogico'
    )
  ),
  summary TEXT NOT NULL,
  confidential_notes_encrypted TEXT,
  risk_level TEXT NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high')),
  opened_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'monitoring', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_orientation_records_student ON public.orientation_records(student_user_id);
CREATE INDEX idx_orientation_records_school_year ON public.orientation_records(school_year_id);
CREATE INDEX idx_orientation_records_opened_by ON public.orientation_records(opened_by);

CREATE TRIGGER trg_orientation_records_updated_at
  BEFORE UPDATE ON public.orientation_records
  FOR EACH ROW
  WHEN (OLD.* IS DISTINCT FROM NEW.*)
  EXECUTE FUNCTION siga_internal.set_updated_at();

CREATE TABLE public.orientation_followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orientation_record_id UUID NOT NULL REFERENCES public.orientation_records(id) ON DELETE CASCADE,
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  observations TEXT NOT NULL,
  agreements TEXT,
  next_review_date DATE,
  recorded_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_orientation_followups_record_id ON public.orientation_followups(orientation_record_id, session_date DESC);
CREATE INDEX idx_orientation_followups_recorded_by ON public.orientation_followups(recorded_by);

-- ============================================================================
-- 10. DOMINIO 7 — PASANTÍAS Y SERVICIO COMUNITARIO (6.º AÑO)
-- ============================================================================

CREATE TABLE public.internship_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rif TEXT NOT NULL UNIQUE CHECK (rif ~ '^[VEJG][0-9]{7,10}$'),
  business_name TEXT NOT NULL,
  sector TEXT NOT NULL CHECK (sector IN ('telematica', 'aduanas', 'turismo', 'administracion')),
  parish_zone TEXT NOT NULL,
  address TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_email TEXT,
  contact_phone TEXT,
  available_slots SMALLINT NOT NULL DEFAULT 1 CHECK (available_slots >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_internship_companies_updated_at
  BEFORE UPDATE ON public.internship_companies
  FOR EACH ROW
  WHEN (OLD.* IS DISTINCT FROM NEW.*)
  EXECUTE FUNCTION siga_internal.set_updated_at();

CREATE TABLE public.internship_placements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL UNIQUE REFERENCES public.enrollments(id) ON DELETE RESTRICT,
  company_id UUID NOT NULL REFERENCES public.internship_companies(id) ON DELETE RESTRICT,
  academic_tutor_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  company_tutor_name TEXT NOT NULL,
  company_tutor_email TEXT,
  ai_match_score NUMERIC(5,2) CHECK (ai_match_score IS NULL OR (ai_match_score BETWEEN 0 AND 100)),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'candidate' CHECK (
    status IN ('candidate', 'postulated', 'active', 'completed', 'cancelled')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);

CREATE INDEX idx_internship_placements_company_id ON public.internship_placements(company_id);
CREATE INDEX idx_internship_placements_tutor_id ON public.internship_placements(academic_tutor_user_id);

CREATE TRIGGER trg_internship_placements_updated_at
  BEFORE UPDATE ON public.internship_placements
  FOR EACH ROW
  WHEN (OLD.* IS DISTINCT FROM NEW.*)
  EXECUTE FUNCTION siga_internal.set_updated_at();

CREATE TABLE public.internship_weekly_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  placement_id UUID NOT NULL REFERENCES public.internship_placements(id) ON DELETE CASCADE,
  week_number SMALLINT NOT NULL CHECK (week_number BETWEEN 1 AND 30),
  hours_logged NUMERIC(4,1) NOT NULL CHECK (hours_logged > 0 AND hours_logged <= 60),
  activities_summary TEXT NOT NULL,
  tutor_approved BOOLEAN NOT NULL DEFAULT false,
  tutor_comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (placement_id, week_number)
);

CREATE TRIGGER trg_internship_weekly_logs_updated_at
  BEFORE UPDATE ON public.internship_weekly_logs
  FOR EACH ROW
  WHEN (OLD.* IS DISTINCT FROM NEW.*)
  EXECUTE FUNCTION siga_internal.set_updated_at();

CREATE TABLE public.internship_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  placement_id UUID NOT NULL REFERENCES public.internship_placements(id) ON DELETE CASCADE,
  version_number SMALLINT NOT NULL DEFAULT 1 CHECK (version_number >= 1),
  file_path_or_drive_id TEXT NOT NULL,
  ai_normative_review JSONB,
  academic_status TEXT NOT NULL DEFAULT 'draft' CHECK (
    academic_status IN ('draft', 'ai_reviewed', 'submitted', 'approved', 'changes_requested')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (placement_id, version_number)
);

CREATE TABLE public.internship_magic_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  placement_id UUID NOT NULL REFERENCES public.internship_placements(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  tutor_email TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  max_uses SMALLINT NOT NULL DEFAULT 1 CHECK (max_uses = 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_internship_magic_links_placement ON public.internship_magic_links(placement_id);

CREATE TABLE public.internship_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  placement_id UUID NOT NULL REFERENCES public.internship_placements(id) ON DELETE RESTRICT,
  evaluator_type TEXT NOT NULL CHECK (evaluator_type IN ('company_tutor', 'academic_tutor')),
  magic_link_id UUID REFERENCES public.internship_magic_links(id) ON DELETE SET NULL,
  rubric_scores_json JSONB NOT NULL,
  final_score NUMERIC(5,2) NOT NULL CHECK (final_score BETWEEN 0 AND 20),
  observations TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (placement_id, evaluator_type)
);

CREATE INDEX idx_internship_evaluations_magic_link ON public.internship_evaluations(magic_link_id)
  WHERE magic_link_id IS NOT NULL;

-- ============================================================================
-- 11. DOMINIO 8 — BIBLIOTECA ESCOLAR Y EQUIPOS AUDIOVISUALES
-- ============================================================================

CREATE TABLE public.library_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('book', 'technical_manual', 'thesis_project', 'reference')),
  mencion_id UUID REFERENCES public.menciones(id) ON DELETE SET NULL,
  total_copies SMALLINT NOT NULL DEFAULT 1 CHECK (total_copies >= 0),
  available_copies SMALLINT NOT NULL DEFAULT 1 CHECK (available_copies >= 0 AND available_copies <= total_copies),
  cover_webp_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_library_items_mencion_id ON public.library_items(mencion_id) WHERE mencion_id IS NOT NULL;

CREATE TRIGGER trg_library_items_updated_at
  BEFORE UPDATE ON public.library_items
  FOR EACH ROW
  WHEN (OLD.* IS DISTINCT FROM NEW.*)
  EXECUTE FUNCTION siga_internal.set_updated_at();

CREATE TABLE public.library_loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_item_id UUID NOT NULL REFERENCES public.library_items(id) ON DELETE RESTRICT,
  borrower_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  issued_by_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  loaned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_date DATE NOT NULL,
  returned_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'overdue', 'returned', 'lost')),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_library_loans_item_id ON public.library_loans(library_item_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_library_loans_borrower_id ON public.library_loans(borrower_user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_library_loans_issued_by ON public.library_loans(issued_by_user_id);

CREATE TABLE public.audiovisual_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_qr_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('videobeam', 'laptop', 'audio', 'didactic_kit')),
  condition_status TEXT NOT NULL DEFAULT 'available' CHECK (
    condition_status IN ('available', 'damaged', 'retired')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.audiovisual_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID NOT NULL REFERENCES public.audiovisual_resources(id) ON DELETE RESTRICT,
  teacher_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  reserved_date DATE NOT NULL,
  block_start TIME NOT NULL,
  block_end TIME NOT NULL,
  slot_range TSRANGE GENERATED ALWAYS AS (
    tsrange(reserved_date + block_start, reserved_date + block_end, '[)')
  ) STORED,
  purpose TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'reserved' CHECK (
    status IN ('reserved', 'checked_out', 'returned', 'cancelled')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CHECK (block_end > block_start)
);

ALTER TABLE public.audiovisual_reservations
  ADD CONSTRAINT excl_audiovisual_no_overlap
  EXCLUDE USING gist (resource_id WITH =, slot_range WITH &&)
  WHERE (deleted_at IS NULL AND status IN ('reserved', 'checked_out'));

CREATE INDEX idx_audiovisual_reservations_teacher ON public.audiovisual_reservations(teacher_user_id)
  WHERE deleted_at IS NULL;

-- ============================================================================
-- 12. DOMINIO 9 — NOTIFICACIONES INTERNAS (IN-APP + CORREO)
-- ============================================================================

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (
    category IN (
      'academic_grade',
      'lms_task',
      'library_due',
      'pasantias',
      'request_status',
      'teacher_absence',
      'sla_alert',
      'early_risk'
    )
  ),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  action_url TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_recipient_unread
  ON public.notifications(recipient_user_id, created_at DESC)
  WHERE is_read = false;

CREATE TABLE public.notification_email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID REFERENCES public.notifications(id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('mailtrap', 'resend')),
  template_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed')),
  provider_message_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notification_email_logs_notification ON public.notification_email_logs(notification_id)
  WHERE notification_id IS NOT NULL;

-- ============================================================================
-- 13. HELPERS INTERNOS DE AUTORIZACIÓN Y RLS (`siga_internal`)
-- ============================================================================

CREATE OR REPLACE FUNCTION siga_internal.current_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT u.id
    FROM public.users u
   WHERE u.auth_user_id = (SELECT auth.uid())
     AND u.deleted_at IS NULL
     AND u.is_active = true
     AND u.access_tier <> 'suspended'
   LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION siga_internal.is_verified_workspace()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.users u
     WHERE u.id = (SELECT siga_internal.current_user_id())
       AND u.access_tier = 'verified_workspace'
  );
$$;

CREATE OR REPLACE FUNCTION siga_internal.has_any_role(p_role_codes TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      JOIN public.users u ON u.id = ur.user_id
     WHERE ur.user_id = (SELECT siga_internal.current_user_id())
       AND ur.is_active = true
       AND r.is_active = true
       AND r.code = ANY(p_role_codes)
       AND ur.valid_from <= CURRENT_DATE
       AND (ur.valid_until IS NULL OR ur.valid_until >= CURRENT_DATE)
       AND (NOT r.requires_workspace OR u.access_tier = 'verified_workspace')
  );
$$;

CREATE OR REPLACE FUNCTION siga_internal.is_coord_of_mencion(p_mencion_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT p_mencion_id IS NOT NULL AND EXISTS (
    SELECT 1
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
     WHERE ur.user_id = (SELECT siga_internal.current_user_id())
       AND ur.is_active = true
       AND r.code = 'coordinador_mencion'
       AND ur.mencion_id = p_mencion_id
       AND ur.valid_from <= CURRENT_DATE
       AND (ur.valid_until IS NULL OR ur.valid_until >= CURRENT_DATE)
       AND (SELECT siga_internal.is_verified_workspace())
  );
$$;

CREATE OR REPLACE FUNCTION siga_internal.teaches_assignment(p_assignment_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.teacher_assignments ta
     WHERE ta.id = p_assignment_id
       AND ta.teacher_user_id = (SELECT siga_internal.current_user_id())
       AND ta.is_active = true
       AND (SELECT siga_internal.has_any_role(ARRAY['docente']))
  );
$$;

CREATE OR REPLACE FUNCTION siga_internal.teaches_enrollment(p_enrollment_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.enrollments e
      JOIN public.teacher_assignments ta
        ON ta.section_id = e.section_id
       AND ta.school_year_id = e.school_year_id
     WHERE e.id = p_enrollment_id
       AND e.deleted_at IS NULL
       AND ta.teacher_user_id = (SELECT siga_internal.current_user_id())
       AND ta.is_active = true
       AND (SELECT siga_internal.has_any_role(ARRAY['docente']))
  );
$$;

CREATE OR REPLACE FUNCTION siga_internal.owns_enrollment(p_enrollment_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.enrollments e
     WHERE e.id = p_enrollment_id
       AND e.student_user_id = (SELECT siga_internal.current_user_id())
       AND e.deleted_at IS NULL
  );
$$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA siga_internal FROM PUBLIC, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA siga_internal TO authenticated, service_role;

-- ============================================================================
-- 14. ACTIVACIÓN DE RLS EN TODAS LAS TABLAS + POLÍTICAS CONSOLIDADAS (INITPLAN)
-- ============================================================================

ALTER TABLE public.menciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identity_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.momentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curriculum_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_dossier_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.official_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.virtual_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rag_material_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.online_exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluation_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moment_final_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_subject_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grade_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_tutor_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_tutor_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mention_lab_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mention_lab_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_diary_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_absences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orientation_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orientation_followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internship_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internship_placements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internship_weekly_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internship_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internship_magic_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internship_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audiovisual_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audiovisual_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_email_logs ENABLE ROW LEVEL SECURITY;

-- Catálogos estructurales (lectura autenticada; escritura solo Dirección / Control)
CREATE POLICY pol_menciones_select ON public.menciones FOR SELECT TO authenticated USING (true);
CREATE POLICY pol_menciones_insert ON public.menciones FOR INSERT TO authenticated
  WITH CHECK ((select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios'])));
CREATE POLICY pol_menciones_update ON public.menciones FOR UPDATE TO authenticated
  USING ((select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios'])))
  WITH CHECK ((select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios'])));
CREATE POLICY pol_menciones_delete ON public.menciones FOR DELETE TO authenticated
  USING ((select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios'])));

CREATE POLICY pol_roles_select ON public.roles FOR SELECT TO authenticated USING (true);
CREATE POLICY pol_roles_insert ON public.roles FOR INSERT TO authenticated
  WITH CHECK ((select siga_internal.has_any_role(ARRAY['direccion'])));
CREATE POLICY pol_roles_update ON public.roles FOR UPDATE TO authenticated
  USING ((select siga_internal.has_any_role(ARRAY['direccion'])))
  WITH CHECK ((select siga_internal.has_any_role(ARRAY['direccion'])));
CREATE POLICY pol_roles_delete ON public.roles FOR DELETE TO authenticated
  USING ((select siga_internal.has_any_role(ARRAY['direccion'])));

CREATE POLICY pol_permissions_select ON public.permissions FOR SELECT TO authenticated
  USING ((select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios'])));
CREATE POLICY pol_role_permissions_select ON public.role_permissions FOR SELECT TO authenticated
  USING ((select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios'])));

-- Users, User Roles, Identity Verifications
CREATE POLICY pol_users_select ON public.users FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL AND (
      id = (select siga_internal.current_user_id())
      OR (select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios', 'orientacion', 'coordinador_pasantias', 'biblioteca']))
      OR EXISTS (
        SELECT 1 FROM public.enrollments e
         WHERE e.student_user_id = users.id
           AND e.deleted_at IS NULL
           AND (
             (select siga_internal.teaches_enrollment(e.id))
             OR (select siga_internal.is_coord_of_mencion(e.mencion_id))
           )
      )
    )
  );

CREATE POLICY pol_users_insert ON public.users FOR INSERT TO authenticated
  WITH CHECK ((select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios'])));

CREATE POLICY pol_users_update ON public.users FOR UPDATE TO authenticated
  USING (
    id = (select siga_internal.current_user_id())
    OR (select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios']))
  )
  WITH CHECK (
    id = (select siga_internal.current_user_id())
    OR (select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios']))
  );

CREATE POLICY pol_user_roles_select ON public.user_roles FOR SELECT TO authenticated
  USING (
    user_id = (select siga_internal.current_user_id())
    OR (select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios']))
  );

CREATE POLICY pol_identity_verifications_select ON public.identity_verifications FOR SELECT TO authenticated
  USING (user_id = (select siga_internal.current_user_id()));

-- Estructura Académica
CREATE POLICY pol_school_years_select ON public.school_years FOR SELECT TO authenticated USING (true);
CREATE POLICY pol_school_years_insert ON public.school_years FOR INSERT TO authenticated
  WITH CHECK ((select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios'])));
CREATE POLICY pol_school_years_update ON public.school_years FOR UPDATE TO authenticated
  USING ((select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios'])))
  WITH CHECK ((select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios'])));
CREATE POLICY pol_school_years_delete ON public.school_years FOR DELETE TO authenticated
  USING ((select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios'])));

CREATE POLICY pol_momentos_select ON public.momentos FOR SELECT TO authenticated USING (true);
CREATE POLICY pol_momentos_insert ON public.momentos FOR INSERT TO authenticated
  WITH CHECK ((select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios'])));
CREATE POLICY pol_momentos_update ON public.momentos FOR UPDATE TO authenticated
  USING ((select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios'])))
  WITH CHECK ((select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios'])));
CREATE POLICY pol_momentos_delete ON public.momentos FOR DELETE TO authenticated
  USING ((select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios'])));

CREATE POLICY pol_subjects_select ON public.subjects FOR SELECT TO authenticated USING (true);
CREATE POLICY pol_subjects_insert ON public.subjects FOR INSERT TO authenticated
  WITH CHECK ((select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios'])));
CREATE POLICY pol_subjects_update ON public.subjects FOR UPDATE TO authenticated
  USING ((select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios'])))
  WITH CHECK ((select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios'])));
CREATE POLICY pol_subjects_delete ON public.subjects FOR DELETE TO authenticated
  USING ((select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios'])));

CREATE POLICY pol_curriculum_subjects_select ON public.curriculum_subjects FOR SELECT TO authenticated USING (true);
CREATE POLICY pol_curriculum_subjects_insert ON public.curriculum_subjects FOR INSERT TO authenticated
  WITH CHECK ((select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios'])));
CREATE POLICY pol_curriculum_subjects_update ON public.curriculum_subjects FOR UPDATE TO authenticated
  USING ((select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios'])))
  WITH CHECK ((select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios'])));
CREATE POLICY pol_curriculum_subjects_delete ON public.curriculum_subjects FOR DELETE TO authenticated
  USING ((select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios'])));

CREATE POLICY pol_sections_select ON public.sections FOR SELECT TO authenticated USING (deleted_at IS NULL);
CREATE POLICY pol_sections_insert ON public.sections FOR INSERT TO authenticated
  WITH CHECK ((select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios'])));
CREATE POLICY pol_sections_update ON public.sections FOR UPDATE TO authenticated
  USING ((select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios'])))
  WITH CHECK ((select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios'])));
CREATE POLICY pol_sections_delete ON public.sections FOR DELETE TO authenticated
  USING ((select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios'])));

CREATE POLICY pol_teacher_assignments_select ON public.teacher_assignments FOR SELECT TO authenticated
  USING (
    teacher_user_id = (select siga_internal.current_user_id())
    OR (select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios']))
    OR EXISTS (
      SELECT 1 FROM public.sections s
       WHERE s.id = teacher_assignments.section_id
         AND (select siga_internal.is_coord_of_mencion(s.mencion_id))
    )
    OR EXISTS (
      SELECT 1 FROM public.enrollments e
       WHERE e.section_id = teacher_assignments.section_id
         AND e.school_year_id = teacher_assignments.school_year_id
         AND e.student_user_id = (select siga_internal.current_user_id())
         AND e.deleted_at IS NULL
    )
  );
CREATE POLICY pol_teacher_assignments_insert ON public.teacher_assignments FOR INSERT TO authenticated
  WITH CHECK ((select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios'])));
CREATE POLICY pol_teacher_assignments_update ON public.teacher_assignments FOR UPDATE TO authenticated
  USING ((select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios'])))
  WITH CHECK ((select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios'])));
CREATE POLICY pol_teacher_assignments_delete ON public.teacher_assignments FOR DELETE TO authenticated
  USING ((select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios'])));

-- Matrícula, Expediente y Solicitudes
CREATE POLICY pol_enrollments_select ON public.enrollments FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL AND (
      student_user_id = (select siga_internal.current_user_id())
      OR (select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios', 'orientacion']))
      OR ((select siga_internal.has_any_role(ARRAY['coordinador_pasantias'])) AND grade_year = 6)
      OR (select siga_internal.is_coord_of_mencion(mencion_id))
      OR (select siga_internal.teaches_enrollment(id))
    )
  );
CREATE POLICY pol_enrollments_insert ON public.enrollments FOR INSERT TO authenticated
  WITH CHECK ((select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios'])));
CREATE POLICY pol_enrollments_update ON public.enrollments FOR UPDATE TO authenticated
  USING ((select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios'])))
  WITH CHECK ((select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios'])));
CREATE POLICY pol_enrollments_delete ON public.enrollments FOR DELETE TO authenticated
  USING ((select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios'])));

CREATE POLICY pol_student_dossier_select ON public.student_dossier_documents FOR SELECT TO authenticated
  USING (
    student_user_id = (select siga_internal.current_user_id())
    OR (select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios']))
  );
CREATE POLICY pol_student_dossier_insert ON public.student_dossier_documents FOR INSERT TO authenticated
  WITH CHECK ((select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios'])));
CREATE POLICY pol_student_dossier_update ON public.student_dossier_documents FOR UPDATE TO authenticated
  USING ((select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios'])))
  WITH CHECK ((select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios'])));
CREATE POLICY pol_student_dossier_delete ON public.student_dossier_documents FOR DELETE TO authenticated
  USING ((select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios'])));

CREATE POLICY pol_official_documents_select ON public.official_documents FOR SELECT TO authenticated
  USING (
    student_user_id = (select siga_internal.current_user_id())
    OR (select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios', 'coordinador_pasantias', 'biblioteca']))
  );
CREATE POLICY pol_official_documents_insert ON public.official_documents FOR INSERT TO authenticated
  WITH CHECK ((select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios', 'coordinador_pasantias', 'biblioteca'])));
CREATE POLICY pol_official_documents_update ON public.official_documents FOR UPDATE TO authenticated
  USING ((select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios'])))
  WITH CHECK ((select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios'])));

CREATE POLICY pol_student_requests_select ON public.student_requests FOR SELECT TO authenticated
  USING (
    student_user_id = (select siga_internal.current_user_id())
    OR (select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios']))
  );
CREATE POLICY pol_student_requests_insert ON public.student_requests FOR INSERT TO authenticated
  WITH CHECK (
    student_user_id = (select siga_internal.current_user_id())
    AND (select siga_internal.owns_enrollment(enrollment_id))
  );
CREATE POLICY pol_student_requests_update ON public.student_requests FOR UPDATE TO authenticated
  USING ((select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios'])))
  WITH CHECK ((select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios'])));

-- Planes de Evaluación, Notas y Auditoría Inmutable
CREATE POLICY pol_eval_plans_select ON public.evaluation_plans FOR SELECT TO authenticated
  USING (
    (select siga_internal.teaches_assignment(teacher_assignment_id))
    OR (select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios']))
    OR EXISTS (
      SELECT 1 FROM public.teacher_assignments ta
      JOIN public.sections s ON s.id = ta.section_id
       WHERE ta.id = evaluation_plans.teacher_assignment_id
         AND (select siga_internal.is_coord_of_mencion(s.mencion_id))
    )
    OR (
      status IN ('published', 'locked') AND (select siga_internal.is_verified_workspace()) AND EXISTS (
        SELECT 1 FROM public.teacher_assignments ta
        JOIN public.enrollments e ON e.section_id = ta.section_id AND e.school_year_id = ta.school_year_id
         WHERE ta.id = evaluation_plans.teacher_assignment_id
           AND e.student_user_id = (select siga_internal.current_user_id())
           AND e.deleted_at IS NULL
      )
    )
  );
CREATE POLICY pol_eval_plans_insert ON public.evaluation_plans FOR INSERT TO authenticated
  WITH CHECK ((select siga_internal.teaches_assignment(teacher_assignment_id)) OR (select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios'])));
CREATE POLICY pol_eval_plans_update ON public.evaluation_plans FOR UPDATE TO authenticated
  USING ((select siga_internal.teaches_assignment(teacher_assignment_id)) OR (select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios'])))
  WITH CHECK ((select siga_internal.teaches_assignment(teacher_assignment_id)) OR (select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios'])));
CREATE POLICY pol_eval_plans_delete ON public.evaluation_plans FOR DELETE TO authenticated
  USING ((select siga_internal.teaches_assignment(teacher_assignment_id)) OR (select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios'])));

CREATE POLICY pol_eval_items_select ON public.evaluation_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.evaluation_plans ep
       WHERE ep.id = evaluation_items.evaluation_plan_id
         AND (
           (select siga_internal.teaches_assignment(ep.teacher_assignment_id))
           OR (select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios']))
           OR (ep.status IN ('published', 'locked') AND (select siga_internal.is_verified_workspace()))
         )
    )
  );
CREATE POLICY pol_eval_items_insert ON public.evaluation_items FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.evaluation_plans ep
       WHERE ep.id = evaluation_items.evaluation_plan_id
         AND ((select siga_internal.teaches_assignment(ep.teacher_assignment_id)) OR (select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios'])))
    )
  );
CREATE POLICY pol_eval_items_update ON public.evaluation_items FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.evaluation_plans ep
       WHERE ep.id = evaluation_items.evaluation_plan_id
         AND ((select siga_internal.teaches_assignment(ep.teacher_assignment_id)) OR (select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios'])))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.evaluation_plans ep
       WHERE ep.id = evaluation_items.evaluation_plan_id
         AND ((select siga_internal.teaches_assignment(ep.teacher_assignment_id)) OR (select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios'])))
    )
  );
CREATE POLICY pol_eval_items_delete ON public.evaluation_items FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.evaluation_plans ep
       WHERE ep.id = evaluation_items.evaluation_plan_id
         AND ((select siga_internal.teaches_assignment(ep.teacher_assignment_id)) OR (select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios'])))
    )
  );

CREATE POLICY pol_student_scores_select ON public.student_scores FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL AND (
      (select siga_internal.owns_enrollment(enrollment_id))
      OR (select siga_internal.teaches_enrollment(enrollment_id))
      OR (select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios']))
    )
  );

CREATE POLICY pol_moment_final_grades_select ON public.moment_final_grades FOR SELECT TO authenticated
  USING (
    (select siga_internal.owns_enrollment(enrollment_id))
    OR (select siga_internal.teaches_enrollment(enrollment_id))
    OR (select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios', 'orientacion']))
    OR EXISTS (
      SELECT 1 FROM public.enrollments e
       WHERE e.id = moment_final_grades.enrollment_id
         AND (select siga_internal.is_coord_of_mencion(e.mencion_id))
    )
  );

CREATE POLICY pol_pending_attempts_select ON public.pending_subject_attempts FOR SELECT TO authenticated
  USING (
    student_user_id = (select siga_internal.current_user_id())
    OR (select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios', 'docente']))
  );
CREATE POLICY pol_pending_attempts_insert ON public.pending_subject_attempts FOR INSERT TO authenticated
  WITH CHECK ((select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios'])));
CREATE POLICY pol_pending_attempts_update ON public.pending_subject_attempts FOR UPDATE TO authenticated
  USING ((select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios'])))
  WITH CHECK ((select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios'])));
CREATE POLICY pol_pending_attempts_delete ON public.pending_subject_attempts FOR DELETE TO authenticated
  USING ((select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios'])));

CREATE POLICY pol_grade_audit_logs_select ON public.grade_audit_logs FOR SELECT TO authenticated
  USING (
    (select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios']))
    OR EXISTS (
      SELECT 1 FROM public.enrollments e
       WHERE e.id = grade_audit_logs.enrollment_id
         AND (select siga_internal.is_coord_of_mencion(e.mencion_id))
    )
  );

-- Aula Virtual, RAG pgvector y Menciones
CREATE POLICY pol_virtual_courses_select ON public.virtual_courses FOR SELECT TO authenticated
  USING (
    (select siga_internal.teaches_assignment(teacher_assignment_id))
    OR (select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios']))
    OR EXISTS (
      SELECT 1 FROM public.teacher_assignments ta
      JOIN public.sections s ON s.id = ta.section_id
       WHERE ta.id = virtual_courses.teacher_assignment_id
         AND (select siga_internal.is_coord_of_mencion(s.mencion_id))
    )
    OR (
      is_published = true AND (select siga_internal.is_verified_workspace()) AND EXISTS (
        SELECT 1 FROM public.teacher_assignments ta
        JOIN public.enrollments e ON e.section_id = ta.section_id AND e.school_year_id = ta.school_year_id
         WHERE ta.id = virtual_courses.teacher_assignment_id
           AND e.student_user_id = (select siga_internal.current_user_id())
           AND e.deleted_at IS NULL
      )
    )
  );
CREATE POLICY pol_virtual_courses_insert ON public.virtual_courses FOR INSERT TO authenticated
  WITH CHECK ((select siga_internal.teaches_assignment(teacher_assignment_id)) OR (select siga_internal.has_any_role(ARRAY['direccion'])));
CREATE POLICY pol_virtual_courses_update ON public.virtual_courses FOR UPDATE TO authenticated
  USING ((select siga_internal.teaches_assignment(teacher_assignment_id)) OR (select siga_internal.has_any_role(ARRAY['direccion'])))
  WITH CHECK ((select siga_internal.teaches_assignment(teacher_assignment_id)) OR (select siga_internal.has_any_role(ARRAY['direccion'])));
CREATE POLICY pol_virtual_courses_delete ON public.virtual_courses FOR DELETE TO authenticated
  USING ((select siga_internal.teaches_assignment(teacher_assignment_id)) OR (select siga_internal.has_any_role(ARRAY['direccion'])));

CREATE POLICY pol_course_modules_select ON public.course_modules FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.virtual_courses vc
       WHERE vc.id = course_modules.virtual_course_id
         AND ((select siga_internal.teaches_assignment(vc.teacher_assignment_id)) OR (is_visible = true AND (select siga_internal.is_verified_workspace())))
    )
  );
CREATE POLICY pol_course_modules_insert ON public.course_modules FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.virtual_courses vc
       WHERE vc.id = course_modules.virtual_course_id
         AND ((select siga_internal.teaches_assignment(vc.teacher_assignment_id)) OR (select siga_internal.has_any_role(ARRAY['direccion'])))
    )
  );
CREATE POLICY pol_course_modules_update ON public.course_modules FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.virtual_courses vc
       WHERE vc.id = course_modules.virtual_course_id
         AND ((select siga_internal.teaches_assignment(vc.teacher_assignment_id)) OR (select siga_internal.has_any_role(ARRAY['direccion'])))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.virtual_courses vc
       WHERE vc.id = course_modules.virtual_course_id
         AND ((select siga_internal.teaches_assignment(vc.teacher_assignment_id)) OR (select siga_internal.has_any_role(ARRAY['direccion'])))
    )
  );
CREATE POLICY pol_course_modules_delete ON public.course_modules FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.virtual_courses vc
       WHERE vc.id = course_modules.virtual_course_id
         AND ((select siga_internal.teaches_assignment(vc.teacher_assignment_id)) OR (select siga_internal.has_any_role(ARRAY['direccion'])))
    )
  );

CREATE POLICY pol_course_materials_select ON public.course_materials FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.course_modules cm
      JOIN public.virtual_courses vc ON vc.id = cm.virtual_course_id
       WHERE cm.id = course_materials.course_module_id
         AND ((select siga_internal.teaches_assignment(vc.teacher_assignment_id)) OR (cm.is_visible = true AND (select siga_internal.is_verified_workspace())))
    )
  );
CREATE POLICY pol_course_materials_insert ON public.course_materials FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.course_modules cm
      JOIN public.virtual_courses vc ON vc.id = cm.virtual_course_id
       WHERE cm.id = course_materials.course_module_id
         AND ((select siga_internal.teaches_assignment(vc.teacher_assignment_id)) OR (select siga_internal.has_any_role(ARRAY['direccion'])))
    )
  );
CREATE POLICY pol_course_materials_update ON public.course_materials FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.course_modules cm
      JOIN public.virtual_courses vc ON vc.id = cm.virtual_course_id
       WHERE cm.id = course_materials.course_module_id
         AND ((select siga_internal.teaches_assignment(vc.teacher_assignment_id)) OR (select siga_internal.has_any_role(ARRAY['direccion'])))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.course_modules cm
      JOIN public.virtual_courses vc ON vc.id = cm.virtual_course_id
       WHERE cm.id = course_materials.course_module_id
         AND ((select siga_internal.teaches_assignment(vc.teacher_assignment_id)) OR (select siga_internal.has_any_role(ARRAY['direccion'])))
    )
  );
CREATE POLICY pol_course_materials_delete ON public.course_materials FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.course_modules cm
      JOIN public.virtual_courses vc ON vc.id = cm.virtual_course_id
       WHERE cm.id = course_materials.course_module_id
         AND ((select siga_internal.teaches_assignment(vc.teacher_assignment_id)) OR (select siga_internal.has_any_role(ARRAY['direccion'])))
    )
  );

CREATE POLICY pol_rag_chunks_select ON public.rag_material_chunks FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.virtual_courses vc
       WHERE vc.id = rag_material_chunks.virtual_course_id
         AND ((select siga_internal.teaches_assignment(vc.teacher_assignment_id)) OR (select siga_internal.has_any_role(ARRAY['direccion'])))
    )
  );

CREATE POLICY pol_assignments_select ON public.assignments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.course_modules cm
      JOIN public.virtual_courses vc ON vc.id = cm.virtual_course_id
       WHERE cm.id = assignments.course_module_id
         AND ((select siga_internal.teaches_assignment(vc.teacher_assignment_id)) OR (select siga_internal.is_verified_workspace()))
    )
  );
CREATE POLICY pol_assignments_insert ON public.assignments FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.course_modules cm
      JOIN public.virtual_courses vc ON vc.id = cm.virtual_course_id
       WHERE cm.id = assignments.course_module_id
         AND ((select siga_internal.teaches_assignment(vc.teacher_assignment_id)) OR (select siga_internal.has_any_role(ARRAY['direccion'])))
    )
  );
CREATE POLICY pol_assignments_update ON public.assignments FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.course_modules cm
      JOIN public.virtual_courses vc ON vc.id = cm.virtual_course_id
       WHERE cm.id = assignments.course_module_id
         AND ((select siga_internal.teaches_assignment(vc.teacher_assignment_id)) OR (select siga_internal.has_any_role(ARRAY['direccion'])))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.course_modules cm
      JOIN public.virtual_courses vc ON vc.id = cm.virtual_course_id
       WHERE cm.id = assignments.course_module_id
         AND ((select siga_internal.teaches_assignment(vc.teacher_assignment_id)) OR (select siga_internal.has_any_role(ARRAY['direccion'])))
    )
  );
CREATE POLICY pol_assignments_delete ON public.assignments FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.course_modules cm
      JOIN public.virtual_courses vc ON vc.id = cm.virtual_course_id
       WHERE cm.id = assignments.course_module_id
         AND ((select siga_internal.teaches_assignment(vc.teacher_assignment_id)) OR (select siga_internal.has_any_role(ARRAY['direccion'])))
    )
  );

CREATE POLICY pol_assignment_submissions_select ON public.assignment_submissions FOR SELECT TO authenticated
  USING (
    (select siga_internal.owns_enrollment(enrollment_id))
    OR (select siga_internal.teaches_enrollment(enrollment_id))
    OR (select siga_internal.has_any_role(ARRAY['direccion']))
  );
CREATE POLICY pol_assignment_submissions_insert ON public.assignment_submissions FOR INSERT TO authenticated
  WITH CHECK ((select siga_internal.owns_enrollment(enrollment_id)) AND (select siga_internal.is_verified_workspace()));
CREATE POLICY pol_assignment_submissions_update ON public.assignment_submissions FOR UPDATE TO authenticated
  USING ((select siga_internal.teaches_enrollment(enrollment_id)) OR (select siga_internal.owns_enrollment(enrollment_id)))
  WITH CHECK ((select siga_internal.teaches_enrollment(enrollment_id)) OR (select siga_internal.owns_enrollment(enrollment_id)));

CREATE POLICY pol_online_exams_select ON public.online_exams FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.virtual_courses vc
       WHERE vc.id = online_exams.virtual_course_id
         AND ((select siga_internal.teaches_assignment(vc.teacher_assignment_id)) OR (select siga_internal.is_verified_workspace()))
    )
  );
CREATE POLICY pol_online_exams_insert ON public.online_exams FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.virtual_courses vc
       WHERE vc.id = online_exams.virtual_course_id
         AND ((select siga_internal.teaches_assignment(vc.teacher_assignment_id)) OR (select siga_internal.has_any_role(ARRAY['direccion'])))
    )
  );
CREATE POLICY pol_online_exams_update ON public.online_exams FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.virtual_courses vc
       WHERE vc.id = online_exams.virtual_course_id
         AND ((select siga_internal.teaches_assignment(vc.teacher_assignment_id)) OR (select siga_internal.has_any_role(ARRAY['direccion'])))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.virtual_courses vc
       WHERE vc.id = online_exams.virtual_course_id
         AND ((select siga_internal.teaches_assignment(vc.teacher_assignment_id)) OR (select siga_internal.has_any_role(ARRAY['direccion'])))
    )
  );
CREATE POLICY pol_online_exams_delete ON public.online_exams FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.virtual_courses vc
       WHERE vc.id = online_exams.virtual_course_id
         AND ((select siga_internal.teaches_assignment(vc.teacher_assignment_id)) OR (select siga_internal.has_any_role(ARRAY['direccion'])))
    )
  );

-- exam_questions: nunca accesible directamente para estudiantes (usan RPC siga_get_exam_questions_student)
CREATE POLICY pol_exam_questions_teacher_select ON public.exam_questions FOR ALL TO authenticated
  USING (
    (select siga_internal.has_any_role(ARRAY['direccion']))
    OR EXISTS (
      SELECT 1 FROM public.online_exams oe
      JOIN public.virtual_courses vc ON vc.id = oe.virtual_course_id
       WHERE oe.id = exam_questions.online_exam_id
         AND (select siga_internal.teaches_assignment(vc.teacher_assignment_id))
    )
  )
  WITH CHECK (
    (select siga_internal.has_any_role(ARRAY['direccion']))
    OR EXISTS (
      SELECT 1 FROM public.online_exams oe
      JOIN public.virtual_courses vc ON vc.id = oe.virtual_course_id
       WHERE oe.id = exam_questions.online_exam_id
         AND (select siga_internal.teaches_assignment(vc.teacher_assignment_id))
    )
  );

CREATE POLICY pol_exam_attempts_select ON public.exam_attempts FOR SELECT TO authenticated
  USING (
    (select siga_internal.owns_enrollment(enrollment_id))
    OR (select siga_internal.teaches_enrollment(enrollment_id))
    OR (select siga_internal.has_any_role(ARRAY['direccion']))
  );

CREATE POLICY pol_ai_tutor_threads_all ON public.ai_tutor_threads FOR ALL TO authenticated
  USING (
    (student_user_id = (select siga_internal.current_user_id()) AND (select siga_internal.is_verified_workspace()))
    OR (select siga_internal.has_any_role(ARRAY['direccion']))
  )
  WITH CHECK (
    student_user_id = (select siga_internal.current_user_id()) AND (select siga_internal.is_verified_workspace())
  );

CREATE POLICY pol_ai_tutor_messages_all ON public.ai_tutor_messages FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ai_tutor_threads t
       WHERE t.id = ai_tutor_messages.thread_id
         AND (t.student_user_id = (select siga_internal.current_user_id()) OR (select siga_internal.has_any_role(ARRAY['direccion'])))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ai_tutor_threads t
       WHERE t.id = ai_tutor_messages.thread_id
         AND t.student_user_id = (select siga_internal.current_user_id())
    )
  );

CREATE POLICY pol_mention_lab_scenarios_select ON public.mention_lab_scenarios FOR SELECT TO authenticated
  USING (
    (select siga_internal.is_verified_workspace())
    AND (
      (select siga_internal.has_any_role(ARRAY['direccion', 'docente', 'coordinador_mencion']))
      OR EXISTS (
        SELECT 1 FROM public.enrollments e
         WHERE e.student_user_id = (select siga_internal.current_user_id())
           AND e.mencion_id = mention_lab_scenarios.mencion_id
           AND e.deleted_at IS NULL
      )
    )
  );
CREATE POLICY pol_mention_lab_scenarios_insert ON public.mention_lab_scenarios FOR INSERT TO authenticated
  WITH CHECK (
    (select siga_internal.has_any_role(ARRAY['direccion', 'docente']))
    OR (select siga_internal.is_coord_of_mencion(mencion_id))
  );
CREATE POLICY pol_mention_lab_scenarios_update ON public.mention_lab_scenarios FOR UPDATE TO authenticated
  USING (
    (select siga_internal.has_any_role(ARRAY['direccion', 'docente']))
    OR (select siga_internal.is_coord_of_mencion(mencion_id))
  )
  WITH CHECK (
    (select siga_internal.has_any_role(ARRAY['direccion', 'docente']))
    OR (select siga_internal.is_coord_of_mencion(mencion_id))
  );
CREATE POLICY pol_mention_lab_scenarios_delete ON public.mention_lab_scenarios FOR DELETE TO authenticated
  USING (
    (select siga_internal.has_any_role(ARRAY['direccion', 'docente']))
    OR (select siga_internal.is_coord_of_mencion(mencion_id))
  );

CREATE POLICY pol_mention_lab_submissions_select ON public.mention_lab_submissions FOR SELECT TO authenticated
  USING (
    (select siga_internal.owns_enrollment(enrollment_id))
    OR (select siga_internal.teaches_enrollment(enrollment_id))
    OR (select siga_internal.has_any_role(ARRAY['direccion']))
    OR EXISTS (
      SELECT 1 FROM public.enrollments e
       WHERE e.id = mention_lab_submissions.enrollment_id
         AND (select siga_internal.is_coord_of_mencion(e.mencion_id))
    )
  );
CREATE POLICY pol_mention_lab_submissions_insert ON public.mention_lab_submissions FOR INSERT TO authenticated
  WITH CHECK ((select siga_internal.owns_enrollment(enrollment_id)) AND (select siga_internal.is_verified_workspace()));
CREATE POLICY pol_mention_lab_submissions_update ON public.mention_lab_submissions FOR UPDATE TO authenticated
  USING ((select siga_internal.teaches_enrollment(enrollment_id)) OR (select siga_internal.has_any_role(ARRAY['direccion'])))
  WITH CHECK ((select siga_internal.teaches_enrollment(enrollment_id)) OR (select siga_internal.has_any_role(ARRAY['direccion'])));

-- Asistencia, Diario e Inasistencia Docente
CREATE POLICY pol_attendance_sessions_select ON public.attendance_sessions FOR SELECT TO authenticated
  USING (
    (select siga_internal.teaches_assignment(teacher_assignment_id))
    OR (select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios', 'orientacion']))
  );
CREATE POLICY pol_attendance_sessions_insert ON public.attendance_sessions FOR INSERT TO authenticated
  WITH CHECK ((select siga_internal.teaches_assignment(teacher_assignment_id)) OR (select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios'])));
CREATE POLICY pol_attendance_sessions_update ON public.attendance_sessions FOR UPDATE TO authenticated
  USING ((select siga_internal.teaches_assignment(teacher_assignment_id)) OR (select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios'])))
  WITH CHECK ((select siga_internal.teaches_assignment(teacher_assignment_id)) OR (select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios'])));
CREATE POLICY pol_attendance_sessions_delete ON public.attendance_sessions FOR DELETE TO authenticated
  USING ((select siga_internal.teaches_assignment(teacher_assignment_id)) OR (select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios'])));

CREATE POLICY pol_attendance_records_select ON public.attendance_records FOR SELECT TO authenticated
  USING (
    (select siga_internal.owns_enrollment(enrollment_id))
    OR (select siga_internal.teaches_enrollment(enrollment_id))
    OR (select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios', 'orientacion']))
  );

CREATE POLICY pol_class_diary_select ON public.class_diary_entries FOR SELECT TO authenticated
  USING (
    (select siga_internal.teaches_assignment(teacher_assignment_id))
    OR (select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios']))
    OR (derive_to_orientation = true AND (select siga_internal.has_any_role(ARRAY['orientacion'])))
    OR EXISTS (
      SELECT 1 FROM public.teacher_assignments ta
      JOIN public.sections s ON s.id = ta.section_id
       WHERE ta.id = class_diary_entries.teacher_assignment_id
         AND (select siga_internal.is_coord_of_mencion(s.mencion_id))
    )
  );
CREATE POLICY pol_class_diary_insert ON public.class_diary_entries FOR INSERT TO authenticated
  WITH CHECK (
    author_user_id = (select siga_internal.current_user_id())
    AND (select siga_internal.teaches_assignment(teacher_assignment_id))
  );

CREATE POLICY pol_teacher_absences_select ON public.teacher_absences FOR SELECT TO authenticated
  USING (
    teacher_user_id = (select siga_internal.current_user_id())
    OR (select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios', 'coordinador_mencion']))
  );
CREATE POLICY pol_teacher_absences_insert ON public.teacher_absences FOR INSERT TO authenticated
  WITH CHECK (
    teacher_user_id = (select siga_internal.current_user_id())
    AND (select siga_internal.has_any_role(ARRAY['docente']))
  );
CREATE POLICY pol_teacher_absences_update ON public.teacher_absences FOR UPDATE TO authenticated
  USING ((select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios', 'coordinador_mencion'])))
  WITH CHECK ((select siga_internal.has_any_role(ARRAY['direccion', 'control_estudios', 'coordinador_mencion'])));

-- Orientación y Psicopedagogía (Confidencialidad Reforzada K12)
CREATE POLICY pol_orientation_records_strict ON public.orientation_records FOR ALL TO authenticated
  USING ((select siga_internal.has_any_role(ARRAY['orientacion', 'direccion'])))
  WITH CHECK ((select siga_internal.has_any_role(ARRAY['orientacion', 'direccion'])));

CREATE POLICY pol_orientation_followups_strict ON public.orientation_followups FOR ALL TO authenticated
  USING ((select siga_internal.has_any_role(ARRAY['orientacion', 'direccion'])))
  WITH CHECK ((select siga_internal.has_any_role(ARRAY['orientacion', 'direccion'])));

-- Pasantías 6.º Año
CREATE POLICY pol_internship_companies_select ON public.internship_companies FOR SELECT TO authenticated
  USING ((select siga_internal.is_verified_workspace()));
CREATE POLICY pol_internship_companies_insert ON public.internship_companies FOR INSERT TO authenticated
  WITH CHECK ((select siga_internal.has_any_role(ARRAY['coordinador_pasantias', 'direccion'])));
CREATE POLICY pol_internship_companies_update ON public.internship_companies FOR UPDATE TO authenticated
  USING ((select siga_internal.has_any_role(ARRAY['coordinador_pasantias', 'direccion'])))
  WITH CHECK ((select siga_internal.has_any_role(ARRAY['coordinador_pasantias', 'direccion'])));
CREATE POLICY pol_internship_companies_delete ON public.internship_companies FOR DELETE TO authenticated
  USING ((select siga_internal.has_any_role(ARRAY['coordinador_pasantias', 'direccion'])));

CREATE POLICY pol_internship_placements_select ON public.internship_placements FOR SELECT TO authenticated
  USING (
    (select siga_internal.owns_enrollment(enrollment_id))
    OR academic_tutor_user_id = (select siga_internal.current_user_id())
    OR (select siga_internal.has_any_role(ARRAY['coordinador_pasantias', 'direccion', 'control_estudios']))
  );
CREATE POLICY pol_internship_placements_insert ON public.internship_placements FOR INSERT TO authenticated
  WITH CHECK ((select siga_internal.has_any_role(ARRAY['coordinador_pasantias', 'direccion'])));
CREATE POLICY pol_internship_placements_update ON public.internship_placements FOR UPDATE TO authenticated
  USING ((select siga_internal.has_any_role(ARRAY['coordinador_pasantias', 'direccion'])))
  WITH CHECK ((select siga_internal.has_any_role(ARRAY['coordinador_pasantias', 'direccion'])));
CREATE POLICY pol_internship_placements_delete ON public.internship_placements FOR DELETE TO authenticated
  USING ((select siga_internal.has_any_role(ARRAY['coordinador_pasantias', 'direccion'])));

CREATE POLICY pol_internship_logs_select ON public.internship_weekly_logs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.internship_placements ip
       WHERE ip.id = internship_weekly_logs.placement_id
         AND (
           (select siga_internal.owns_enrollment(ip.enrollment_id))
           OR ip.academic_tutor_user_id = (select siga_internal.current_user_id())
           OR (select siga_internal.has_any_role(ARRAY['coordinador_pasantias', 'direccion']))
         )
    )
  );
CREATE POLICY pol_internship_logs_insert ON public.internship_weekly_logs FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.internship_placements ip
       WHERE ip.id = internship_weekly_logs.placement_id
         AND (select siga_internal.owns_enrollment(ip.enrollment_id))
         AND (select siga_internal.is_verified_workspace())
    )
  );
CREATE POLICY pol_internship_logs_update ON public.internship_weekly_logs FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.internship_placements ip
       WHERE ip.id = internship_weekly_logs.placement_id
         AND (
           ip.academic_tutor_user_id = (select siga_internal.current_user_id())
           OR (select siga_internal.has_any_role(ARRAY['coordinador_pasantias', 'direccion']))
         )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.internship_placements ip
       WHERE ip.id = internship_weekly_logs.placement_id
         AND (
           ip.academic_tutor_user_id = (select siga_internal.current_user_id())
           OR (select siga_internal.has_any_role(ARRAY['coordinador_pasantias', 'direccion']))
         )
    )
  );

CREATE POLICY pol_internship_reports_all ON public.internship_reports FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.internship_placements ip
       WHERE ip.id = internship_reports.placement_id
         AND (
           (select siga_internal.owns_enrollment(ip.enrollment_id))
           OR ip.academic_tutor_user_id = (select siga_internal.current_user_id())
           OR (select siga_internal.has_any_role(ARRAY['coordinador_pasantias', 'direccion']))
         )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.internship_placements ip
       WHERE ip.id = internship_reports.placement_id
         AND (
           (select siga_internal.owns_enrollment(ip.enrollment_id))
           OR ip.academic_tutor_user_id = (select siga_internal.current_user_id())
           OR (select siga_internal.has_any_role(ARRAY['coordinador_pasantias', 'direccion']))
         )
    )
  );

CREATE POLICY pol_internship_magic_links_admin ON public.internship_magic_links FOR ALL TO authenticated
  USING ((select siga_internal.has_any_role(ARRAY['coordinador_pasantias', 'direccion'])))
  WITH CHECK ((select siga_internal.has_any_role(ARRAY['coordinador_pasantias', 'direccion'])));

CREATE POLICY pol_internship_evaluations_select ON public.internship_evaluations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.internship_placements ip
       WHERE ip.id = internship_evaluations.placement_id
         AND (
           (select siga_internal.owns_enrollment(ip.enrollment_id))
           OR ip.academic_tutor_user_id = (select siga_internal.current_user_id())
           OR (select siga_internal.has_any_role(ARRAY['coordinador_pasantias', 'direccion', 'control_estudios']))
         )
    )
  );
CREATE POLICY pol_internship_evaluations_write ON public.internship_evaluations FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.internship_placements ip
       WHERE ip.id = internship_evaluations.placement_id
         AND (
           ip.academic_tutor_user_id = (select siga_internal.current_user_id())
           OR (select siga_internal.has_any_role(ARRAY['coordinador_pasantias', 'direccion']))
         )
    )
  );

-- Biblioteca Escolar y Equipos Audiovisuales
CREATE POLICY pol_library_items_select ON public.library_items FOR SELECT TO authenticated
  USING ((select siga_internal.is_verified_workspace()));
CREATE POLICY pol_library_items_insert ON public.library_items FOR INSERT TO authenticated
  WITH CHECK ((select siga_internal.has_any_role(ARRAY['biblioteca', 'direccion'])));
CREATE POLICY pol_library_items_update ON public.library_items FOR UPDATE TO authenticated
  USING ((select siga_internal.has_any_role(ARRAY['biblioteca', 'direccion'])))
  WITH CHECK ((select siga_internal.has_any_role(ARRAY['biblioteca', 'direccion'])));
CREATE POLICY pol_library_items_delete ON public.library_items FOR DELETE TO authenticated
  USING ((select siga_internal.has_any_role(ARRAY['biblioteca', 'direccion'])));

CREATE POLICY pol_library_loans_select ON public.library_loans FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL AND (
      borrower_user_id = (select siga_internal.current_user_id())
      OR (select siga_internal.has_any_role(ARRAY['biblioteca', 'direccion', 'control_estudios']))
    )
  );

CREATE POLICY pol_audiovisual_resources_select ON public.audiovisual_resources FOR SELECT TO authenticated
  USING ((select siga_internal.is_verified_workspace()));
CREATE POLICY pol_audiovisual_resources_insert ON public.audiovisual_resources FOR INSERT TO authenticated
  WITH CHECK ((select siga_internal.has_any_role(ARRAY['biblioteca', 'direccion'])));
CREATE POLICY pol_audiovisual_resources_update ON public.audiovisual_resources FOR UPDATE TO authenticated
  USING ((select siga_internal.has_any_role(ARRAY['biblioteca', 'direccion'])))
  WITH CHECK ((select siga_internal.has_any_role(ARRAY['biblioteca', 'direccion'])));
CREATE POLICY pol_audiovisual_resources_delete ON public.audiovisual_resources FOR DELETE TO authenticated
  USING ((select siga_internal.has_any_role(ARRAY['biblioteca', 'direccion'])));

CREATE POLICY pol_audiovisual_reservations_select ON public.audiovisual_reservations FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL AND (
      teacher_user_id = (select siga_internal.current_user_id())
      OR (select siga_internal.has_any_role(ARRAY['biblioteca', 'direccion', 'docente']))
    )
  );

-- Notificaciones
CREATE POLICY pol_notifications_select ON public.notifications FOR SELECT TO authenticated
  USING (recipient_user_id = (select siga_internal.current_user_id()));
CREATE POLICY pol_notifications_update ON public.notifications FOR UPDATE TO authenticated
  USING (recipient_user_id = (select siga_internal.current_user_id()))
  WITH CHECK (recipient_user_id = (select siga_internal.current_user_id()));

CREATE POLICY pol_notification_email_logs_select ON public.notification_email_logs FOR SELECT TO authenticated
  USING ((select siga_internal.has_any_role(ARRAY['direccion'])));

-- ============================================================================
-- 15. SUPERFICIE MÍNIMA DE PRIVILEGIOS EN TABLAS DE `public`
-- ============================================================================

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- Blindaje adicional en tablas solo-escritura por RPC/servidor
REVOKE INSERT, UPDATE, DELETE ON public.grade_audit_logs FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.notification_email_logs FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.notifications FROM authenticated;
GRANT UPDATE (is_read, read_at) ON public.notifications TO authenticated;

-- ============================================================================
-- 16. RPCs PROTEGIDOS (`SECURITY DEFINER`) Y SUPERFICIE PÚBLICA CONTROLADA
-- ============================================================================

-- 16.1 Registrar calificación parcial con recálculo MPPE y bitácora inmutable
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
  v_curr_subject_id UUID;
  v_grading_scale TEXT;
  v_prev_score JSONB;
  v_score_id UUID;
  v_weighted_avg NUMERIC(5,2);
  v_final_numeric SMALLINT;
  v_reopened_until TIMESTAMPTZ;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Sesión institucional requerida' USING ERRCODE = '42501';
  END IF;

  SELECT ei.evaluation_plan_id, ep.teacher_assignment_id, ep.momento_id, m.status, ta.curriculum_subject_id, s.grading_scale
    INTO v_plan_id, v_assignment_id, v_momento_id, v_moment_status, v_curr_subject_id, v_grading_scale
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

  IF v_moment_status <> 'open' AND NOT (
    siga_internal.has_any_role(ARRAY['control_estudios', 'direccion'])
    OR (v_reopened_until IS NOT NULL AND v_reopened_until > now())
  ) THEN
    RAISE EXCEPTION 'La ventana de carga de notas para este momento está cerrada' USING ERRCODE = '42501';
  END IF;

  IF v_grading_scale = 'NUMERIC_1_20' THEN
    IF p_numeric_score IS NULL OR p_numeric_score < 0 OR p_numeric_score > 20 THEN
      RAISE EXCEPTION 'Calificación fuera de rango (0-20)' USING ERRCODE = '22023';
    END IF;
  ELSE
    IF p_literal_grade IS NULL OR p_literal_grade NOT IN ('A', 'B', 'C', 'D', 'E') THEN
      RAISE EXCEPTION 'Literal fuera de rango (A-E)' USING ERRCODE = '22023';
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
    target_table, target_record_id, enrollment_id, actor_user_id, action, previous_value, new_value, reason
  )
  VALUES (
    'student_scores',
    v_score_id,
    p_enrollment_id,
    v_actor_id,
    CASE WHEN v_prev_score IS NULL THEN 'insert' ELSE 'update' END,
    v_prev_score,
    jsonb_build_object('numeric_score', p_numeric_score, 'literal_grade', p_literal_grade, 'source', p_source),
    p_reason
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

  RETURN jsonb_build_object('success', true, 'score_id', v_score_id, 'weighted_avg', v_weighted_avg, 'final_numeric', v_final_numeric);
END;
$$;

-- 16.2 Sincronización idempotente de asistencia Offline-First / QR
CREATE OR REPLACE FUNCTION public.siga_sync_attendance_batch(
  p_teacher_assignment_id UUID,
  p_momento_id UUID,
  p_session_date DATE,
  p_block_label TEXT,
  p_recorded_mode TEXT,
  p_records JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor_id UUID := siga_internal.current_user_id();
  v_session_id UUID;
  v_item JSONB;
  v_inserted INTEGER := 0;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Sesión institucional requerida' USING ERRCODE = '42501';
  END IF;

  IF NOT (
    siga_internal.teaches_assignment(p_teacher_assignment_id)
    OR siga_internal.has_any_role(ARRAY['control_estudios', 'direccion'])
  ) THEN
    RAISE EXCEPTION 'No autorizado para registrar asistencia en esta sección' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.attendance_sessions (
    teacher_assignment_id, momento_id, session_date, block_label, recorded_mode, created_by
  )
  VALUES (
    p_teacher_assignment_id, p_momento_id, p_session_date, p_block_label, p_recorded_mode, v_actor_id
  )
  ON CONFLICT (teacher_assignment_id, session_date, block_label)
  DO UPDATE SET synced_at = now()
  RETURNING id INTO v_session_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_records, '[]'::jsonb))
  LOOP
    INSERT INTO public.attendance_records (
      attendance_session_id, enrollment_id, status, note, client_mutation_id
    )
    VALUES (
      v_session_id,
      (v_item->>'enrollment_id')::UUID,
      v_item->>'status',
      v_item->>'note',
      (v_item->>'client_mutation_id')::UUID
    )
    ON CONFLICT (client_mutation_id) DO NOTHING;

    IF FOUND THEN
      v_inserted := v_inserted + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'session_id', v_session_id, 'synced_count', v_inserted);
END;
$$;

-- 16.3 Reserva audiovisual sin solapamiento (Advisory Lock + GIST)
CREATE OR REPLACE FUNCTION public.siga_reservar_audiovisual(
  p_resource_id UUID,
  p_reserved_date DATE,
  p_block_start TIME,
  p_block_end TIME,
  p_purpose TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor_id UUID := siga_internal.current_user_id();
  v_reservation_id UUID;
BEGIN
  IF v_actor_id IS NULL OR NOT siga_internal.has_any_role(ARRAY['docente', 'biblioteca', 'direccion', 'coordinador_mencion']) THEN
    RAISE EXCEPTION 'Solo docentes o personal autorizado pueden reservar equipos audiovisuales' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_resource_id::text || p_reserved_date::text));

  INSERT INTO public.audiovisual_reservations (
    resource_id, teacher_user_id, reserved_date, block_start, block_end, purpose
  )
  VALUES (
    p_resource_id, v_actor_id, p_reserved_date, p_block_start, p_block_end, p_purpose
  )
  RETURNING id INTO v_reservation_id;

  RETURN jsonb_build_object('success', true, 'reservation_id', v_reservation_id);
END;
$$;

-- 16.4 Préstamo y devolución atómica de Biblioteca Escolar
CREATE OR REPLACE FUNCTION public.siga_registrar_prestamo_biblioteca(
  p_library_item_id UUID,
  p_borrower_user_id UUID,
  p_due_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor_id UUID := siga_internal.current_user_id();
  v_loan_id UUID;
BEGIN
  IF v_actor_id IS NULL OR NOT siga_internal.has_any_role(ARRAY['biblioteca', 'direccion']) THEN
    RAISE EXCEPTION 'Requiere rol de Biblioteca o Dirección' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_library_item_id::text));

  UPDATE public.library_items
     SET available_copies = available_copies - 1
   WHERE id = p_library_item_id
     AND is_active = true
     AND available_copies > 0;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No hay ejemplares disponibles para préstamo' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.library_loans (
    library_item_id, borrower_user_id, issued_by_user_id, due_date
  )
  VALUES (
    p_library_item_id, p_borrower_user_id, v_actor_id, p_due_date
  )
  RETURNING id INTO v_loan_id;

  RETURN jsonb_build_object('success', true, 'loan_id', v_loan_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.siga_devolver_prestamo_biblioteca(p_loan_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor_id UUID := siga_internal.current_user_id();
  v_item_id UUID;
BEGIN
  IF v_actor_id IS NULL OR NOT siga_internal.has_any_role(ARRAY['biblioteca', 'direccion']) THEN
    RAISE EXCEPTION 'Requiere rol de Biblioteca o Dirección' USING ERRCODE = '42501';
  END IF;

  UPDATE public.library_loans
     SET returned_at = now(),
         status = 'returned'
   WHERE id = p_loan_id
     AND deleted_at IS NULL
     AND status IN ('active', 'overdue')
  RETURNING library_item_id INTO v_item_id;

  IF v_item_id IS NULL THEN
    RAISE EXCEPTION 'Préstamo activo no encontrado' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.library_items
     SET available_copies = LEAST(total_copies, available_copies + 1)
   WHERE id = v_item_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 16.5 Administración RBAC Multi-Rol (solo Dirección; evita dejar sin Director activo)
CREATE OR REPLACE FUNCTION public.siga_gestionar_user_role(
  p_target_user_id UUID,
  p_role_code TEXT,
  p_grant BOOLEAN,
  p_mencion_id UUID DEFAULT NULL,
  p_valid_until DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor_id UUID := siga_internal.current_user_id();
  v_role_id UUID;
  v_active_directors INTEGER;
  v_user_role_id UUID;
BEGIN
  IF v_actor_id IS NULL OR NOT siga_internal.has_any_role(ARRAY['direccion']) THEN
    RAISE EXCEPTION 'Solo Dirección puede asignar o revocar roles' USING ERRCODE = '42501';
  END IF;

  SELECT id INTO v_role_id FROM public.roles WHERE code = p_role_code AND is_active = true;
  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'Rol inexistente o inactivo: %', p_role_code USING ERRCODE = 'P0002';
  END IF;

  IF p_grant THEN
    INSERT INTO public.user_roles (
      user_id, role_id, mencion_id, assigned_by, valid_until, is_active
    )
    VALUES (
      p_target_user_id, v_role_id, p_mencion_id, v_actor_id, p_valid_until, true
    )
    ON CONFLICT (user_id, role_id, COALESCE(mencion_id, '00000000-0000-0000-0000-000000000000'::uuid))
      WHERE is_active = true
    DO UPDATE SET valid_until = EXCLUDED.valid_until, assigned_by = EXCLUDED.assigned_by
    RETURNING id INTO v_user_role_id;
  ELSE
    IF p_role_code = 'direccion' THEN
      SELECT COUNT(*) INTO v_active_directors
        FROM public.user_roles ur
       WHERE ur.role_id = v_role_id AND ur.is_active = true;

      IF v_active_directors <= 1 THEN
        RAISE EXCEPTION 'No puede revocarse el último rol Dirección activo del plantel' USING ERRCODE = '42501';
      END IF;
    END IF;

    UPDATE public.user_roles
       SET is_active = false
     WHERE user_id = p_target_user_id
       AND role_id = v_role_id
       AND (p_mencion_id IS NULL OR mencion_id = p_mencion_id)
       AND is_active = true
    RETURNING id INTO v_user_role_id;
  END IF;

  INSERT INTO public.grade_audit_logs (
    target_table, target_record_id, actor_user_id, action, new_value
  )
  VALUES (
    'user_roles',
    COALESCE(v_user_role_id, p_target_user_id),
    v_actor_id,
    'role_change',
    jsonb_build_object('target_user_id', p_target_user_id, 'role_code', p_role_code, 'grant', p_grant, 'mencion_id', p_mencion_id)
  );

  RETURN jsonb_build_object('success', true, 'user_role_id', v_user_role_id);
END;
$$;

-- 16.6 Entrega segura de preguntas al alumno (sin `correct_answer_json`) y calificación en servidor
CREATE OR REPLACE FUNCTION public.siga_get_exam_questions_student(p_online_exam_id UUID)
RETURNS TABLE (
  id UUID,
  question_type TEXT,
  prompt TEXT,
  options_json JSONB,
  points NUMERIC(5,2),
  sort_order SMALLINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor_id UUID := siga_internal.current_user_id();
BEGIN
  IF v_actor_id IS NULL OR NOT siga_internal.is_verified_workspace() THEN
    RAISE EXCEPTION 'Requiere cuenta institucional verificada' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.online_exams oe
      JOIN public.virtual_courses vc ON vc.id = oe.virtual_course_id
      JOIN public.teacher_assignments ta ON ta.id = vc.teacher_assignment_id
      JOIN public.enrollments e ON e.section_id = ta.section_id AND e.school_year_id = ta.school_year_id
     WHERE oe.id = p_online_exam_id
       AND vc.is_published = true
       AND now() BETWEEN oe.opens_at AND oe.closes_at
       AND e.student_user_id = v_actor_id
       AND e.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Examen no disponible para tu sección o fuera de horario' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT eq.id, eq.question_type, eq.prompt, eq.options_json, eq.points, eq.sort_order
    FROM public.exam_questions eq
   WHERE eq.online_exam_id = p_online_exam_id
   ORDER BY eq.sort_order, eq.created_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.siga_submit_exam_attempt(
  p_online_exam_id UUID,
  p_answers JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor_id UUID := siga_internal.current_user_id();
  v_enrollment_id UUID;
  v_max_attempts SMALLINT;
  v_sync_item_id UUID;
  v_attempt_num SMALLINT;
  v_total_points NUMERIC(6,2) := 0;
  v_earned_points NUMERIC(6,2) := 0;
  v_final_20 NUMERIC(5,2) := 0;
  v_q RECORD;
  v_attempt_id UUID;
BEGIN
  IF v_actor_id IS NULL OR NOT siga_internal.is_verified_workspace() THEN
    RAISE EXCEPTION 'Requiere cuenta institucional verificada' USING ERRCODE = '42501';
  END IF;

  SELECT e.id, oe.max_attempts, oe.sync_to_evaluation_item_id
    INTO v_enrollment_id, v_max_attempts, v_sync_item_id
    FROM public.online_exams oe
    JOIN public.virtual_courses vc ON vc.id = oe.virtual_course_id
    JOIN public.teacher_assignments ta ON ta.id = vc.teacher_assignment_id
    JOIN public.enrollments e ON e.section_id = ta.section_id AND e.school_year_id = ta.school_year_id
   WHERE oe.id = p_online_exam_id
     AND now() BETWEEN oe.opens_at AND oe.closes_at
     AND e.student_user_id = v_actor_id
     AND e.deleted_at IS NULL;

  IF v_enrollment_id IS NULL THEN
    RAISE EXCEPTION 'Fuera de ventana de examen o sin matrícula en el curso' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(MAX(attempt_number), 0) + 1
    INTO v_attempt_num
    FROM public.exam_attempts
   WHERE online_exam_id = p_online_exam_id AND enrollment_id = v_enrollment_id;

  IF v_attempt_num > v_max_attempts THEN
    RAISE EXCEPTION 'Límite de intentos alcanzado' USING ERRCODE = '22023';
  END IF;

  FOR v_q IN
    SELECT id, points, correct_answer_json
      FROM public.exam_questions
     WHERE online_exam_id = p_online_exam_id
  LOOP
    v_total_points := v_total_points + v_q.points;
    IF (p_answers -> v_q.id::text) = v_q.correct_answer_json THEN
      v_earned_points := v_earned_points + v_q.points;
    END IF;
  END LOOP;

  IF v_total_points > 0 THEN
    v_final_20 := ROUND((v_earned_points / v_total_points) * 20.0, 2);
  END IF;

  INSERT INTO public.exam_attempts (
    online_exam_id, enrollment_id, submitted_at, answers_json, computed_score, attempt_number
  )
  VALUES (
    p_online_exam_id, v_enrollment_id, now(), COALESCE(p_answers, '{}'::jsonb), v_final_20, v_attempt_num
  )
  RETURNING id INTO v_attempt_id;

  IF v_sync_item_id IS NOT NULL THEN
    INSERT INTO public.student_scores (
      evaluation_item_id, enrollment_id, numeric_score, source, recorded_by
    )
    VALUES (
      v_sync_item_id, v_enrollment_id, v_final_20, 'lms_exam_sync', v_actor_id
    )
    ON CONFLICT (evaluation_item_id, enrollment_id) WHERE deleted_at IS NULL
    DO UPDATE SET numeric_score = EXCLUDED.numeric_score, source = 'lms_exam_sync', updated_at = now();
  END IF;

  RETURN jsonb_build_object('success', true, 'attempt_id', v_attempt_id, 'score', v_final_20);
END;
$$;

-- 16.7 Búsqueda RAG pgvector filtrada estrictamente por virtual_course_id
CREATE OR REPLACE FUNCTION public.siga_match_rag_chunks(
  p_virtual_course_id UUID,
  p_query_embedding extensions.vector(768),
  p_match_count INTEGER DEFAULT 5
)
RETURNS TABLE (
  chunk_id UUID,
  course_material_id UUID,
  material_title TEXT,
  content TEXT,
  similarity DOUBLE PRECISION
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_actor_id UUID := siga_internal.current_user_id();
BEGIN
  IF v_actor_id IS NULL OR NOT siga_internal.is_verified_workspace() THEN
    RAISE EXCEPTION 'Requiere cuenta institucional verificada' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.virtual_courses vc
      JOIN public.teacher_assignments ta ON ta.id = vc.teacher_assignment_id
      LEFT JOIN public.enrollments e ON e.section_id = ta.section_id AND e.school_year_id = ta.school_year_id AND e.deleted_at IS NULL
     WHERE vc.id = p_virtual_course_id
       AND (ta.teacher_user_id = v_actor_id OR e.student_user_id = v_actor_id OR siga_internal.has_any_role(ARRAY['direccion']))
  ) THEN
    RAISE EXCEPTION 'Sin acceso al curso virtual solicitado' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    rmc.id AS chunk_id,
    rmc.course_material_id,
    cm.title AS material_title,
    rmc.content,
    1 - (rmc.embedding OPERATOR(extensions.<=>) p_query_embedding) AS similarity
  FROM public.rag_material_chunks rmc
  JOIN public.course_materials cm ON cm.id = rmc.course_material_id
  WHERE rmc.virtual_course_id = p_virtual_course_id
  ORDER BY rmc.embedding OPERATOR(extensions.<=>) p_query_embedding
  LIMIT LEAST(GREATEST(p_match_count, 1), 12);
END;
$$;

-- 16.8 Verificador público anti-forjamiento (`/verificar`) — única función otorgada a `anon`
CREATE OR REPLACE FUNCTION public.siga_public_verificar_documento(p_verification_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_doc RECORD;
BEGIN
  IF p_verification_code IS NULL OR length(trim(p_verification_code)) < 6 THEN
    RETURN jsonb_build_object('valid', false, 'status', 'invalid_format');
  END IF;

  SELECT od.verification_code, od.document_type, od.status, od.issued_at, od.revoked_at,
         od.payload_snapshot - 'cedula' - 'phone' - 'address' AS safe_metadata
    INTO v_doc
    FROM public.official_documents od
   WHERE od.verification_code = upper(trim(p_verification_code))
   LIMIT 1;

  IF v_doc IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'status', 'not_found');
  END IF;

  RETURN jsonb_build_object(
    'valid', (v_doc.status = 'valid'),
    'verification_code', v_doc.verification_code,
    'document_type', v_doc.document_type,
    'status', v_doc.status,
    'issued_at', v_doc.issued_at,
    'revoked_at', v_doc.revoked_at,
    'metadata', COALESCE(v_doc.safe_metadata, '{}'::jsonb)
  );
END;
$$;

-- Permisos explícitos sobre RPCs (revocar PUBLIC/anon en todos salvo siga_public_*)
REVOKE EXECUTE ON FUNCTION public.siga_registrar_nota(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.siga_registrar_nota(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.siga_sync_attendance_batch(UUID, UUID, DATE, TEXT, TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.siga_sync_attendance_batch(UUID, UUID, DATE, TEXT, TEXT, JSONB) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.siga_reservar_audiovisual(UUID, DATE, TIME, TIME, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.siga_reservar_audiovisual(UUID, DATE, TIME, TIME, TEXT) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.siga_registrar_prestamo_biblioteca(UUID, UUID, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.siga_registrar_prestamo_biblioteca(UUID, UUID, DATE) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.siga_devolver_prestamo_biblioteca(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.siga_devolver_prestamo_biblioteca(UUID) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.siga_gestionar_user_role(UUID, TEXT, BOOLEAN, UUID, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.siga_gestionar_user_role(UUID, TEXT, BOOLEAN, UUID, DATE) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.siga_get_exam_questions_student(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.siga_get_exam_questions_student(UUID) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.siga_submit_exam_attempt(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.siga_submit_exam_attempt(UUID, JSONB) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.siga_match_rag_chunks(UUID, extensions.vector, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.siga_match_rag_chunks(UUID, extensions.vector, INTEGER) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.siga_public_verificar_documento(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.siga_public_verificar_documento(TEXT) TO anon, authenticated, service_role;

-- ============================================================================
-- 17. SUPABASE REALTIME (SOLO TABLAS OPERATIVAS NO CONFIDENCIALES)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.student_requests;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END;
$$;

-- ============================================================================
-- S.I.G.A. — Estructura Oficial de Planes de Estudio (Escuelas Técnicas MPPE)
-- Migración puramente DDL (cero INSERT/UPDATE/DELETE)
-- Añade:
--   1. Especialidad oficial en public.menciones (Economía Social / Industrial)
--   2. Componente formativo, orden oficial y carga horaria anual (1440 h para 6.º)
--      en public.curriculum_subjects
-- ============================================================================

-- 1. Especialidad institucional por mención
ALTER TABLE public.menciones
  ADD COLUMN IF NOT EXISTS specialty TEXT;

ALTER TABLE public.menciones
  DROP CONSTRAINT IF EXISTS chk_menciones_specialty_nonempty;

ALTER TABLE public.menciones
  ADD CONSTRAINT chk_menciones_specialty_nonempty
  CHECK (specialty IS NULL OR length(trim(specialty)) >= 2);

COMMENT ON COLUMN public.menciones.specialty IS
  'Especialidad oficial del Plan de Estudio MPPE (ej. Economía Social, Industrial).';

-- 2. Carga horaria semanal/anual, componente curricular y orden oficial en malla
ALTER TABLE public.curriculum_subjects
  ADD COLUMN IF NOT EXISTS annual_hours INTEGER,
  ADD COLUMN IF NOT EXISTS curriculum_component TEXT NOT NULL DEFAULT 'formacion_general',
  ADD COLUMN IF NOT EXISTS display_order SMALLINT NOT NULL DEFAULT 10;

ALTER TABLE public.curriculum_subjects
  DROP CONSTRAINT IF EXISTS curriculum_subjects_weekly_hours_check;

ALTER TABLE public.curriculum_subjects
  DROP CONSTRAINT IF EXISTS chk_curriculum_subjects_weekly_hours;

ALTER TABLE public.curriculum_subjects
  ADD CONSTRAINT chk_curriculum_subjects_weekly_hours
  CHECK (weekly_hours BETWEEN 0 AND 45);

ALTER TABLE public.curriculum_subjects
  DROP CONSTRAINT IF EXISTS chk_curriculum_subjects_annual_hours;

ALTER TABLE public.curriculum_subjects
  ADD CONSTRAINT chk_curriculum_subjects_annual_hours
  CHECK (annual_hours IS NULL OR annual_hours BETWEEN 1 AND 3000);

ALTER TABLE public.curriculum_subjects
  DROP CONSTRAINT IF EXISTS chk_curriculum_subjects_workload_present;

ALTER TABLE public.curriculum_subjects
  ADD CONSTRAINT chk_curriculum_subjects_workload_present
  CHECK (weekly_hours > 0 OR annual_hours IS NOT NULL);

ALTER TABLE public.curriculum_subjects
  DROP CONSTRAINT IF EXISTS chk_curriculum_subjects_component;

ALTER TABLE public.curriculum_subjects
  ADD CONSTRAINT chk_curriculum_subjects_component
  CHECK (
    curriculum_component IN (
      'formacion_general',
      'formacion_cientifica_tecnologica',
      'practica_vocacional_profesional'
    )
  );

ALTER TABLE public.curriculum_subjects
  DROP CONSTRAINT IF EXISTS chk_curriculum_subjects_display_order;

ALTER TABLE public.curriculum_subjects
  ADD CONSTRAINT chk_curriculum_subjects_display_order
  CHECK (display_order BETWEEN 1 AND 99);

COMMENT ON COLUMN public.curriculum_subjects.annual_hours IS
  'Carga horaria del año escolar cuando el área se mide en horas anuales (ej. 1440 h de Práctica Profesional en 6.º año).';

COMMENT ON COLUMN public.curriculum_subjects.curriculum_component IS
  'Componente oficial del Plan de Estudio: formacion_general, formacion_cientifica_tecnologica o practica_vocacional_profesional.';

COMMENT ON COLUMN public.curriculum_subjects.display_order IS
  'Orden oficial de presentación dentro de la matriz del Plan de Estudio por mención y año.';

-- 3. Índice de soporte para consultas ordenadas por mención y año escolar
CREATE INDEX IF NOT EXISTS idx_curriculum_subjects_mencion_grade_order
  ON public.curriculum_subjects (mencion_id, grade_year, display_order)
  WHERE is_active = true;

-- Recargar caché de esquema en PostgREST
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- S.I.G.A. — Catálogos Base Estructurales (Sin PII ni Contraseñas)
-- Seguro para versionar en Git y aplicar de forma idempotente en entornos nuevos.
-- Incluye: Menciones Técnicas (con Especialidad), Roles RBAC, Permisos,
-- Áreas de Formación oficiales y Planes de Estudio 1.º–6.º año (MPPE)
-- ============================================================================

INSERT INTO public.menciones (code, name, specialty, description, is_active)
VALUES
  (
    'ADUANAS',
    'Aduana',
    'Economía Social',
    'Especialidad Economía Social · Mención Aduana (1.º a 5.º año y Práctica Profesional de 1440 h en 6.º año).',
    true
  ),
  (
    'TURISMO',
    'Turismo',
    'Economía Social',
    'Especialidad Economía Social · Mención Turismo (1.º a 5.º año y Práctica Profesional de 1440 h en 6.º año).',
    true
  ),
  (
    'TELEMATICA',
    'Telemática',
    'Industrial',
    'Especialidad Industrial · Mención Telemática (1.º a 5.º año y Práctica Profesional de 1440 h en 6.º año).',
    true
  )
ON CONFLICT (code) DO UPDATE
  SET name = EXCLUDED.name,
      specialty = EXCLUDED.specialty,
      description = EXCLUDED.description,
      is_active = EXCLUDED.is_active;

INSERT INTO public.roles (code, name, description, hierarchy_level, requires_workspace, is_system, is_active)
VALUES
  ('estudiante', 'Estudiante', 'Alumno regular o pasante de 6.º año (admite acceso provisional inicial por cédula antes de activar Workspace).', 10, false, true, true),
  ('docente', 'Docente', 'Profesor de aula, laboratorio y tutor académico de pasantías.', 20, true, true, true),
  ('coordinador_mencion', 'Coordinación de Mención', 'Supervisión académica y operativa acotada a una mención técnica específica.', 40, true, true, true),
  ('coordinador_pasantias', 'Coordinación de Pasantías', 'Vinculación con empresas receptoras, matchmaking IA y evaluación de 6.º año.', 45, true, true, true),
  ('biblioteca', 'Administración de Biblioteca', 'Inventario QR, préstamos domiciliarios, solvencias y agenda audiovisual.', 45, true, true, true),
  ('orientacion', 'Orientación y Psicopedagogía', 'Expediente confidencial cifrado, actas de compromiso y seguimiento psicosocial.', 50, true, true, true),
  ('control_estudios', 'Control de Estudios y Secretaría', 'Periodos, mallas MPPE, inscripción OCR, materias pendientes, auditoría y emisión PDF/QR.', 60, true, true, true),
  ('direccion', 'Dirección / Supervisión', 'Gestión institucional, analítica BI, auditoría inmutable y administración RBAC multi-rol.', 90, true, true, true)
ON CONFLICT (code) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      hierarchy_level = EXCLUDED.hierarchy_level,
      requires_workspace = EXCLUDED.requires_workspace,
      is_active = EXCLUDED.is_active;

INSERT INTO public.permissions (code, module, description)
VALUES
  ('academic.view_own', 'alumnos', 'Consultar matrícula, calificaciones, asistencia y documentos propios.'),
  ('lms.participate', 'aula_virtual', 'Acceder a guías, entregar tareas, presentar exámenes y usar el Tutor Socrático IA.'),
  ('menciones.use_labs', 'menciones', 'Participar en simuladores y sandboxes prácticos de su mención técnica.'),
  ('grades.write_open_moment', 'docentes', 'Registrar calificaciones dentro de ventanas abiertas de Momento Pedagógico.'),
  ('grades.reopen_closed_moment', 'control_estudios', 'Autorizar reapertura auditada de ventanas de calificación cerradas.'),
  ('attendance.sync_offline', 'asistencia', 'Sincronizar pases de asistencia desde PWA Offline-First y QR.'),
  ('orientation.read_confidential', 'orientacion', 'Acceder al expediente confidencial psicopedagógico bajo RLS estricto.'),
  ('pasantias.manage_companies', 'pasantias', 'Administrar CRM de empresas de Ciudad Guayana, matchmaking y Magic Links.'),
  ('library.manage_inventory', 'biblioteca', 'Gestionar catálogo bibliográfico QR, préstamos, solvencias y reservas audiovisuales.'),
  ('analytics.view_institutional', 'analitica', 'Consultar tableros BI, Radar SLA, materias filtro, deserción IA y reportes CDCE.'),
  ('rbac.assign_roles', 'administracion', 'Asignar o revocar roles institucionales en la tabla user_roles.')
ON CONFLICT (code) DO UPDATE
  SET module = EXCLUDED.module,
      description = EXCLUDED.description;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM public.roles r
  JOIN public.permissions p ON (
    (r.code = 'estudiante' AND p.code IN ('academic.view_own', 'lms.participate', 'menciones.use_labs'))
    OR (r.code = 'docente' AND p.code IN ('lms.participate', 'menciones.use_labs', 'grades.write_open_moment', 'attendance.sync_offline'))
    OR (r.code = 'coordinador_mencion' AND p.code IN ('menciones.use_labs', 'analytics.view_institutional'))
    OR (r.code = 'coordinador_pasantias' AND p.code IN ('pasantias.manage_companies', 'analytics.view_institutional'))
    OR (r.code = 'biblioteca' AND p.code IN ('library.manage_inventory'))
    OR (r.code = 'orientacion' AND p.code IN ('orientation.read_confidential', 'analytics.view_institutional'))
    OR (r.code = 'control_estudios' AND p.code IN ('grades.write_open_moment', 'grades.reopen_closed_moment', 'analytics.view_institutional'))
    OR (r.code = 'direccion')
  )
ON CONFLICT DO NOTHING;

-- Áreas de Formación oficiales MPPE (Transformación Curricular Escuelas Técnicas)
INSERT INTO public.subjects (code, name, grading_scale, passing_threshold, is_technical_core)
VALUES
  -- Formación General (y transversal)
  ('LYL', 'Lengua y Literatura', 'NUMERIC_1_20', 10, false),
  ('MAT', 'Matemática', 'NUMERIC_1_20', 10, false),
  ('IDI', 'Idiomas', 'NUMERIC_1_20', 10, false),
  ('EDF', 'Educación Física', 'NUMERIC_1_20', 10, false),
  ('BAT', 'Biología, Ambiente y Tecnología', 'NUMERIC_1_20', 10, false),
  ('GHSN', 'Geografía, Historia y Soberanía Nacional', 'NUMERIC_1_20', 10, false),

  -- Formación Científica, Tecnológica y Productiva
  ('PEST', 'Proyecto de Economía Socioproductiva y Tecnología', 'NUMERIC_1_20', 10, true),
  ('ADU-FTA', 'Fundamentos y Técnicas de Aduana', 'NUMERIC_1_20', 10, true),
  ('TUR-GSTH', 'Gestión y Administración de Servicios Turísticos y Hoteleros', 'NUMERIC_1_20', 10, true),
  ('TEL-PDSR', 'Programación y Diseño de Software y Redes', 'NUMERIC_1_20', 10, true),

  -- Práctica Vocacional y Profesional
  ('OVS', 'Orientación y Vinculación Sociolaboral', 'NUMERIC_1_20', 10, false),
  ('PPRO', 'Práctica Profesional', 'NUMERIC_1_20', 10, true)
ON CONFLICT (code) DO UPDATE
  SET name = EXCLUDED.name,
      grading_scale = EXCLUDED.grading_scale,
      passing_threshold = EXCLUDED.passing_threshold,
      is_technical_core = EXCLUDED.is_technical_core;

-- Planes de Estudio oficiales completos (1.º a 6.º año) para las 3 menciones
-- Carga semanal: 1.º y 2.º = 40 h/sem · 3.º, 4.º y 5.º = 42 h/sem · 6.º = 1440 h/año escolar
WITH plan(mencion_code, grade_year, subject_code, weekly_hours, annual_hours, curriculum_component, display_order) AS (
  VALUES
    -- ========================================================================
    -- ESPECIALIDAD: ECONOMÍA SOCIAL · MENCIÓN: ADUANA
    -- ========================================================================
    -- 1.º Año (40 h/sem)
    ('ADUANAS', 1, 'LYL',     3,  NULL, 'formacion_general',                1),
    ('ADUANAS', 1, 'MAT',     4,  NULL, 'formacion_general',                2),
    ('ADUANAS', 1, 'IDI',     3,  NULL, 'formacion_general',                3),
    ('ADUANAS', 1, 'EDF',     2,  NULL, 'formacion_general',                4),
    ('ADUANAS', 1, 'BAT',     4,  NULL, 'formacion_general',                5),
    ('ADUANAS', 1, 'GHSN',    4,  NULL, 'formacion_general',                6),
    ('ADUANAS', 1, 'PEST',    8,  NULL, 'formacion_cientifica_tecnologica', 7),
    ('ADUANAS', 1, 'ADU-FTA', 8,  NULL, 'formacion_cientifica_tecnologica', 8),
    ('ADUANAS', 1, 'OVS',     4,  NULL, 'practica_vocacional_profesional',  9),

    -- 2.º Año (40 h/sem)
    ('ADUANAS', 2, 'LYL',     3,  NULL, 'formacion_general',                1),
    ('ADUANAS', 2, 'MAT',     4,  NULL, 'formacion_general',                2),
    ('ADUANAS', 2, 'IDI',     3,  NULL, 'formacion_general',                3),
    ('ADUANAS', 2, 'EDF',     2,  NULL, 'formacion_general',                4),
    ('ADUANAS', 2, 'BAT',     4,  NULL, 'formacion_general',                5),
    ('ADUANAS', 2, 'GHSN',    4,  NULL, 'formacion_general',                6),
    ('ADUANAS', 2, 'PEST',    8,  NULL, 'formacion_cientifica_tecnologica', 7),
    ('ADUANAS', 2, 'ADU-FTA', 8,  NULL, 'formacion_cientifica_tecnologica', 8),
    ('ADUANAS', 2, 'OVS',     4,  NULL, 'practica_vocacional_profesional',  9),

    -- 3.º Año (42 h/sem)
    ('ADUANAS', 3, 'LYL',     4,  NULL, 'formacion_general',                1),
    ('ADUANAS', 3, 'MAT',     4,  NULL, 'formacion_general',                2),
    ('ADUANAS', 3, 'IDI',     4,  NULL, 'formacion_general',                3),
    ('ADUANAS', 3, 'EDF',     2,  NULL, 'formacion_general',                4),
    ('ADUANAS', 3, 'BAT',     8,  NULL, 'formacion_general',                5),
    ('ADUANAS', 3, 'GHSN',    2,  NULL, 'formacion_general',                6),
    ('ADUANAS', 3, 'PEST',    8,  NULL, 'formacion_cientifica_tecnologica', 7),
    ('ADUANAS', 3, 'ADU-FTA', 8,  NULL, 'formacion_cientifica_tecnologica', 8),
    ('ADUANAS', 3, 'OVS',     2,  NULL, 'practica_vocacional_profesional',  9),

    -- 4.º Año (42 h/sem)
    ('ADUANAS', 4, 'LYL',     4,  NULL, 'formacion_general',                1),
    ('ADUANAS', 4, 'MAT',     4,  NULL, 'formacion_general',                2),
    ('ADUANAS', 4, 'IDI',     4,  NULL, 'formacion_general',                3),
    ('ADUANAS', 4, 'BAT',     8,  NULL, 'formacion_general',                5),
    ('ADUANAS', 4, 'GHSN',    2,  NULL, 'formacion_general',                6),
    ('ADUANAS', 4, 'PEST',    8,  NULL, 'formacion_cientifica_tecnologica', 7),
    ('ADUANAS', 4, 'ADU-FTA', 10, NULL, 'formacion_cientifica_tecnologica', 8),
    ('ADUANAS', 4, 'OVS',     2,  NULL, 'practica_vocacional_profesional',  9),

    -- 5.º Año (42 h/sem)
    ('ADUANAS', 5, 'LYL',     4,  NULL, 'formacion_general',                1),
    ('ADUANAS', 5, 'MAT',     4,  NULL, 'formacion_general',                2),
    ('ADUANAS', 5, 'IDI',     4,  NULL, 'formacion_general',                3),
    ('ADUANAS', 5, 'BAT',     8,  NULL, 'formacion_general',                5),
    ('ADUANAS', 5, 'GHSN',    2,  NULL, 'formacion_general',                6),
    ('ADUANAS', 5, 'PEST',    8,  NULL, 'formacion_cientifica_tecnologica', 7),
    ('ADUANAS', 5, 'ADU-FTA', 10, NULL, 'formacion_cientifica_tecnologica', 8),
    ('ADUANAS', 5, 'OVS',     2,  NULL, 'practica_vocacional_profesional',  9),

    -- 6.º Año (1440 h año escolar)
    ('ADUANAS', 6, 'PPRO',    0,  1440, 'practica_vocacional_profesional',  10),

    -- ========================================================================
    -- ESPECIALIDAD: ECONOMÍA SOCIAL · MENCIÓN: TURISMO
    -- ========================================================================
    -- 1.º Año (40 h/sem)
    ('TURISMO', 1, 'LYL',      3, NULL, 'formacion_general',                1),
    ('TURISMO', 1, 'MAT',      4, NULL, 'formacion_general',                2),
    ('TURISMO', 1, 'EDF',      2, NULL, 'formacion_general',                3),
    ('TURISMO', 1, 'BAT',      4, NULL, 'formacion_general',                4),
    ('TURISMO', 1, 'GHSN',     4, NULL, 'formacion_general',                5),
    ('TURISMO', 1, 'PEST',     8, NULL, 'formacion_cientifica_tecnologica', 6),
    ('TURISMO', 1, 'TUR-GSTH', 8, NULL, 'formacion_cientifica_tecnologica', 7),
    ('TURISMO', 1, 'IDI',      3, NULL, 'formacion_cientifica_tecnologica', 8),
    ('TURISMO', 1, 'OVS',      4, NULL, 'practica_vocacional_profesional',  9),

    -- 2.º Año (40 h/sem)
    ('TURISMO', 2, 'LYL',      3, NULL, 'formacion_general',                1),
    ('TURISMO', 2, 'MAT',      4, NULL, 'formacion_general',                2),
    ('TURISMO', 2, 'EDF',      2, NULL, 'formacion_general',                3),
    ('TURISMO', 2, 'BAT',      4, NULL, 'formacion_general',                4),
    ('TURISMO', 2, 'GHSN',     4, NULL, 'formacion_general',                5),
    ('TURISMO', 2, 'PEST',     8, NULL, 'formacion_cientifica_tecnologica', 6),
    ('TURISMO', 2, 'TUR-GSTH', 8, NULL, 'formacion_cientifica_tecnologica', 7),
    ('TURISMO', 2, 'IDI',      3, NULL, 'formacion_cientifica_tecnologica', 8),
    ('TURISMO', 2, 'OVS',      4, NULL, 'practica_vocacional_profesional',  9),

    -- 3.º Año (42 h/sem)
    ('TURISMO', 3, 'LYL',      4, NULL, 'formacion_general',                1),
    ('TURISMO', 3, 'MAT',      4, NULL, 'formacion_general',                2),
    ('TURISMO', 3, 'EDF',      2, NULL, 'formacion_general',                3),
    ('TURISMO', 3, 'BAT',      8, NULL, 'formacion_general',                4),
    ('TURISMO', 3, 'GHSN',     2, NULL, 'formacion_general',                5),
    ('TURISMO', 3, 'PEST',     8, NULL, 'formacion_cientifica_tecnologica', 6),
    ('TURISMO', 3, 'TUR-GSTH', 8, NULL, 'formacion_cientifica_tecnologica', 7),
    ('TURISMO', 3, 'IDI',      4, NULL, 'formacion_cientifica_tecnologica', 8),
    ('TURISMO', 3, 'OVS',      2, NULL, 'practica_vocacional_profesional',  9),

    -- 4.º Año (42 h/sem)
    ('TURISMO', 4, 'LYL',      4, NULL, 'formacion_general',                1),
    ('TURISMO', 4, 'MAT',      4, NULL, 'formacion_general',                2),
    ('TURISMO', 4, 'BAT',      8, NULL, 'formacion_general',                4),
    ('TURISMO', 4, 'GHSN',     2, NULL, 'formacion_general',                5),
    ('TURISMO', 4, 'PEST',     8, NULL, 'formacion_cientifica_tecnologica', 6),
    ('TURISMO', 4, 'TUR-GSTH', 8, NULL, 'formacion_cientifica_tecnologica', 7),
    ('TURISMO', 4, 'IDI',      6, NULL, 'formacion_cientifica_tecnologica', 8),
    ('TURISMO', 4, 'OVS',      2, NULL, 'practica_vocacional_profesional',  9),

    -- 5.º Año (42 h/sem)
    ('TURISMO', 5, 'LYL',      4, NULL, 'formacion_general',                1),
    ('TURISMO', 5, 'MAT',      4, NULL, 'formacion_general',                2),
    ('TURISMO', 5, 'BAT',      8, NULL, 'formacion_general',                4),
    ('TURISMO', 5, 'GHSN',     2, NULL, 'formacion_general',                5),
    ('TURISMO', 5, 'PEST',     8, NULL, 'formacion_cientifica_tecnologica', 6),
    ('TURISMO', 5, 'TUR-GSTH', 8, NULL, 'formacion_cientifica_tecnologica', 7),
    ('TURISMO', 5, 'IDI',      6, NULL, 'formacion_cientifica_tecnologica', 8),
    ('TURISMO', 5, 'OVS',      2, NULL, 'practica_vocacional_profesional',  9),

    -- 6.º Año (1440 h año escolar)
    ('TURISMO', 6, 'PPRO',     0, 1440, 'practica_vocacional_profesional',  10),

    -- ========================================================================
    -- ESPECIALIDAD: INDUSTRIAL · MENCIÓN: TELEMÁTICA
    -- ========================================================================
    -- 1.º Año (40 h/sem)
    ('TELEMATICA', 1, 'LYL',      3,  NULL, 'formacion_general',                1),
    ('TELEMATICA', 1, 'MAT',      4,  NULL, 'formacion_general',                2),
    ('TELEMATICA', 1, 'IDI',      3,  NULL, 'formacion_general',                3),
    ('TELEMATICA', 1, 'EDF',      2,  NULL, 'formacion_general',                4),
    ('TELEMATICA', 1, 'BAT',      4,  NULL, 'formacion_general',                5),
    ('TELEMATICA', 1, 'GHSN',     4,  NULL, 'formacion_general',                6),
    ('TELEMATICA', 1, 'PEST',     8,  NULL, 'formacion_cientifica_tecnologica', 7),
    ('TELEMATICA', 1, 'TEL-PDSR', 8,  NULL, 'formacion_cientifica_tecnologica', 8),
    ('TELEMATICA', 1, 'OVS',      4,  NULL, 'practica_vocacional_profesional',  9),

    -- 2.º Año (40 h/sem)
    ('TELEMATICA', 2, 'LYL',      3,  NULL, 'formacion_general',                1),
    ('TELEMATICA', 2, 'MAT',      4,  NULL, 'formacion_general',                2),
    ('TELEMATICA', 2, 'IDI',      3,  NULL, 'formacion_general',                3),
    ('TELEMATICA', 2, 'EDF',      2,  NULL, 'formacion_general',                4),
    ('TELEMATICA', 2, 'BAT',      4,  NULL, 'formacion_general',                5),
    ('TELEMATICA', 2, 'GHSN',     4,  NULL, 'formacion_general',                6),
    ('TELEMATICA', 2, 'PEST',     8,  NULL, 'formacion_cientifica_tecnologica', 7),
    ('TELEMATICA', 2, 'TEL-PDSR', 8,  NULL, 'formacion_cientifica_tecnologica', 8),
    ('TELEMATICA', 2, 'OVS',      4,  NULL, 'practica_vocacional_profesional',  9),

    -- 3.º Año (42 h/sem)
    ('TELEMATICA', 3, 'LYL',      4,  NULL, 'formacion_general',                1),
    ('TELEMATICA', 3, 'MAT',      4,  NULL, 'formacion_general',                2),
    ('TELEMATICA', 3, 'IDI',      4,  NULL, 'formacion_general',                3),
    ('TELEMATICA', 3, 'EDF',      2,  NULL, 'formacion_general',                4),
    ('TELEMATICA', 3, 'BAT',      8,  NULL, 'formacion_general',                5),
    ('TELEMATICA', 3, 'GHSN',     2,  NULL, 'formacion_general',                6),
    ('TELEMATICA', 3, 'PEST',     8,  NULL, 'formacion_cientifica_tecnologica', 7),
    ('TELEMATICA', 3, 'TEL-PDSR', 8,  NULL, 'formacion_cientifica_tecnologica', 8),
    ('TELEMATICA', 3, 'OVS',      2,  NULL, 'practica_vocacional_profesional',  9),

    -- 4.º Año (42 h/sem)
    ('TELEMATICA', 4, 'LYL',      4,  NULL, 'formacion_general',                1),
    ('TELEMATICA', 4, 'MAT',      4,  NULL, 'formacion_general',                2),
    ('TELEMATICA', 4, 'IDI',      4,  NULL, 'formacion_general',                3),
    ('TELEMATICA', 4, 'BAT',      8,  NULL, 'formacion_general',                5),
    ('TELEMATICA', 4, 'GHSN',     2,  NULL, 'formacion_general',                6),
    ('TELEMATICA', 4, 'PEST',     8,  NULL, 'formacion_cientifica_tecnologica', 7),
    ('TELEMATICA', 4, 'TEL-PDSR', 10, NULL, 'formacion_cientifica_tecnologica', 8),
    ('TELEMATICA', 4, 'OVS',      2,  NULL, 'practica_vocacional_profesional',  9),

    -- 5.º Año (42 h/sem)
    ('TELEMATICA', 5, 'LYL',      4,  NULL, 'formacion_general',                1),
    ('TELEMATICA', 5, 'MAT',      4,  NULL, 'formacion_general',                2),
    ('TELEMATICA', 5, 'IDI',      4,  NULL, 'formacion_general',                3),
    ('TELEMATICA', 5, 'BAT',      8,  NULL, 'formacion_general',                5),
    ('TELEMATICA', 5, 'GHSN',     2,  NULL, 'formacion_general',                6),
    ('TELEMATICA', 5, 'PEST',     8,  NULL, 'formacion_cientifica_tecnologica', 7),
    ('TELEMATICA', 5, 'TEL-PDSR', 10, NULL, 'formacion_cientifica_tecnologica', 8),
    ('TELEMATICA', 5, 'OVS',      2,  NULL, 'practica_vocacional_profesional',  9),

    -- 6.º Año (1440 h año escolar)
    ('TELEMATICA', 6, 'PPRO',     0,  1440, 'practica_vocacional_profesional',  10)
)
INSERT INTO public.curriculum_subjects (
  mencion_id,
  subject_id,
  grade_year,
  weekly_hours,
  annual_hours,
  curriculum_component,
  display_order,
  is_active
)
SELECT
  m.id,
  s.id,
  p.grade_year,
  p.weekly_hours,
  p.annual_hours,
  p.curriculum_component,
  p.display_order,
  true
  FROM plan p
  JOIN public.menciones m ON m.code = p.mencion_code
  JOIN public.subjects s ON s.code = p.subject_code
ON CONFLICT (mencion_id, subject_id, grade_year) DO UPDATE
  SET weekly_hours = EXCLUDED.weekly_hours,
      annual_hours = EXCLUDED.annual_hours,
      curriculum_component = EXCLUDED.curriculum_component,
      display_order = EXCLUDED.display_order,
      is_active = true;

-- Bucket institucional de fotografías de perfil / carnet (.webp <= 512 KB)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'student-avatars',
  'student-avatars',
  true,
  524288,
  ARRAY['image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

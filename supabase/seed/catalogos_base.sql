-- ============================================================================
-- S.I.G.A. — Catálogos Base Estructurales (Sin PII ni Contraseñas)
-- Seguro para versionar en Git y aplicar de forma idempotente en entornos nuevos.
-- Incluye: Menciones Técnicas, Roles RBAC, Permisos, Asignaturas y Malla 1.º–6.º
-- ============================================================================

INSERT INTO public.menciones (code, name, description, is_active)
VALUES
  ('TELEMATICA', 'Telemática', 'Redes, infraestructura TI, sistemas, programación y bases de datos (1.º a 6.º año).', true),
  ('ADUANAS', 'Aduanas', 'Comercio exterior, clasificación arancelaria, valoración CIF/FOB y logística portuaria (1.º a 6.º año).', true),
  ('TURISMO', 'Turismo', 'Hospitalidad, guiatura patrimonial de Guayana, eventos, protocolo y recepción hotelera (1.º a 6.º año).', true)
ON CONFLICT (code) DO UPDATE
  SET name = EXCLUDED.name,
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

-- Asignaturas oficiales MPPE + Especialidades Técnicas (Telemática, Aduanas, Turismo)
INSERT INTO public.subjects (code, name, grading_scale, passing_threshold, is_technical_core)
VALUES
  -- Formación Común MPPE
  ('CAS', 'Castellano y Literatura', 'NUMERIC_1_20', 10, false),
  ('MAT', 'Matemática', 'NUMERIC_1_20', 10, false),
  ('ING', 'Inglés Técnico y General', 'NUMERIC_1_20', 10, false),
  ('GHC', 'Geografía, Historia y Ciudadanía', 'NUMERIC_1_20', 10, false),
  ('EDF', 'Educación Física', 'NUMERIC_1_20', 10, false),
  ('CNAT', 'Ciencias Naturales / Biología', 'NUMERIC_1_20', 10, false),
  ('FIS', 'Física Aplicada', 'NUMERIC_1_20', 10, false),
  ('QUI', 'Química Aplicada', 'NUMERIC_1_20', 10, false),
  ('FSN', 'Formación para la Soberanía Nacional', 'NUMERIC_1_20', 10, false),
  ('CRP', 'Grupo de Creación, Recreación y Producción (CRP)', 'LITERAL_A_E', 10, false),

  -- Mención Telemática
  ('TEL-OFI', 'Fundamentos de Cómputo y Ofimática', 'NUMERIC_1_20', 10, true),
  ('TEL-ARQ', 'Arquitectura de Hardware y Electrónica Básica', 'NUMERIC_1_20', 10, true),
  ('TEL-ALG', 'Algoritmos y Programación', 'NUMERIC_1_20', 10, true),
  ('TEL-RED', 'Redes de Datos, Protocolos OSI/TCP-IP y Cableado', 'NUMERIC_1_20', 10, true),
  ('TEL-BDD', 'Bases de Datos SQL y Desarrollo Web', 'NUMERIC_1_20', 10, true),
  ('TEL-SEG', 'Seguridad LAN, Servidores y Pasantías TI', 'NUMERIC_1_20', 10, true),

  -- Mención Aduanas
  ('ADU-COM', 'Iniciación Comercial y Geografía del Orinoco', 'NUMERIC_1_20', 10, true),
  ('ADU-CON', 'Contabilidad General y Legislación Mercantil', 'NUMERIC_1_20', 10, true),
  ('ADU-POT', 'Potestad Aduanera e Inglés Comercial', 'NUMERIC_1_20', 10, true),
  ('ADU-ARA', 'Clasificación Arancelaria (Sistema Armonizado)', 'NUMERIC_1_20', 10, true),
  ('ADU-VAL', 'Valoración CIF/FOB, Incoterms y Documentos B/L', 'NUMERIC_1_20', 10, true),
  ('ADU-REG', 'Regímenes Especiales y Práctica Aduanal', 'NUMERIC_1_20', 10, true),

  -- Mención Turismo
  ('TUR-PAT', 'Patrimonio Guayanés, Ecología y Anfitrionía', 'NUMERIC_1_20', 10, true),
  ('TUR-SIS', 'Sistema Turístico y Geografía de Bolívar', 'NUMERIC_1_20', 10, true),
  ('TUR-ING', 'Inglés Turístico y Atención Bilingüe', 'NUMERIC_1_20', 10, true),
  ('TUR-GUI', 'Técnicas de Guiatura Interpretativa y Rutas', 'NUMERIC_1_20', 10, true),
  ('TUR-HOT', 'Alojamiento, Recepción Hotelera y Eventos', 'NUMERIC_1_20', 10, true),
  ('TUR-ECO', 'Ecoturismo Digital y Gestión de Operadoras', 'NUMERIC_1_20', 10, true)
ON CONFLICT (code) DO UPDATE
  SET name = EXCLUDED.name,
      grading_scale = EXCLUDED.grading_scale,
      passing_threshold = EXCLUDED.passing_threshold,
      is_technical_core = EXCLUDED.is_technical_core;

-- Malla curricular completa de 1.º a 6.º año para las 3 menciones
WITH plan(mencion_code, grade_year, subject_code, weekly_hours) AS (
  VALUES
    -- TELEMÁTICA (1.º a 6.º)
    ('TELEMATICA', 1, 'CAS', 4), ('TELEMATICA', 1, 'MAT', 4), ('TELEMATICA', 1, 'ING', 3), ('TELEMATICA', 1, 'GHC', 4), ('TELEMATICA', 1, 'CNAT', 4), ('TELEMATICA', 1, 'TEL-OFI', 4), ('TELEMATICA', 1, 'CRP', 2),
    ('TELEMATICA', 2, 'CAS', 4), ('TELEMATICA', 2, 'MAT', 4), ('TELEMATICA', 2, 'ING', 3), ('TELEMATICA', 2, 'GHC', 4), ('TELEMATICA', 2, 'CNAT', 4), ('TELEMATICA', 2, 'TEL-OFI', 4), ('TELEMATICA', 2, 'CRP', 2),
    ('TELEMATICA', 3, 'CAS', 4), ('TELEMATICA', 3, 'MAT', 4), ('TELEMATICA', 3, 'ING', 3), ('TELEMATICA', 3, 'FIS', 4), ('TELEMATICA', 3, 'TEL-ARQ', 4), ('TELEMATICA', 3, 'TEL-ALG', 4), ('TELEMATICA', 3, 'CRP', 2),
    ('TELEMATICA', 4, 'CAS', 3), ('TELEMATICA', 4, 'MAT', 4), ('TELEMATICA', 4, 'ING', 3), ('TELEMATICA', 4, 'FSN', 2), ('TELEMATICA', 4, 'TEL-RED', 6), ('TELEMATICA', 4, 'TEL-ALG', 4), ('TELEMATICA', 4, 'CRP', 2),
    ('TELEMATICA', 5, 'MAT', 4), ('TELEMATICA', 5, 'ING', 3), ('TELEMATICA', 5, 'FSN', 2), ('TELEMATICA', 5, 'TEL-RED', 5), ('TELEMATICA', 5, 'TEL-BDD', 6), ('TELEMATICA', 5, 'EDF', 2), ('TELEMATICA', 5, 'CRP', 2),
    ('TELEMATICA', 6, 'ING', 3), ('TELEMATICA', 6, 'GHC', 2), ('TELEMATICA', 6, 'TEL-BDD', 5), ('TELEMATICA', 6, 'TEL-SEG', 8), ('TELEMATICA', 6, 'EDF', 2), ('TELEMATICA', 6, 'CRP', 2),

    -- ADUANAS (1.º a 6.º)
    ('ADUANAS', 1, 'CAS', 4), ('ADUANAS', 1, 'MAT', 4), ('ADUANAS', 1, 'ING', 3), ('ADUANAS', 1, 'GHC', 4), ('ADUANAS', 1, 'CNAT', 4), ('ADUANAS', 1, 'ADU-COM', 4), ('ADUANAS', 1, 'CRP', 2),
    ('ADUANAS', 2, 'CAS', 4), ('ADUANAS', 2, 'MAT', 4), ('ADUANAS', 2, 'ING', 3), ('ADUANAS', 2, 'GHC', 4), ('ADUANAS', 2, 'ADU-COM', 4), ('ADUANAS', 2, 'ADU-CON', 4), ('ADUANAS', 2, 'CRP', 2),
    ('ADUANAS', 3, 'CAS', 4), ('ADUANAS', 3, 'MAT', 4), ('ADUANAS', 3, 'ING', 3), ('ADUANAS', 3, 'QUI', 3), ('ADUANAS', 3, 'ADU-CON', 4), ('ADUANAS', 3, 'ADU-POT', 4), ('ADUANAS', 3, 'CRP', 2),
    ('ADUANAS', 4, 'CAS', 3), ('ADUANAS', 4, 'MAT', 4), ('ADUANAS', 4, 'FSN', 2), ('ADUANAS', 4, 'ADU-POT', 5), ('ADUANAS', 4, 'ADU-ARA', 6), ('ADUANAS', 4, 'EDF', 2), ('ADUANAS', 4, 'CRP', 2),
    ('ADUANAS', 5, 'MAT', 4), ('ADUANAS', 5, 'ING', 3), ('ADUANAS', 5, 'FSN', 2), ('ADUANAS', 5, 'ADU-ARA', 5), ('ADUANAS', 5, 'ADU-VAL', 6), ('ADUANAS', 5, 'EDF', 2), ('ADUANAS', 5, 'CRP', 2),
    ('ADUANAS', 6, 'ING', 3), ('ADUANAS', 6, 'GHC', 2), ('ADUANAS', 6, 'ADU-VAL', 5), ('ADUANAS', 6, 'ADU-REG', 8), ('ADUANAS', 6, 'EDF', 2), ('ADUANAS', 6, 'CRP', 2),

    -- TURISMO (1.º a 6.º)
    ('TURISMO', 1, 'CAS', 4), ('TURISMO', 1, 'MAT', 4), ('TURISMO', 1, 'ING', 3), ('TURISMO', 1, 'GHC', 4), ('TURISMO', 1, 'CNAT', 4), ('TURISMO', 1, 'TUR-PAT', 4), ('TURISMO', 1, 'CRP', 2),
    ('TURISMO', 2, 'CAS', 4), ('TURISMO', 2, 'MAT', 4), ('TURISMO', 2, 'ING', 3), ('TURISMO', 2, 'GHC', 4), ('TURISMO', 2, 'TUR-PAT', 4), ('TURISMO', 2, 'TUR-SIS', 4), ('TURISMO', 2, 'CRP', 2),
    ('TURISMO', 3, 'CAS', 4), ('TURISMO', 3, 'MAT', 4), ('TURISMO', 3, 'GHC', 4), ('TURISMO', 3, 'TUR-SIS', 4), ('TURISMO', 3, 'TUR-ING', 5), ('TURISMO', 3, 'EDF', 2), ('TURISMO', 3, 'CRP', 2),
    ('TURISMO', 4, 'CAS', 3), ('TURISMO', 4, 'FSN', 2), ('TURISMO', 4, 'TUR-ING', 4), ('TURISMO', 4, 'TUR-GUI', 6), ('TURISMO', 4, 'TUR-HOT', 5), ('TURISMO', 4, 'EDF', 2), ('TURISMO', 4, 'CRP', 2),
    ('TURISMO', 5, 'MAT', 3), ('TURISMO', 5, 'FSN', 2), ('TURISMO', 5, 'TUR-ING', 4), ('TURISMO', 5, 'TUR-GUI', 5), ('TURISMO', 5, 'TUR-HOT', 6), ('TURISMO', 5, 'EDF', 2), ('TURISMO', 5, 'CRP', 2),
    ('TURISMO', 6, 'GHC', 2), ('TURISMO', 6, 'TUR-ING', 4), ('TURISMO', 6, 'TUR-HOT', 5), ('TURISMO', 6, 'TUR-ECO', 8), ('TURISMO', 6, 'EDF', 2), ('TURISMO', 6, 'CRP', 2)
)
INSERT INTO public.curriculum_subjects (mencion_id, subject_id, grade_year, weekly_hours, is_active)
SELECT m.id, s.id, p.grade_year, p.weekly_hours, true
  FROM plan p
  JOIN public.menciones m ON m.code = p.mencion_code
  JOIN public.subjects s ON s.code = p.subject_code
ON CONFLICT (mencion_id, subject_id, grade_year) DO UPDATE
  SET weekly_hours = EXCLUDED.weekly_hours,
      is_active = true;

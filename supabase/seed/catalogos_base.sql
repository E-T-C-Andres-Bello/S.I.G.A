-- ============================================================================
-- S.I.G.A. — Catálogos Base Estructurales (Sin PII ni Contraseñas)
-- Seguro para versionar en Git y aplicar una sola vez en entornos nuevos.
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

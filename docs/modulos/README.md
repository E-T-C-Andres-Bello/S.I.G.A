# Documentación Técnica y Funcional por Sección — S.I.G.A.

**Institución:** Escuela Técnica Comercial "Andrés Bello" (Unare II, Puerto Ordaz) · **Código DEA:** `OD01340701`  
**Naturaleza de esta documentación:** Especificación arquitectónica, funcional y relacional previa a la fase de desarrollo de código y migraciones SQL.

---

## Alcance Cerrado del Sistema

S.I.G.A. se organiza estrictamente en **tres bloques de usuarios** y un **modelo relacional unificado y extensible**:

| Documento | Contenido | Audiencia / Roles |
| :--- | :--- | :--- |
| [00-MODELO-RELACIONAL-BD.md](./00-MODELO-RELACIONAL-BD.md) | Diseño completo de tablas, claves, relaciones, **tabla exclusiva de `roles`**, permisos RBAC, políticas RLS, auditoría inmutable y arquitectura híbrida **Supabase + Neon**. | Arquitectura / BD |
| [01-ALUMNOS.md](./01-ALUMNOS.md) | Especificación detallada (*qué se quiere*, *qué se hace* y *cómo se construye*) de todos los módulos estudiantiles, incluyendo acceso provisional por cédula vs. `@etcandresbello.org`. | `estudiante` |
| [02-DOCENTES.md](./02-DOCENTES.md) | Especificación detallada de planificación IA, asistencia *Offline-First* / QR, plan de evaluación ponderado, gestión en Aula Virtual, menciones, observaciones de boletín, tutoría de pasantías y reservas audiovisuales. | `docente` |
| [03-ADMINISTRACION.md](./03-ADMINISTRACION.md) | Especificación detallada de Dirección/BI, Coordinación de Mención, Control de Estudios/Secretaría, Orientación confidencial, Coordinación de Pasantías, Biblioteca y Administración RBAC. | `direccion`, `coordinador_mencion`, `control_estudios`, `orientacion`, `coordinador_pasantias`, `biblioteca` |
| [04-AULA-VIRTUAL.md](./04-AULA-VIRTUAL.md) | **Especificación unificada del Aula Virtual (`/aula-virtual`)**: campus único compartido dentro de S.I.G.A. para todos los alumnos y docentes, salas `[courseId]`, sincronización con planillas MPPE, Tutor IA RAG y laboratorios por mención. | `estudiante`, `docente`, `coordinador_mencion`, `direccion` |

### Exclusiones Explícitas de Alcance
Para mantener la arquitectura enfocada y libre de complejidad innecesaria, quedan **fuera del alcance** de S.I.G.A.:
- **Portal de Representantes** (los datos de contacto de emergencia/representante legal se resguardan únicamente dentro de la ficha administrativa del estudiante en Control de Estudios, sin cuentas ni portal propio).
- **Módulo PAE / Comedor escolar**.
- **Módulo de Mantenimiento físico del plantel / Obrero / Portería** (la bitácora técnica de Telemática refiere exclusivamente a prácticas académicas de soporte TI en laboratorio).
- **Gestión de Licencias o Patrocinios Tecnológicos**.
- **Notificaciones Push Web y Telegram Bot:** El sistema de avisos opera únicamente mediante **bandeja in-app (Supabase Realtime)** y **correo electrónico transaccional** vía Edge Functions.

---

## Decisiones Arquitectónicas Transversales

1. **Identidad y Seguridad de Dominio (`@etcandresbello.org` + Acceso Provisional por Cédula):**
   - El **acceso completo** a S.I.G.A. requiere autenticación vía **Google Workspace institucional (`@etcandresbello.org`)**; no se permiten cuentas `@gmail.com` ni otros dominios personales como credencial principal de ingreso.
   - Los usuarios pueden registrar un correo personal secundario únicamente como **correo de recuperación**.
   - Estudiantes recién ingresados (ej. 1.º año) o inscritos sin cuenta institucional activa pueden ingresar inicialmente con **Cédula** en modo **`provisional_cedula`** con permisos acotados (consultar ficha de inscripción, estatus de activación y solicitudes básicas), desbloqueando el ecosistema completo al vincular su cuenta `@etcandresbello.org`.
2. **RBAC Multi-Rol Extensible (`roles` + `permissions` + `role_permissions` + `user_roles`):**
   - Existe una **tabla exclusiva `roles`** desacoplada de `users`, conectada mediante `user_roles` (muchos-a-muchos), permitiendo que una misma persona posea múltiples roles simultáneos (por ejemplo: `docente` + `coordinador_mencion` o `docente` + `coordinador_pasantias`).
3. **Perímetro Cero-Secretos en Next.js:**
   - El entorno web Next.js solo contiene variables públicas de **Supabase**.
   - **Neon Serverless** (`siga-vault-analytics` y `siga-telematica-labs`), modelos de **IA (Gemini 2.5 Flash)**, correo transaccional y almacenamiento externo operan aislados tras **Supabase Edge Functions (Deno)** o endpoints de servidor protegidos.
4. **Offline-First, PDF Client-Side y Verificación Pública `/verificar`:**
   - Pase de asistencia en aula funciona sin internet mediante **PWA + IndexedDB** con claves de idempotencia (`client_mutation_id`).
   - Boletines, constancias, certificaciones MPPE y cartas de pasantía se generan en el navegador con **`@react-pdf/renderer`** (0 MB en servidor) y llevan firma hash + código QR verificable públicamente en `/verificar`.
5. **Aula Virtual Unificada dentro de S.I.G.A. (`/aula-virtual`):**
   - No se construye como una aplicación externa ni subdominio separado (`aula.*`), ni se fragmentan las materias por menciones. Todos los estudiantes y docentes confluyen en el campus único `/aula-virtual` y `/aula-virtual/[courseId]`, donde PostgreSQL RLS filtra automáticamente cursos por matrícula (`enrollments`) y asignaciones docentes (`teacher_assignments`). Los entornos de `telematica`, `aduanas` y `turismo` viven integrados dentro de `/aula-virtual` como laboratorios prácticos complementarios. Ver [04-AULA-VIRTUAL.md](./04-AULA-VIRTUAL.md).

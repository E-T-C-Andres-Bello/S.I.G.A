# Seeds y Catálogos Base — S.I.G.A.

Regla estricta del proyecto: **`supabase/migrations/` contiene únicamente DDL puro** (tablas, índices, RLS, triggers y RPCs). Cualquier inserción de catálogos o datos de desarrollo se mantiene separada en esta carpeta:

- **`catalogos_base.sql`** *(versionado en Git, sin PII ni claves)*: inserta de forma idempotente las 3 menciones (`TELEMATICA`, `ADUANAS`, `TURISMO`), los 8 roles exclusivos (`roles`) y los permisos RBAC (`permissions` + `role_permissions`).
- **`*.local.sql`** *(ignorado por `.gitignore`, **jamás subir a Git ni ejecutar en producción**)*: semillas de prueba locales (por ejemplo `dev_seed.local.sql` para pruebas de desarrollo en Supabase local).

> En **producción**, los catálogos estructurales se cargan de forma controlada cuando corresponda y los usuarios administrativos iniciales se crean mediante el panel seguro de Supabase Auth / flujo Google Workspace `@etcandresbello.org` sin guardar contraseñas en archivos versionados.

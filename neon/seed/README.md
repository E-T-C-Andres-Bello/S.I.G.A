# Seeds y Catálogos Base — S.I.G.A. (Neon PostgreSQL)

Regla estricta del proyecto: **`neon/migrations/` contiene únicamente DDL puro** (tablas, índices, RLS, triggers y RPCs). Cualquier inserción de catálogos o datos de desarrollo se mantiene separada en esta carpeta:

- **`catalogos_base.sql`** *(versionado en Git, sin PII ni claves)*: inserta de forma idempotente las 3 menciones (`TELEMATICA`, `ADUANAS`, `TURISMO`), los 8 roles exclusivos (`roles`) y los permisos RBAC (`permissions` + `role_permissions`). Se ejecuta con `npm run db:seed`.
- **`*.local.sql`** *(ignorado por `.gitignore`, **jamás subir a Git ni ejecutar en producción**)*: semillas de prueba locales con datos sintéticos (por ejemplo `dev_seed.local.sql` para pruebas QA en ramas `development` de Neon).

> En **producción**, los catálogos estructurales se cargan de forma controlada con `npm run db:seed` y los usuarios administrativos iniciales se crean mediante `scripts/db/create-user.mjs` o el flujo de Google Workspace `@etcandresbello.org` sobre Better Auth + Neon, sin guardar contraseñas en archivos versionados.

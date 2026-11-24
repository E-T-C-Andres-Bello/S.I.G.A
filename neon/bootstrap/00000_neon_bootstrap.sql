-- ============================================================================
-- S.I.G.A. — Bootstrap Idempotente para Neon PostgreSQL 17+
-- Prepara roles compatibles con RLS (`anon`, `authenticated`, `service_role`),
-- helpers `auth.uid()` / `auth.jwt()` / `auth.role()` basados en GUCs por
-- transacción (`SET LOCAL`) y la bitácora interna de migraciones.
-- ============================================================================

-- 1. ESQUEMAS BASE
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS siga_internal;

-- 2. ROLES DE APLICACIÓN SIN SUPERUSUARIO (RLS SIEMPRE ACTIVO EN anon/authenticated)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT NOBYPASSRLS;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT NOBYPASSRLS;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN NOINHERIT;
  END IF;

  -- Permitir que el rol propietario de Neon (`neondb_owner`) haga `SET LOCAL ROLE`
  EXECUTE format('GRANT anon, authenticated, service_role TO %I', current_user);

  -- Otorgar BYPASSRLS solo a service_role cuando el motor lo permita
  BEGIN
    ALTER ROLE service_role BYPASSRLS;
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END
$$;

-- 3. PRIVILEGIOS DE ESQUEMAS Y DEFECTO (MÍNIMO PRIVILEGIO PARA `anon`)
REVOKE ALL ON SCHEMA siga_internal FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA public, extensions, auth TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA siga_internal TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated, service_role;

-- 4. HELPERS DE IDENTIDAD POR TRANSACCIÓN (COMPATIBLES CON RLS Y RPCs DE S.I.G.A.)
CREATE OR REPLACE FUNCTION auth.jwt()
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = pg_catalog
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb,
    '{}'::jsonb
  );
$$;

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID
LANGUAGE sql
STABLE
SET search_path = pg_catalog
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid,
    NULLIF(
      (COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb) ->> 'sub'),
      ''
    )::uuid
  );
$$;

CREATE OR REPLACE FUNCTION auth.role()
RETURNS TEXT
LANGUAGE sql
STABLE
SET search_path = pg_catalog
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claim.role', true), ''),
    NULLIF(
      (COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb) ->> 'role'),
      ''
    ),
    ''
  );
$$;

REVOKE ALL ON FUNCTION auth.jwt() FROM PUBLIC;
REVOKE ALL ON FUNCTION auth.uid() FROM PUBLIC;
REVOKE ALL ON FUNCTION auth.role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth.jwt() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.role() TO anon, authenticated, service_role;

-- 5. TABLA DE CONTROL DE MIGRACIONES APLICADAS
CREATE TABLE IF NOT EXISTS siga_internal.schema_migrations (
  version TEXT PRIMARY KEY,
  checksum TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

REVOKE ALL ON TABLE siga_internal.schema_migrations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE siga_internal.schema_migrations TO service_role;

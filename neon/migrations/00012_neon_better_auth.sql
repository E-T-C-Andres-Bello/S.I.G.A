-- ============================================================================
-- S.I.G.A. — Migración 00012: Tablas de Autenticación Better Auth + Passkeys
-- Motor: Neon PostgreSQL 17/18+ (SOLO DDL — Cero INSERTs ni credenciales)
-- Seguridad: RLS habilitado + acceso revocado a PUBLIC, anon y authenticated.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.auth_user (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  "emailVerified" BOOLEAN NOT NULL DEFAULT false,
  image TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.auth_session (
  id TEXT PRIMARY KEY,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  token TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "userId" TEXT NOT NULL REFERENCES public.auth_user(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_auth_session_user_id ON public.auth_session("userId");
CREATE INDEX IF NOT EXISTS idx_auth_session_expires_at ON public.auth_session("expiresAt");

CREATE TABLE IF NOT EXISTS public.auth_account (
  id TEXT PRIMARY KEY,
  "accountId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES public.auth_user(id) ON DELETE CASCADE,
  "accessToken" TEXT,
  "refreshToken" TEXT,
  "idToken" TEXT,
  "accessTokenExpiresAt" TIMESTAMPTZ,
  "refreshTokenExpiresAt" TIMESTAMPTZ,
  scope TEXT,
  password TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_account_user_id ON public.auth_account("userId");
CREATE INDEX IF NOT EXISTS idx_auth_account_provider_account ON public.auth_account("providerId", "accountId");

CREATE TABLE IF NOT EXISTS public.auth_verification (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_verification_identifier ON public.auth_verification(identifier);
CREATE INDEX IF NOT EXISTS idx_auth_verification_expires_at ON public.auth_verification("expiresAt");

CREATE TABLE IF NOT EXISTS public.auth_passkey (
  id TEXT PRIMARY KEY,
  name TEXT,
  "publicKey" TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES public.auth_user(id) ON DELETE CASCADE,
  "credentialID" TEXT NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  "deviceType" TEXT NOT NULL,
  "backedUp" BOOLEAN NOT NULL DEFAULT false,
  transports TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT now(),
  aaguid TEXT
);

CREATE INDEX IF NOT EXISTS idx_auth_passkey_user_id ON public.auth_passkey("userId");
CREATE INDEX IF NOT EXISTS idx_auth_passkey_credential_id ON public.auth_passkey("credentialID");

-- Bloqueo estricto: ninguna tabla de credenciales/sesiones es accesible por `anon` o `authenticated`
ALTER TABLE public.auth_user ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_session ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_account ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_verification ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_passkey ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.auth_user FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.auth_session FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.auth_account FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.auth_verification FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.auth_passkey FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public.auth_user TO service_role;
GRANT ALL ON TABLE public.auth_session TO service_role;
GRANT ALL ON TABLE public.auth_account TO service_role;
GRANT ALL ON TABLE public.auth_verification TO service_role;
GRANT ALL ON TABLE public.auth_passkey TO service_role;

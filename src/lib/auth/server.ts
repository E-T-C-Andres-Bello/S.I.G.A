import { cache } from "react";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { passkey } from "@better-auth/passkey";
import { headers } from "next/headers";
import { getNeonPool, isNeonDatabaseConfigured } from "@/lib/db/neon";
import { devError, devWarn } from "@/lib/dev-logger";
import { INSTITUTIONAL_EMAIL_DOMAIN } from "@/lib/validators/auth";

export interface ServerAuthSession {
  authUserId: string;
  email: string | null;
  name: string | null;
}

function resolveAppBaseUrl(): string {
  return (
    process.env.BETTER_AUTH_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "http://localhost:3000"
  ).replace(/\/+$/, "");
}

function resolveRpId(baseUrl: string): string {
  try {
    return new URL(baseUrl).hostname;
  } catch {
    return "localhost";
  }
}

export function isAuthConfigured(): boolean {
  if (typeof window !== "undefined") {
    throw new Error("isAuthConfigured solo puede ejecutarse en el servidor.");
  }
  return (
    isNeonDatabaseConfigured() &&
    Boolean(process.env.BETTER_AUTH_SECRET?.trim())
  );
}

export function isGoogleWorkspaceOAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() &&
      process.env.GOOGLE_CLIENT_SECRET?.trim()
  );
}

type BetterAuthInstance = ReturnType<typeof createBetterAuthInstance>;

declare global {
  var __sigaBetterAuthV2: BetterAuthInstance | undefined;
}

function createBetterAuthInstance() {
  const baseURL = resolveAppBaseUrl();
  const rpID = resolveRpId(baseURL);
  const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();

  const trustedOrigins = Array.from(
    new Set(
      [
        baseURL,
        ...(process.env.NODE_ENV !== "production"
          ? ["http://localhost:3000", "http://127.0.0.1:3000"]
          : []),
      ].filter(Boolean)
    )
  );

  return betterAuth({
    appName: "S.I.G.A. — E.T.C. Andrés Bello",
    baseURL,
    basePath: "/api/auth",
    trustedOrigins,
    secret:
      process.env.BETTER_AUTH_SECRET?.trim() ||
      "siga-unconfigured-dev-fallback-secret-change-me",
    database: getNeonPool(),
    user: {
      modelName: "auth_user",
    },
    session: {
      modelName: "auth_session",
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: {
        enabled: true,
        maxAge: 60,
      },
    },
    account: {
      modelName: "auth_account",
      accountLinking: {
        enabled: true,
        trustedProviders: ["google"],
      },
    },
    verification: {
      modelName: "auth_verification",
    },
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 6,
      maxPasswordLength: 128,
    },
    socialProviders:
      googleClientId && googleClientSecret
        ? {
            google: {
              clientId: googleClientId,
              clientSecret: googleClientSecret,
              prompt: "select_account",
              hd: INSTITUTIONAL_EMAIL_DOMAIN,
            },
          }
        : undefined,
    advanced: {
      database: {
        generateId: () => crypto.randomUUID(),
      },
      useSecureCookies: baseURL.startsWith("https://"),
    },
    plugins: [
      passkey({
        rpID,
        rpName: 'S.I.G.A. — E.T.C. "Andrés Bello"',
        origin: baseURL,
        schema: {
          passkey: {
            modelName: "auth_passkey",
          },
        },
      }),
      nextCookies(),
    ],
  });
}

export function getAuth(): BetterAuthInstance {
  if (typeof window !== "undefined") {
    throw new Error("getAuth solo puede ejecutarse en el servidor.");
  }

  if (globalThis.__sigaBetterAuthV2) {
    return globalThis.__sigaBetterAuthV2;
  }

  const instance = createBetterAuthInstance();
  globalThis.__sigaBetterAuthV2 = instance;
  return instance;
}

/**
 * Obtiene la sesión autenticada actual validada por Better Auth (con deduplicación
 * por request vía React.cache y Cookie Cache firmada con BETTER_AUTH_SECRET).
 */
export const getServerAuthSession = cache(
  async (): Promise<ServerAuthSession | null> => {
    if (!isAuthConfigured()) {
      devWarn(
        "auth:session",
        "Autenticación no configurada (falta DATABASE_URL o BETTER_AUTH_SECRET)"
      );
      return null;
    }

    try {
      const auth = getAuth();
      const session = await auth.api.getSession({
        headers: await headers(),
      });

      if (!session?.user?.id) {
        return null;
      }

      return {
        authUserId: session.user.id,
        email: session.user.email ?? null,
        name: session.user.name ?? null,
      };
    } catch (error) {
      devError(
        "auth:session",
        "Error validando sesión Better Auth en servidor",
        error
      );
      return null;
    }
  }
);

/**
 * Cierra la sesión actual del usuario en servidor limpiando cookies HttpOnly.
 */
export async function signOutServerSession(): Promise<void> {
  if (!isAuthConfigured()) return;
  try {
    const auth = getAuth();
    await auth.api.signOut({
      headers: await headers(),
    });
  } catch (error) {
    devWarn("auth:session", "No se pudo mutar cookie al cerrar sesión en contexto de solo lectura", {
      reason: error instanceof Error ? error.message : "unknown",
    });
  }
}

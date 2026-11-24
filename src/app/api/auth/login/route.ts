import { NextResponse, type NextRequest } from "next/server";
import {
  getAuth,
  isAuthConfigured,
  signOutServerSession,
} from "@/lib/auth/server";
import {
  resolveAuthEmailForCedula,
  verifyPreEnrolledAccess,
} from "@/lib/auth/verification";
import {
  devError,
  devLog,
  devWarn,
  maskCedulaForDevLog,
  maskEmailForDevLog,
} from "@/lib/dev-logger";
import {
  enforceRateLimit,
  resolveRequestClientIp,
} from "@/lib/security/rate-limit";
import {
  AUTH_ERROR_MESSAGES,
  loginCredentialsSchema,
  type AuthErrorCode,
} from "@/lib/validators/auth";

export const runtime = "nodejs";

const GENERIC_CREDENTIALS_ERROR =
  "Cédula, correo o clave incorrectos, o tu ficha aún no ha sido pre-inscrita por Control de Estudios.";

function errorJson(
  message: string,
  status: number,
  code?: AuthErrorCode | "invalid_input" | "invalid_credentials" | "rate_limited",
  headers?: HeadersInit
): NextResponse {
  return NextResponse.json({ ok: false, code, message }, { status, headers });
}

/**
 * Inicio de sesión institucional con Cédula (`V12345678`) o correo `@etcandresbello.org`
 * y contraseña sobre Better Auth + Neon PostgreSQL.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const clientIp = resolveRequestClientIp(request);
  const rate = await enforceRateLimit({
    namespace: "auth_login",
    clientKey: clientIp,
    limit: 10,
    windowMs: 60_000,
  });

  if (!rate.allowed) {
    devWarn("auth:login", "Intento bloqueado por rate limit", {
      retryAfterSec: rate.retryAfterSec,
    });
    return errorJson(
      "Demasiados intentos de inicio de sesión. Espera un minuto antes de volver a intentar.",
      429,
      "rate_limited",
      { "Retry-After": String(rate.retryAfterSec) }
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch (error) {
    devError("auth:login", "Cuerpo JSON malformado en /api/auth/login", error);
    return errorJson("Solicitud de ingreso malformada.", 400, "invalid_input");
  }

  const parsed = loginCredentialsSchema.safeParse(rawBody);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message ?? "Datos de acceso inválidos.";
    devWarn("auth:login", "Validación Zod rechazada", { reason: firstIssue });
    return errorJson(firstIssue, 400, "invalid_input");
  }

  if (!isAuthConfigured()) {
    devError("auth:login", "Auth no configurado: revisa DATABASE_URL y BETTER_AUTH_SECRET en .env.local");
    return errorJson(
      AUTH_ERROR_MESSAGES.auth_not_configured,
      503,
      "auth_not_configured"
    );
  }

  const { identifier, password } = parsed.data;
  const maskedIdentifier =
    identifier.kind === "cedula"
      ? maskCedulaForDevLog(identifier.value)
      : maskEmailForDevLog(identifier.value);

  devLog("auth:login", "Iniciando validación de credenciales", {
    kind: identifier.kind,
    identifier: maskedIdentifier,
    origin: request.headers.get("origin") ?? "(none)",
  });

  let authEmail = identifier.value;

  if (identifier.kind === "cedula") {
    const resolved = await resolveAuthEmailForCedula(identifier.value);
    if (!resolved.ok) {
      devWarn("auth:login", "No se pudo resolver correo para la cédula", {
        identifier: maskedIdentifier,
        errorCode: resolved.errorCode,
      });
      if (resolved.errorCode === "schema_not_ready" || resolved.errorCode === "auth_not_configured") {
        return errorJson(
          AUTH_ERROR_MESSAGES[resolved.errorCode],
          503,
          resolved.errorCode
        );
      }
      if (resolved.errorCode === "account_suspended") {
        return errorJson(
          AUTH_ERROR_MESSAGES.account_suspended,
          403,
          "account_suspended"
        );
      }
      return errorJson(GENERIC_CREDENTIALS_ERROR, 401, "invalid_credentials");
    }

    authEmail = resolved.email;
  }

  const auth = getAuth();
  let signedUser: { id: string; email?: string | null } | null = null;
  let setCookies: string[] = [];

  try {
    const signInResult = await auth.api.signInEmail({
      body: {
        email: authEmail,
        password,
      },
      headers: request.headers,
      returnHeaders: true,
    });
    if (signInResult?.response?.user?.id) {
      signedUser = signInResult.response.user;
      const rawHeaders = signInResult.headers;
      if (rawHeaders && typeof rawHeaders.getSetCookie === "function") {
        setCookies = rawHeaders.getSetCookie();
      } else {
        const single = rawHeaders?.get("set-cookie");
        if (single) setCookies = [single];
      }
    }
  } catch (error) {
    devError("auth:login", "Better Auth signInEmail falló", error, {
      account: maskEmailForDevLog(authEmail),
    });
    return errorJson(GENERIC_CREDENTIALS_ERROR, 401, "invalid_credentials");
  }

  if (!signedUser) {
    devWarn("auth:login", "signInEmail retornó sin usuario", {
      account: maskEmailForDevLog(authEmail),
    });
    return errorJson(GENERIC_CREDENTIALS_ERROR, 401, "invalid_credentials");
  }

  const verification = await verifyPreEnrolledAccess({
    authUserId: signedUser.id,
    email: signedUser.email ?? authEmail,
    loginMethod: "credentials",
  });

  if (!verification.ok) {
    devWarn("auth:login", "verifyPreEnrolledAccess rechazó el ingreso", {
      account: maskEmailForDevLog(signedUser.email ?? authEmail),
      errorCode: verification.errorCode,
    });
    await signOutServerSession();
    return errorJson(
      AUTH_ERROR_MESSAGES[verification.errorCode],
      verification.errorCode === "schema_not_ready" ? 503 : 403,
      verification.errorCode
    );
  }

  devLog("auth:login", "Inicio de sesión exitoso", {
    account: maskEmailForDevLog(signedUser.email ?? authEmail),
    role: verification.primaryRole,
    redirectTo: verification.redirectTo,
    sessionHeadersCount: setCookies.length,
  });

  const response = NextResponse.json({
    ok: true,
    redirectTo: verification.redirectTo,
  });

  // Asegurar que la cookie de sesión viaje explícitamente en la respuesta HTTP
  for (const cookieStr of setCookies) {
    response.headers.append("set-cookie", cookieStr);
  }
  return response;
}

import { NextResponse, type NextRequest } from "next/server";
import {
  enforceRateLimit,
  resolveRequestClientIp,
} from "@/lib/security/rate-limit";
import {
  resolveAuthEmailForCedula,
  verifyPreEnrolledAccess,
} from "@/lib/supabase/auth-verification";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  AUTH_ERROR_MESSAGES,
  loginCredentialsSchema,
  type AuthErrorCode,
} from "@/lib/validators/auth";

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
 * y contraseña. No existe auto-registro; exige ficha pre-inscrita y rol activo.
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
  } catch {
    return errorJson("Solicitud de ingreso malformada.", 400, "invalid_input");
  }

  const parsed = loginCredentialsSchema.safeParse(rawBody);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message ?? "Datos de acceso inválidos.";
    return errorJson(firstIssue, 400, "invalid_input");
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return errorJson(
      AUTH_ERROR_MESSAGES.supabase_not_configured,
      503,
      "supabase_not_configured"
    );
  }

  const { identifier, password } = parsed.data;
  let authEmail = identifier.value;

  if (identifier.kind === "cedula") {
    const resolved = await resolveAuthEmailForCedula(identifier.value);
    if (!resolved.ok) {
      if (resolved.errorCode === "supabase_not_configured") {
        return errorJson(
          "El acceso por cédula requiere clave de servidor; inicia sesión con tu correo @etcandresbello.org.",
          503,
          resolved.errorCode
        );
      }
      if (resolved.errorCode === "schema_not_ready") {
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
      // Respuesta genérica para evitar enumeración de cédulas inscritas.
      return errorJson(GENERIC_CREDENTIALS_ERROR, 401, "invalid_credentials");
    }

    authEmail = resolved.email;
  }

  const { data: signInData, error: signInError } =
    await supabase.auth.signInWithPassword({
      email: authEmail,
      password,
    });

  if (signInError || !signInData.user) {
    return errorJson(GENERIC_CREDENTIALS_ERROR, 401, "invalid_credentials");
  }

  const verification = await verifyPreEnrolledAccess({
    authUserId: signInData.user.id,
    email: signInData.user.email,
    loginMethod: "credentials",
    sessionClient: supabase,
    accessToken: signInData.session?.access_token,
  });

  if (!verification.ok) {
    await supabase.auth.signOut();
    return errorJson(
      AUTH_ERROR_MESSAGES[verification.errorCode],
      verification.errorCode === "schema_not_ready" ? 503 : 403,
      verification.errorCode
    );
  }

  return NextResponse.json({
    ok: true,
    redirectTo: verification.redirectTo,
  });
}

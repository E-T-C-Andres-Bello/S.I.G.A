import { NextResponse, type NextRequest } from "next/server";
import {
  getServerAuthSession,
  isAuthConfigured,
  signOutServerSession,
} from "@/lib/auth/server";
import { verifyPreEnrolledAccess } from "@/lib/auth/verification";
import { devWarn, maskEmailForDevLog } from "@/lib/dev-logger";
import {
  isInstitutionalEmail,
  sanitizeInternalNextPath,
  type AuthErrorCode,
} from "@/lib/validators/auth";

export const runtime = "nodejs";

function buildErrorRedirect(
  requestUrl: URL,
  errorCode: AuthErrorCode,
  returnPath: string
): NextResponse {
  devWarn("auth:callback", "Redirigiendo con error de autenticación OAuth", {
    errorCode,
    returnPath,
  });
  const safeBase = sanitizeInternalNextPath(returnPath) ?? "/";
  const destination = new URL(safeBase, requestUrl.origin);
  destination.searchParams.set("auth_error", errorCode);
  return NextResponse.redirect(destination);
}

/**
 * Callback post-OAuth de Google Workspace (`@etcandresbello.org`) sobre Better Auth + Neon.
 * Verifica dominio institucional, pre-inscripción y elevación de cuentas provisionales.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const requestUrl = new URL(request.url);
  const linkMode = requestUrl.searchParams.get("link_mode") === "workspace";
  const returnPath =
    sanitizeInternalNextPath(requestUrl.searchParams.get("return_to")) ?? "/";
  const requestedNext = sanitizeInternalNextPath(requestUrl.searchParams.get("next"));

  if (requestUrl.searchParams.get("error")) {
    return buildErrorRedirect(requestUrl, "oauth_failed", returnPath);
  }

  if (!isAuthConfigured()) {
    return buildErrorRedirect(requestUrl, "auth_not_configured", returnPath);
  }

  const session = await getServerAuthSession();
  if (!session) {
    return buildErrorRedirect(requestUrl, "oauth_failed", returnPath);
  }

  const effectiveEmail = session.email?.trim().toLowerCase() ?? "";
  if (!isInstitutionalEmail(effectiveEmail)) {
    devWarn("auth:callback", "Correo OAuth fuera de dominio institucional", {
      account: maskEmailForDevLog(effectiveEmail),
    });
    if (!linkMode) {
      await signOutServerSession();
    }
    return buildErrorRedirect(requestUrl, "domain_not_allowed", returnPath);
  }

  const verification = await verifyPreEnrolledAccess({
    authUserId: session.authUserId,
    email: effectiveEmail,
    loginMethod: "google_oauth",
    requestedNextPath: requestedNext,
  });

  if (!verification.ok) {
    if (!linkMode) {
      await signOutServerSession();
    }
    return buildErrorRedirect(requestUrl, verification.errorCode, returnPath);
  }

  const successUrl = new URL(verification.redirectTo, requestUrl.origin);
  if (linkMode) {
    successUrl.searchParams.set("workspace_linked", "1");
  }
  return NextResponse.redirect(successUrl);
}

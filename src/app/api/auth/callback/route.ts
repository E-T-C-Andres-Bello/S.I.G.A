import { NextResponse, type NextRequest } from "next/server";
import { verifyPreEnrolledAccess } from "@/lib/supabase/auth-verification";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  isInstitutionalEmail,
  sanitizeInternalNextPath,
  type AuthErrorCode,
} from "@/lib/validators/auth";

function buildErrorRedirect(
  requestUrl: URL,
  errorCode: AuthErrorCode,
  returnPath: string
): NextResponse {
  const safeBase = sanitizeInternalNextPath(returnPath) ?? "/";
  const destination = new URL(safeBase, requestUrl.origin);
  destination.searchParams.set("auth_error", errorCode);
  return NextResponse.redirect(destination);
}

/**
 * Callback PKCE de Google Workspace OAuth (`@etcandresbello.org`).
 * Soporta tanto ingreso directo como vinculación desde cuenta `provisional_cedula`.
 * Bloquea dominios externos (como `@gmail.com`) y usuarios sin pre-inscripción.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const linkMode = requestUrl.searchParams.get("link_mode") === "workspace";
  const returnPath =
    sanitizeInternalNextPath(requestUrl.searchParams.get("return_to")) ?? "/";
  const requestedNext = sanitizeInternalNextPath(requestUrl.searchParams.get("next"));

  const providerError = requestUrl.searchParams.get("error");
  if (providerError || !code) {
    return buildErrorRedirect(requestUrl, "oauth_failed", returnPath);
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return buildErrorRedirect(requestUrl, "supabase_not_configured", returnPath);
  }

  const { data: sessionData, error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError || !sessionData.user) {
    return buildErrorRedirect(requestUrl, "oauth_failed", returnPath);
  }

  const googleIdentity = sessionData.user.identities?.find(
    (identity) => identity.provider === "google"
  );
  const googleIdentityEmail =
    typeof googleIdentity?.identity_data?.email === "string"
      ? googleIdentity.identity_data.email.trim().toLowerCase()
      : null;
  const effectiveEmail =
    googleIdentityEmail ?? sessionData.user.email?.trim().toLowerCase() ?? "";

  if (!isInstitutionalEmail(effectiveEmail)) {
    if (linkMode && googleIdentity) {
      const { error: unlinkError } = await supabase.auth.unlinkIdentity(googleIdentity);
      if (unlinkError) {
        await supabase.auth.signOut();
      }
      return buildErrorRedirect(requestUrl, "domain_not_allowed", returnPath);
    }

    await supabase.auth.signOut();
    return buildErrorRedirect(requestUrl, "domain_not_allowed", returnPath);
  }

  const verification = await verifyPreEnrolledAccess({
    authUserId: sessionData.user.id,
    email: effectiveEmail,
    loginMethod: "google_oauth",
    requestedNextPath: requestedNext,
    sessionClient: supabase,
    accessToken: sessionData.session?.access_token,
  });

  if (!verification.ok) {
    if (linkMode && googleIdentity) {
      const { error: unlinkError } = await supabase.auth.unlinkIdentity(googleIdentity);
      if (unlinkError) {
        await supabase.auth.signOut();
      }
      return buildErrorRedirect(requestUrl, verification.errorCode, returnPath);
    }

    await supabase.auth.signOut();
    return buildErrorRedirect(requestUrl, verification.errorCode, returnPath);
  }

  const successUrl = new URL(verification.redirectTo, requestUrl.origin);
  if (linkMode) {
    successUrl.searchParams.set("workspace_linked", "1");
  }
  return NextResponse.redirect(successUrl);
}

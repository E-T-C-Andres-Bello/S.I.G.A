import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isInstitutionalEmail,
  sanitizeInternalNextPath,
  type AuthErrorCode,
} from "@/lib/validators/auth";
import { createAdminSupabaseClient, createTokenSupabaseClient } from "./server";

export type InstitutionalRoleCode =
  | "direccion"
  | "control_estudios"
  | "orientacion"
  | "coordinador_pasantias"
  | "coordinador_mencion"
  | "biblioteca"
  | "docente"
  | "estudiante";

const ROLE_HOME_ROUTES: Record<InstitutionalRoleCode, string> = {
  direccion: "/analitica",
  control_estudios: "/control-estudios",
  orientacion: "/control-estudios/orientacion",
  coordinador_pasantias: "/pasantias",
  coordinador_mencion: "/docente",
  biblioteca: "/biblioteca",
  docente: "/docente",
  estudiante: "/estudiante",
};

interface InternalUserRow {
  id: string;
  auth_user_id: string | null;
  institutional_email: string | null;
  access_tier: "provisional_cedula" | "verified_workspace" | "suspended";
  is_active: boolean;
  deleted_at: string | null;
}

interface JoinedUserRoleRow {
  roles:
    | {
        code: string;
        hierarchy_level: number;
        requires_workspace: boolean;
      }
    | Array<{
        code: string;
        hierarchy_level: number;
        requires_workspace: boolean;
      }>
    | null;
}

export type PreEnrollmentCheckResult =
  | {
      ok: true;
      internalUserId: string;
      primaryRole: InstitutionalRoleCode;
      redirectTo: string;
    }
  | {
      ok: false;
      errorCode: AuthErrorCode;
    };

function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    Boolean(error.message?.includes("Could not find the table"))
  );
}

/**
 * Resuelve la cuenta de autenticación (por cédula canónica sin exponer existencia en cliente)
 * consultando exclusivamente `public.users` desde servidor.
 */
export async function resolveAuthEmailForCedula(
  canonicalCedula: string
): Promise<{ ok: true; email: string } | { ok: false; errorCode: AuthErrorCode }> {
  const adminClient = createAdminSupabaseClient();
  if (!adminClient) {
    return { ok: false, errorCode: "supabase_not_configured" };
  }

  const { data: userRow, error } = await adminClient
    .from("users")
    .select("auth_user_id, institutional_email, is_active, access_tier, deleted_at")
    .eq("cedula", canonicalCedula)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      errorCode: isMissingTableError(error) ? "schema_not_ready" : "not_enrolled",
    };
  }

  if (!userRow || !userRow.auth_user_id) {
    return { ok: false, errorCode: "not_enrolled" };
  }

  if (!userRow.is_active || userRow.access_tier === "suspended") {
    return { ok: false, errorCode: "account_suspended" };
  }

  if (userRow.institutional_email && isInstitutionalEmail(userRow.institutional_email)) {
    return { ok: true, email: userRow.institutional_email.toLowerCase() };
  }

  // Para alumnos en estado provisional_cedula aún sin Google Workspace vinculado,
  // resuelve el identificador real registrado en Supabase Auth sin exponerlo al navegador.
  const { data: authLookup, error: authError } =
    await adminClient.auth.admin.getUserById(userRow.auth_user_id);

  if (authError || !authLookup.user?.email) {
    return { ok: false, errorCode: "not_enrolled" };
  }

  return { ok: true, email: authLookup.user.email.toLowerCase() };
}

/**
 * Verifica de forma estricta (fail-closed) que:
 * 1) El dominio institucional `@etcandresbello.org` sea válido cuando el flujo lo exige.
 * 2) El usuario exista pre-inscrito en `public.users` (`deleted_at IS NULL`).
 * 3) Posea al menos un rol activo en `user_roles` conectado con `roles`.
 */
export async function verifyPreEnrolledAccess(params: {
  authUserId: string;
  email: string | undefined;
  loginMethod: "google_oauth" | "credentials";
  requestedNextPath?: string | null;
  sessionClient?: SupabaseClient | null;
  accessToken?: string | null;
}): Promise<PreEnrollmentCheckResult> {
  const adminClient: SupabaseClient | null = createAdminSupabaseClient();
  const tokenClient: SupabaseClient | null =
    !adminClient && params.accessToken
      ? createTokenSupabaseClient(params.accessToken)
      : null;
  const dbClient: SupabaseClient | null =
    adminClient ?? tokenClient ?? params.sessionClient ?? null;

  if (!dbClient) {
    return { ok: false, errorCode: "supabase_not_configured" };
  }

  const normalizedEmail = params.email?.trim().toLowerCase() ?? "";

  if (params.loginMethod === "google_oauth" && !isInstitutionalEmail(normalizedEmail)) {
    return { ok: false, errorCode: "domain_not_allowed" };
  }

  const { data: byAuthUser, error: authUserLookupError } = await dbClient
    .from("users")
    .select("id, auth_user_id, institutional_email, access_tier, is_active, deleted_at")
    .eq("auth_user_id", params.authUserId)
    .is("deleted_at", null)
    .maybeSingle<InternalUserRow>();

  if (authUserLookupError) {
    return {
      ok: false,
      errorCode: isMissingTableError(authUserLookupError)
        ? "schema_not_ready"
        : "not_enrolled",
    };
  }

  let matchedUser = byAuthUser;

  // Primer ingreso Workspace de un alumno o docente ya pre-inscrito por email institucional
  if (!matchedUser && isInstitutionalEmail(normalizedEmail) && adminClient) {
    const { data: byInstitutionalEmail, error: emailLookupError } = await adminClient
      .from("users")
      .select("id, auth_user_id, institutional_email, access_tier, is_active, deleted_at")
      .eq("institutional_email", normalizedEmail)
      .is("deleted_at", null)
      .maybeSingle<InternalUserRow>();

    if (emailLookupError) {
      return {
        ok: false,
        errorCode: isMissingTableError(emailLookupError)
          ? "schema_not_ready"
          : "not_enrolled",
      };
    }

    if (byInstitutionalEmail) {
      await adminClient
        .from("users")
        .update({
          auth_user_id: params.authUserId,
          access_tier: "verified_workspace",
          workspace_verified_at: new Date().toISOString(),
        })
        .eq("id", byInstitutionalEmail.id)
        .is("auth_user_id", null);

      matchedUser = {
        ...byInstitutionalEmail,
        auth_user_id: params.authUserId,
        access_tier: "verified_workspace",
      };
    }
  }

  if (!matchedUser) {
    return { ok: false, errorCode: "not_enrolled" };
  }

  if (!matchedUser.is_active || matchedUser.access_tier === "suspended") {
    return { ok: false, errorCode: "account_suspended" };
  }

  if (
    matchedUser.access_tier !== "provisional_cedula" &&
    !isInstitutionalEmail(normalizedEmail)
  ) {
    return { ok: false, errorCode: "domain_not_allowed" };
  }

  const { data: roleRows, error: rolesError } = await dbClient
    .from("user_roles")
    .select("roles!inner(code, hierarchy_level, requires_workspace)")
    .eq("user_id", matchedUser.id)
    .eq("is_active", true)
    .returns<JoinedUserRoleRow[]>();

  if (rolesError) {
    return {
      ok: false,
      errorCode: isMissingTableError(rolesError) ? "schema_not_ready" : "role_missing",
    };
  }

  const resolvedRoles = (roleRows ?? [])
    .flatMap((row) => (Array.isArray(row.roles) ? row.roles : row.roles ? [row.roles] : []))
    .filter((role): role is { code: InstitutionalRoleCode; hierarchy_level: number; requires_workspace: boolean } =>
      role.code in ROLE_HOME_ROUTES
    )
    .sort((a, b) => b.hierarchy_level - a.hierarchy_level);

  const primaryRole = resolvedRoles[0];
  if (!primaryRole) {
    return { ok: false, errorCode: "role_missing" };
  }

  if (
    matchedUser.access_tier === "provisional_cedula" &&
    resolvedRoles.some((role) => role.requires_workspace)
  ) {
    return { ok: false, errorCode: "domain_not_allowed" };
  }

  const safeNext = sanitizeInternalNextPath(params.requestedNextPath);
  const redirectTo = safeNext ?? ROLE_HOME_ROUTES[primaryRole.code];

  return {
    ok: true,
    internalUserId: matchedUser.id,
    primaryRole: primaryRole.code,
    redirectTo,
  };
}

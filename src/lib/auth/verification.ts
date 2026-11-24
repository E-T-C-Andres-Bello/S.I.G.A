import {
  isNeonDatabaseConfigured,
  querySingleRow,
  withServiceDb,
} from "@/lib/db/neon";
import { devError, devWarn, maskEmailForDevLog } from "@/lib/dev-logger";
import {
  isInstitutionalEmail,
  sanitizeInternalNextPath,
  type AuthErrorCode,
} from "@/lib/validators/auth";

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

interface RoleQueryRow {
  code: string;
  hierarchy_level: number;
  requires_workspace: boolean;
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

function isMissingTableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const pgErr = error as { code?: string; message?: string };
  return (
    pgErr.code === "42P01" ||
    Boolean(pgErr.message?.includes("does not exist"))
  );
}

/**
 * Resuelve la cuenta de autenticación (por cédula canónica sin exponer existencia en cliente)
 * consultando exclusivamente `public.users` y `public.auth_user` en Neon desde servidor.
 */
export async function resolveAuthEmailForCedula(
  canonicalCedula: string
): Promise<{ ok: true; email: string } | { ok: false; errorCode: AuthErrorCode }> {
  if (!isNeonDatabaseConfigured()) {
    return { ok: false, errorCode: "auth_not_configured" };
  }

  try {
    return await withServiceDb(async (client) => {
      const userRow = await querySingleRow<{
        auth_user_id: string | null;
        institutional_email: string | null;
        is_active: boolean;
        access_tier: "provisional_cedula" | "verified_workspace" | "suspended";
        auth_email: string | null;
      }>(
        client,
        `SELECT u.auth_user_id,
                u.institutional_email,
                u.is_active,
                u.access_tier,
                au.email AS auth_email
           FROM public.users u
           LEFT JOIN public.auth_user au ON au.id = u.auth_user_id::text
          WHERE u.cedula = $1
            AND u.deleted_at IS NULL
          LIMIT 1`,
        [canonicalCedula]
      );

      if (!userRow || !userRow.auth_user_id) {
        return { ok: false, errorCode: "not_enrolled" };
      }

      if (!userRow.is_active || userRow.access_tier === "suspended") {
        return { ok: false, errorCode: "account_suspended" };
      }

      if (userRow.auth_email) {
        return { ok: true, email: userRow.auth_email.toLowerCase() };
      }

      if (
        userRow.institutional_email &&
        isInstitutionalEmail(userRow.institutional_email)
      ) {
        return { ok: true, email: userRow.institutional_email.toLowerCase() };
      }

      return { ok: false, errorCode: "not_enrolled" };
    });
  } catch (error) {
    devError("auth:verification", "Error SQL al resolver cédula", error);
    return {
      ok: false,
      errorCode: isMissingTableError(error) ? "schema_not_ready" : "not_enrolled",
    };
  }
}

/**
 * Verifica de forma estricta (fail-closed) sobre Neon PostgreSQL que:
 * 1) El dominio institucional `@etcandresbello.org` sea válido cuando el flujo lo exige.
 * 2) El usuario exista pre-inscrito en `public.users` (`deleted_at IS NULL`).
 * 3) Posea al menos un rol activo en `user_roles` conectado con `roles`.
 */
export async function verifyPreEnrolledAccess(params: {
  authUserId: string;
  email: string | null | undefined;
  loginMethod: "google_oauth" | "credentials";
  requestedNextPath?: string | null;
}): Promise<PreEnrollmentCheckResult> {
  if (!isNeonDatabaseConfigured()) {
    return { ok: false, errorCode: "auth_not_configured" };
  }

  const normalizedEmail = params.email?.trim().toLowerCase() ?? "";

  if (params.loginMethod === "google_oauth" && !isInstitutionalEmail(normalizedEmail)) {
    return { ok: false, errorCode: "domain_not_allowed" };
  }

  try {
    return await withServiceDb(async (client) => {
      let matchedUser = await querySingleRow<InternalUserRow>(
        client,
        `SELECT id, auth_user_id, institutional_email, access_tier, is_active, deleted_at
           FROM public.users
          WHERE auth_user_id = $1::uuid
            AND deleted_at IS NULL
          LIMIT 1`,
        [params.authUserId]
      );

      // Elevación automática si el alumno provisional vincula su Google Workspace (@etcandresbello.org)
      if (
        matchedUser &&
        matchedUser.access_tier === "provisional_cedula" &&
        params.loginMethod === "google_oauth" &&
        isInstitutionalEmail(normalizedEmail)
      ) {
        if (
          matchedUser.institutional_email &&
          matchedUser.institutional_email.toLowerCase() !== normalizedEmail
        ) {
          return { ok: false, errorCode: "domain_not_allowed" };
        }

        const emailOwner = await querySingleRow<{ id: string }>(
          client,
          `SELECT id
             FROM public.users
            WHERE lower(institutional_email) = $1
              AND id <> $2::uuid
              AND deleted_at IS NULL
            LIMIT 1`,
          [normalizedEmail, matchedUser.id]
        );

        if (emailOwner) {
          return { ok: false, errorCode: "domain_not_allowed" };
        }

        const upgradedUser = await querySingleRow<InternalUserRow>(
          client,
          `UPDATE public.users
              SET institutional_email = $1,
                  access_tier = 'verified_workspace',
                  workspace_verified_at = now()
            WHERE id = $2::uuid
              AND access_tier = 'provisional_cedula'
            RETURNING id, auth_user_id, institutional_email, access_tier, is_active, deleted_at`,
          [normalizedEmail, matchedUser.id]
        );

        if (!upgradedUser) {
          return { ok: false, errorCode: "oauth_failed" };
        }

        matchedUser = upgradedUser;
      }

      // Primer ingreso Workspace de un alumno o docente ya pre-inscrito por email institucional
      if (!matchedUser && isInstitutionalEmail(normalizedEmail)) {
        const byInstitutionalEmail = await querySingleRow<InternalUserRow>(
          client,
          `SELECT id, auth_user_id, institutional_email, access_tier, is_active, deleted_at
             FROM public.users
            WHERE lower(institutional_email) = $1
              AND deleted_at IS NULL
            LIMIT 1`,
          [normalizedEmail]
        );

        if (
          byInstitutionalEmail &&
          (byInstitutionalEmail.auth_user_id === null ||
            byInstitutionalEmail.access_tier === "provisional_cedula")
        ) {
          const boundUser = await querySingleRow<InternalUserRow>(
            client,
            `UPDATE public.users
                SET auth_user_id = $1::uuid,
                    access_tier = 'verified_workspace',
                    workspace_verified_at = now()
              WHERE id = $2::uuid
              RETURNING id, auth_user_id, institutional_email, access_tier, is_active, deleted_at`,
            [params.authUserId, byInstitutionalEmail.id]
          );

          if (boundUser) {
            matchedUser = boundUser;
          }
        }
      }

      if (!matchedUser) {
        devWarn("auth:verification", "Usuario no encontrado o eliminado en public.users", {
          account: maskEmailForDevLog(normalizedEmail),
        });
        return { ok: false, errorCode: "not_enrolled" };
      }

      if (!matchedUser.is_active || matchedUser.access_tier === "suspended") {
        devWarn("auth:verification", "Cuenta inactiva o suspendida", {
          account: maskEmailForDevLog(normalizedEmail),
          accessTier: matchedUser.access_tier,
        });
        return { ok: false, errorCode: "account_suspended" };
      }

      if (
        matchedUser.access_tier !== "provisional_cedula" &&
        !isInstitutionalEmail(normalizedEmail)
      ) {
        devWarn("auth:verification", "Correo fuera de dominio institucional para cuenta verificada", {
          account: maskEmailForDevLog(normalizedEmail),
        });
        return { ok: false, errorCode: "domain_not_allowed" };
      }

      const rolesResult = await client.query<RoleQueryRow>(
        `SELECT r.code, r.hierarchy_level, r.requires_workspace
           FROM public.user_roles ur
           JOIN public.roles r ON r.id = ur.role_id
          WHERE ur.user_id = $1::uuid
            AND ur.is_active = true
            AND r.is_active = true
          ORDER BY r.hierarchy_level DESC`,
        [matchedUser.id]
      );

      const resolvedRoles = rolesResult.rows.filter(
        (role): role is RoleQueryRow & { code: InstitutionalRoleCode } =>
          role.code in ROLE_HOME_ROUTES
      );

      const primaryRole = resolvedRoles[0];
      if (!primaryRole) {
        devWarn("auth:verification", "Usuario sin rol activo en public.user_roles", {
          account: maskEmailForDevLog(normalizedEmail),
        });
        return { ok: false, errorCode: "role_missing" };
      }

      if (
        matchedUser.access_tier === "provisional_cedula" &&
        resolvedRoles.some((role) => role.requires_workspace)
      ) {
        devWarn("auth:verification", "Rol requiere Google Workspace pero la cuenta es provisional_cedula", {
          account: maskEmailForDevLog(normalizedEmail),
          primaryRole: primaryRole.code,
        });
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
    });
  } catch (error) {
    devError("auth:verification", "Error SQL en verifyPreEnrolledAccess", error);
    return {
      ok: false,
      errorCode: isMissingTableError(error) ? "schema_not_ready" : "not_enrolled",
    };
  }
}

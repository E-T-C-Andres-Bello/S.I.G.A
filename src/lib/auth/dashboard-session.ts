import { cache } from "react";
import { redirect } from "next/navigation";
import {
  callNeonRpcScalar,
  querySingleRow,
  withUserDb,
} from "@/lib/db/neon";
import { devWarn } from "@/lib/dev-logger";
import { isInstitutionalEmail, type AuthErrorCode } from "@/lib/validators/auth";
import {
  getServerAuthSession,
  isAuthConfigured,
  signOutServerSession,
} from "./server";
import {
  verifyPreEnrolledAccess,
  type InstitutionalRoleCode,
} from "./verification";

export interface DashboardUserProfile {
  authUserId: string;
  authEmail: string | null;
  internalUserId: string;
  firstName: string;
  lastName: string;
  cedula: string;
  institutionalEmail: string | null;
  recoveryEmail: string | null;
  phone: string | null;
  accessTier: "provisional_cedula" | "verified_workspace" | "suspended";
  avatarWebpUrl: string | null;
  primaryRole: InstitutionalRoleCode;
  unreadNotificationsCount: number;
}

interface UserProfileQueryRow {
  first_name: string;
  last_name: string;
  cedula: string;
  institutional_email: string | null;
  recovery_email: string | null;
  phone: string | null;
  access_tier: "provisional_cedula" | "verified_workspace" | "suspended";
  avatar_webp_url: string | null;
}

interface SessionContextRpcPayload {
  ok: boolean;
  error_code?: AuthErrorCode;
  internal_user_id?: string;
  first_name?: string;
  last_name?: string;
  cedula?: string;
  institutional_email?: string | null;
  recovery_email?: string | null;
  phone?: string | null;
  access_tier?: "provisional_cedula" | "verified_workspace" | "suspended";
  avatar_webp_url?: string | null;
  primary_role?: InstitutionalRoleCode;
  unread_notifications_count?: number;
}

function isUndefinedFunctionError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const pgErr = error as { code?: string; message?: string };
  return (
    pgErr.code === "42883" ||
    Boolean(pgErr.message?.includes("siga_get_dashboard_session_context"))
  );
}

/**
 * Resuelve en una sola llamada SQL el contexto completo del usuario autenticado
 * (perfil, rol activo y conteo de notificaciones no leídas) sin redirigir, útil para Route Handlers.
 */
export const resolveDashboardUserContextOrNull = cache(
  async (): Promise<
    | { ok: true; profile: DashboardUserProfile }
    | { ok: false; reason: "not_configured" | "no_session" | AuthErrorCode }
  > => {
    if (!isAuthConfigured()) {
      return { ok: false, reason: "not_configured" };
    }

    const session = await getServerAuthSession();
    if (!session) {
      return { ok: false, reason: "no_session" };
    }

    // Camino rápido: 1 sola transacción y 1 llamada RPC en Neon (migración 00019+)
    try {
      const fastCtx = await withUserDb(
        { authUserId: session.authUserId, email: session.email },
        (client) =>
          callNeonRpcScalar<SessionContextRpcPayload>(
            client,
            "siga_get_dashboard_session_context"
          )
      );

      if (fastCtx?.ok && fastCtx.internal_user_id && fastCtx.primary_role) {
        return {
          ok: true,
          profile: {
            authUserId: session.authUserId,
            authEmail: session.email,
            internalUserId: fastCtx.internal_user_id,
            firstName: fastCtx.first_name ?? "",
            lastName: fastCtx.last_name ?? "",
            cedula: fastCtx.cedula ?? "",
            institutionalEmail: fastCtx.institutional_email ?? null,
            recoveryEmail: fastCtx.recovery_email ?? null,
            phone: fastCtx.phone ?? null,
            accessTier: fastCtx.access_tier ?? "provisional_cedula",
            avatarWebpUrl: fastCtx.avatar_webp_url ?? null,
            primaryRole: fastCtx.primary_role,
            unreadNotificationsCount: Number(
              fastCtx.unread_notifications_count ?? 0
            ),
          },
        };
      }

      // Si el usuario tiene correo @etcandresbello.org pero aún no tiene auth_user_id enlazado,
      // delegamos a verifyPreEnrolledAccess para realizar el auto-enlace en escritura.
      if (
        fastCtx &&
        !fastCtx.ok &&
        !(
          fastCtx.error_code === "not_enrolled" &&
          isInstitutionalEmail(session.email ?? "")
        )
      ) {
        return {
          ok: false,
          reason: fastCtx.error_code ?? "not_enrolled",
        };
      }
    } catch (error) {
      if (!isUndefinedFunctionError(error)) {
        throw error;
      }
    }

    // Fallback para auto-enlace de primer login Workspace o entornos previos a migración 00019
    const verification = await verifyPreEnrolledAccess({
      authUserId: session.authUserId,
      email: session.email,
      loginMethod: "credentials",
    });

    if (!verification.ok) {
      return { ok: false, reason: verification.errorCode };
    }

    const combined = await withUserDb(
      { authUserId: session.authUserId, email: session.email },
      (client) =>
        querySingleRow<UserProfileQueryRow & { unread_total: number }>(
          client,
          `SELECT u.first_name,
                  u.last_name,
                  u.cedula,
                  u.institutional_email,
                  u.recovery_email,
                  u.phone,
                  u.access_tier,
                  u.avatar_webp_url,
                  (
                    SELECT count(*)::int
                      FROM public.notifications n
                     WHERE n.recipient_user_id = u.id
                       AND n.is_read = false
                  ) AS unread_total
             FROM public.users u
            WHERE u.id = $1::uuid
            LIMIT 1`,
          [verification.internalUserId]
        )
    );

    if (!combined) {
      return { ok: false, reason: "not_enrolled" };
    }

    return {
      ok: true,
      profile: {
        authUserId: session.authUserId,
        authEmail: session.email,
        internalUserId: verification.internalUserId,
        firstName: combined.first_name,
        lastName: combined.last_name,
        cedula: combined.cedula,
        institutionalEmail: combined.institutional_email,
        recoveryEmail: combined.recovery_email,
        phone: combined.phone,
        accessTier: combined.access_tier,
        avatarWebpUrl: combined.avatar_webp_url,
        primaryRole: verification.primaryRole,
        unreadNotificationsCount: combined.unread_total ?? 0,
      },
    };
  }
);

/**
 * Resuelve y valida en servidor la sesión autenticada (Better Auth + Neon PostgreSQL)
 * y la matrícula/rol activo antes de renderizar cualquier ruta privada de `(dashboard)`.
 */
export const getAuthenticatedDashboardContext = cache(
  async (): Promise<DashboardUserProfile> => {
    const resolved = await resolveDashboardUserContextOrNull();

    if (resolved.ok) {
      return resolved.profile;
    }

    if (resolved.reason === "not_configured") {
      devWarn("dashboard:session", "Redirigiendo a /: auth no configurado");
      redirect("/?auth_error=supabase_not_configured");
    }

    if (resolved.reason === "no_session") {
      devWarn(
        "dashboard:session",
        "Redirigiendo a /: getServerAuthSession retornó null"
      );
      redirect("/");
    }

    devWarn("dashboard:session", "Redirigiendo a /: verificación fallida", {
      errorCode: resolved.reason,
    });
    await signOutServerSession();
    redirect(`/?auth_error=${resolved.reason}`);
  }
);

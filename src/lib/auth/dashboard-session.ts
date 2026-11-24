import { cache } from "react";
import { redirect } from "next/navigation";
import { querySingleRow, withUserDb } from "@/lib/db/neon";
import { devWarn } from "@/lib/dev-logger";
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

/**
 * Resuelve y valida en servidor la sesión autenticada (Better Auth + Neon PostgreSQL)
 * y la matrícula/rol activo antes de renderizar cualquier ruta privada de `(dashboard)`.
 */
export const getAuthenticatedDashboardContext = cache(
  async (): Promise<DashboardUserProfile> => {
    if (!isAuthConfigured()) {
      devWarn("dashboard:session", "Redirigiendo a /: auth no configurado");
      redirect("/?auth_error=supabase_not_configured");
    }

    const session = await getServerAuthSession();
    if (!session) {
      devWarn("dashboard:session", "Redirigiendo a /: getServerAuthSession retornó null");
      redirect("/");
    }

    const verification = await verifyPreEnrolledAccess({
      authUserId: session.authUserId,
      email: session.email,
      loginMethod: "credentials",
    });

    if (!verification.ok) {
      devWarn("dashboard:session", "Redirigiendo a /: verificación fallida", {
        errorCode: verification.errorCode,
      });
      await signOutServerSession();
      redirect(`/?auth_error=${verification.errorCode}`);
    }

    const { profile, unreadCount } = await withUserDb(
      { authUserId: session.authUserId, email: session.email },
      async (client) => {
        const [profileRow, unreadRow] = await Promise.all([
          querySingleRow<UserProfileQueryRow>(
            client,
            `SELECT first_name,
                    last_name,
                    cedula,
                    institutional_email,
                    recovery_email,
                    phone,
                    access_tier,
                    avatar_webp_url
               FROM public.users
              WHERE id = $1::uuid
              LIMIT 1`,
            [verification.internalUserId]
          ),
          querySingleRow<{ total: number }>(
            client,
            `SELECT count(*)::int AS total
               FROM public.notifications
              WHERE recipient_user_id = $1::uuid
                AND is_read = false`,
            [verification.internalUserId]
          ),
        ]);

        return {
          profile: profileRow,
          unreadCount: unreadRow?.total ?? 0,
        };
      }
    );

    if (!profile) {
      redirect("/?auth_error=not_enrolled");
    }

    return {
      authUserId: session.authUserId,
      authEmail: session.email,
      internalUserId: verification.internalUserId,
      firstName: profile.first_name,
      lastName: profile.last_name,
      cedula: profile.cedula,
      institutionalEmail: profile.institutional_email,
      recoveryEmail: profile.recovery_email,
      phone: profile.phone,
      accessTier: profile.access_tier,
      avatarWebpUrl: profile.avatar_webp_url,
      primaryRole: verification.primaryRole,
      unreadNotificationsCount: unreadCount,
    };
  }
);

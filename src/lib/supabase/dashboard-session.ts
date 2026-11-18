import { cache } from "react";
import { redirect } from "next/navigation";
import {
  verifyPreEnrolledAccess,
  type InstitutionalRoleCode,
} from "@/lib/supabase/auth-verification";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface DashboardUserProfile {
  internalUserId: string;
  firstName: string;
  lastName: string;
  cedula: string;
  institutionalEmail: string | null;
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
  access_tier: "provisional_cedula" | "verified_workspace" | "suspended";
  avatar_webp_url: string | null;
}

/**
 * Resuelve y valida en servidor la sesión autenticada y la matrícula/rol activo
 * del usuario antes de renderizar cualquier ruta privada de `(dashboard)`.
 * Falla cerrado (redirige a `/`) si falta configuración `.env.local` o sesión.
 */
export const getAuthenticatedDashboardContext = cache(
  async (): Promise<DashboardUserProfile> => {
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      redirect("/?auth_error=supabase_not_configured");
    }

    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      redirect("/");
    }

    const verification = await verifyPreEnrolledAccess({
      authUserId: authUser.id,
      email: authUser.email,
      loginMethod: "credentials",
      sessionClient: supabase,
    });

    if (!verification.ok) {
      await supabase.auth.signOut();
      redirect(`/?auth_error=${verification.errorCode}`);
    }

    const [profileResult, unreadResult] = await Promise.all([
      supabase
        .from("users")
        .select(
          "first_name, last_name, cedula, institutional_email, access_tier, avatar_webp_url"
        )
        .eq("id", verification.internalUserId)
        .maybeSingle<UserProfileQueryRow>(),
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("recipient_user_id", verification.internalUserId)
        .eq("is_read", false),
    ]);

    const profile = profileResult.data;
    if (!profile) {
      redirect("/?auth_error=not_enrolled");
    }

    return {
      internalUserId: verification.internalUserId,
      firstName: profile.first_name,
      lastName: profile.last_name,
      cedula: profile.cedula,
      institutionalEmail: profile.institutional_email,
      accessTier: profile.access_tier,
      avatarWebpUrl: profile.avatar_webp_url,
      primaryRole: verification.primaryRole,
      unreadNotificationsCount: unreadResult.count ?? 0,
    };
  }
);

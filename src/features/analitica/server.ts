import { queryInstitutionalAnalytics } from "@/lib/neon/analytics-client";
import type { DashboardUserProfile } from "@/lib/supabase/dashboard-session";
import { assertAuthorizedRole } from "@/lib/supabase/rbac";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  AnalyticsBiOverview,
  AnalyticsFilterInput,
} from "./schemas";

export type AnalyticsServerResult =
  | { ok: true; data: AnalyticsBiOverview }
  | { ok: false; message: string };

/**
 * Obtiene en servidor el tablero completo de Dirección y Analítica Avanzada
 * validando sesión institucional verificada y rol autorizado.
 */
export async function getInstitutionalAnalyticsData(
  profile: DashboardUserProfile,
  filters?: AnalyticsFilterInput
): Promise<AnalyticsServerResult> {
  const authCheck = assertAuthorizedRole(
    profile,
    ["direccion", "control_estudios", "coordinador_mencion"],
    { requireVerifiedWorkspace: true }
  );

  if (!authCheck.ok) {
    return authCheck;
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return {
      ok: false,
      message: "El servicio de datos institucionales no está disponible.",
    };
  }

  return queryInstitutionalAnalytics(supabase, filters);
}


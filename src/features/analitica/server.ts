import type { DashboardUserProfile } from "@/lib/auth/dashboard-session";
import { assertAuthorizedRole } from "@/lib/auth/rbac";
import { queryInstitutionalAnalytics } from "@/lib/neon/analytics-client";
import type {
  AnalyticsBiOverview,
  AnalyticsFilterInput,
} from "./schemas";

export type AnalyticsServerResult =
  | { ok: true; data: AnalyticsBiOverview }
  | { ok: false; message: string };

/**
 * Obtiene en servidor el tablero completo de Dirección y Analítica Avanzada
 * validando sesión institucional verificada y rol autorizado sobre Neon.
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

  return queryInstitutionalAnalytics(
    { authUserId: profile.authUserId, email: profile.authEmail },
    filters
  );
}

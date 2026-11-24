import {
  analyticsFilterSchema,
  type AnalyticsBiOverview,
  type AnalyticsFilterInput,
} from "@/features/analitica/schemas";
import {
  callNeonRpcScalar,
  isNeonDatabaseConfigured,
  withUserDb,
  type NeonAuthSessionContext,
} from "@/lib/db/neon";

/**
 * Cliente de analítica institucional directamente sobre Neon PostgreSQL
 * ejecutando el RPC `SECURITY DEFINER` `siga_get_analytics_bi_overview` bajo RLS/RBAC.
 */
export async function queryInstitutionalAnalytics(
  authSession: NeonAuthSessionContext,
  rawFilters?: AnalyticsFilterInput
): Promise<
  | { ok: true; data: AnalyticsBiOverview }
  | { ok: false; message: string }
> {
  if (typeof window !== "undefined") {
    throw new Error(
      "queryInstitutionalAnalytics solo puede ejecutarse en el servidor."
    );
  }

  const parsed = analyticsFilterSchema.safeParse(rawFilters ?? {});
  if (!parsed.success) {
    return {
      ok: false,
      message: "Los filtros de consulta estadística no son válidos.",
    };
  }

  if (!isNeonDatabaseConfigured()) {
    return {
      ok: false,
      message: "El servicio de datos institucionales no está disponible.",
    };
  }

  const { schoolYearId = null, momentoNumber = null } = parsed.data;

  try {
    const data = await withUserDb(authSession, (client) =>
      callNeonRpcScalar<AnalyticsBiOverview>(
        client,
        "siga_get_analytics_bi_overview",
        {
          p_school_year_id: schoolYearId,
          p_momento_number: momentoNumber,
        }
      )
    );

    if (!data || typeof data !== "object") {
      return {
        ok: false,
        message: "No fue posible cargar los indicadores institucionales en este momento.",
      };
    }

    return {
      ok: true,
      data: {
        ...data,
        source: "neon_vault",
      },
    };
  } catch (error) {
    const pgErr = error as { code?: string };
    if (pgErr?.code === "42501") {
      return {
        ok: false,
        message: "No cuentas con permisos para consultar el tablero de analítica institucional.",
      };
    }
    return {
      ok: false,
      message: "No fue posible cargar los indicadores institucionales en este momento.",
    };
  }
}

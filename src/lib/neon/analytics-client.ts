import type { SupabaseClient } from "@supabase/supabase-js";
import {
  analyticsFilterSchema,
  type AnalyticsBiOverview,
  type AnalyticsFilterInput,
} from "@/features/analitica/schemas";
import { queryAnalyticsViaRlsFallback } from "./analytics-fallback";

/**
 * Cliente de analítica institucional (Zero-Secrets en Next.js).
 * Invoca la Edge Function aislada `neon-analytics-query` cuando la bóveda externa
 * está activa y usa el RPC agregado `siga_get_analytics_bi_overview` como fuente
 * transaccional verificada cuando no hay bóveda externa desplegada.
 */
export async function queryInstitutionalAnalytics(
  supabase: SupabaseClient,
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

  const { schoolYearId = null, momentoNumber = null } = parsed.data;

  // 1. Intentar consulta a bóveda analítica vía Edge Function (sin credenciales Neon en Next.js)
  try {
    const { data: edgeData, error: edgeError } = await supabase.functions.invoke<{
      source?: string;
      slaRows?: unknown[];
      subjectRows?: unknown[];
      riskRows?: unknown[];
    }>("neon-analytics-query", {
      body: {
        queryKey: "overview",
        schoolYearId,
        momentoNumber,
      },
    });

    if (
      !edgeError &&
      edgeData?.source === "neon_vault" &&
      Array.isArray(edgeData.subjectRows) &&
      edgeData.subjectRows.length > 0
    ) {
      // Si Neon está activo y sincronizado, complementamos con el RPC para
      // catálogos/matrícula en vivo y marcamos el origen como bóveda analítica.
      const { data: liveData } = await supabase.rpc(
        "siga_get_analytics_bi_overview",
        {
          p_school_year_id: schoolYearId,
          p_momento_number: momentoNumber,
        }
      );

      if (liveData && typeof liveData === "object") {
        return {
          ok: true,
          data: {
            ...(liveData as AnalyticsBiOverview),
            source: "neon_vault",
          },
        };
      }
    }
  } catch {
    // Continuar hacia el RPC agregado principal si la Edge Function no está activa aún.
  }

  // 2. Consulta agregada directa sobre RPC SECURITY DEFINER con RLS/RBAC estricto
  const { data, error } = await supabase.rpc(
    "siga_get_analytics_bi_overview",
    {
      p_school_year_id: schoolYearId,
      p_momento_number: momentoNumber,
    }
  );

  if (error || !data) {
    // Si la migración 00011 aún no ha sido aplicada en Supabase o hubo un fallo de esquema,
    // consultar bajo RLS estándar del usuario autenticado (salvo denegación explícita 42501).
    const isPermissionDenied = error?.code === "42501";

    if (!isPermissionDenied) {
      if (error) {
        console.warn(
          "[analitica] Usando consulta RLS estándar:",
          error.code ?? "unknown",
          error.message ?? ""
        );
      }
      try {
        const fallbackData = await queryAnalyticsViaRlsFallback(
          supabase,
          schoolYearId,
          momentoNumber
        );
        return { ok: true, data: fallbackData };
      } catch (fallbackErr) {
        console.warn("[analitica] Error en consulta RLS:", fallbackErr);
        return {
          ok: false,
          message:
            "No fue posible cargar los indicadores institucionales en este momento.",
        };
      }
    }

    return {
      ok: false,
      message:
        "No fue posible cargar los indicadores institucionales en este momento.",
    };
  }

  return {
    ok: true,
    data: data as AnalyticsBiOverview,
  };
}


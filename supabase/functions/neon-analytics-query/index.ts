import { createClient } from "jsr:@supabase/supabase-js@2";
import { neon } from "npm:@neondatabase/serverless@0.10.4";

const ALLOWED_QUERY_KEYS = new Set([
  "overview",
  "sla_metrics",
  "materias_filtro",
  "riesgo_temprano",
  "reporte_cdce",
]);

const ALLOWED_ROLES = new Set([
  "direccion",
  "control_estudios",
  "coordinador_mencion",
]);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Método no permitido" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const neonReadUrl = Deno.env.get("NEON_ANALYTICS_READ_URL");

  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonResponse({ error: "Configuración de servidor incompleta" }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return jsonResponse({ error: "Sesión requerida" }, 401);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return jsonResponse({ error: "Sesión inválida o expirada" }, 401);
  }

  // Verificar rol activo del usuario en PostgreSQL bajo su propio JWT
  const { data: internalUser, error: internalUserError } = await supabase
    .from("users")
    .select("id, access_tier")
    .eq("auth_user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (
    internalUserError ||
    !internalUser ||
    internalUser.access_tier !== "verified_workspace"
  ) {
    return jsonResponse(
      { error: "Cuenta institucional verificada requerida" },
      403
    );
  }

  const { data: rolesRows, error: rolesError } = await supabase
    .from("user_roles")
    .select("mencion_id, roles!inner(code)")
    .eq("user_id", internalUser.id)
    .eq("is_active", true);

  if (rolesError || !rolesRows || rolesRows.length === 0) {
    return jsonResponse({ error: "Sin roles institucionales activos" }, 403);
  }

  const roleCodes = rolesRows
    .map((r: { roles: { code: string } | { code: string }[] }) =>
      Array.isArray(r.roles) ? r.roles[0]?.code : r.roles?.code
    )
    .filter((c): c is string => typeof c === "string" && ALLOWED_ROLES.has(c));

  if (roleCodes.length === 0) {
    return jsonResponse({ error: "Rol sin acceso a analítica BI" }, 403);
  }

  let payload: {
    queryKey?: string;
    schoolYearId?: string | null;
    momentoNumber?: number | null;
  };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Cuerpo JSON inválido" }, 400);
  }

  const queryKey = payload?.queryKey ?? "overview";
  if (!ALLOWED_QUERY_KEYS.has(queryKey)) {
    return jsonResponse({ error: "Identificador de consulta no permitido" }, 400);
  }

  // Si Neon Vault no está configurado en secretos todavía, responder 503 controlado
  // para que el servidor Next.js pueda usar el RPC agregado de Supabase sin error.
  if (!neonReadUrl) {
    return jsonResponse(
      {
        error: "neon_not_configured",
        message: "Bóveda analítica externa no configurada en este entorno.",
      },
      503
    );
  }

  const isFullAdmin =
    roleCodes.includes("direccion") || roleCodes.includes("control_estudios");
  const coordMencionId = isFullAdmin
    ? null
    : (rolesRows.find((r: { mencion_id: string | null }) => r.mencion_id)
        ?.mencion_id ?? null);

  try {
    const sql = neon(neonReadUrl);

    if (queryKey === "overview") {
      const [slaRows, subjectRows, riskRows, watermarkRows] = await Promise.all([
        sql`
          SELECT metric_key, payload, computed_at
          FROM analytics_sla_metrics
          WHERE ($1::uuid IS NULL OR mencion_id IS NULL OR mencion_id = $1::uuid)
          ORDER BY computed_at DESC
          LIMIT 100
        `,
        sql`
          SELECT curriculum_subject_id, subject_code, subject_name, mencion_id, mencion_name,
                 grade_year, total_graded, failed_count, failure_rate_pct, avg_numeric, pending_students
          FROM analytics_subject_stats
          WHERE ($1::uuid IS NULL OR mencion_id = $1::uuid)
          ORDER BY failure_rate_pct DESC
          LIMIT 50
        `,
        sql`
          SELECT student_user_id, full_name, cedula_last4, mencion_id, mencion_name,
                 grade_year, section_letter, absence_rate_pct, failed_subjects,
                 pending_count, avg_grade, risk_score, risk_level
          FROM analytics_student_risk
          WHERE ($1::uuid IS NULL OR mencion_id = $1::uuid)
          ORDER BY risk_score DESC
          LIMIT 50
        `,
        sql`
          SELECT table_name, last_synced_updated_at, rows_synced, status
          FROM sync_watermarks
          ORDER BY last_synced_updated_at DESC
          LIMIT 15
        `,
      ]);

      return jsonResponse({
        source: "neon_vault",
        scopedMencionId: coordMencionId,
        slaRows,
        subjectRows,
        riskRows,
        watermarks: watermarkRows,
        generatedAt: new Date().toISOString(),
      });
    }

    return jsonResponse({
      source: "neon_vault",
      queryKey,
      scopedMencionId: coordMencionId,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[neon-analytics-query] Error:", err);
    return jsonResponse(
      { error: "No fue posible consultar la bóveda analítica" },
      502
    );
  }
});


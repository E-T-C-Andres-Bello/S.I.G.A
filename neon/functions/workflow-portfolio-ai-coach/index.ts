import { attachDatabasePool } from "@neon/functions";
import pg, { type PoolClient } from "pg";
import { verifyWorkflowInvocationAuth } from "../_shared/webhook-auth";

const { Pool } = pg;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const VALID_TEMPLATES = new Set([
  "clasico-ejecutivo",
  "tecnico-moderno",
  "editorial-minimalista",
  "creativo-bellista",
  "ats-compacto",
  "ingenieria-telematica",
  "comercio-aduanas",
  "hospitalidad-turismo",
  "timeline-academico",
  "dos-columnas-ejecutivo",
  "custom",
]);

function normalizeNeonConnectionString(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    const sslMode = parsed.searchParams.get("sslmode");
    if (
      !sslMode ||
      sslMode === "require" ||
      sslMode === "prefer" ||
      sslMode === "verify-ca"
    ) {
      parsed.searchParams.set("sslmode", "verify-full");
    }
    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

let cachedPool: pg.Pool | null = null;

function getPool(): pg.Pool {
  if (cachedPool) return cachedPool;
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error("DATABASE_URL no está configurada en la Neon Function.");
  }
  const pool = new Pool({
    connectionString: normalizeNeonConnectionString(connectionString),
    max: 5,
    idleTimeoutMillis: 15_000,
    connectionTimeoutMillis: 10_000,
  });
  attachDatabasePool(pool);
  cachedPool = pool;
  return pool;
}

async function withServiceClient<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL ROLE service_role");
    await client.query(
      "SELECT set_config('request.jwt.claim.role', 'service_role', true)"
    );
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore rollback errors
    }
    throw err;
  } finally {
    client.release();
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function scrubPii(raw: string): string {
  return raw
    .replace(/\b[VvEeJj]-?\d{6,9}\b/g, "[CEDULA_PROTEGIDA]")
    .replace(
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
      "[CORREO_PROTEGIDO]"
    )
    .replace(
      /(?:\+?58[\s-]?)?0?(?:412|414|416|424|426|286)[\s-]?\d{3}[\s-]?\d{4}\b/g,
      "[TELEFONO_PROTEGIDO]"
    )
    .replace(/\u0000/g, "")
    .trim();
}

function sanitizeText(raw: unknown, maxLen: number): string {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<\/?[a-z][^>]*>/gi, "")
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .trim()
    .slice(0, maxLen);
}

function sanitizeStringArray(raw: unknown, maxItems: number, maxItemLen: number): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    const clean = sanitizeText(item, maxItemLen);
    if (clean.length > 0 && !out.includes(clean)) {
      out.push(clean);
    }
    if (out.length >= maxItems) break;
  }
  return out;
}

function resolveSafeN8nWebhookUrl(): { ok: true; url: string } | { ok: false } {
  const direct = process.env.N8N_WEBHOOK_URL_PORTFOLIO_AI?.trim();
  const base = process.env.N8N_WEBHOOK_BASE_URL?.trim();
  const raw =
    direct ||
    (base ? `${base.replace(/\/+$/, "")}/webhook/siga-portafolio-ia` : "");

  if (!raw) return { ok: false };

  try {
    const parsed = new URL(raw);
    const isLocalHost =
      parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    if (parsed.protocol === "https:" || (parsed.protocol === "http:" && isLocalHost)) {
      return { ok: true, url: parsed.toString() };
    }
    return { ok: false };
  } catch {
    return { ok: false };
  }
}

async function finishUsage(
  usageLogId: string,
  status: "completed" | "failed" | "timeout",
  latencyMs: number
): Promise<void> {
  try {
    await withServiceClient((client) =>
      client.query(
        `SELECT public.siga_finish_portfolio_ai_usage(
           p_usage_log_id := $1::uuid,
           p_status := $2::text,
           p_latency_ms := $3::integer
         )`,
        [usageLogId, status, Math.max(0, Math.min(120000, Math.round(latencyMs)))]
      )
    );
  } catch {
    // non-fatal audit close
  }
}

function sanitizeImportedCv(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object") return {};
  const src = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};

  const headline = sanitizeText(src.headline, 140);
  if (headline) out.headline = headline;

  const aboutSummary = sanitizeText(src.aboutSummary ?? src.about_summary, 1200);
  if (aboutSummary) out.aboutSummary = aboutSummary;

  const city = sanitizeText(src.city, 80);
  if (city) out.city = city;

  if (Array.isArray(src.skills)) {
    const skills = src.skills
      .slice(0, 20)
      .map((item) => {
        if (typeof item === "string") {
          const name = sanitizeText(item, 64);
          return name ? { name, category: "tecnica", level: "intermedio" } : null;
        }
        if (!item || typeof item !== "object") return null;
        const obj = item as Record<string, unknown>;
        const name = sanitizeText(obj.name, 64);
        if (!name) return null;
        const cat =
          obj.category === "herramienta" || obj.category === "blanda"
            ? obj.category
            : "tecnica";
        const lvl =
          obj.level === "basico" || obj.level === "avanzado"
            ? obj.level
            : "intermedio";
        return { name, category: cat, level: lvl };
      })
      .filter(Boolean);
    if (skills.length > 0) out.skills = skills;
  }

  if (Array.isArray(src.languages)) {
    const allowedLevels = new Set(["A1", "A2", "B1", "B2", "C1", "C2", "Nativo"]);
    const languages = src.languages
      .slice(0, 6)
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const obj = item as Record<string, unknown>;
        const name = sanitizeText(obj.name, 40);
        if (!name) return null;
        const rawLevel = sanitizeText(obj.level, 12);
        return { name, level: allowedLevels.has(rawLevel) ? rawLevel : "B1" };
      })
      .filter(Boolean);
    if (languages.length > 0) out.languages = languages;
  }

  if (Array.isArray(src.projects)) {
    const projects = src.projects
      .slice(0, 8)
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const obj = item as Record<string, unknown>;
        const title = sanitizeText(obj.title, 100);
        if (title.length < 2) return null;
        return {
          title,
          role: sanitizeText(obj.role, 70),
          period: sanitizeText(obj.period, 40),
          summary: sanitizeText(obj.summary, 550),
          tools: sanitizeStringArray(obj.tools, 8, 40),
          impact: sanitizeText(obj.impact, 260),
        };
      })
      .filter(Boolean);
    if (projects.length > 0) out.projects = projects;
  }

  if (Array.isArray(src.experience)) {
    const experience = src.experience
      .slice(0, 8)
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const obj = item as Record<string, unknown>;
        const organization = sanitizeText(obj.organization, 100);
        const role = sanitizeText(obj.role, 80);
        if (organization.length < 2 || role.length < 2) return null;
        return {
          organization,
          role,
          period: sanitizeText(obj.period, 40),
          summary: sanitizeText(obj.summary, 500),
          achievements: sanitizeStringArray(obj.achievements, 5, 200),
        };
      })
      .filter(Boolean);
    if (experience.length > 0) out.experience = experience;
  }

  if (Array.isArray(src.certifications)) {
    const certifications = src.certifications
      .slice(0, 10)
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const obj = item as Record<string, unknown>;
        const name = sanitizeText(obj.name, 110);
        if (name.length < 2) return null;
        return {
          name,
          issuer: sanitizeText(obj.issuer, 90),
          year: sanitizeText(obj.year, 16),
        };
      })
      .filter(Boolean);
    if (certifications.length > 0) out.certifications = certifications;
  }

  if (Array.isArray(src.customSections ?? src.custom_sections)) {
    const rawSections = (src.customSections ?? src.custom_sections) as unknown[];
    const customSections = rawSections
      .slice(0, 4)
      .map((sec) => {
        if (!sec || typeof sec !== "object") return null;
        const obj = sec as Record<string, unknown>;
        const title = sanitizeText(obj.title, 60);
        if (title.length < 2 || !Array.isArray(obj.items)) return null;
        const items = obj.items
          .slice(0, 8)
          .map((it) => {
            if (!it || typeof it !== "object") return null;
            const i = it as Record<string, unknown>;
            const heading = sanitizeText(i.heading, 100);
            if (!heading) return null;
            return {
              heading,
              subtitle: sanitizeText(i.subtitle, 80),
              period: sanitizeText(i.period, 40),
              description: sanitizeText(i.description, 450),
            };
          })
          .filter(Boolean);
        return items.length > 0 ? { title, items } : null;
      })
      .filter(Boolean);
    if (customSections.length > 0) out.customSections = customSections;
  }

  return out;
}

/**
 * Neon Function (`portfoliocoach`):
 * Puente seguro y auditado entre S.I.G.A. y el Workflow 04 de n8n para:
 * - `coach`: Coaching socrático pedagógico por sección del CV.
 * - `import_pdf`: Estructuración de texto extraído de un CV en PDF hacia campos editables.
 */
async function handleRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  if (req.method === "GET") {
    return jsonResponse({
      ok: true,
      service: "siga-portfolio-ai-coach",
      modes: ["coach", "import_pdf"],
    });
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  const auth = verifyWorkflowInvocationAuth(req);
  if (!auth.authorized) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON payload" }, 400);
  }

  const usageLogId =
    typeof body.usage_log_id === "string" ? body.usage_log_id.trim() : "";
  if (!UUID_REGEX.test(usageLogId)) {
    return jsonResponse({ ok: false, error: "Invalid usage_log_id" }, 400);
  }

  const mode = body.mode === "import_pdf" ? "import_pdf" : "coach";

  // Verificar ticket real y vigente en Neon PostgreSQL
  const ticketCheck = await withServiceClient(async (client) => {
    const res = await client.query<{ result: { valid?: boolean; request_mode?: string } }>(
      `SELECT public.siga_service_verify_portfolio_ai_ticket(
         p_usage_log_id := $1::uuid
       ) AS result`,
      [usageLogId]
    );
    return res.rows[0]?.result ?? { valid: false };
  });

  if (!ticketCheck.valid) {
    return jsonResponse({ ok: false, error: "Ticket inválido o expirado" }, 403);
  }

  const n8nTarget = resolveSafeN8nWebhookUrl();
  if (!n8nTarget.ok) {
    await finishUsage(usageLogId, "failed", 0);
    return jsonResponse(
      { ok: false, error: "Webhook n8n del Coach de Portafolio no configurado" },
      503
    );
  }

  const startedAt = Date.now();
  const n8nHeaders: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const n8nSecret = process.env.N8N_WEBHOOK_SECRET?.trim();
  if (n8nSecret) {
    n8nHeaders["x-siga-n8n-secret"] = n8nSecret;
  }

  const n8nPayload =
    mode === "import_pdf"
      ? {
          source: "siga_portfolio_studio",
          mode: "import_pdf",
          mencion_name: sanitizeText(body.mencion_name, 80),
          grade_year: typeof body.grade_year === "number" ? body.grade_year : null,
          extracted_text: scrubPii(sanitizeText(body.extracted_text, 14000)),
        }
      : {
          source: "siga_portfolio_studio",
          mode: "coach",
          section_key: sanitizeText(body.section_key, 32) || "general",
          focus_item_title: sanitizeText(body.focus_item_title, 120),
          mencion_name: sanitizeText(body.mencion_name, 80),
          grade_year: typeof body.grade_year === "number" ? body.grade_year : null,
          current_block_text: scrubPii(sanitizeText(body.current_block_text, 1600)),
          message: scrubPii(sanitizeText(body.message, 1000)),
          history: Array.isArray(body.history)
            ? body.history.slice(-6).map((h) => {
                const item = (h && typeof h === "object" ? h : {}) as Record<string, unknown>;
                return {
                  role: item.role === "assistant" ? "assistant" : "user",
                  content: scrubPii(sanitizeText(item.content, 700)),
                };
              })
            : [],
        };

  let n8nRes: Response;
  try {
    n8nRes = await fetch(n8nTarget.url, {
      method: "POST",
      headers: n8nHeaders,
      body: JSON.stringify(n8nPayload),
      signal: AbortSignal.timeout(45_000),
    });
  } catch {
    await finishUsage(usageLogId, "timeout", Date.now() - startedAt);
    return jsonResponse(
      { ok: false, error: "Tiempo de espera agotado al consultar al Coach IA" },
      504
    );
  }

  const latencyMs = Date.now() - startedAt;
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = (await n8nRes.json()) as Record<string, unknown>;
  } catch {
    parsed = null;
  }

  if (!n8nRes.ok || !parsed || parsed.ok === false) {
    await finishUsage(usageLogId, "failed", latencyMs);
    return jsonResponse(
      { ok: false, error: "El Coach IA no pudo procesar la solicitud en este momento" },
      502
    );
  }

  await finishUsage(usageLogId, "completed", latencyMs);

  if (mode === "import_pdf") {
    const rawTemplate = sanitizeText(
      parsed.suggestedTemplateId ?? parsed.suggested_template_id,
      40
    );
    const suggestedTemplateId = VALID_TEMPLATES.has(rawTemplate)
      ? rawTemplate
      : "tecnico-moderno";
    const extracted = sanitizeImportedCv(parsed.extracted);
    const detectedFieldsCount = Object.keys(extracted).length;

    return jsonResponse({
      ok: true,
      mode: "import_pdf",
      summary:
        sanitizeText(parsed.summary, 400) ||
        "Extrajimos la información principal de tu currículum para que puedas editarla y perfeccionarla.",
      suggestedTemplateId,
      detectedFieldsCount,
      extracted,
    });
  }

  const reply = sanitizeText(parsed.reply, 1200);
  if (!reply) {
    return jsonResponse(
      { ok: false, error: "Respuesta vacía del Coach IA" },
      502
    );
  }

  const suggestedText = sanitizeText(
    parsed.suggestedText ?? parsed.suggested_text,
    1200
  );

  return jsonResponse({
    ok: true,
    mode: "coach",
    reply,
    whyItMatters:
      sanitizeText(parsed.whyItMatters ?? parsed.why_it_matters, 320) || null,
    guidingQuestions: sanitizeStringArray(
      parsed.guidingQuestions ?? parsed.guiding_questions,
      3,
      220
    ),
    suggestedText: suggestedText.length >= 8 ? suggestedText : null,
    suggestedSkills: sanitizeStringArray(
      parsed.suggestedSkills ?? parsed.suggested_skills,
      6,
      64
    ),
  });
}

export default handleRequest;

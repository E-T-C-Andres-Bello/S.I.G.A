import { attachDatabasePool } from "@neon/functions";
import pg, { type PoolClient } from "pg";
import { verifyWorkflowInvocationAuth } from "../_shared/webhook-auth";

const { Pool } = pg;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const VALID_CATEGORIES = new Set([
  "urgente",
  "evento",
  "academico",
  "mencion",
  "cultura_deporte",
]);

const VALID_MODES = new Set(["chat", "draft", "improve", "summarize"]);

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
      // ignore rollback failure
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
    );
}

function sanitizeOutputText(raw: string, maxLen: number): string {
  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<\/?[a-z][^>]*>/gi, "")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_full, label: string, url: string) => {
      const cleanUrl = url.trim();
      if (/^https:\/\/[^\s)]+$/i.test(cleanUrl)) {
        return `[${label.trim()}](${cleanUrl})`;
      }
      return label.trim();
    })
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .trim()
    .slice(0, maxLen);
}

function sanitizeSuggestion(raw: unknown): Record<string, string> | null {
  if (!raw || typeof raw !== "object") return null;
  const src = raw as Record<string, unknown>;
  const out: Record<string, string> = {};

  if (typeof src.title === "string") {
    const t = sanitizeOutputText(src.title, 80).replace(/\s+/g, " ").trim();
    if (t.length >= 4) out.title = t;
  }

  const rawNote = src.shortNote ?? src.short_note;
  if (typeof rawNote === "string") {
    const n = sanitizeOutputText(rawNote, 32).replace(/\s+/g, " ").trim();
    if (n.length >= 2) out.shortNote = n;
  }

  const rawLoc = src.locationLabel ?? src.location_label;
  if (typeof rawLoc === "string") {
    const l = sanitizeOutputText(rawLoc, 120).replace(/\s+/g, " ").trim();
    if (l.length >= 2) out.locationLabel = l;
  }

  if (typeof src.category === "string") {
    const c = src.category.trim().toLowerCase();
    if (VALID_CATEGORIES.has(c)) out.category = c;
  }

  if (typeof src.body === "string") {
    const b = sanitizeOutputText(src.body, 4000);
    if (b.length >= 10) out.body = b;
  }

  return Object.keys(out).length > 0 ? out : null;
}

function resolveSafeN8nWebhookUrl(): { ok: true; url: string } | { ok: false } {
  const direct = process.env.N8N_WEBHOOK_URL_BULLETIN_AI?.trim();
  const base = process.env.N8N_WEBHOOK_BASE_URL?.trim();
  const raw =
    direct || (base ? `${base.replace(/\/+$/, "")}/siga-cartelera-ia` : "");

  if (!raw) return { ok: false };

  try {
    const parsed = new URL(raw);
    const isLocalHost =
      parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    if (parsed.protocol === "https:") {
      return { ok: true, url: parsed.toString() };
    }
    if (parsed.protocol === "http:" && isLocalHost) {
      return { ok: true, url: parsed.toString() };
    }
    return { ok: false };
  } catch {
    return { ok: false };
  }
}

async function finishTicket(
  usageLogId: string,
  status: "completed" | "failed" | "timeout",
  latencyMs: number
): Promise<void> {
  try {
    await withServiceClient((client) =>
      client.query(
        "SELECT public.siga_finish_bulletin_ai_usage($1::uuid, $2::text, $3::integer)",
        [usageLogId, status, Math.max(0, Math.round(latencyMs))]
      )
    );
  } catch (err) {
    console.error("[bulletinai] Error cerrando registro de uso:", err);
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Método no permitido." }, 405);
  }

  // Capa 1 de seguridad: secreto compartido servidor-a-servidor (timingSafeEqual)
  const authResult = verifyWorkflowInvocationAuth(req);
  if (!authResult.authorized) {
    return jsonResponse({ ok: false, error: "Invocación no autorizada." }, 401);
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ ok: false, error: "Payload inválido." }, 400);
  }

  const usageLogId =
    typeof body.usage_log_id === "string" ? body.usage_log_id.trim() : "";
  if (!UUID_REGEX.test(usageLogId)) {
    return jsonResponse(
      { ok: false, error: "Ticket de sesión editorial inválido." },
      400
    );
  }

  // Capa 2 de seguridad: verificar ticket recién emitido por PostgreSQL (pending y < 2 min)
  let ticketInfo: {
    valid?: boolean;
    department_label?: string;
    request_mode?: string;
  } | null = null;
  try {
    ticketInfo = await withServiceClient(async (client) => {
      const res = await client.query<{
        result: {
          valid?: boolean;
          department_label?: string;
          request_mode?: string;
        };
      }>(
        "SELECT public.siga_service_verify_bulletin_ai_ticket($1::uuid) AS result",
        [usageLogId]
      );
      return res.rows[0]?.result ?? null;
    });
  } catch (err) {
    console.error("[bulletinai] Error validando ticket:", err);
    return jsonResponse(
      { ok: false, error: "No se pudo verificar la autorización editorial." },
      500
    );
  }

  if (!ticketInfo?.valid) {
    return jsonResponse(
      { ok: false, error: "Autorización editorial expirada o inválida." },
      403
    );
  }

  const startedAt = Date.now();
  const n8nUrlResult = resolveSafeN8nWebhookUrl();
  if (!n8nUrlResult.ok) {
    await finishTicket(usageLogId, "failed", Date.now() - startedAt);
    return jsonResponse(
      {
        ok: false,
        error: "El flujo de redacción asistida no está configurado todavía.",
      },
      503
    );
  }

  const rawMessage =
    typeof body.message === "string" ? body.message.trim() : "";
  if (rawMessage.length < 2 || rawMessage.length > 1200) {
    await finishTicket(usageLogId, "failed", Date.now() - startedAt);
    return jsonResponse(
      { ok: false, error: "El mensaje debe tener entre 2 y 1200 caracteres." },
      400
    );
  }

  const rawMode =
    typeof body.mode === "string" && VALID_MODES.has(body.mode)
      ? body.mode
      : ticketInfo.request_mode || "chat";

  const rawHistory = Array.isArray(body.history) ? body.history.slice(-6) : [];
  const safeHistory = rawHistory
    .filter(
      (h): h is { role: string; content: string } =>
        Boolean(h) &&
        typeof h === "object" &&
        ((h as { role?: unknown }).role === "user" ||
          (h as { role?: unknown }).role === "assistant") &&
        typeof (h as { content?: unknown }).content === "string"
    )
    .map((h) => ({
      role: h.role,
      content: scrubPii(h.content.trim().slice(0, 1400)),
    }));

  const rawDraft =
    body.draft && typeof body.draft === "object"
      ? (body.draft as Record<string, unknown>)
      : {};

  // Payload mínimo, desidentificado (cero user_id, cédulas, correos ni teléfonos)
  const n8nPayload = {
    source: "siga_bulletin_studio",
    institution: 'E.T.C. "Andrés Bello" (Unare II, Puerto Ordaz)',
    department_label: ticketInfo.department_label || "Dirección",
    mode: rawMode,
    message: scrubPii(rawMessage),
    history: safeHistory,
    draft: {
      title:
        typeof rawDraft.title === "string"
          ? scrubPii(rawDraft.title.slice(0, 80))
          : "",
      shortNote:
        typeof rawDraft.shortNote === "string"
          ? scrubPii(rawDraft.shortNote.slice(0, 32))
          : "",
      category:
        typeof rawDraft.category === "string" &&
        VALID_CATEGORIES.has(rawDraft.category)
          ? rawDraft.category
          : "evento",
      locationLabel:
        typeof rawDraft.locationLabel === "string"
          ? scrubPii(rawDraft.locationLabel.slice(0, 120))
          : "",
      audienceLabel:
        typeof rawDraft.audienceLabel === "string"
          ? scrubPii(rawDraft.audienceLabel.slice(0, 120))
          : "Toda la comunidad bellista",
      body:
        typeof rawDraft.body === "string"
          ? scrubPii(rawDraft.body.slice(0, 4000))
          : "",
    },
    constraints: {
      title_max_chars: 80,
      short_note_max_chars: 32,
      body_max_chars: 4000,
      allowed_markdown: ["##", "###", "**bold**", "*italic*", "__underline__", "==highlight==", "- list", "1. list", "> quote", "---", "[label](https://...)"],
      forbid_html: true,
    },
  };

  const n8nHeaders: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const n8nSecret = process.env.N8N_WEBHOOK_SECRET?.trim();
  if (n8nSecret) {
    n8nHeaders["x-siga-n8n-secret"] = n8nSecret;
  }

  let n8nRes: Response;
  try {
    n8nRes = await fetch(n8nUrlResult.url, {
      method: "POST",
      headers: n8nHeaders,
      body: JSON.stringify(n8nPayload),
      signal: AbortSignal.timeout(22_000),
    });
  } catch (err) {
    const isTimeout =
      err instanceof Error &&
      (err.name === "TimeoutError" || err.name === "AbortError");
    await finishTicket(
      usageLogId,
      isTimeout ? "timeout" : "failed",
      Date.now() - startedAt
    );
    return jsonResponse(
      {
        ok: false,
        error: isTimeout
          ? "El asistente tardó demasiado en responder. Intenta de nuevo en unos segundos."
          : "No fue posible conectar con el servicio de redacción asistida.",
      },
      isTimeout ? 504 : 502
    );
  }

  let parsedN8n: Record<string, unknown> | null = null;
  try {
    parsedN8n = (await n8nRes.json()) as Record<string, unknown>;
  } catch {
    parsedN8n = null;
  }

  if (!n8nRes.ok || parsedN8n?.ok === false) {
    await finishTicket(usageLogId, "failed", Date.now() - startedAt);
    return jsonResponse(
      {
        ok: false,
        error: "El servicio de redacción asistida no devolvió una respuesta válida.",
      },
      502
    );
  }

  const rawReply =
    typeof parsedN8n?.reply === "string"
      ? parsedN8n.reply
      : typeof parsedN8n?.message === "string"
        ? parsedN8n.message
        : "";
  const safeReply = sanitizeOutputText(rawReply, 2000);
  const safeSuggestion = sanitizeSuggestion(parsedN8n?.suggestion);

  if (!safeReply && !safeSuggestion) {
    await finishTicket(usageLogId, "failed", Date.now() - startedAt);
    return jsonResponse(
      {
        ok: false,
        error: "No se recibió una propuesta legible desde el asistente.",
      },
      502
    );
  }

  await finishTicket(usageLogId, "completed", Date.now() - startedAt);

  return jsonResponse({
    ok: true,
    reply:
      safeReply ||
      "Preparé una propuesta de comunicado lista para revisar y aplicar en tu hoja.",
    suggestion: safeSuggestion,
  });
}

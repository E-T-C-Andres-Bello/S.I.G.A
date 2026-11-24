import { redactSigaPii } from "@/lib/analytics/sentry-scrub";

const IS_DEV = process.env.NODE_ENV !== "production";

const SENSITIVE_KEY_PATTERN =
  /pass(word|phrase)?|secret|token|cookie|auth(orization)?|api[_-]?key|private[_-]?key|database[_-]?url|dsn|credential/i;

export function maskEmailForDevLog(rawEmail: string | null | undefined): string {
  if (!rawEmail) return "(none)";
  const trimmed = rawEmail.trim().toLowerCase();
  const atIdx = trimmed.indexOf("@");
  if (atIdx <= 0) return "***";
  const local = trimmed.slice(0, atIdx);
  const domain = trimmed.slice(atIdx + 1);
  return `${local.slice(0, 1)}***@${domain}`;
}

export function maskCedulaForDevLog(rawCedula: string | null | undefined): string {
  if (!rawCedula) return "(none)";
  const cleaned = rawCedula.trim().toUpperCase().replace(/[^VEJ0-9]/g, "");
  if (cleaned.length <= 4) return "***";
  return `${cleaned.charAt(0)}***${cleaned.slice(-4)}`;
}

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") {
    return redactSigaPii(value).slice(0, 300);
  }
  if (depth >= 3) return "[truncated]";
  if (Array.isArray(value)) {
    return value.slice(0, 15).map((item) => sanitizeValue(item, depth + 1));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERN.test(k)) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = sanitizeValue(v, depth + 1);
      }
    }
    return out;
  }
  return String(value);
}

export function sanitizeDevMeta(
  meta?: Record<string, unknown>
): Record<string, unknown> | undefined {
  if (!meta) return undefined;
  return sanitizeValue(meta, 0) as Record<string, unknown>;
}

export function extractSafeErrorSummary(error: unknown): Record<string, unknown> {
  if (!error) return { message: "unknown_error" };
  if (error instanceof Error) {
    const extended = error as Error & {
      code?: string;
      status?: number;
      statusCode?: number;
      table?: string;
      column?: string;
      constraint?: string;
      routine?: string;
      body?: { code?: string; message?: string };
    };
    const summary: Record<string, unknown> = {
      name: extended.name,
      message: redactSigaPii(extended.message).slice(0, 300),
    };
    if (extended.code) summary.code = extended.code;
    if (extended.status) summary.status = extended.status;
    if (extended.statusCode) summary.statusCode = extended.statusCode;
    if (extended.table) summary.table = extended.table;
    if (extended.column) summary.column = extended.column;
    if (extended.constraint) summary.constraint = extended.constraint;
    if (extended.routine) summary.routine = extended.routine;
    if (extended.body?.code) summary.bodyCode = extended.body.code;
    if (extended.body?.message) {
      summary.bodyMessage = redactSigaPii(extended.body.message).slice(0, 300);
    }
    return summary;
  }
  if (typeof error === "object") {
    return sanitizeValue(error, 0) as Record<string, unknown>;
  }
  return { message: redactSigaPii(String(error)).slice(0, 300) };
}

/**
 * Logger informativo exclusivo para `npm run dev` (no imprime nada en producción).
 */
export function devLog(
  scope: string,
  message: string,
  meta?: Record<string, unknown>
): void {
  if (!IS_DEV) return;
  const safeMeta = sanitizeDevMeta(meta);
  if (safeMeta) {
    console.info(`[SIGA:DEV][${scope}] ${message}`, safeMeta);
  } else {
    console.info(`[SIGA:DEV][${scope}] ${message}`);
  }
}

/**
 * Logger de advertencia exclusivo para `npm run dev` (no imprime nada en producción).
 */
export function devWarn(
  scope: string,
  message: string,
  meta?: Record<string, unknown>
): void {
  if (!IS_DEV) return;
  const safeMeta = sanitizeDevMeta(meta);
  if (safeMeta) {
    console.warn(`[SIGA:DEV][${scope}] ${message}`, safeMeta);
  } else {
    console.warn(`[SIGA:DEV][${scope}] ${message}`);
  }
}

/**
 * Logger de error exclusivo para `npm run dev` (nunca expone secretos ni PII).
 */
export function devError(
  scope: string,
  message: string,
  error?: unknown,
  meta?: Record<string, unknown>
): void {
  if (!IS_DEV) return;
  const safeMeta = sanitizeDevMeta(meta) ?? {};
  console.error(`[SIGA:DEV][${scope}] ${message}`, {
    ...safeMeta,
    ...(error !== undefined ? { error: extractSafeErrorSummary(error) } : {}),
  });
}

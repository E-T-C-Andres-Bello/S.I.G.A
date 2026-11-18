import * as Sentry from "@sentry/nextjs";
import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";

const CEDULA_REGEX = /\b([VEJ])-?(\d{2,5})(\d{4})\b/gi;
const EMAIL_REGEX = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const PHONE_REGEX = /\b(?:\+?58|0)(?:4\d{2}|2\d{2})[-.\s]?\d{3}[-.\s]?\d{4}\b/g;
const JWT_REGEX = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;

const SENSITIVE_HEADER_KEYS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "x-supabase-auth",
  "apikey",
  "x-api-key",
]);

const SENSITIVE_ROUTE_PREFIXES = [
  "/api/auth",
  "/api/ai",
  "/control-estudios/orientacion",
  "/orientacion",
];

/**
 * Redacta cédulas venezolanas, correos, teléfonos y tokens JWT de cadenas de telemetría
 * para cumplir con la política de privacidad K12 de S.I.G.A.
 */
export function redactSigaPii(value: string): string {
  return value
    .replace(JWT_REGEX, "[REDACTED_JWT]")
    .replace(EMAIL_REGEX, "[REDACTED_EMAIL]")
    .replace(PHONE_REGEX, "[REDACTED_PHONE]")
    .replace(CEDULA_REGEX, (_, prefix: string, _head: string, last4: string) => {
      return `${prefix.toUpperCase()}-***${last4}`;
    });
}

function scrubUnknownRecord(input: unknown): unknown {
  if (typeof input === "string") {
    return redactSigaPii(input);
  }
  if (Array.isArray(input)) {
    return input.map(scrubUnknownRecord);
  }
  if (input && typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(input as Record<string, unknown>)) {
      const lower = key.toLowerCase();
      if (
        lower.includes("password") ||
        lower.includes("token") ||
        lower.includes("secret") ||
        lower.includes("cookie") ||
        lower.includes("orientacion") ||
        lower === "cedula" ||
        lower === "email" ||
        lower === "phone" ||
        lower === "telefono"
      ) {
        out[key] = typeof val === "string" && lower === "cedula" ? redactSigaPii(val) : "[REDACTED]";
      } else {
        out[key] = scrubUnknownRecord(val);
      }
    }
    return out;
  }
  return input;
}

export function getSentryEnvironment(): string {
  return (
    process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT?.trim() ||
    process.env.SENTRY_ENVIRONMENT?.trim() ||
    process.env.VERCEL_ENV?.trim() ||
    process.env.NODE_ENV ||
    "development"
  );
}

export function getSentryTracesSampleRate(): number {
  return process.env.NODE_ENV === "production" ? 0.15 : 1.0;
}

/**
 * Política estricta de recolección de datos para K12 en Sentry v11:
 * desactiva captura automática de info de usuario, cookies, cabeceras,
 * cuerpos HTTP, parámetros de BD y entradas/salidas de IA generativa.
 */
export const SIGA_DATA_COLLECTION = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [] as [],
  urlQueryParams: false,
  genAI: { inputs: false, outputs: false },
  databaseQueryData: false,
  stackFrameVariables: false,
};

/**
 * Filtro `beforeSend` compartido para navegador, servidor Node.js y Edge Runtime.
 * Garantiza que nunca salga PII real de estudiantes ni cuerpos de rutas confidenciales.
 */
export function scrubSentryEvent<T extends ErrorEvent>(event: T): T {
  if (event.message) {
    event.message = redactSigaPii(event.message);
  }

  if (event.exception?.values) {
    for (const ex of event.exception.values) {
      if (ex.value) {
        ex.value = redactSigaPii(ex.value);
      }
    }
  }

  if (event.user) {
    event.user = event.user.id ? { id: String(event.user.id) } : undefined;
  }

  if (event.request) {
    const reqUrl = event.request.url ?? "";
    const isSensitiveRoute = SENSITIVE_ROUTE_PREFIXES.some((prefix) =>
      reqUrl.includes(prefix)
    );

    if (event.request.headers) {
      const cleanHeaders: Record<string, string> = {};
      for (const [k, v] of Object.entries(event.request.headers)) {
        cleanHeaders[k] = SENSITIVE_HEADER_KEYS.has(k.toLowerCase())
          ? "[REDACTED]"
          : redactSigaPii(v);
      }
      event.request.headers = cleanHeaders;
    }

    delete event.request.cookies;
    if (isSensitiveRoute) {
      event.request.data = "[REDACTED_SENSITIVE_ROUTE]";
    } else if (event.request.data !== undefined) {
      event.request.data = scrubUnknownRecord(event.request.data);
    }

    if (typeof event.request.query_string === "string") {
      event.request.query_string = redactSigaPii(event.request.query_string);
    }
  }

  if (event.extra) {
    event.extra = scrubUnknownRecord(event.extra) as Record<string, unknown>;
  }

  return event;
}

/**
 * Filtro `beforeBreadcrumb` para limpiar URLs, mensajes y cuerpos de fetch/XHR.
 */
export function scrubSentryBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  if (breadcrumb.message) {
    breadcrumb.message = redactSigaPii(breadcrumb.message);
  }

  if (breadcrumb.data) {
    const cleaned = scrubUnknownRecord(breadcrumb.data) as Record<string, unknown>;
    if (typeof cleaned.url === "string") {
      cleaned.url = redactSigaPii(cleaned.url);
    }
    breadcrumb.data = cleaned;
  }

  return breadcrumb;
}

/**
 * Helper centralizado para reportar errores controlados desde módulos de S.I.G.A.
 * sin exponer datos sensibles de estudiantes al cliente.
 */
export function captureSigaError(
  error: unknown,
  context?: {
    area: string;
    extra?: Record<string, string | number | boolean>;
  }
): string {
  return Sentry.withScope((scope) => {
    if (context?.area) {
      scope.setTag("siga.area", context.area);
    }
    if (context?.extra) {
      scope.setExtras(scrubUnknownRecord(context.extra) as Record<string, unknown>);
    }
    return Sentry.captureException(error);
  });
}

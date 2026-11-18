export interface N8nDispatchResult {
  ok: boolean;
  statusCode: number;
  studentSent: boolean;
  studentMessageId: string | null;
  staffSent: boolean;
  staffMessageIds: string[];
  rawResponse?: unknown;
  error?: string;
}

/**
 * Invoca el Webhook de n8n encargado del envío vía Mailtrap, autenticando la
 * llamada con el header secreto `x-siga-n8n-secret` y un timeout estricto.
 */
export async function dispatchWorkflowToN8n(
  payload: Record<string, unknown>
): Promise<N8nDispatchResult> {
  const directUrl = Deno.env.get("N8N_WEBHOOK_URL_STUDENT_REQUEST")?.trim();
  const baseUrl = Deno.env.get("N8N_WEBHOOK_BASE_URL")?.trim();
  const targetUrl =
    directUrl ||
    (baseUrl ? `${baseUrl.replace(/\/+$/, "")}/siga-tramite-mailtrap` : "");

  if (!targetUrl) {
    return {
      ok: false,
      statusCode: 503,
      studentSent: false,
      studentMessageId: null,
      staffSent: false,
      staffMessageIds: [],
      error:
        "N8N_WEBHOOK_URL_STUDENT_REQUEST no está configurado en Supabase Secrets.",
    };
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(targetUrl);
  } catch {
    return {
      ok: false,
      statusCode: 500,
      studentSent: false,
      studentMessageId: null,
      staffSent: false,
      staffMessageIds: [],
      error: "La URL del webhook de n8n configurada no es válida.",
    };
  }

  if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
    return {
      ok: false,
      statusCode: 500,
      studentSent: false,
      studentMessageId: null,
      staffSent: false,
      staffMessageIds: [],
      error: "Protocolo de webhook n8n no permitido.",
    };
  }

  const n8nSecret = Deno.env.get("N8N_WEBHOOK_SECRET")?.trim();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (n8nSecret) {
    headers["x-siga-n8n-secret"] = n8nSecret;
  }

  let response: Response;
  try {
    response = await fetch(parsedUrl.toString(), {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    return {
      ok: false,
      statusCode: 504,
      studentSent: false,
      studentMessageId: null,
      staffSent: false,
      staffMessageIds: [],
      error:
        err instanceof Error
          ? `Fallo de red al contactar n8n: ${err.message}`
          : "Fallo de red al contactar n8n.",
    };
  }

  let parsedBody: Record<string, unknown> | null = null;
  try {
    parsedBody = (await response.json()) as Record<string, unknown>;
  } catch {
    parsedBody = null;
  }

  if (!response.ok || parsedBody?.ok === false) {
    const errorMsg =
      typeof parsedBody?.error === "string"
        ? parsedBody.error
        : `n8n respondió HTTP ${response.status}`;
    return {
      ok: false,
      statusCode: response.status,
      studentSent: false,
      studentMessageId: null,
      staffSent: false,
      staffMessageIds: [],
      rawResponse: parsedBody,
      error: errorMsg,
    };
  }

  const studentSent =
    typeof parsedBody?.student_sent === "boolean"
      ? parsedBody.student_sent
      : true;
  const staffSent =
    typeof parsedBody?.staff_sent === "boolean"
      ? parsedBody.staff_sent
      : true;

  const studentMessageId =
    typeof parsedBody?.student_message_id === "string"
      ? parsedBody.student_message_id
      : null;

  const staffMessageIds = Array.isArray(parsedBody?.staff_message_ids)
    ? parsedBody.staff_message_ids.filter(
        (id): id is string => typeof id === "string"
      )
    : [];

  return {
    ok: true,
    statusCode: response.status,
    studentSent,
    studentMessageId,
    staffSent,
    staffMessageIds,
    rawResponse: parsedBody,
  };
}

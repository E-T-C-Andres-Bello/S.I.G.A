import { NextResponse } from "next/server";
import { getServerAuthSession, isAuthConfigured } from "@/lib/auth/server";
import { callNeonRpcScalar, withUserDb } from "@/lib/db/neon";
import { devWarn } from "@/lib/dev-logger";
import {
  bulletinAiChatRequestSchema,
  bulletinAiResponseSchema,
  sanitizeAiMarkdownText,
  sanitizeBulletinAiSuggestion,
  scrubPotentialPiiForLlm,
} from "@/lib/validators/bulletin-ai";

export const runtime = "nodejs";

const MAX_REQUEST_BYTES = 24 * 1024;

function resolveBulletinAiFunctionUrl(): string | null {
  const override = process.env.NEON_FUNCTION_BULLETINAI_URL?.trim();
  if (override) {
    try {
      const parsed = new URL(override);
      const isLocal =
        parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
      if (parsed.protocol === "https:" || (parsed.protocol === "http:" && isLocal)) {
        return parsed.toString();
      }
      return null;
    } catch {
      return null;
    }
  }

  const hostSuffix = process.env.NEON_FUNCTION_HOST_SUFFIX?.trim();
  if (!hostSuffix) return null;
  return `https://bulletinai.${hostSuffix.replace(/^\.+/, "")}`;
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!isAuthConfigured()) {
    return NextResponse.json(
      { ok: false, message: "El servicio no está disponible temporalmente." },
      { status: 503 }
    );
  }

  const session = await getServerAuthSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, message: "Tu sesión institucional expiró." },
      { status: 401 }
    );
  }

  // Defensa contra payloads sobredimensionados (LLM10)
  const contentLengthHeader = request.headers.get("content-length");
  if (contentLengthHeader && Number(contentLengthHeader) > MAX_REQUEST_BYTES) {
    return NextResponse.json(
      { ok: false, message: "El mensaje enviado excede el tamaño permitido." },
      { status: 413 }
    );
  }

  let rawText: string;
  try {
    rawText = await request.text();
  } catch {
    return NextResponse.json(
      { ok: false, message: "No se pudo leer la solicitud." },
      { status: 400 }
    );
  }

  if (Buffer.byteLength(rawText, "utf8") > MAX_REQUEST_BYTES) {
    return NextResponse.json(
      { ok: false, message: "El mensaje enviado excede el tamaño permitido." },
      { status: 413 }
    );
  }

  let rawJson: unknown;
  try {
    rawJson = JSON.parse(rawText);
  } catch {
    return NextResponse.json(
      { ok: false, message: "Formato de solicitud inválido." },
      { status: 400 }
    );
  }

  const parsed = bulletinAiChatRequestSchema.safeParse(rawJson);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        message:
          parsed.error.issues[0]?.message ??
          "Revisa tu consulta antes de enviarla al asistente.",
      },
      { status: 400 }
    );
  }

  const functionUrl = resolveBulletinAiFunctionUrl();
  if (!functionUrl) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "El asistente de redacción todavía no está activado en este entorno. Puedes seguir redactando con las plantillas rápidas.",
      },
      { status: 503 }
    );
  }

  // Verificar rol editorial real y consumir cuota horaria atómica en Neon (25/hora)
  interface QuotaResult {
    allowed?: boolean;
    usage_log_id?: string;
    department_label?: string;
    remaining?: number;
    limit_per_hour?: number;
    retry_after_seconds?: number;
  }

  let quota: QuotaResult | null = null;
  try {
    quota = await withUserDb(
      { authUserId: session.authUserId, email: session.email },
      (client) =>
        callNeonRpcScalar<QuotaResult>(
          client,
          "siga_consume_bulletin_ai_quota",
          { p_request_mode: parsed.data.mode }
        )
    );
  } catch (err) {
    const pgCode =
      err && typeof err === "object" && "code" in err
        ? String((err as { code?: unknown }).code)
        : "";
    if (pgCode === "42501") {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Solo el personal editorial autorizado puede utilizar el asistente de redacción.",
        },
        { status: 403 }
      );
    }
    return NextResponse.json(
      {
        ok: false,
        message:
          "No se pudo verificar el servicio de redacción en este momento.",
      },
      { status: 503 }
    );
  }

  if (!quota?.allowed || !quota.usage_log_id) {
    const retryMinutes = Math.max(
      1,
      Math.ceil(Number(quota?.retry_after_seconds ?? 300) / 60)
    );
    return NextResponse.json(
      {
        ok: false,
        message: `Alcanzaste el límite de consultas por hora del asistente. Podrás volver a usarlo en aproximadamente ${retryMinutes} min.`,
        remaining: 0,
      },
      { status: 429 }
    );
  }

  const usageLogId = quota.usage_log_id;
  const remaining = Math.max(0, Number(quota.remaining ?? 0));
  const limitPerHour = Number(quota.limit_per_hour ?? 25);
  const startedAt = Date.now();

  const closeTicketOnError = async (status: "failed" | "timeout") => {
    try {
      await withUserDb(
        { authUserId: session.authUserId, email: session.email },
        (client) =>
          callNeonRpcScalar(client, "siga_finish_bulletin_ai_usage", {
            p_usage_log_id: usageLogId,
            p_status: status,
            p_latency_ms: Math.max(0, Date.now() - startedAt),
          })
      );
    } catch {
      // No interrumpir respuesta de error limpia
    }
  };

  // Desidentificar cualquier PII accidental antes de salir hacia Neon Function -> n8n
  const outboundPayload = {
    usage_log_id: usageLogId,
    mode: parsed.data.mode,
    message: scrubPotentialPiiForLlm(parsed.data.message),
    history: parsed.data.history.map((item) => ({
      role: item.role,
      content: scrubPotentialPiiForLlm(item.content),
    })),
    draft: {
      title: scrubPotentialPiiForLlm(parsed.data.draft.title),
      shortNote: scrubPotentialPiiForLlm(parsed.data.draft.shortNote),
      category: parsed.data.draft.category,
      locationLabel: scrubPotentialPiiForLlm(parsed.data.draft.locationLabel),
      audienceLabel: scrubPotentialPiiForLlm(parsed.data.draft.audienceLabel),
      body: scrubPotentialPiiForLlm(parsed.data.draft.body),
    },
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const workflowSecret = process.env.WORKFLOW_WEBHOOK_SECRET?.trim();
  if (workflowSecret) {
    headers["x-siga-workflow-secret"] = workflowSecret;
  }

  let fnResponse: Response;
  try {
    fnResponse = await fetch(functionUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(outboundPayload),
      signal: AbortSignal.timeout(25_000),
    });
  } catch (err) {
    const isTimeout =
      err instanceof Error &&
      (err.name === "TimeoutError" || err.name === "AbortError");
    await closeTicketOnError(isTimeout ? "timeout" : "failed");
    devWarn("bulletin:ai", "Fallo al invocar puente editorial IA", {
      isTimeout,
    });
    return NextResponse.json(
      {
        ok: false,
        message: isTimeout
          ? "El asistente tardó demasiado en responder. Inténtalo nuevamente en un momento."
          : "El asistente de redacción no está disponible en este momento.",
        remaining,
      },
      { status: isTimeout ? 504 : 502 }
    );
  }

  let fnJson: Record<string, unknown> | null = null;
  try {
    fnJson = (await fnResponse.json()) as Record<string, unknown>;
  } catch {
    fnJson = null;
  }

  if (!fnResponse.ok || fnJson?.ok === false) {
    await closeTicketOnError("failed");
    return NextResponse.json(
      {
        ok: false,
        message:
          typeof fnJson?.error === "string" && fnJson.error.length <= 160
            ? sanitizeAiMarkdownText(fnJson.error, 160)
            : "El asistente no pudo generar una propuesta en este momento.",
        remaining,
      },
      { status: fnResponse.status >= 400 && fnResponse.status < 600 ? fnResponse.status : 502 }
    );
  }

  // Defensa en profundidad: re-sanitizar y validar con Zod la respuesta antes de devolverla al navegador
  const safeReply = sanitizeAiMarkdownText(
    typeof fnJson?.reply === "string" ? fnJson.reply : "",
    2000
  );
  const safeSuggestion = sanitizeBulletinAiSuggestion(fnJson?.suggestion);

  const validated = bulletinAiResponseSchema.safeParse({
    reply:
      safeReply ||
      "Listo, preparé una propuesta que puedes revisar y aplicar a tu hoja.",
    suggestion: safeSuggestion,
  });

  if (!validated.success) {
    await closeTicketOnError("failed");
    return NextResponse.json(
      {
        ok: false,
        message:
          "La respuesta recibida no cumplió los filtros de seguridad editorial.",
        remaining,
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    reply: validated.data.reply,
    suggestion: validated.data.suggestion ?? null,
    remaining,
    limitPerHour,
  });
}

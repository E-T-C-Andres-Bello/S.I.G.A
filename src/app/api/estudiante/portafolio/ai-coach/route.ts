import { NextResponse } from "next/server";
import { getServerAuthSession, isAuthConfigured } from "@/lib/auth/server";
import { callNeonRpcScalar, withUserDb } from "@/lib/db/neon";
import { devWarn } from "@/lib/dev-logger";
import {
  portfolioAiCoachRequestSchema,
  scrubPortfolioTextForLlm,
} from "@/lib/validators/portfolio";

export const runtime = "nodejs";

const MAX_REQUEST_BYTES = 40 * 1024;

function resolvePortfolioCoachFunctionUrl(): string | null {
  const override = process.env.NEON_FUNCTION_PORTFOLIOCOACH_URL?.trim();
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

  const branchId = process.env.NEON_BRANCH_ID?.trim();
  const hostSuffix = process.env.NEON_FUNCTION_HOST_SUFFIX?.trim();
  if (branchId && hostSuffix) {
    return `https://${branchId}-portfoliocoach.${hostSuffix.replace(/^\.+/, "")}`;
  }
  if (hostSuffix) {
    return `https://portfoliocoach.${hostSuffix.replace(/^\.+/, "")}`;
  }
  return null;
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!isAuthConfigured()) {
    return NextResponse.json(
      { ok: false, message: "El servicio del Coach no está disponible temporalmente." },
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

  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_REQUEST_BYTES) {
    return NextResponse.json(
      { ok: false, message: "El contenido enviado excede el tamaño máximo permitido." },
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
      { ok: false, message: "El contenido enviado excede el tamaño máximo permitido." },
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

  const parsed = portfolioAiCoachRequestSchema.safeParse(rawJson);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        message:
          parsed.error.issues[0]?.message ??
          "Revisa los datos enviados al Coach de Portafolio.",
      },
      { status: 400 }
    );
  }

  const fnUrl = resolvePortfolioCoachFunctionUrl();
  if (!fnUrl) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "El Coach inteligente aún no está conectado en este entorno. Puedes seguir usando la evaluación de nivel en vivo.",
      },
      { status: 503 }
    );
  }

  // Reclamar cuota horaria en Neon PostgreSQL (20 solicitudes/hora por estudiante)
  let quota: {
    allowed?: boolean;
    usage_log_id?: string;
    remaining?: number;
    retry_after_seconds?: number;
  } | null = null;

  try {
    quota = await withUserDb(
      { authUserId: session.authUserId, email: session.email },
      (client) =>
        callNeonRpcScalar<typeof quota>(
          client,
          "siga_consume_portfolio_ai_quota",
          { p_request_mode: parsed.data.mode }
        )
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("cuenta institucional") || msg.includes("Solo estudiantes")) {
      return NextResponse.json({ ok: false, message: msg }, { status: 403 });
    }
    devWarn("portfolio-ai", "Error verificando cuota", {
      detail: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { ok: false, message: "No se pudo verificar tu acceso al Coach en este momento." },
      { status: 500 }
    );
  }

  if (!quota || !quota.allowed || !quota.usage_log_id) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Alcanzaste el límite de consultas por hora al Coach IA. Espera unos minutos mientras sigues puliendo tu hoja de vida.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(quota?.retry_after_seconds ?? 300),
        },
      }
    );
  }

  const workflowSecret = process.env.WORKFLOW_WEBHOOK_SECRET?.trim();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (workflowSecret) {
    headers["x-siga-workflow-secret"] = workflowSecret;
  }

  const payload =
    parsed.data.mode === "import_pdf"
      ? {
          usage_log_id: quota.usage_log_id,
          mode: "import_pdf",
          mencion_name: parsed.data.mencionName,
          grade_year: parsed.data.gradeYear,
          extracted_text: scrubPortfolioTextForLlm(parsed.data.extractedText),
        }
      : {
          usage_log_id: quota.usage_log_id,
          mode: "coach",
          section_key: parsed.data.sectionKey,
          focus_item_title: parsed.data.focusItemTitle,
          mencion_name: parsed.data.mencionName,
          grade_year: parsed.data.gradeYear,
          current_block_text: scrubPortfolioTextForLlm(
            parsed.data.currentBlockText
          ),
          message: scrubPortfolioTextForLlm(parsed.data.message),
          history: parsed.data.history.map((h) => ({
            role: h.role,
            content: scrubPortfolioTextForLlm(h.content),
          })),
        };

  let fnRes: Response;
  try {
    fnRes = await fetch(fnUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(48_000),
    });
  } catch (err) {
    devWarn("portfolio-ai", "Timeout o error de red hacia Neon Function", {
      detail: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      {
        ok: false,
        message:
          "El Coach IA tardó demasiado en responder. Intenta nuevamente en unos segundos.",
      },
      { status: 504 }
    );
  }

  let data: Record<string, unknown> | null = null;
  try {
    data = (await fnRes.json()) as Record<string, unknown>;
  } catch {
    data = null;
  }

  if (!fnRes.ok || !data || data.ok === false) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "No fue posible obtener una recomendación del Coach IA en este momento. Intenta de nuevo.",
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ...data,
    remainingQuota: quota.remaining ?? 0,
  });
}

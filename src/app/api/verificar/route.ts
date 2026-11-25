import { NextResponse, type NextRequest } from "next/server";
import {
  callNeonRpcScalar,
  isNeonDatabaseConfigured,
  withAnonDb,
} from "@/lib/db/neon";
import {
  enforceRateLimit,
  resolveRequestClientIp,
} from "@/lib/security/rate-limit";
import { verificationCodeSchema } from "@/lib/validators/student-portal";

export const runtime = "nodejs";

/**
 * Endpoint público acotado con rate limiting para verificar autenticidad de constancias,
 * boletines y certificaciones emitidas por S.I.G.A. sin exponer PII sensible.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const clientIp = resolveRequestClientIp(request);
  const rate = await enforceRateLimit({
    namespace: "public_verify_qr",
    clientKey: clientIp,
    limit: 25,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      {
        ok: false,
        status: "rate_limited",
        message: "Demasiadas consultas seguidas. Espera unos segundos e intenta de nuevo.",
      },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSec) },
      }
    );
  }

  const rawCode = request.nextUrl.searchParams.get("code") ?? "";
  const parsed = verificationCodeSchema.safeParse(rawCode);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        status: "invalid_format",
        message: parsed.error.issues[0]?.message ?? "Formato de código inválido.",
      },
      { status: 400 }
    );
  }

  if (!isNeonDatabaseConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        status: "service_unavailable",
        message: "El servicio de verificación no está disponible temporalmente.",
      },
      { status: 503 }
    );
  }

  try {
    const rpcName = parsed.data.startsWith("SIGA-CV-")
      ? "siga_public_verificar_portafolio"
      : "siga_public_verificar_documento";
    const data = await withAnonDb((client) =>
      callNeonRpcScalar<Record<string, unknown>>(client, rpcName, {
        p_verification_code: parsed.data,
      })
    );

    if (!data || typeof data !== "object") {
      return NextResponse.json(
        {
          ok: false,
          status: "lookup_error",
          message: "No se pudo consultar el registro oficial en este momento.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, result: data });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        status: "lookup_error",
        message: "No se pudo consultar el registro oficial en este momento.",
      },
      { status: 502 }
    );
  }
}

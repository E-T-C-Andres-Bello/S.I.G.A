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

export const runtime = "nodejs";

/**
 * Valida un Magic Link de tutor empresarial externo para evaluación de pasantías (6.º año)
 * sin requerir cuenta `@etcandresbello.org`, aplicando rate-limiting y hash SHA-256 en BD.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const clientIp = resolveRequestClientIp(request);
  const rate = await enforceRateLimit({
    namespace: "tutor_magic_link",
    clientKey: clientIp,
    limit: 12,
    windowMs: 60_000,
  });

  if (!rate.allowed) {
    return NextResponse.json(
      {
        ok: false,
        status: "rate_limited",
        message:
          "Demasiadas verificaciones consecutivas. Espera unos segundos e intenta de nuevo.",
      },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSec) },
      }
    );
  }

  const rawToken = request.nextUrl.searchParams.get("token")?.trim() ?? "";
  if (rawToken.length < 24 || rawToken.length > 256) {
    return NextResponse.json(
      {
        ok: false,
        status: "invalid_token",
        message: "El enlace de evaluación empresarial no tiene un formato válido.",
      },
      { status: 400 }
    );
  }

  if (!isNeonDatabaseConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        status: "service_unavailable",
        message: "El servicio de pasantías no está disponible temporalmente.",
      },
      { status: 503 }
    );
  }

  try {
    const data = await withAnonDb((client) =>
      callNeonRpcScalar<Record<string, unknown>>(
        client,
        "siga_public_validar_magic_link_pasantia",
        { p_raw_token: rawToken }
      )
    );

    if (!data || typeof data !== "object") {
      return NextResponse.json(
        {
          ok: false,
          status: "lookup_error",
          message: "No se pudo verificar el enlace de evaluación en este momento.",
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
        message: "No se pudo verificar el enlace de evaluación en este momento.",
      },
      { status: 502 }
    );
  }
}

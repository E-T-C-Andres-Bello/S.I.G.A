import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { captureSigaError } from "@/lib/analytics/sentry-scrub";

function isTestEndpointEnabled(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.ALLOW_SENTRY_TEST === "true";
}

/**
 * Endpoint de verificación de Sentry (deshabilitado en producción salvo ALLOW_SENTRY_TEST=true).
 * Permite validar captura de errores de servidor, trazas y redacción de PII.
 */
export async function GET(request: Request) {
  if (!isTestEndpointEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") ?? "status";
  const marker = searchParams.get("marker") ?? new Date().toISOString();

  if (mode === "error") {
    const simulatedError = new Error(
      `Sentry SIGA server verification [${marker}] (synthetic PII check: V-12345678 / prueba@example.invalid)`
    );
    const eventId = captureSigaError(simulatedError, {
      area: "sentry-verification",
      extra: {
        marker,
        cedula: "V12345678",
        email: "prueba@example.invalid",
      },
    });
    await Sentry.flush(5000);

    return NextResponse.json(
      {
        ok: true,
        captured: true,
        eventId,
        marker,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    sentryEnabled: Boolean(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN),
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
  });
}

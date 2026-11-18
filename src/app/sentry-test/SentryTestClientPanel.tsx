"use client";

import * as Sentry from "@sentry/nextjs";
import { useState } from "react";
import { captureSigaError } from "@/lib/analytics/sentry-scrub";

export function SentryTestClientPanel() {
  const [status, setStatus] = useState<string>("Listo para probar Sentry (cliente y servidor).");
  const [busy, setBusy] = useState(false);

  const triggerClientEvent = async () => {
    setBusy(true);
    try {
      const marker = new Date().toISOString();
      const eventId = captureSigaError(
        new Error(
          `Sentry SIGA client verification [${marker}] (synthetic PII check: V-87654321 / estudiante@example.invalid)`
        ),
        {
          area: "sentry-client-verification",
          extra: { marker, cedula: "V87654321" },
        }
      );
      await Sentry.flush(3000);
      setStatus(`Error de cliente enviado vía túnel de Sentry. eventId=${eventId}`);
    } finally {
      setBusy(false);
    }
  };

  const triggerServerEvent = async () => {
    setBusy(true);
    try {
      const marker = encodeURIComponent(new Date().toISOString());
      const res = await fetch(`/api/sentry-test?mode=error&marker=${marker}`);
      const payload = (await res.json()) as { eventId?: string; marker?: string };
      setStatus(
        `Error de servidor enviado (HTTP ${res.status}). eventId=${payload.eventId ?? "n/a"}`
      );
    } catch (err) {
      setStatus(
        err instanceof Error ? `Fallo al invocar endpoint: ${err.message}` : "Error inesperado"
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-6 py-12">
      <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          S.I.G.A. · Verificación de Telemetría
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Prueba de integración con Sentry
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Esta página solo está activa en desarrollo (o con <code>ALLOW_SENTRY_TEST=true</code>) y
          envía eventos sintéticos con validación de redacción de PII K12.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={triggerClientEvent}
            className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            Probar error en navegador
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={triggerServerEvent}
            className="rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium transition hover:bg-muted disabled:opacity-50"
          >
            Probar error en servidor (/api/sentry-test)
          </button>
        </div>

        <p className="mt-6 rounded-lg bg-muted px-4 py-3 text-xs font-mono text-foreground">
          {status}
        </p>
      </div>
    </main>
  );
}

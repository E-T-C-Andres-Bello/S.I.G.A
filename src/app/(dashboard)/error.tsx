"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { SigaErrorScreen } from "@/components/ui/siga-error-screen";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.error("[SIGA:DEV][dashboard:error]", {
        name: error.name,
        message: error.message,
        digest: error.digest ?? null,
      });
    }
    Sentry.captureException(error);
  }, [error]);

  return (
    <SigaErrorScreen
      statusCode="Módulo académico"
      title="No se pudo cargar este módulo del panel"
      description="Verifica tu conexión o pulsa Reintentar para sincronizar nuevamente tu sesión institucional en S.I.G.A."
      digest={error.digest}
      onRetry={reset}
      homeHref="/"
      homeLabel="Ir a la portada"
    />
  );
}

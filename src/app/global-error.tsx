"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { SigaErrorScreen } from "@/components/ui/siga-error-screen";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="es">
      <body className="m-0 p-0">
        <SigaErrorScreen
          statusCode="Error crítico"
          title="Ocurrió un error inesperado en S.I.G.A."
          description="El incidente ya fue reportado automáticamente al equipo técnico para su revisión."
          digest={error.digest}
          onRetry={reset}
          homeHref="/"
          homeLabel="Recargar inicio"
        />
      </body>
    </html>
  );
}

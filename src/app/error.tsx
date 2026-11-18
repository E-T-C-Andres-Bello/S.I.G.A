"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { SigaErrorScreen } from "@/components/ui/siga-error-screen";

export default function AppError({
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
    <SigaErrorScreen
      statusCode="Error de aplicación"
      title="Ocurrió un inconveniente al cargar esta vista"
      description="El incidente fue registrado de forma automática. Puedes reintentar la carga de inmediato o regresar a la portada institucional."
      digest={error.digest}
      onRetry={reset}
      homeHref="/"
      homeLabel="Volver al inicio"
    />
  );
}

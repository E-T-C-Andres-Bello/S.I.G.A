"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";

export interface SigaErrorScreenProps {
  statusCode?: string;
  title?: string;
  description?: string;
  digest?: string;
  onRetry?: () => void;
  homeHref?: string;
  homeLabel?: string;
}

/**
 * Pantalla de error institucional S.I.G.A. reutilizable para `error.tsx`,
 * `(dashboard)/error.tsx` y `not-found.tsx`.
 * No expone trazas internas ni detalles técnicos al navegador.
 */
export function SigaErrorScreen({
  statusCode = "Aviso del sistema",
  title = "No pudimos completar esta operación",
  description = "Se produjo una interrupción temporal al procesar tu solicitud. Tus datos académicos están resguardados; intenta recargar el módulo o vuelve al inicio.",
  digest,
  onRetry,
  homeHref = "/",
  homeLabel = "Ir al inicio",
}: SigaErrorScreenProps) {
  return (
    <div className="font-hero relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-gradient-to-b from-[#1a3379] via-[#0f172a] to-[#020617] px-5 py-12 text-white">
      {/* Orbe luminoso decorativo de fondo */}
      <div
        aria-hidden="true"
        className="animate-loaderCircle pointer-events-none absolute size-[320px] rounded-full opacity-35 blur-md"
      />

      <main
        role="alert"
        aria-live="assertive"
        className="relative z-10 w-full max-w-md rounded-[28px] border border-white/20 bg-white/10 p-7 text-center shadow-2xl backdrop-blur-2xl sm:p-8"
      >
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-white/30 bg-white/95 p-1.5 shadow-md">
          <Image
            src="/images/institucion/logotipo.webp"
            alt='Escudo E.T.C. "Andrés Bello"'
            width={40}
            height={40}
            className="size-10 rounded-full object-contain"
          />
        </div>

        <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-sky-300/30 bg-sky-400/15 px-3 py-1 text-[11px] font-semibold tracking-[0.14em] text-sky-200 uppercase">
          <AlertTriangle className="size-3.5 text-sky-300" aria-hidden="true" />
          <span>{statusCode}</span>
        </div>

        <h1 className="mt-4 text-xl leading-[1.3] font-semibold tracking-[-0.02em] text-balance text-white sm:text-2xl">
          {title}
        </h1>

        <p className="mt-3 text-xs leading-[1.65] text-sky-100/80 sm:text-[13.5px]">
          {description}
        </p>

        {digest ? (
          <p className="mt-3 text-[11px] tabular-nums text-sky-200/60">
            Código de referencia: {digest}
          </p>
        ) : null}

        <div className="mt-7 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-white px-5 text-xs font-semibold text-[#0b1d59] shadow-sm transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:outline-none sm:w-auto"
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
              <span>Reintentar</span>
            </button>
          ) : null}

          <Link
            href={homeHref}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full border border-white/25 bg-white/10 px-5 text-xs font-medium text-white transition-colors hover:bg-white/18 focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:outline-none sm:w-auto"
          >
            <Home className="size-3.5" aria-hidden="true" />
            <span>{homeLabel}</span>
          </Link>
        </div>

        <p className="mt-6 text-[11px] tracking-[0.12em] text-sky-200/60 uppercase">
          S.I.G.A. · E.T.C. &ldquo;Andrés Bello&rdquo;
        </p>
      </main>
    </div>
  );
}

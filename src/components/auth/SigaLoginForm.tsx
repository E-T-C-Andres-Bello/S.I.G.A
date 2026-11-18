"use client";

import * as React from "react";
import Image from "next/image";
import { AlertCircle, ChevronDown, Loader2 } from "lucide-react";
import { cn } from "cn";
import { startGoogleWorkspaceOAuth } from "@/lib/supabase/client";
import { INSTITUTIONAL_EMAIL_DOMAIN } from "@/lib/validators/auth";
import {
  GoogleWorkspaceGlyph,
  SigaCredentialsFields,
  resolveAuthErrorMessage,
} from "./SigaCredentialsFields";

export interface SigaLoginFormProps {
  /** Ruta a la cual devolver un eventual error OAuth desde `/api/auth/callback`. */
  callbackReturnPath?: string;
  /** Código de error recibido por redirección OAuth. */
  initialAuthErrorCode?: string | null;
  /** Acción opcional alineada a la derecha de la cabecera. */
  headerAction?: React.ReactNode;
  /** Referencia al primer foco accesible dentro del formulario. */
  initialFocusRef?: React.RefObject<HTMLButtonElement | null>;
}

/**
 * Tarjeta independiente minimalista usada en `/login` y `components/ui/login-form.tsx`.
 */
export function SigaLoginForm({
  callbackReturnPath = "/",
  initialAuthErrorCode = null,
  headerAction,
  initialFocusRef,
}: SigaLoginFormProps) {
  const credentialsPanelId = React.useId();
  const googleLockRef = React.useRef(false);
  const identifierInputRef = React.useRef<HTMLInputElement | null>(null);

  const [credentialsOpen, setCredentialsOpen] = React.useState(false);
  const [googlePending, setGooglePending] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(() =>
    resolveAuthErrorMessage(initialAuthErrorCode)
  );

  React.useEffect(() => {
    const resolved = resolveAuthErrorMessage(initialAuthErrorCode);
    if (resolved) {
      setErrorMessage(resolved);
    }
  }, [initialAuthErrorCode]);

  const toggleCredentials = React.useCallback(() => {
    setCredentialsOpen((prev) => {
      const next = !prev;
      if (next) {
        window.setTimeout(() => {
          identifierInputRef.current?.focus({ preventScroll: true });
        }, 200);
      }
      return next;
    });
  }, []);

  const handleGoogleLogin = React.useCallback(async () => {
    if (googleLockRef.current) return;
    googleLockRef.current = true;
    setErrorMessage(null);
    setGooglePending(true);

    const result = await startGoogleWorkspaceOAuth(callbackReturnPath);
    if (!result.ok) {
      setErrorMessage(result.message);
      setGooglePending(false);
      googleLockRef.current = false;
    }
  }, [callbackReturnPath]);

  return (
    <div className="flex flex-col text-white">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/95 p-1 shadow-xs">
            <Image
              src="/images/institucion/logotipo.webp"
              alt='Escudo de la E.T.C. "Andrés Bello"'
              width={28}
              height={28}
              className="size-7 rounded-full object-contain"
            />
          </div>
          <h2 className="font-display text-lg font-medium tracking-[-0.02em] text-white">
            Acceso S.I.G.A.
          </h2>
        </div>

        {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
      </div>

      {errorMessage ? (
        <div
          role="alert"
          aria-live="polite"
          className="mt-4 flex items-start gap-2 rounded-xl border border-red-400/35 bg-red-950/60 px-3 py-2.5 text-xs leading-relaxed text-red-100"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-300" aria-hidden="true" />
          <span>{errorMessage}</span>
        </div>
      ) : null}

      <button
        ref={initialFocusRef}
        type="button"
        onClick={handleGoogleLogin}
        disabled={googlePending}
        className="mt-5 flex h-11 w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl bg-white/95 px-4 text-sm font-semibold text-[#090d16] shadow-sm transition-all duration-200 hover:bg-white focus-visible:ring-2 focus-visible:ring-[#7dd3fc] focus-visible:ring-offset-2 focus-visible:ring-offset-[#020617] focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
      >
        {googlePending ? (
          <Loader2 className="size-4 animate-spin text-[#1c47c4]" aria-hidden="true" />
        ) : (
          <GoogleWorkspaceGlyph />
        )}
        <span>Ingresar con Google</span>
        <span className="text-[11px] font-normal text-slate-500">
          @{INSTITUTIONAL_EMAIL_DOMAIN}
        </span>
      </button>

      <button
        type="button"
        onClick={toggleCredentials}
        aria-expanded={credentialsOpen}
        aria-controls={credentialsPanelId}
        className="mt-3.5 inline-flex w-full cursor-pointer items-center justify-center gap-1.5 py-1 text-xs font-medium text-slate-300 transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-[#7dd3fc] focus-visible:outline-none"
      >
        <span>Usar correo y contraseña</span>
        <ChevronDown
          className={cn(
            "size-3.5 transition-transform duration-300",
            credentialsOpen && "rotate-180"
          )}
          aria-hidden="true"
        />
      </button>

      <div
        id={credentialsPanelId}
        data-state={credentialsOpen ? "open" : "closed"}
        aria-hidden={!credentialsOpen}
        inert={!credentialsOpen ? true : undefined}
        className="siga-creds-fold"
      >
        <div className="siga-creds-fold-inner">
          <div className="siga-creds-fold-content pt-4">
            <SigaCredentialsFields
              identifierInputRef={identifierInputRef}
              onErrorMessage={setErrorMessage}
              disabled={googlePending}
            />
          </div>
        </div>
      </div>

      <p className="mt-4 text-center text-[11px] text-slate-300/85">
        Solo matrícula y personal inscrito.
      </p>
    </div>
  );
}

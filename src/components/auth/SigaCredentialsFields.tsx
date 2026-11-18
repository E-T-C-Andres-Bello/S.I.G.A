"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Loader2, Lock, User } from "lucide-react";
import { cn } from "cn";
import {
  AUTH_ERROR_MESSAGES,
  formatVenezuelanCedulaDisplay,
  getForeignEmailWarning,
  loginCredentialsSchema,
  normalizeVenezuelanCedula,
  type AuthErrorCode,
} from "@/lib/validators/auth";

export function GoogleWorkspaceGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={cn("size-4.5 shrink-0", className)}
      aria-hidden="true"
    >
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039L38.802 8.841C34.553 4.806 29.613 2.5 24 2.5C11.983 2.5 2.5 11.983 2.5 24s9.483 21.5 21.5 21.5S45.5 36.017 45.5 24c0-1.538-.135-3.022-.389-4.417z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12.5 24 12.5c3.059 0 5.842 1.154 7.961 3.039l5.839-5.841C34.553 4.806 29.613 2.5 24 2.5C16.318 2.5 9.642 6.723 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 45.5c5.613 0 10.553-2.306 14.802-6.341l-5.839-5.841C30.842 35.846 27.059 38 24 38c-5.039 0-9.345-2.608-11.124-6.481l-6.571 4.819C9.642 41.277 16.318 45.5 24 45.5z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l5.839 5.841C44.196 35.123 45.5 29.837 45.5 24c0-1.538-.135-3.022-.389-4.417z"
      />
    </svg>
  );
}

export function resolveAuthErrorMessage(
  code: string | null | undefined
): string | null {
  if (!code) return null;
  if (code in AUTH_ERROR_MESSAGES) {
    return AUTH_ERROR_MESSAGES[code as AuthErrorCode];
  }
  return AUTH_ERROR_MESSAGES.oauth_failed;
}

export interface SigaCredentialsFieldsProps {
  /** Ref opcional al primer campo para enfocar al desplegarse. */
  identifierInputRef?: React.RefObject<HTMLInputElement | null>;
  /** Callback para mostrar/limpiar errores en el contenedor padre. */
  onErrorMessage: (message: string | null) => void;
  /** Deshabilita envío mientras Google OAuth está en curso. */
  disabled?: boolean;
}

/**
 * Campos mínimos reutilizables de acceso institucional (correo @etcandresbello.org o cédula + contraseña)
 * sin texto decorativo ni registro abierto.
 */
export function SigaCredentialsFields({
  identifierInputRef,
  onErrorMessage,
  disabled = false,
}: SigaCredentialsFieldsProps) {
  const router = useRouter();
  const identifierId = React.useId();
  const passwordId = React.useId();

  const submitLockRef = React.useRef(false);

  const [identifier, setIdentifier] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const foreignDomainWarning = React.useMemo(
    () => getForeignEmailWarning(identifier),
    [identifier]
  );

  const normalizedCedulaPreview = React.useMemo(() => {
    if (!identifier.trim() || identifier.includes("@")) return null;
    const normalized = normalizeVenezuelanCedula(identifier);
    return normalized ? formatVenezuelanCedulaDisplay(normalized) : null;
  }, [identifier]);

  const handleSubmit = React.useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (submitLockRef.current || disabled) return;

      const parsed = loginCredentialsSchema.safeParse({ identifier, password });
      if (!parsed.success) {
        onErrorMessage(
          parsed.error.issues[0]?.message ?? "Revisa tus credenciales de acceso."
        );
        return;
      }

      submitLockRef.current = true;
      onErrorMessage(null);
      setSubmitting(true);

      try {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier, password }),
        });

        const payload = (await response.json()) as {
          ok?: boolean;
          message?: string;
          redirectTo?: string;
        };

        if (!response.ok || !payload.ok || !payload.redirectTo) {
          onErrorMessage(
            payload.message ??
              "No fue posible validar tus credenciales institucionales."
          );
          setSubmitting(false);
          submitLockRef.current = false;
          return;
        }

        try {
          window.sessionStorage.removeItem("siga-intro-shown-v1");
        } catch {
          // Ignorar si sessionStorage está restringido.
        }
        router.push(payload.redirectTo);
        router.refresh();
      } catch {
        onErrorMessage(
          "Sin respuesta del servidor de autenticación. Verifica tu conexión."
        );
        setSubmitting(false);
        submitLockRef.current = false;
      }
    },
    [disabled, identifier, onErrorMessage, password, router]
  );

  const isBusy = submitting || disabled;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div>
        <div className="relative z-0">
          <input
            ref={identifierInputRef}
            id={identifierId}
            name="identifier"
            type="text"
            autoComplete="username"
            inputMode="email"
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
            placeholder=" "
            value={identifier}
            onChange={(e) => {
              setIdentifier(e.target.value);
              onErrorMessage(null);
            }}
            disabled={isBusy}
            aria-invalid={Boolean(foreignDomainWarning)}
            aria-describedby={foreignDomainWarning ? `${identifierId}-warn` : undefined}
            className={cn(
              "peer block w-full appearance-none border-0 border-b-2 bg-transparent py-2 pl-0 text-sm text-white transition-colors focus:ring-0 focus:outline-none",
              normalizedCedulaPreview ? "pr-24" : "pr-1",
              foreignDomainWarning
                ? "border-amber-400 focus:border-amber-300"
                : "border-white/30 focus:border-[#7dd3fc]"
            )}
          />
          <label
            htmlFor={identifierId}
            className={cn(
              "pointer-events-none absolute top-2.5 left-0 -z-10 origin-[0] -translate-y-5.5 scale-75 transform text-sm transition-all duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:left-0 peer-focus:-translate-y-5.5 peer-focus:scale-75",
              foreignDomainWarning
                ? "text-amber-300"
                : "text-slate-300 peer-focus:text-[#7dd3fc]"
            )}
          >
            <User className="mr-1.5 -mt-0.5 inline-block size-3.5" aria-hidden="true" />
            Correo o cédula
          </label>

          {normalizedCedulaPreview ? (
            <span className="pointer-events-none absolute top-2 right-0 rounded bg-[#7dd3fc]/15 px-1.5 py-0.5 text-[10.5px] font-medium text-[#bae6fd]">
              {normalizedCedulaPreview}
            </span>
          ) : null}
        </div>

        {foreignDomainWarning ? (
          <p
            id={`${identifierId}-warn`}
            className="mt-1.5 text-[11px] leading-snug text-amber-200"
          >
            {foreignDomainWarning}
          </p>
        ) : null}
      </div>

      <div className="relative z-0">
        <input
          id={passwordId}
          name="password"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          placeholder=" "
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            onErrorMessage(null);
          }}
          disabled={isBusy}
          className="peer block w-full appearance-none border-0 border-b-2 border-white/30 bg-transparent py-2 pr-8 pl-0 text-sm text-white transition-colors focus:border-[#7dd3fc] focus:ring-0 focus:outline-none"
        />
        <label
          htmlFor={passwordId}
          className="pointer-events-none absolute top-2.5 left-0 -z-10 origin-[0] -translate-y-5.5 scale-75 transform text-sm text-slate-300 transition-all duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:left-0 peer-focus:-translate-y-5.5 peer-focus:scale-75 peer-focus:text-[#7dd3fc]"
        >
          <Lock className="mr-1.5 -mt-0.5 inline-block size-3.5" aria-hidden="true" />
          Contraseña
        </label>
        <button
          type="button"
          onClick={() => setShowPassword((prev) => !prev)}
          aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
          className="absolute top-1.5 right-0 inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-slate-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-[#7dd3fc] focus-visible:outline-none"
        >
          {showPassword ? (
            <EyeOff className="size-4" aria-hidden="true" />
          ) : (
            <Eye className="size-4" aria-hidden="true" />
          )}
        </button>
      </div>

      <button
        type="submit"
        disabled={isBusy || Boolean(foreignDomainWarning)}
        className="group flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#1c47c4] px-4 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-[#2555dd] focus-visible:ring-2 focus-visible:ring-[#7dd3fc] focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
      >
        {submitting ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            <span>Verificando...</span>
          </>
        ) : (
          <>
            <span>Ingresar</span>
            <ArrowRight
              className="size-4 transform transition-transform duration-200 group-hover:translate-x-1"
              aria-hidden="true"
            />
          </>
        )}
      </button>
    </form>
  );
}

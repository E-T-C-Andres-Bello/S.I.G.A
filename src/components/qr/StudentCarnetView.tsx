"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  Maximize2,
  QrCode,
  RefreshCw,
  ShieldCheck,
  WifiOff,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import {
  generateStudentCarnetTokenAction,
  type StudentCarnetTokenPayload,
} from "@/features/estudiante/student-actions";
import type { DashboardUserProfile } from "@/lib/auth/dashboard-session";
import { formatVenezuelanCedulaDisplay } from "@/lib/validators/auth";

export interface StudentCarnetViewProps {
  profile: DashboardUserProfile;
  initialToken: StudentCarnetTokenPayload | null;
  initialDeadlineMs?: number | null;
  initialError: string | null;
  onTokenIssued?: (
    payload: StudentCarnetTokenPayload,
    deadlineMs: number
  ) => void;
  /** Cuando se renderiza dentro de una pestaña de `/estudiante`, omite el encabezado de página independiente. */
  embedded?: boolean;
}

function computeClientDeadlineMs(payload: StudentCarnetTokenPayload): number {
  const issuedMs = Date.parse(payload.issuedAt);
  const expiresMs = Date.parse(payload.expiresAt);
  const durationMs =
    Number.isFinite(issuedMs) &&
    Number.isFinite(expiresMs) &&
    expiresMs > issuedMs
      ? expiresMs - issuedMs
      : Math.max(30, payload.ttlSeconds || 120) * 1000;

  return Date.now() + durationMs;
}

function formatCountdown(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

/**
 * Carnet Digital Inteligente con código QR dinámico cuyo token se re-emite
 * criptográficamente en servidor (TTL 120s, invalidando tokens previos) y soporte
 * de lectura de alto contraste.
 */
export function StudentCarnetView({
  profile,
  initialToken,
  initialDeadlineMs = null,
  initialError,
  onTokenIssued,
  embedded = false,
}: StudentCarnetViewProps) {
  const [tokenData, setTokenData] =
    React.useState<StudentCarnetTokenPayload | null>(initialToken);
  const [deadlineMs, setDeadlineMs] = React.useState<number | null>(() => {
    if (!initialToken) return null;
    return initialDeadlineMs ?? computeClientDeadlineMs(initialToken);
  });
  const [errorMessage, setErrorMessage] = React.useState<string | null>(
    initialError
  );
  const [isReissuing, setIsReissuing] = React.useState(false);
  const [secondsLeft, setSecondsLeft] = React.useState<number>(() => {
    if (!initialToken) return 0;
    const targetDeadline =
      initialDeadlineMs ?? computeClientDeadlineMs(initialToken);
    return Math.max(0, Math.ceil((targetDeadline - Date.now()) / 1000));
  });
  const [isOffline, setIsOffline] = React.useState(false);
  const [cachedCard, setCachedCard] = React.useState<
    StudentCarnetTokenPayload["card"] | null
  >(initialToken?.card ?? null);

  const reissueLockRef = React.useRef(false);
  const didAutoInitRef = React.useRef(false);
  const reissuedTokensRef = React.useRef<Set<string>>(new Set());
  const cacheKey = `siga-carnet-summary-v1-${profile.internalUserId}`;

  // Sincroniza estado online/offline y caché local sin secretos
  React.useEffect(() => {
    const syncNetwork = () => {
      setIsOffline(!window.navigator.onLine);
    };
    syncNetwork();
    window.addEventListener("online", syncNetwork);
    window.addEventListener("offline", syncNetwork);

    if (initialToken?.card) {
      try {
        window.localStorage.setItem(cacheKey, JSON.stringify(initialToken.card));
      } catch {
        // Ignorar cuota de almacenamiento.
      }
    } else {
      try {
        const raw = window.localStorage.getItem(cacheKey);
        if (raw) {
          setCachedCard(JSON.parse(raw) as StudentCarnetTokenPayload["card"]);
        }
      } catch {
        // Ignorar lectura restringida.
      }
    }

    return () => {
      window.removeEventListener("online", syncNetwork);
      window.removeEventListener("offline", syncNetwork);
    };
  }, [cacheKey, initialToken]);

  const handleReissueToken = React.useCallback(
    async (silent = false) => {
      if (reissueLockRef.current) return;
      if (!window.navigator.onLine) {
        setIsOffline(true);
        if (!silent) {
          toast.error("Sin conexión a internet para re-emitir el código QR.");
        }
        return;
      }

      reissueLockRef.current = true;
      setIsReissuing(true);

      try {
        const res = await generateStudentCarnetTokenAction(120);
        if (!res.ok) {
          setErrorMessage(res.message);
          if (!silent) toast.error(res.message);
          return;
        }

        const nextDeadline = computeClientDeadlineMs(res.data);
        setTokenData(res.data);
        setDeadlineMs(nextDeadline);
        onTokenIssued?.(res.data, nextDeadline);
        setCachedCard(res.data.card);
        setErrorMessage(null);

        const diff = Math.ceil((nextDeadline - Date.now()) / 1000);
        setSecondsLeft(Math.max(0, diff));

        try {
          window.localStorage.setItem(cacheKey, JSON.stringify(res.data.card));
        } catch {
          // Ignorar cuota.
        }

        if (!silent) {
          toast.success("Nuevo token QR re-emitido por 2 minutos.");
        }
      } catch {
        const fallbackMessage =
          "No se pudo completar la re-emisión del código QR. Intenta nuevamente.";
        setErrorMessage(fallbackMessage);
        if (!silent) toast.error(fallbackMessage);
      } finally {
        setIsReissuing(false);
        reissueLockRef.current = false;
      }
    },
    [cacheKey, onTokenIssued]
  );

  // Cuenta regresiva monotónica por segundo y re-emisión automática al vencer
  React.useEffect(() => {
    if (!tokenData && !errorMessage) {
      if (!didAutoInitRef.current && window.navigator.onLine) {
        didAutoInitRef.current = true;
        void handleReissueToken(true);
      }
      return;
    }
    if (!tokenData || !deadlineMs) return;

    const tick = () => {
      const remaining = Math.max(
        0,
        Math.ceil((deadlineMs - Date.now()) / 1000)
      );
      setSecondsLeft(remaining);
      if (
        remaining <= 5 &&
        !errorMessage &&
        !reissueLockRef.current &&
        window.navigator.onLine &&
        !reissuedTokensRef.current.has(tokenData.token)
      ) {
        reissuedTokensRef.current.add(tokenData.token);
        void handleReissueToken(true);
      }
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [deadlineMs, errorMessage, handleReissueToken, tokenData]);

  const card = tokenData?.card ?? cachedCard;
  const fullName =
    card?.fullName ?? `${profile.firstName} ${profile.lastName}`;
  const formattedCedula = formatVenezuelanCedulaDisplay(
    card?.cedula || profile.cedula
  );
  const avatarUrl = card?.avatarWebpUrl ?? profile.avatarWebpUrl;
  const initials = `${profile.firstName.charAt(0)}${profile.lastName.charAt(0)}`.toUpperCase();
  const ttlTotal = tokenData?.ttlSeconds ?? 120;
  const validityPercent =
    tokenData && ttlTotal > 0
      ? Math.min(100, Math.max(0, Math.round((secondsLeft / ttlTotal) * 100)))
      : 0;
  const qrActive = Boolean(tokenData?.token) && secondsLeft > 0;

  return (
    <div className="font-hero flex flex-col gap-5 pb-8">
      {embedded ? (
        <div className="siga-glass-surface flex flex-col justify-between gap-3 rounded-[28px] border p-5 sm:flex-row sm:items-center sm:p-6">
          <div>
            <h2 className="text-base leading-snug font-semibold tracking-[-0.02em] text-foreground">
              Carnet Digital Inteligente
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Identificación estudiantil oficial con código QR temporal firmado
              para Biblioteca, asistencia en aula y portón.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleReissueToken(false)}
            disabled={isReissuing || isOffline}
            className="siga-glass-inner w-fit rounded-full"
          >
            {isReissuing ? (
              <>
                <Spinner data-icon="inline-start" />
                Re-emitiendo...
              </>
            ) : (
              <>
                <RefreshCw data-icon="inline-start" />
                Re-emitir QR ahora
              </>
            )}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <Link
              href="/estudiante"
              className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              Volver al inicio estudiantil
            </Link>
            <h1 className="text-[1.75rem] leading-tight font-normal tracking-[-0.03em] text-foreground sm:text-[2.15rem]">
              Carnet Digital Inteligente
            </h1>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Identificación estudiantil oficial con código QR temporal firmado
              para Biblioteca, asistencia en aula y portón.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => void handleReissueToken(false)}
            disabled={isReissuing || isOffline}
            className="siga-glass-pill w-fit rounded-full"
          >
            {isReissuing ? (
              <>
                <Spinner data-icon="inline-start" />
                Re-emitiendo...
              </>
            ) : (
              <>
                <RefreshCw data-icon="inline-start" />
                Re-emitir QR ahora
              </>
            )}
          </Button>
        </div>
      )}

      {isOffline ? (
        <Alert className="siga-glass-surface rounded-2xl">
          <WifiOff aria-hidden="true" />
          <AlertTitle>Modo sin conexión detectado</AlertTitle>
          <AlertDescription>
            Puedes mostrar tus datos de identificación guardados en caché local,
            pero la firma del código QR temporal requiere internet para
            re-emitirse.
          </AlertDescription>
        </Alert>
      ) : null}

      {errorMessage ? (
        <Alert variant="destructive" className="rounded-2xl">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>No se pudo generar el código QR dinámico</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
        {/* Tarjeta principal del Carnet Digital */}
        <section
          aria-label="Credencial estudiantil E.T.C. Andrés Bello"
          className="siga-glass-hero relative overflow-hidden rounded-[28px] border p-6 text-white shadow-xl sm:p-7 lg:col-span-7"
        >
          {/* Cabecera institucional */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/20 pb-4">
            <div className="flex items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-white/75 bg-white p-1 shadow-sm">
                <Image
                  src="/images/institucion/logotipo.webp"
                  alt='Escudo E.T.C. "Andrés Bello"'
                  width={36}
                  height={36}
                  className="size-8.5 rounded-full object-contain"
                />
              </span>
              <div>
                <p className="text-xs font-semibold tracking-[0.14em] text-sky-200 uppercase">
                  E.T.C. &ldquo;Andrés Bello&rdquo;
                </p>
                <p className="text-[11px] text-sky-100/80">
                  Unare II, Puerto Ordaz · DEA OD01340701
                </p>
              </div>
            </div>

            <Badge className="border-white/25 bg-white/15 text-white hover:bg-white/20">
              <ShieldCheck data-icon="inline-start" aria-hidden="true" />
              Cuenta Institucional Verificada
            </Badge>
          </div>

          {/* Cuerpo del carnet: Foto .webp + Datos */}
          <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-center">
            <div className="relative mx-auto flex size-32 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-white/50 bg-[#0b1d59]/75 shadow-inner sm:mx-0 sm:size-36">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt={`Foto carnet de ${fullName}`}
                  className="size-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-center">
                  <span className="font-kpi-num text-3xl font-light text-white">
                    {initials || "AB"}
                  </span>
                  <span className="mt-1 text-[10px] text-sky-200/80">
                    Foto oficial pendiente
                  </span>
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1 space-y-2.5 text-center sm:text-left">
              <div>
                <span className="text-[10.5px] font-medium tracking-[0.14em] text-sky-200/85 uppercase">
                  Estudiante Regular
                </span>
                <h2 className="mt-0.5 truncate text-xl font-semibold tracking-tight text-white sm:text-2xl">
                  {fullName}
                </h2>
                <p className="font-kpi-num mt-0.5 text-base font-normal text-sky-100 tabular-nums">
                  {formattedCedula}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5 rounded-2xl border border-white/15 bg-black/15 p-3 text-left text-xs">
                <div>
                  <span className="block text-[10px] text-sky-200/75">
                    Año / Sección
                  </span>
                  <span className="font-semibold text-white">
                    {card?.gradeYear
                      ? `${card.gradeYear}.º Año · Sec. ${card.sectionLetter ?? "—"}`
                      : "Por asignar"}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] text-sky-200/75">
                    Mención Técnica
                  </span>
                  <span className="font-semibold text-white">
                    {card?.mencionName ?? "Por asignar"}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] text-sky-200/75">
                    Período Escolar
                  </span>
                  <span className="font-medium text-sky-100">
                    {card?.schoolYearName ?? "Vigente"}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] text-sky-200/75">
                    Identidad Institucional
                  </span>
                  <span className="block truncate font-medium text-sky-100">
                    {profile.institutionalEmail ?? "@etcandresbello.org"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Panel derecho: Código QR dinámico + Ventana temporal */}
        <section
          aria-label="Código QR dinámico del carnet"
          className="siga-glass-surface flex flex-col items-center gap-4 rounded-[28px] border p-6 text-center lg:col-span-5"
        >
          <div className="flex w-full items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <QrCode className="size-4 text-primary" aria-hidden="true" />
              <span>QR Dinámico Firmado</span>
            </div>
            <Badge
              variant={qrActive ? "default" : "destructive"}
              className="tabular-nums"
            >
              {qrActive
                ? `Vigente · ${formatCountdown(secondsLeft)}`
                : "Expirado"}
            </Badge>
          </div>

          <div className="rounded-3xl border border-border bg-white p-4 shadow-sm">
            {qrActive && tokenData ? (
              <QRCodeSVG
                value={tokenData.token}
                size={210}
                level="M"
                bgColor="#ffffff"
                fgColor="#090d16"
                title={`QR dinámico de carnet estudiantil para ${fullName}`}
              />
            ) : (
              <div className="flex size-[210px] flex-col items-center justify-center gap-2 text-slate-500">
                <QrCode className="size-10 opacity-40" aria-hidden="true" />
                <span className="text-xs font-medium">
                  {isReissuing
                    ? "Re-emitiendo código seguro..."
                    : "Código no disponible"}
                </span>
              </div>
            )}
          </div>

          <div className="w-full space-y-1.5 text-left">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Re-emisión automática de seguridad</span>
              <span className="font-medium tabular-nums text-foreground">
                {formatCountdown(secondsLeft)} / {formatCountdown(ttlTotal)}
              </span>
            </div>
            <Progress
              value={validityPercent}
              aria-label={`Vigencia del QR: ${secondsLeft} segundos restantes`}
              className="h-2"
            />
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row">
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1"
                  disabled={!qrActive}
                >
                  <Maximize2 data-icon="inline-start" />
                  Modo escaneo
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Carnet QR — Lectura Rápida</DialogTitle>
                  <DialogDescription>
                    Acerca este código al lector de Biblioteca, control de
                    acceso o pase de asistencia docente.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col items-center gap-3 py-2">
                  <div className="rounded-3xl border bg-white p-5 shadow-xs">
                    {qrActive && tokenData ? (
                      <QRCodeSVG
                        value={tokenData.token}
                        size={260}
                        level="M"
                        bgColor="#ffffff"
                        fgColor="#090d16"
                      />
                    ) : null}
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    {fullName} · {formattedCedula}
                  </p>
                  <Badge variant="outline" className="tabular-nums">
                    Expira en {formatCountdown(secondsLeft)}
                  </Badge>
                </div>
              </DialogContent>
            </Dialog>

            <Button
              type="button"
              variant="outline"
              onClick={() => void handleReissueToken(false)}
              disabled={isReissuing || isOffline}
              className="flex-1"
            >
              {isReissuing ? (
                <>
                  <Spinner data-icon="inline-start" />
                  Re-emitiendo...
                </>
              ) : (
                <>
                  <RefreshCw data-icon="inline-start" />
                  Re-emitir QR
                </>
              )}
            </Button>
          </div>

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Cada código QR se re-emite con una firma digital temporal única para
            impedir capturas de pantalla reutilizables.
          </p>
        </section>
      </div>
    </div>
  );
}

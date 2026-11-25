"use client";

import * as React from "react";
import {
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  GraduationCap,
  Mail,
  Send,
  ShieldAlert,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { BellistaBulletinCardFan } from "@/components/cartelera/BellistaBulletinCardFan";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import type { ProvisionalOnboardingData } from "@/features/estudiante/provisional-data";
import {
  createStudentRequestAction,
  updateRecoveryEmailAction,
} from "@/features/estudiante/student-actions";
import { linkGoogleWorkspaceIdentity } from "@/lib/auth/client";
import type { DashboardUserProfile } from "@/lib/auth/dashboard-session";
import {
  AUTH_ERROR_MESSAGES,
  formatVenezuelanCedulaDisplay,
  type AuthErrorCode,
} from "@/lib/validators/auth";
import {
  recoveryEmailSchema,
  STUDENT_REQUEST_STATUS_LABELS,
  type StudentRequestStatus,
} from "@/lib/validators/student-portal";
import type { SchoolAnnouncementItem } from "@/lib/validators/bulletin";

export interface ProvisionalStudentOnboardingViewProps {
  profile: DashboardUserProfile;
  onboarding: ProvisionalOnboardingData;
  bulletinHighlights?: SchoolAnnouncementItem[];
  authErrorCode?: string | null;
}

function isKnownAuthErrorCode(code: string | null | undefined): code is AuthErrorCode {
  return Boolean(code && code in AUTH_ERROR_MESSAGES);
}

/**
 * Vista limitada obligatoria para estudiantes en estado `provisional_cedula`
 * antes de vincular su cuenta institucional `@etcandresbello.org`.
 */
export function ProvisionalStudentOnboardingView({
  profile,
  onboarding,
  bulletinHighlights = [],
  authErrorCode,
}: ProvisionalStudentOnboardingViewProps) {
  const [recoveryEmail, setRecoveryEmail] = React.useState(
    profile.recoveryEmail ?? ""
  );
  const [savedRecoveryEmail, setSavedRecoveryEmail] = React.useState(
    profile.recoveryEmail ?? ""
  );
  const [recoveryError, setRecoveryError] = React.useState<string | null>(null);
  const [savingRecovery, setSavingRecovery] = React.useState(false);

  const [activationRequest, setActivationRequest] = React.useState(
    onboarding.activationRequest
  );

  React.useEffect(() => {
    setActivationRequest(onboarding.activationRequest);
  }, [onboarding.activationRequest]);
  const [requestPending, setRequestPending] = React.useState(false);
  const [linkingGoogle, setLinkingGoogle] = React.useState(false);
  const [linkError, setLinkError] = React.useState<string | null>(() =>
    isKnownAuthErrorCode(authErrorCode)
      ? AUTH_ERROR_MESSAGES[authErrorCode]
      : null
  );

  const recoveryLockRef = React.useRef(false);
  const requestLockRef = React.useRef(false);
  const googleLockRef = React.useRef(false);

  // El estado de `activacion_workspace` se sincroniza tras cada acción o recarga de página.

  const handleSaveRecoveryEmail = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (recoveryLockRef.current) return;

    const parsed = recoveryEmailSchema.safeParse(recoveryEmail);
    if (!parsed.success) {
      setRecoveryError(
        parsed.error.issues[0]?.message ?? "Ingresa un correo válido."
      );
      return;
    }

    recoveryLockRef.current = true;
    setRecoveryError(null);
    setSavingRecovery(true);

    try {
      const result = await updateRecoveryEmailAction(parsed.data);
      if (!result.ok) {
        setRecoveryError(result.message);
        toast.error(result.message);
        return;
      }
      setSavedRecoveryEmail(result.data.recoveryEmail);
      setRecoveryEmail(result.data.recoveryEmail);
      toast.success("Correo secundario de recuperación guardado.");
    } finally {
      setSavingRecovery(false);
      recoveryLockRef.current = false;
    }
  };

  const handleRequestWorkspaceActivation = async () => {
    if (requestLockRef.current) return;
    requestLockRef.current = true;
    setRequestPending(true);

    try {
      const result = await createStudentRequestAction({
        requestType: "activacion_workspace",
        reason: savedRecoveryEmail
          ? `Solicitud de activación @etcandresbello.org (respaldo: ${savedRecoveryEmail})`
          : "Solicitud de activación de cuenta Google Workspace institucional.",
        clientRequestId: crypto.randomUUID(),
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      setActivationRequest({
        id: result.data.requestId,
        status: "pending",
        reason: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      toast.success(
        "Solicitud enviada a Control de Estudios. Te notificaremos al habilitarla."
      );
    } finally {
      setRequestPending(false);
      requestLockRef.current = false;
    }
  };

  const handleLinkGoogleWorkspace = async () => {
    if (googleLockRef.current) return;
    googleLockRef.current = true;
    setLinkError(null);
    setLinkingGoogle(true);

    const result = await linkGoogleWorkspaceIdentity("/estudiante");
    if (!result.ok) {
      setLinkError(result.message);
      setLinkingGoogle(false);
      googleLockRef.current = false;
    }
  };

  const enrollment = onboarding.enrollment;
  const activeRequestExists =
    activationRequest?.status === "pending" ||
    activationRequest?.status === "in_review";

  return (
    <div className="font-hero flex flex-col gap-5 pb-8">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-[1.75rem] leading-tight font-normal tracking-[-0.03em] text-foreground sm:text-[2.15rem]">
            Activación de Cuenta Estudiantil
          </h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            {profile.firstName} {profile.lastName} ·{" "}
            {formatVenezuelanCedulaDisplay(profile.cedula)}
          </p>
        </div>

        <Badge className="w-fit rounded-full px-3 py-1 text-xs">
          Acceso provisional por cédula
        </Badge>
      </div>

      {linkError ? (
        <Alert variant="destructive" className="rounded-2xl">
          <ShieldAlert aria-hidden="true" />
          <AlertTitle>No se pudo vincular la cuenta Google</AlertTitle>
          <AlertDescription>{linkError}</AlertDescription>
        </Alert>
      ) : null}

      {/* Hero de bienvenida y vinculación Google Workspace */}
      <section className="siga-glass-hero rounded-[28px] border p-6 text-white sm:p-7">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/12 px-3 py-1 text-[11px] font-medium text-sky-100">
              <GraduationCap className="size-3.5" aria-hidden="true" />
              Paso requerido para acceso completo
            </span>
            <h2 className="mt-4 text-2xl leading-snug font-normal tracking-[-0.02em] text-white sm:text-[1.85rem]">
              Vincula tu cuenta oficial @etcandresbello.org
            </h2>
            <p className="mt-2.5 text-[13.5px] leading-relaxed text-sky-100/90">
              Por seguridad K12, en modo provisional solo puedes consultar tu
              ficha de inscripción, registrar un correo de recuperación y
              solicitar la activación. Al vincular tu correo institucional de
              Google Workspace desbloquearás notas, simulador, horario, Carnet
              QR, Aula Virtual, Tutor IA, menciones y biblioteca.
            </p>
          </div>

          <div className="flex shrink-0 flex-col gap-2.5">
            <Button
              type="button"
              size="lg"
              onClick={handleLinkGoogleWorkspace}
              disabled={linkingGoogle}
              className="rounded-full bg-white text-[#0b1d59] hover:bg-sky-50"
            >
              {linkingGoogle ? (
                <>
                  <Spinner data-icon="inline-start" />
                  Conectando Google...
                </>
              ) : (
                <>
                  <ExternalLink data-icon="inline-start" />
                  Vincular @etcandresbello.org
                </>
              )}
            </Button>
            <span className="text-center text-[11px] text-sky-100/80">
              Cuentas personales (@gmail.com) serán rechazadas
            </span>
          </div>
        </div>
      </section>

      {/* La Cartelera Bellista visible también para estudiantes en acceso provisional */}
      <BellistaBulletinCardFan
        items={bulletinHighlights}
        variant="dashboard"
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Tarjeta 1: Ficha de Inscripción */}
        <Card className="siga-glass-surface rounded-[28px] lg:col-span-5">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">Ficha de Inscripción</CardTitle>
              <UserCheck className="size-4 text-primary" aria-hidden="true" />
            </div>
            <CardDescription>
              Datos oficiales registrados por Control de Estudios.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-xs">
            <div className="siga-glass-inner flex flex-col gap-2.5 rounded-2xl border p-4">
              <InfoRow
                label="Estudiante"
                value={`${profile.firstName} ${profile.lastName}`}
              />
              <InfoRow
                label="Cédula"
                value={formatVenezuelanCedulaDisplay(profile.cedula)}
              />
              <InfoRow
                label="Correo institucional asignado"
                value={
                  profile.institutionalEmail ?? "Pendiente por activar"
                }
              />
              {enrollment ? (
                <>
                  <InfoRow
                    label="Año escolar"
                    value={enrollment.schoolYearName ?? "Vigente"}
                  />
                  <InfoRow
                    label="Cursando"
                    value={`${enrollment.gradeYear}.º Año · ${enrollment.mencionName ?? "Mención"} · Sección ${enrollment.sectionLetter ?? "—"}`}
                  />
                  <InfoRow
                    label="Estatus matrícula"
                    value={enrollment.enrollmentStatus}
                  />
                  {enrollment.emergencyContactName ? (
                    <InfoRow
                      label="Contacto de emergencia"
                      value={`${enrollment.emergencyContactName}${enrollment.emergencyContactRelationship ? ` (${enrollment.emergencyContactRelationship})` : ""}`}
                    />
                  ) : null}
                </>
              ) : (
                <p className="pt-1 text-muted-foreground">
                  Tu sección del año escolar vigente está en proceso de
                  asignación por Control de Estudios.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tarjeta 2: Correo de Recuperación + Solicitud de Activación */}
        <div className="flex flex-col gap-5 lg:col-span-7">
          <Card className="siga-glass-surface rounded-[28px]">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">
                  Correo Secundario de Recuperación
                </CardTitle>
                <Mail className="size-4 text-primary" aria-hidden="true" />
              </div>
              <CardDescription>
                Solo se utiliza para enviarte avisos de activación y
                recuperación (nunca como inicio de sesión OAuth).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveRecoveryEmail} noValidate>
                <FieldGroup>
                  <Field data-invalid={Boolean(recoveryError) || undefined}>
                    <FieldLabel htmlFor="recovery-email-input">
                      Correo personal de respaldo
                    </FieldLabel>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Input
                        id="recovery-email-input"
                        type="email"
                        value={recoveryEmail}
                        onChange={(e) => {
                          setRecoveryEmail(e.target.value);
                          if (recoveryError) setRecoveryError(null);
                        }}
                        placeholder="tu.nombre@correo.com"
                        aria-invalid={Boolean(recoveryError) || undefined}
                        className="siga-glass-inner"
                      />
                      <Button
                        type="submit"
                        disabled={savingRecovery}
                        className="shrink-0"
                      >
                        {savingRecovery ? (
                          <>
                            <Spinner data-icon="inline-start" />
                            Guardando
                          </>
                        ) : (
                          "Guardar respaldo"
                        )}
                      </Button>
                    </div>
                    <FieldDescription>
                      {savedRecoveryEmail
                        ? `Registrado actualmente: ${savedRecoveryEmail}`
                        : "Aún no has registrado un correo secundario."}
                    </FieldDescription>
                    {recoveryError ? (
                      <FieldError>{recoveryError}</FieldError>
                    ) : null}
                  </Field>
                </FieldGroup>
              </form>
            </CardContent>
          </Card>

          <Card className="siga-glass-surface rounded-[28px]">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">
                  Instructivo y Solicitud de Activación
                </CardTitle>
                <ClipboardCheck className="size-4 text-primary" aria-hidden="true" />
              </div>
              <CardDescription>
                Sigue estos pasos si todavía no recibes tus credenciales
                Google Workspace.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 text-xs">
              <ol className="siga-glass-inner flex flex-col gap-2 rounded-2xl border p-4 text-muted-foreground">
                <li>
                  <strong className="text-foreground">1.</strong> Registra tu
                  correo secundario de respaldo arriba.
                </li>
                <li>
                  <strong className="text-foreground">2.</strong> Envía tu
                  solicitud a Control de Estudios si aún no tienes tu usuario{" "}
                  <span className="font-medium text-foreground">
                    @etcandresbello.org
                  </span>
                  .
                </li>
                <li>
                  <strong className="text-foreground">3.</strong> Al recibir tus
                  credenciales institucionales, pulsa{" "}
                  <strong className="text-foreground">
                    &ldquo;Vincular @etcandresbello.org&rdquo;
                  </strong>{" "}
                  arriba para desbloquear todo S.I.G.A.
                </li>
              </ol>

              <div className="flex flex-wrap items-center justify-between gap-3">
                {activationRequest ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle2
                      className="size-4 text-primary"
                      aria-hidden="true"
                    />
                    <span className="text-muted-foreground">
                      Estado de tu solicitud:
                    </span>
                    <Badge variant="secondary">
                      {STUDENT_REQUEST_STATUS_LABELS[
                        activationRequest.status as StudentRequestStatus
                      ] ?? activationRequest.status}
                    </Badge>
                  </div>
                ) : (
                  <span className="text-muted-foreground">
                    Aún no has enviado una solicitud de activación.
                  </span>
                )}

                <Button
                  type="button"
                  variant={activeRequestExists ? "outline" : "default"}
                  disabled={requestPending || activeRequestExists}
                  onClick={handleRequestWorkspaceActivation}
                >
                  {requestPending ? (
                    <>
                      <Spinner data-icon="inline-start" />
                      Enviando...
                    </>
                  ) : activeRequestExists ? (
                    "Solicitud en curso"
                  ) : (
                    <>
                      <Send data-icon="inline-start" />
                      Solicitar activación Workspace
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/45 pb-2 last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  );
}

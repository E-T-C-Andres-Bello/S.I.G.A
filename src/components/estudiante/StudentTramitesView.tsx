"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  FileCheck2,
  FileText,
  Send,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  cancelStudentRequestAction,
  createStudentRequestAction,
} from "@/features/estudiante/student-actions";
import type {
  StudentOfficialDocumentItem,
  StudentRequestItem,
  StudentTramitesData,
} from "@/features/estudiante/tramites-data";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import type { DashboardUserProfile } from "@/lib/supabase/dashboard-session";
import { formatVenezuelanCedulaDisplay } from "@/lib/validators/auth";
import {
  OFFICIAL_DOCUMENT_TYPE_LABELS,
  STUDENT_REQUEST_LABELS,
  STUDENT_REQUEST_STATUS_LABELS,
  STUDENT_REQUEST_TYPES,
  studentRequestCreateSchema,
  type StudentRequestStatus,
  type StudentRequestType,
} from "@/lib/validators/student-portal";

export interface StudentTramitesViewProps {
  profile: DashboardUserProfile;
  initialData: StudentTramitesData;
  /** Cuando se renderiza dentro de una pestaña de `/estudiante`, omite el encabezado independiente. */
  embedded?: boolean;
  /** Muestra enlace "Volver al inicio estudiantil" cuando no se accede desde el sidebar principal. */
  showBackLink?: boolean;
  /** Preselección opcional de trámite al navegar desde una asignatura. */
  initialRequestType?: StudentRequestType;
  /** Detalle prellenado opcional cuando proviene de una revisión de asignatura. */
  initialRequestReason?: string;
}

let tramitesRealtimeSeq = 0;

function formatCaracasDate(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "—";
  return new Intl.DateTimeFormat("es-VE", {
    timeZone: "America/Caracas",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(dt);
}

function getStatusBadgeVariant(
  status: StudentRequestStatus
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "approved" || status === "delivered") return "default";
  if (status === "rejected") return "destructive";
  if (status === "in_review") return "secondary";
  return "outline";
}

/**
 * Trámites Express del estudiante: creación idempotente, seguimiento en tiempo real
 * y descarga client-side de documentos oficiales en PDF con código QR.
 */
export function StudentTramitesView({
  profile,
  initialData,
  embedded = false,
  showBackLink = true,
  initialRequestType,
  initialRequestReason,
}: StudentTramitesViewProps) {
  const router = useRouter();
  const [requests, setRequests] = React.useState<StudentRequestItem[]>(
    initialData.requests
  );
  const officialDocs = initialData.officialDocuments;

  React.useEffect(() => {
    setRequests(initialData.requests);
  }, [initialData.requests]);

  const [requestType, setRequestType] = React.useState<StudentRequestType>(
    () => initialRequestType ?? "constancia_estudio"
  );
  const [reason, setReason] = React.useState(() => initialRequestReason ?? "");

  React.useEffect(() => {
    if (initialRequestType) {
      setRequestType(initialRequestType);
    }
    if (initialRequestReason !== undefined) {
      setReason(initialRequestReason);
    }
  }, [initialRequestReason, initialRequestType]);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const [cancelTarget, setCancelTarget] =
    React.useState<StudentRequestItem | null>(null);
  const [cancelling, setCancelling] = React.useState(false);
  const [downloadingDocId, setDownloadingDocId] = React.useState<string | null>(
    null
  );

  const submitLockRef = React.useRef(false);
  const cancelLockRef = React.useRef(false);
  const downloadLockRef = React.useRef(false);
  const pendingClientRequestIdRef = React.useRef<string | null>(null);

  // Suscripción en tiempo real a `student_requests` del estudiante autenticado
  React.useEffect(() => {
    const supabase = getBrowserSupabaseClient();
    if (!supabase) return;

    const topic = `siga-student-requests-${++tramitesRealtimeSeq}`;
    const channel = supabase
      .channel(topic)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "student_requests",
          filter: `student_user_id=eq.${profile.internalUserId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const deletedId = (payload.old as { id?: string } | null)?.id;
            if (deletedId) {
              setRequests((prev) => prev.filter((item) => item.id !== deletedId));
            }
            return;
          }

          const row = payload.new as {
            id?: string;
            request_type?: StudentRequestType;
            reason?: string | null;
            status?: StudentRequestStatus;
            sla_entered_at?: string;
            resolved_at?: string | null;
            official_document_id?: string | null;
            created_at?: string;
            updated_at?: string;
          } | null;

          if (!row?.id || !row.request_type || !row.status) return;

          const mapped: StudentRequestItem = {
            id: row.id,
            requestType: row.request_type,
            reason: row.reason ?? null,
            status: row.status,
            slaEnteredAt: row.sla_entered_at ?? new Date().toISOString(),
            resolvedAt: row.resolved_at ?? null,
            officialDocumentId: row.official_document_id ?? null,
            createdAt: row.created_at ?? new Date().toISOString(),
            updatedAt: row.updated_at ?? new Date().toISOString(),
          };

          setRequests((prev) => {
            const idx = prev.findIndex((item) => item.id === mapped.id);
            if (idx === -1) return [mapped, ...prev];
            const copy = [...prev];
            copy[idx] = mapped;
            return copy;
          });

          if (
            mapped.officialDocumentId ||
            mapped.status === "approved" ||
            mapped.status === "delivered"
          ) {
            router.refresh();
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [profile.internalUserId, router]);

  const handleCreateRequest = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitLockRef.current) return;

    const clientRequestId =
      pendingClientRequestIdRef.current ?? crypto.randomUUID();
    pendingClientRequestIdRef.current = clientRequestId;

    const parsed = studentRequestCreateSchema.safeParse({
      requestType,
      reason: reason.trim() || undefined,
      clientRequestId,
    });

    if (!parsed.success) {
      setFormError(
        parsed.error.issues[0]?.message ?? "Verifica los campos del trámite."
      );
      return;
    }

    submitLockRef.current = true;
    setFormError(null);
    setSubmitting(true);

    try {
      const result = await createStudentRequestAction(parsed.data);
      if (!result.ok) {
        setFormError(result.message);
        toast.error(result.message);
        return;
      }

      pendingClientRequestIdRef.current = null;
      const nowIso = new Date().toISOString();
      const newReq: StudentRequestItem = {
        id: result.data.requestId || clientRequestId,
        requestType: parsed.data.requestType,
        reason: parsed.data.reason ?? null,
        status: "pending",
        slaEnteredAt: nowIso,
        resolvedAt: null,
        officialDocumentId: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      setRequests((prev) =>
        prev.some((r) => r.id === newReq.id) ? prev : [newReq, ...prev]
      );
      setReason("");
      toast.success("Solicitud registrada en Secretaría.");
    } finally {
      setSubmitting(false);
      submitLockRef.current = false;
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelTarget || cancelLockRef.current) return;
    cancelLockRef.current = true;
    setCancelling(true);

    try {
      const result = await cancelStudentRequestAction(cancelTarget.id);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setRequests((prev) => prev.filter((item) => item.id !== cancelTarget.id));
      setCancelTarget(null);
      toast.success("Solicitud pendiente cancelada.");
    } finally {
      setCancelling(false);
      cancelLockRef.current = false;
    }
  };

  const handleDownloadPdf = async (doc: StudentOfficialDocumentItem) => {
    if (downloadLockRef.current) return;
    downloadLockRef.current = true;
    setDownloadingDocId(doc.id);

    try {
      const { downloadOfficialDocumentPdf } = await import(
        "@/components/pdf/OfficialDocumentPdf"
      );
      await downloadOfficialDocumentPdf(doc, {
        fullName: `${profile.firstName} ${profile.lastName}`,
        cedulaDisplay: formatVenezuelanCedulaDisplay(profile.cedula),
        institutionalEmail: profile.institutionalEmail,
        mencionName: initialData.enrollment?.mencionName ?? null,
        gradeYear: initialData.enrollment?.gradeYear ?? null,
        sectionLetter: initialData.enrollment?.sectionLetter ?? null,
        schoolYearName: initialData.enrollment?.schoolYearName ?? null,
      });
      toast.success("Documento PDF generado en tu navegador.");
    } catch {
      toast.error("No se pudo generar el archivo PDF en este momento.");
    } finally {
      setDownloadingDocId(null);
      downloadLockRef.current = false;
    }
  };

  const enrollment = initialData.enrollment;
  const activeTypePending = requests.some(
    (r) =>
      r.requestType === requestType &&
      (r.status === "pending" || r.status === "in_review")
  );

  return (
    <div className="font-hero flex flex-col gap-5 pb-8">
      {embedded ? (
        <div className="siga-glass-surface flex flex-col justify-between gap-3 rounded-[28px] border p-5 sm:flex-row sm:items-center sm:p-6">
          <div>
            <h2 className="text-base leading-snug font-semibold tracking-[-0.02em] text-foreground">
              Trámites Express y Constancias
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Solicita constancias o revisiones a Control de Estudios y descarga
              tus PDFs oficiales verificables con QR.
            </p>
          </div>

          {enrollment ? (
            <Badge variant="secondary" className="w-fit rounded-full px-3 py-1">
              {enrollment.gradeYear}.º Año ·{" "}
              {enrollment.mencionName ?? "Mención"} · Sec.{" "}
              {enrollment.sectionLetter ?? "—"}
            </Badge>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            {showBackLink ? (
              <Link
                href="/estudiante"
                className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeft className="size-3.5" aria-hidden="true" />
                Volver al inicio estudiantil
              </Link>
            ) : null}
            <h1 className="text-[1.75rem] leading-tight font-normal tracking-[-0.03em] text-foreground sm:text-[2.15rem]">
              Trámites Express y Constancias
            </h1>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Solicita constancias o revisiones a Control de Estudios y descarga
              tus PDFs oficiales verificables con QR.
            </p>
          </div>

          {enrollment ? (
            <Badge variant="secondary" className="w-fit rounded-full px-3 py-1">
              {enrollment.gradeYear}.º Año ·{" "}
              {enrollment.mencionName ?? "Mención"} · Sec.{" "}
              {enrollment.sectionLetter ?? "—"}
            </Badge>
          ) : null}
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
        {/* Columna izquierda: Nueva Solicitud */}
        <Card className="siga-glass-surface rounded-[28px] lg:col-span-5">
          <CardHeader>
            <CardTitle className="text-base">Nueva Solicitud</CardTitle>
            <CardDescription>
              Envía tu requerimiento directo a la cola de Secretaría sin hacer
              filas presenciales.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateRequest} noValidate>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="request-type-select">
                    Tipo de trámite
                  </FieldLabel>
                  <Select
                    value={requestType}
                    onValueChange={(val) => {
                      setRequestType(val as StudentRequestType);
                      setFormError(null);
                    }}
                  >
                    <SelectTrigger
                      id="request-type-select"
                      className="siga-glass-inner w-full rounded-xl"
                    >
                      <SelectValue placeholder="Selecciona un trámite" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {STUDENT_REQUEST_TYPES.map((typeKey) => (
                          <SelectItem key={typeKey} value={typeKey}>
                            {STUDENT_REQUEST_LABELS[typeKey]}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>

                <Field data-invalid={Boolean(formError) || undefined}>
                  <FieldLabel htmlFor="request-reason-input">
                    Detalle o justificación{" "}
                    {requestType === "revision_notas"
                      ? "(obligatorio)"
                      : "(opcional)"}
                  </FieldLabel>
                  <Textarea
                    id="request-reason-input"
                    rows={4}
                    value={reason}
                    onChange={(e) => {
                      setReason(e.target.value);
                      if (formError) setFormError(null);
                    }}
                    placeholder={
                      requestType === "revision_notas"
                        ? "Indica asignatura, momento pedagógico y evaluación a revisar..."
                        : "Ej. Requerida para trámite de beca o pasantías..."
                    }
                    aria-invalid={Boolean(formError) || undefined}
                    className="siga-glass-inner rounded-xl"
                  />
                  <FieldDescription>
                    {activeTypePending
                      ? "Ya tienes una solicitud activa en proceso de este mismo tipo."
                      : "Máximo 600 caracteres."}
                  </FieldDescription>
                  {formError ? <FieldError>{formError}</FieldError> : null}
                </Field>

                <Button
                  type="submit"
                  disabled={submitting || activeTypePending || !enrollment}
                  className="w-full rounded-xl"
                >
                  {submitting ? (
                    <>
                      <Spinner data-icon="inline-start" />
                      Enviando solicitud...
                    </>
                  ) : !enrollment ? (
                    "Requiere matrícula activa"
                  ) : activeTypePending ? (
                    "Solicitud ya en curso"
                  ) : (
                    <>
                      <Send data-icon="inline-start" />
                      Enviar solicitud a Secretaría
                    </>
                  )}
                </Button>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>

        {/* Columna derecha: Seguimiento en tiempo real + Documentos Emitidos */}
        <div className="flex flex-col gap-5 lg:col-span-7">
          {/* Documentos Oficiales Emitidos (`official_documents`) */}
          <Card className="siga-glass-surface rounded-[28px]">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base">
                    Documentos Oficiales Listos para Descargar
                  </CardTitle>
                  <CardDescription>
                    PDFs generados en tu navegador con código QR anti-forjamiento
                    verificable en el portal público de validación.
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="tabular-nums">
                  {officialDocs.length} emitido(s)
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {officialDocs.length === 0 ? (
                <Empty className="siga-glass-inner rounded-2xl border border-dashed py-8">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <FileCheck2 aria-hidden="true" />
                    </EmptyMedia>
                    <EmptyTitle className="text-base">
                      Sin documentos oficiales emitidos todavía
                    </EmptyTitle>
                    <EmptyDescription>
                      Cuando Control de Estudios apruebe una constancia,
                      solvencia o boletín, aparecerá aquí listo para descargar
                      en PDF.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {officialDocs.map((doc) => {
                    const isDownloading = downloadingDocId === doc.id;
                    const docLabel =
                      OFFICIAL_DOCUMENT_TYPE_LABELS[doc.documentType] ??
                      doc.documentType;

                    return (
                      <div
                        key={doc.id}
                        className="siga-glass-inner flex flex-col justify-between gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-foreground">
                              {docLabel}
                            </span>
                            <Badge
                              variant={
                                doc.status === "valid"
                                  ? "default"
                                  : "destructive"
                              }
                            >
                              {doc.status === "valid" ? "Válido" : "Revocado"}
                            </Badge>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Código:{" "}
                            <span className="font-mono font-medium text-foreground">
                              {doc.verificationCode}
                            </span>{" "}
                            · Emitido el {formatCaracasDate(doc.issuedAt)}
                          </p>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <Button asChild size="sm" variant="outline">
                            <Link
                              href={`/verificar?code=${encodeURIComponent(doc.verificationCode)}`}
                              target="_blank"
                            >
                              <ExternalLink data-icon="inline-start" />
                              Verificar
                            </Link>
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            disabled={isDownloading}
                            onClick={() => void handleDownloadPdf(doc)}
                          >
                            {isDownloading ? (
                              <>
                                <Spinner data-icon="inline-start" />
                                Generando...
                              </>
                            ) : (
                              <>
                                <Download data-icon="inline-start" />
                                PDF
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Historial de Solicitudes */}
          <Card className="siga-glass-surface rounded-[28px]">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base">
                    Seguimiento de Solicitudes
                  </CardTitle>
                  <CardDescription>
                    Actualización en tiempo real del estado de tus trámites.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="tabular-nums">
                  {requests.length} registro(s)
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {requests.length === 0 ? (
                <Empty className="siga-glass-inner rounded-2xl border border-dashed py-8">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <FileText aria-hidden="true" />
                    </EmptyMedia>
                    <EmptyTitle className="text-base">
                      No has enviado solicitudes aún
                    </EmptyTitle>
                    <EmptyDescription>
                      Usa el formulario de la izquierda para solicitar tu
                      constancia de estudio, inscripción o solvencia.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {requests.map((req) => (
                    <div
                      key={req.id}
                      className="siga-glass-inner flex flex-col justify-between gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold text-foreground sm:text-sm">
                            {STUDENT_REQUEST_LABELS[req.requestType] ??
                              req.requestType}
                          </span>
                          <Badge variant={getStatusBadgeVariant(req.status)}>
                            {req.status === "approved" ||
                            req.status === "delivered" ? (
                              <CheckCircle2
                                data-icon="inline-start"
                                aria-hidden="true"
                              />
                            ) : (
                              <Clock
                                data-icon="inline-start"
                                aria-hidden="true"
                              />
                            )}
                            {STUDENT_REQUEST_STATUS_LABELS[req.status] ??
                              req.status}
                          </Badge>
                        </div>

                        {req.reason ? (
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            {req.reason}
                          </p>
                        ) : null}

                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Ingresada el {formatCaracasDate(req.createdAt)}
                        </p>
                      </div>

                      {req.status === "pending" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setCancelTarget(req)}
                          className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 data-icon="inline-start" />
                          Cancelar
                        </Button>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Confirmación de cancelación */}
      <Dialog
        open={Boolean(cancelTarget)}
        onOpenChange={(open) => {
          if (!open && !cancelling) setCancelTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar solicitud pendiente</DialogTitle>
            <DialogDescription>
              ¿Seguro que deseas retirar tu solicitud de{" "}
              <strong>
                {cancelTarget
                  ? STUDENT_REQUEST_LABELS[cancelTarget.requestType]
                  : ""}
              </strong>
              ? Esta acción solo aplica mientras no haya entrado en revisión.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={cancelling}
              onClick={() => setCancelTarget(null)}
            >
              Volver
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={cancelling}
              onClick={() => void handleConfirmCancel()}
            >
              {cancelling ? (
                <>
                  <Spinner data-icon="inline-start" />
                  Cancelando...
                </>
              ) : (
                "Sí, cancelar solicitud"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

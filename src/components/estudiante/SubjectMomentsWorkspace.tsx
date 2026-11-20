"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertCircle,
  CalendarClock,
  FileCheck2,
  MessageSquareQuote,
} from "lucide-react";
import { StudentGradeSimulator } from "@/components/estudiante/StudentGradeSimulator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  EVALUATION_SOURCE_LABELS,
  EVALUATION_TYPE_LABELS,
  MOMENT_PERIOD_STATUS_LABELS,
  MOMENT_PLAN_STATUS_LABELS,
} from "@/features/estudiante/curriculum-tracks";
import type {
  SubjectEvaluationItemDetail,
  SubjectMomentDetail,
} from "@/features/estudiante/subjects-data";
import type { DashboardUserProfile } from "@/lib/supabase/dashboard-session";

export interface SubjectMomentsWorkspaceProps {
  accessTier: DashboardUserProfile["accessTier"];
  schoolYearName: string | null;
  subjectCode: string;
  subjectName: string;
  gradingScale: "NUMERIC_1_20" | "LITERAL_A_E";
  activeMomentNumber: number | null;
  moments: SubjectMomentDetail[];
  /** En modo compacto (desplegable), el simulador y la comparativa anual siguen disponibles sin recargar página. */
  showReviewAction?: boolean;
}

function formatLongDate(iso: string | null): string {
  if (!iso) return "Por definir";
  const dt = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(dt.getTime())) return iso;
  return new Intl.DateTimeFormat("es-VE", {
    timeZone: "America/Caracas",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(dt);
}

function renderItemStatusBadge(status: SubjectEvaluationItemDetail["itemStatus"]) {
  if (status === "graded") {
    return (
      <Badge className="border-emerald-500/35 bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300">
        Calificada
      </Badge>
    );
  }
  if (status === "overdue") {
    return (
      <Badge
        variant="outline"
        className="border-amber-500/40 text-amber-700 dark:text-amber-300"
      >
        Pendiente de carga
      </Badge>
    );
  }
  return <Badge variant="secondary">Programada</Badge>;
}

/**
 * Espacio reutilizable de evaluaciones por Momento Pedagógico (I, II, III y Anual)
 * más mini-simulador MPPE integrado. Usado tanto en tarjetas desplegables como
 * en el expediente completo por asignatura.
 */
export function SubjectMomentsWorkspace({
  accessTier,
  schoolYearName,
  subjectCode,
  subjectName,
  gradingScale,
  activeMomentNumber,
  moments,
  showReviewAction = true,
}: SubjectMomentsWorkspaceProps) {
  const defaultTab = React.useMemo(() => {
    if (moments.length === 0) return "anual";
    const preferred = activeMomentNumber ?? moments[0]?.momentNumber ?? 1;
    return `m-${preferred}`;
  }, [activeMomentNumber, moments]);

  const reviewRequestHref = React.useMemo(() => {
    const params = new URLSearchParams({
      requestType: "revision_notas",
      subject: `${subjectName} (${subjectCode})`,
    });
    return `/estudiante/tramites?${params.toString()}`;
  }, [subjectCode, subjectName]);

  if (accessTier === "provisional_cedula") {
    return (
      <Alert className="siga-glass-inner rounded-2xl border-amber-500/40 bg-amber-500/10">
        <AlertCircle
          className="text-amber-600 dark:text-amber-300"
          aria-hidden="true"
        />
        <AlertTitle>Vista previa curricular (acceso provisional)</AlertTitle>
        <AlertDescription>
          <p>
            Las evaluaciones detalladas, calificaciones y el simulador se
            desbloquearán automáticamente al vincular tu correo institucional{" "}
            <strong>@etcandresbello.org</strong>.
          </p>
        </AlertDescription>
      </Alert>
    );
  }

  if (moments.length === 0) {
    return (
      <Empty className="siga-glass-inner rounded-2xl border border-dashed py-6">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CalendarClock aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle className="text-base">
            Sin momentos pedagógicos configurados aún
          </EmptyTitle>
          <EmptyDescription>
            Cuando Control de Estudios active los cortes del período escolar
            vigente, verás aquí cada evaluación y tu progreso.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <Tabs defaultValue={defaultTab} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <TabsList className="siga-glass-inner h-auto w-full justify-start gap-1 overflow-x-auto rounded-xl border p-1 sm:w-fit">
          {moments.map((m) => (
            <TabsTrigger
              key={m.momentoId}
              value={`m-${m.momentNumber}`}
              className="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium"
            >
              {m.momentName}
              {m.momentNumber === activeMomentNumber ? (
                <span
                  className="ml-1.5 inline-block size-1.5 rounded-full bg-primary dark:bg-sky-300"
                  aria-hidden="true"
                />
              ) : null}
            </TabsTrigger>
          ))}
          <TabsTrigger
            value="anual"
            className="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium"
          >
            Resumen Anual
          </TabsTrigger>
        </TabsList>

        {showReviewAction ? (
          <Button asChild size="sm" variant="outline" className="rounded-xl">
            <Link href={reviewRequestHref}>
              <FileCheck2 data-icon="inline-start" />
              Solicitar revisión de nota
            </Link>
          </Button>
        ) : null}
      </div>

      {moments.map((mom) => (
        <TabsContent
          key={mom.momentoId}
          value={`m-${mom.momentNumber}`}
          className="space-y-4"
        >
          <div className="siga-glass-inner space-y-4 rounded-2xl border p-4 sm:p-5">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground sm:text-base">
                    {mom.planTitle ?? `Evaluaciones · ${mom.momentName}`}
                  </h3>
                  <Badge variant="outline" className="text-[10.5px]">
                    {MOMENT_PERIOD_STATUS_LABELS[mom.momentStatus] ??
                      mom.momentStatus}
                  </Badge>
                  {mom.planStatus ? (
                    <Badge variant="secondary" className="text-[10.5px]">
                      {MOMENT_PLAN_STATUS_LABELS[mom.planStatus] ??
                        mom.planStatus}
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Progreso ponderado evaluado:{" "}
                  <strong className="font-semibold text-foreground tabular-nums">
                    {mom.evaluatedWeight}%
                  </strong>{" "}
                  de {mom.totalWeight || 100}% configurado.
                </p>
              </div>

              {mom.finalGrade ? (
                <div className="flex items-center gap-2.5 rounded-xl border border-border/70 bg-background/60 px-3.5 py-2">
                  <div>
                    <span className="block text-[10.5px] text-muted-foreground">
                      {mom.finalGrade.isLocked
                        ? "Definitiva cerrada"
                        : "Definitiva actual"}
                    </span>
                    <span className="text-sm font-semibold text-foreground tabular-nums sm:text-base">
                      {mom.finalGrade.finalNumeric !== null
                        ? `${mom.finalGrade.finalNumeric} / 20 pts`
                        : mom.finalGrade.finalLiteral
                          ? `Literal ${mom.finalGrade.finalLiteral}`
                          : "—"}
                    </span>
                  </div>
                  {mom.finalGrade.rawWeightedAvg !== null ? (
                    <Badge variant="outline" className="tabular-nums">
                      Bruto: {mom.finalGrade.rawWeightedAvg.toFixed(2)}
                    </Badge>
                  ) : null}
                </div>
              ) : null}
            </div>

            <Progress
              value={mom.evaluatedWeight}
              aria-label={`Avance ponderado de ${mom.momentName}: ${mom.evaluatedWeight}%`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={mom.evaluatedWeight}
              className="h-1.5"
            />

            {mom.finalGrade?.qualitativeObservation ? (
              <Alert className="rounded-xl border-primary/25 bg-primary/5">
                <MessageSquareQuote
                  className="text-primary dark:text-sky-300"
                  aria-hidden="true"
                />
                <AlertTitle>Observación del docente</AlertTitle>
                <AlertDescription>
                  <p>{mom.finalGrade.qualitativeObservation}</p>
                </AlertDescription>
              </Alert>
            ) : null}

            {mom.items.length === 0 ? (
              <p className="rounded-xl border border-dashed px-4 py-5 text-center text-xs text-muted-foreground">
                Tu docente aún no ha publicado el plan de evaluación ponderado
                para {mom.momentName}.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border/70 bg-background/45">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Evaluación</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead className="text-right">Peso</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Nota</TableHead>
                      <TableHead className="text-right">Aporte</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mom.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="whitespace-normal">
                          <div className="font-medium text-foreground">
                            {item.title}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                            <span>
                              {EVALUATION_TYPE_LABELS[item.evaluationType] ??
                                item.evaluationType}
                            </span>
                            {item.source ? (
                              <span>
                                ·{" "}
                                {EVALUATION_SOURCE_LABELS[item.source] ??
                                  item.source}
                              </span>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground tabular-nums">
                          {formatLongDate(item.scheduledDate)}
                        </TableCell>
                        <TableCell className="text-right text-xs font-medium tabular-nums">
                          {item.weightPercent}%
                        </TableCell>
                        <TableCell>
                          {renderItemStatusBadge(item.itemStatus)}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-foreground tabular-nums">
                          {item.numericScore !== null
                            ? `${item.numericScore.toFixed(1)} / ${item.maxPoints}`
                            : item.literalGrade
                              ? `Literal ${item.literalGrade}`
                              : "—"}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-primary tabular-nums dark:text-sky-300">
                          {item.weightedContribution !== null
                            ? `+${item.weightedContribution.toFixed(2)}`
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {gradingScale === "NUMERIC_1_20" ? (
            <StudentGradeSimulator
              simulatorSubjects={[mom.simulatorInput]}
              pendingSubjects={[]}
              activeMomentName={mom.momentName}
              embeddedSingleSubject
            />
          ) : null}
        </TabsContent>
      ))}

      <TabsContent value="anual" className="space-y-4">
        <div className="siga-glass-inner space-y-3 rounded-2xl border p-4 sm:p-5">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Comparativa de los 3 Momentos Pedagógicos
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Evolución oficial registrada durante el período{" "}
              {schoolYearName ?? "vigente"}.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {moments.map((m) => {
              const fg = m.finalGrade;
              return (
                <div
                  key={m.momentoId}
                  className="flex flex-col justify-between gap-2 rounded-xl border border-border/70 bg-background/55 p-3.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-foreground">
                      {m.momentName}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {MOMENT_PERIOD_STATUS_LABELS[m.momentStatus] ??
                        m.momentStatus}
                    </Badge>
                  </div>
                  <p className="font-kpi-num text-2xl font-light text-foreground tabular-nums">
                    {fg?.finalNumeric !== null && fg?.finalNumeric !== undefined
                      ? `${fg.finalNumeric} pts`
                      : fg?.finalLiteral
                        ? `Literal ${fg.finalLiteral}`
                        : "—"}
                  </p>
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    {m.evaluatedWeight}% evaluado ({m.items.length} ítems)
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}

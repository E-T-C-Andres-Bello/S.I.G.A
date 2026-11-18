"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  Calculator,
  CheckCircle2,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { cn } from "cn";
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
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PendingSubjectAttemptSummary } from "@/features/estudiante/dashboard-data";
import { EVALUATION_TYPE_LABELS } from "@/features/estudiante/curriculum-tracks";
import {
  analyzeSubjectSimulation,
  simulateSubjectWhatIf,
  type SubjectSimulatorInput,
} from "@/features/estudiante/grade-simulator";

export interface StudentGradeSimulatorProps {
  simulatorSubjects: SubjectSimulatorInput[];
  pendingSubjects: PendingSubjectAttemptSummary[];
  activeMomentName: string | null;
  /** Cuando se embebe dentro de `/estudiante/asignaturas/[codigo]`, oculta el selector global y bloques inferiores. */
  embeddedSingleSubject?: boolean;
}

/**
 * Simulador matemático "¿Cuánto necesito para aprobar?" basado exclusivamente
 * en ítems reales de `evaluation_items` y `student_scores` bajo escala MPPE.
 */
export function StudentGradeSimulator({
  simulatorSubjects,
  pendingSubjects,
  activeMomentName,
  embeddedSingleSubject = false,
}: StudentGradeSimulatorProps) {
  const numericSubjects = React.useMemo(
    () => simulatorSubjects.filter((s) => s.gradingScale === "NUMERIC_1_20"),
    [simulatorSubjects]
  );
  const literalSubjects = React.useMemo(
    () => simulatorSubjects.filter((s) => s.gradingScale === "LITERAL_A_E"),
    [simulatorSubjects]
  );

  const [selectedSubjectId, setSelectedSubjectId] = React.useState<string>(
    () => numericSubjects[0]?.curriculumSubjectId ?? ""
  );
  const [hypotheticalScores, setHypotheticalScores] = React.useState<
    Record<string, number>
  >({});

  React.useEffect(() => {
    if (
      numericSubjects.length > 0 &&
      !numericSubjects.some((s) => s.curriculumSubjectId === selectedSubjectId)
    ) {
      setSelectedSubjectId(numericSubjects[0]!.curriculumSubjectId);
    }
  }, [numericSubjects, selectedSubjectId]);

  const selectedSubject = React.useMemo(
    () =>
      numericSubjects.find((s) => s.curriculumSubjectId === selectedSubjectId) ??
      numericSubjects[0] ??
      null,
    [numericSubjects, selectedSubjectId]
  );

  const analysis = React.useMemo(
    () => (selectedSubject ? analyzeSubjectSimulation(selectedSubject) : null),
    [selectedSubject]
  );

  const whatIf = React.useMemo(
    () =>
      selectedSubject
        ? simulateSubjectWhatIf(
            selectedSubject.items,
            hypotheticalScores,
            selectedSubject.passingThreshold
          )
        : null,
    [hypotheticalScores, selectedSubject]
  );

  const handleApplyMinimumNeeded = () => {
    if (!selectedSubject || !analysis || analysis.requiredUniformScore === null) {
      return;
    }
    const clampedTarget = Math.min(
      20,
      Math.max(0, Math.ceil(analysis.requiredUniformScore * 2) / 2)
    );
    setHypotheticalScores((prev) => {
      const next = { ...prev };
      for (const item of selectedSubject.items) {
        if (item.recordedScore === null) {
          next[item.id] = clampedTarget;
        }
      }
      return next;
    });
  };

  const handleResetSimulation = () => {
    if (!selectedSubject) return;
    setHypotheticalScores((prev) => {
      const next = { ...prev };
      for (const item of selectedSubject.items) {
        delete next[item.id];
      }
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <section
        aria-label="Simulador de calificaciones MPPE"
        className="siga-glass-surface rounded-[28px] border p-5 sm:p-6"
      >
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-base leading-snug font-semibold tracking-[-0.02em] text-foreground">
              Simulador: &ldquo;¿Cuánto necesito para aprobar?&rdquo;
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Proyección matemática sobre planes publicados en{" "}
              {activeMomentName ?? "el momento activo"} (escala MPPE 1–20).
            </p>
          </div>

          {!embeddedSingleSubject && numericSubjects.length > 0 && selectedSubject ? (
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-full sm:w-64">
                <Select
                  value={selectedSubject.curriculumSubjectId}
                  onValueChange={setSelectedSubjectId}
                >
                  <SelectTrigger
                    aria-label="Seleccionar asignatura para simular"
                    className="siga-glass-inner w-full rounded-xl"
                  >
                    <SelectValue placeholder="Selecciona una asignatura" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {numericSubjects.map((subj) => (
                        <SelectItem
                          key={subj.curriculumSubjectId}
                          value={subj.curriculumSubjectId}
                        >
                          {subj.subjectName} ({subj.subjectCode})
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="rounded-xl"
              >
                <Link
                  href={`/estudiante/asignaturas/${encodeURIComponent(selectedSubject.subjectCode)}`}
                >
                  <span>Expediente</span>
                  <ArrowUpRight data-icon="inline-end" />
                </Link>
              </Button>
            </div>
          ) : null}
        </div>

        {numericSubjects.length === 0 || !selectedSubject || !analysis ? (
          <Empty className="siga-glass-inner mt-5 rounded-2xl border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Calculator aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle className="text-base">
                Sin asignaturas numéricas disponibles
              </EmptyTitle>
              <EmptyDescription>
                Cuando Control de Estudios active tu matrícula y malla curricular
                del año escolar vigente, podrás proyectar aquí tus evaluaciones.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : analysis.status === "no_plan" ? (
          <Empty className="siga-glass-inner mt-5 rounded-2xl border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Calculator aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle className="text-base">
                Plan de evaluación aún no publicado
              </EmptyTitle>
              <EmptyDescription>
                <p>
                  El docente de <strong>{selectedSubject.subjectName}</strong>{" "}
                  aún no ha publicado el plan ponderado (100%) para este momento.
                </p>
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="mt-5 flex flex-col gap-5">
            {/* Resumen matemático de la asignatura */}
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
              <div className="siga-glass-inner flex flex-col justify-between rounded-2xl border p-4">
                <span className="text-xs font-medium text-muted-foreground">
                  Acumulado ponderado real
                </span>
                <div className="mt-2.5 flex items-baseline gap-1.5">
                  <span className="text-[1.75rem] leading-none font-semibold tracking-tight text-foreground tabular-nums">
                    {analysis.earnedWeightedPoints.toFixed(2)}
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">
                    / 20 pts
                  </span>
                </div>
                <span className="mt-2 block text-[11.5px] text-muted-foreground">
                  {analysis.evaluatedWeight}% del plan evaluado
                </span>
              </div>

              <div className="siga-glass-inner flex flex-col justify-between rounded-2xl border p-4">
                <span className="text-xs font-medium text-muted-foreground">
                  Mínimo en pendientes
                </span>
                <div className="mt-2.5 flex items-baseline gap-1.5">
                  <span className="text-[1.75rem] leading-none font-semibold tracking-tight text-foreground tabular-nums">
                    {analysis.requiredUniformScore !== null
                      ? analysis.requiredUniformScore.toFixed(1)
                      : "—"}
                  </span>
                  {analysis.requiredUniformScore !== null ? (
                    <span className="text-xs font-medium text-muted-foreground">
                      / 20 pts
                    </span>
                  ) : null}
                </div>
                <span className="mt-2 block text-[11.5px] text-muted-foreground">
                  {analysis.pendingWeight > 0
                    ? `En el ${analysis.pendingWeight}% restante`
                    : "Plan evaluado al 100%"}
                </span>
              </div>

              <div className="siga-glass-inner flex flex-col justify-between rounded-2xl border p-4">
                <span className="text-xs font-medium text-muted-foreground">
                  Máximo alcanzable
                </span>
                <div className="mt-2.5 flex items-baseline gap-1.5">
                  <span className="text-[1.75rem] leading-none font-semibold tracking-tight text-foreground tabular-nums">
                    {analysis.maxPossibleWeightedAvg.toFixed(1)}
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">
                    / 20 pts
                  </span>
                </div>
                <span className="mt-2 block text-[11.5px] text-muted-foreground">
                  Meta aprobatoria: {analysis.passingThreshold} pts
                </span>
              </div>

              <div className="siga-glass-hero flex flex-col justify-between rounded-2xl border p-4 text-white">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-sky-100/90">
                    Proyección simulada
                  </span>
                  <Badge
                    className={cn(
                      "shrink-0 border text-[11px] font-semibold",
                      whatIf?.willApprove
                        ? "border-emerald-300/35 bg-emerald-500/90 text-white hover:bg-emerald-500"
                        : "border-white/25 bg-white/15 text-white hover:bg-white/20"
                    )}
                  >
                    {whatIf?.willApprove ? "Aprueba" : "En riesgo"}
                  </Badge>
                </div>

                <div className="mt-2.5 flex items-baseline gap-1.5">
                  <span className="text-[1.75rem] leading-none font-semibold tracking-tight text-white tabular-nums">
                    {whatIf ? whatIf.projectedMppeFinal : "—"}
                  </span>
                  <span className="text-xs font-medium text-sky-100/80">
                    / 20 pts
                  </span>
                </div>

                <div className="mt-2.5 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-sky-100/85 tabular-nums">
                    <span>Cálculo exacto</span>
                    <span>
                      {whatIf ? whatIf.projectedRawAvg.toFixed(2) : "0.00"} pts
                    </span>
                  </div>
                  <Progress
                    value={whatIf ? (whatIf.projectedRawAvg / 20) * 100 : 0}
                    aria-label="Proyección de calificación simulada"
                    className="h-2 bg-white/20 [&>[data-slot=progress-indicator]]:bg-sky-300"
                  />
                </div>
              </div>
            </div>

            {/* Diagnóstico claro del estado */}
            <SimulatorDiagnosticAlert
              status={analysis.status}
              requiredUniformScore={analysis.requiredUniformScore}
              maxPossible={analysis.maxPossibleWeightedAvg}
              passingThreshold={analysis.passingThreshold}
            />

            {/* Controles de simulación por ítem */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground">
                {selectedSubject.planTitle ?? "Plan de evaluación"} ·{" "}
                {selectedSubject.items.length} ítem(s) ponderado(s)
              </p>

              <div className="flex flex-wrap items-center gap-2">
                {analysis.status === "achievable" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={handleApplyMinimumNeeded}
                  >
                    <Sparkles data-icon="inline-start" />
                    Simular mínimo necesario
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleResetSimulation}
                >
                  <RotateCcw data-icon="inline-start" />
                  Reiniciar
                </Button>
              </div>
            </div>

            <div className="siga-glass-inner overflow-hidden rounded-2xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Evaluación</TableHead>
                    <TableHead className="text-right">Peso</TableHead>
                    <TableHead className="w-56">Nota (Real o Simulada)</TableHead>
                    <TableHead className="text-right">Aporte</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedSubject.items.map((item) => {
                    const isOfficial = item.recordedScore !== null;
                    const activeValue = isOfficial
                      ? item.recordedScore!
                      : (hypotheticalScores[item.id] ?? 0);
                    const contribution =
                      activeValue * (item.weightPercent / 100);

                    return (
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
                            {item.scheduledDate ? (
                              <span>· {item.scheduledDate}</span>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {item.weightPercent}%
                        </TableCell>
                        <TableCell className="min-w-60 py-3.5">
                          {isOfficial ? (
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="secondary"
                                className="font-medium tabular-nums"
                              >
                                Oficial: {item.recordedScore?.toFixed(1)} / 20
                              </Badge>
                              <span className="text-[11px] text-muted-foreground">
                                Nota fija
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3">
                              <Slider
                                min={0}
                                max={20}
                                step={0.5}
                                value={[activeValue]}
                                aria-label={`Simular nota para ${item.title}`}
                                onValueChange={([val]) =>
                                  setHypotheticalScores((prev) => ({
                                    ...prev,
                                    [item.id]: val ?? 0,
                                  }))
                                }
                              />
                              <span className="w-13 shrink-0 rounded-md bg-primary/10 px-2 py-0.5 text-center text-xs font-semibold tabular-nums text-primary dark:text-[#7dd3fc]">
                                {activeValue.toFixed(1)}
                              </span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">
                          +{contribution.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </section>

      {/* Bloque informativo para escalas literales A–E y Materias Pendientes */}
      {!embeddedSingleSubject &&
      (literalSubjects.length > 0 || pendingSubjects.length > 0) && (
        <div
          className={cn(
            "grid grid-cols-1 gap-5",
            literalSubjects.length > 0 &&
              pendingSubjects.length > 0 &&
              "lg:grid-cols-2"
          )}
        >
          {literalSubjects.length > 0 ? (
            <section
              aria-label="Asignaturas con escala literal"
              className="siga-glass-surface rounded-[28px] border p-5 sm:p-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Asignaturas de Evaluación Literal (A–E)
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    No se promedian en escala numérica 1–20; aprueban con
                    literal A, B, C o D.
                  </p>
                </div>
                <Badge variant="secondary" className="text-[11px]">
                  Escala cualitativa MPPE
                </Badge>
              </div>
              <div
                className={cn(
                  "mt-4 grid grid-cols-1 gap-2.5",
                  pendingSubjects.length === 0 && "sm:grid-cols-2"
                )}
              >
                {literalSubjects.map((subj) => (
                  <Link
                    key={subj.curriculumSubjectId}
                    href={`/estudiante/asignaturas/${encodeURIComponent(subj.subjectCode)}`}
                    className="siga-glass-inner flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-xs transition-colors hover:border-primary/45 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none"
                  >
                    <span className="font-medium text-foreground">
                      {subj.subjectName}
                    </span>
                    <Badge variant="outline" className="shrink-0">
                      {subj.subjectCode}
                    </Badge>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {pendingSubjects.length > 0 ? (
            <section
              aria-label="Materias pendientes reglamentarias"
              className="siga-glass-surface rounded-[28px] border p-5 sm:p-6"
            >
              <h3 className="text-sm font-semibold text-foreground">
                Materias Pendientes (Hasta 4 Momentos)
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Seguimiento oficial de tus intentos registrados en Control de
                Estudios.
              </p>
              <div className="mt-3 flex flex-col gap-2">
                {pendingSubjects.map((attempt) => (
                  <div
                    key={attempt.id}
                    className="siga-glass-inner flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">
                        {attempt.subjectName}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Momento {attempt.attemptNumber}/4 · {attempt.examDate}
                      </p>
                    </div>
                    <Badge
                      variant={attempt.passed ? "default" : "destructive"}
                      className="tabular-nums"
                    >
                      {attempt.finalNumeric}/20 ·{" "}
                      {attempt.passed ? "Aprobada" : "Pendiente"}
                    </Badge>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}

function SimulatorDiagnosticAlert({
  status,
  requiredUniformScore,
  maxPossible,
  passingThreshold,
}: {
  status: string;
  requiredUniformScore: number | null;
  maxPossible: number;
  passingThreshold: number;
}) {
  if (status === "secured" || status === "completed_passed") {
    return (
      <Alert className="border-emerald-500/35 bg-emerald-500/10">
        <CheckCircle2
          className="text-emerald-600 dark:text-emerald-400"
          aria-hidden="true"
        />
        <AlertTitle>Meta aprobatoria asegurada</AlertTitle>
        <AlertDescription>
          <p>
            Con tus notas ya cargadas superas el mínimo aprobatorio de{" "}
            {passingThreshold} puntos.
          </p>
        </AlertDescription>
      </Alert>
    );
  }

  if (status === "unreachable" || status === "completed_failed") {
    return (
      <Alert variant="destructive">
        <AlertTriangle aria-hidden="true" />
        <AlertTitle>No alcanzable únicamente con evaluaciones pendientes</AlertTitle>
        <AlertDescription>
          <p>
            El puntaje máximo proyectable en este corte es{" "}
            <strong>{maxPossible.toFixed(2)} pts</strong>. Consulta con tu
            docente sobre actividades de nivelación o revisión formal.
          </p>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert className="siga-glass-inner rounded-2xl">
      <Calculator className="text-primary" aria-hidden="true" />
      <AlertTitle>
        Objetivo calculado para aprobar ({passingThreshold} pts)
      </AlertTitle>
      <AlertDescription>
        <p>
          Necesitas promediar al menos{" "}
          <strong className="font-semibold text-foreground">
            {requiredUniformScore?.toFixed(2) ?? "10.00"} / 20 pts
          </strong>{" "}
          en tus evaluaciones pendientes. Ajusta los deslizadores abajo para
          probar distintos escenarios.
        </p>
      </AlertDescription>
    </Alert>
  );
}

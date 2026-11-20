"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  AlertTriangle,
  ArrowUpRight,
  Award,
  BookOpenCheck,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  GraduationCap,
  History,
  Loader2,
  MapPin,
  Search,
  TrendingUp,
  UserCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { SigaAnalyticsBento } from "@/components/dashboard/SigaAnalyticsBento";
import { SubjectMomentsWorkspace } from "@/components/estudiante/SubjectMomentsWorkspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  formatPromedioDisplay,
  getHistorySubjectStatusLabel,
  type AcademicHistoryMomentValue,
  type AcademicHistorySubjectStatus,
} from "@/features/estudiante/academic-history";
import { formatCurriculumWorkload } from "@/features/estudiante/curriculum-tracks";
import type {
  EnrolledSubjectCardData,
  StudentCurriculumOverviewData,
} from "@/features/estudiante/subjects-data";

export interface StudentCurriculumHubViewProps {
  data: StudentCurriculumOverviewData;
  /** Subsección inicial (`asignaturas` | `mapa`). */
  initialSubsection?: "asignaturas" | "mapa";
}

const WEEKDAY_SHORT: Record<number, string> = {
  1: "Lun",
  2: "Mar",
  3: "Mié",
  4: "Jue",
  5: "Vie",
  6: "Sáb",
  7: "Dom",
};

const WEEKDAY_FULL: Record<number, string> = {
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
  6: "Sábado",
  7: "Domingo",
};

function formatCompactScheduleLabel(subject: EnrolledSubjectCardData): string {
  if (subject.scheduleBlocks.length === 0) {
    return formatCurriculumWorkload(subject.weeklyHours, subject.annualHours);
  }
  const first = subject.scheduleBlocks[0]!;
  const day = WEEKDAY_SHORT[first.dayOfWeek] ?? "Clase";
  const extraCount = subject.scheduleBlocks.length - 1;
  return extraCount > 0
    ? `${day} ${first.startTime}–${first.endTime} (+${extraCount})`
    : `${day} ${first.startTime}–${first.endTime}`;
}

function formatMomentCell(moment: AcademicHistoryMomentValue | null): string {
  if (!moment) return "—";
  if (moment.numeric !== null) return String(moment.numeric);
  if (moment.literal) return moment.literal;
  return "—";
}

function getHistoryStatusTone(status: AcademicHistorySubjectStatus): string {
  switch (status) {
    case "approved":
      return "border-emerald-500/35 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300";
    case "in_progress":
      return "border-primary/40 bg-primary/10 text-primary dark:border-sky-400/40 dark:bg-sky-400/15 dark:text-sky-200";
    case "needs_improvement":
      return "border-rose-500/35 bg-rose-500/12 text-rose-700 dark:text-rose-300";
    case "pending_recovery":
      return "border-amber-500/40 bg-amber-500/12 text-amber-700 dark:text-amber-300";
    default:
      return "border-border/70 bg-background/50 text-muted-foreground";
  }
}

/**
 * Vista principal de `/estudiante/asignaturas`:
 * - Subsección `Mis Asignaturas`: cuadrícula limpia de las materias del año en curso
 *   con detalle desplegable de evaluaciones, horario, asistencia y simulador.
 * - Subsección `Balance e Historial`: indicadores de promedio general, visualizaciones
 *   compactas del año actual e historial académico completo por período con descarga PDF.
 */
export function StudentCurriculumHubView({
  data,
  initialSubsection = "asignaturas",
}: StudentCurriculumHubViewProps) {
  const prefersReducedMotion = useReducedMotion();
  const detailPanelRef = React.useRef<HTMLElement | null>(null);

  const [subsection, setSubsection] = React.useState<"asignaturas" | "mapa">(
    initialSubsection
  );
  const [selectedSubjectCode, setSelectedSubjectCode] = React.useState<
    string | null
  >(() => data.enrolledSubjects[0]?.subjectCode ?? null);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [selectedEnrollmentId, setSelectedEnrollmentId] = React.useState<
    string | null
  >(() => data.academicHistory.periods[0]?.enrollmentId ?? null);
  const [exportingPdf, setExportingPdf] = React.useState(false);

  React.useEffect(() => {
    if (data.enrolledSubjects.length === 0) {
      setSelectedSubjectCode(null);
      return;
    }
    setSelectedSubjectCode((prev) =>
      prev && data.enrolledSubjects.some((s) => s.subjectCode === prev)
        ? prev
        : (data.enrolledSubjects[0]?.subjectCode ?? null)
    );
  }, [data.enrolledSubjects]);

  React.useEffect(() => {
    if (data.academicHistory.periods.length === 0) {
      setSelectedEnrollmentId(null);
      return;
    }
    setSelectedEnrollmentId((prev) =>
      prev && data.academicHistory.periods.some((p) => p.enrollmentId === prev)
        ? prev
        : (data.academicHistory.periods[0]?.enrollmentId ?? null)
    );
  }, [data.academicHistory.periods]);

  const handleSubsectionChange = React.useCallback((val: string) => {
    const next = val === "mapa" ? "mapa" : "asignaturas";
    setSubsection(next);
    try {
      const nextUrl = new URL(window.location.href);
      if (next === "mapa") {
        nextUrl.searchParams.set("vista", "historial");
      } else {
        nextUrl.searchParams.delete("vista");
      }
      window.history.replaceState(null, "", nextUrl.toString());
    } catch {
      // Ignorar si history API está restringida.
    }
  }, []);

  const filteredSubjects = React.useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return data.enrolledSubjects;
    return data.enrolledSubjects.filter(
      (subj) =>
        subj.subjectName.toLowerCase().includes(q) ||
        subj.subjectCode.toLowerCase().includes(q) ||
        (subj.teacherName ?? "").toLowerCase().includes(q)
    );
  }, [data.enrolledSubjects, searchTerm]);

  const selectedSubject = React.useMemo(
    () =>
      data.enrolledSubjects.find(
        (s) => s.subjectCode === selectedSubjectCode
      ) ?? null,
    [data.enrolledSubjects, selectedSubjectCode]
  );

  const selectedPeriod = React.useMemo(
    () =>
      data.academicHistory.periods.find(
        (p) => p.enrollmentId === selectedEnrollmentId
      ) ??
      data.academicHistory.periods[0] ??
      null,
    [data.academicHistory.periods, selectedEnrollmentId]
  );

  const handleToggleSubject = (code: string) => {
    const nextCode = selectedSubjectCode === code ? null : code;
    setSelectedSubjectCode(nextCode);
    if (nextCode) {
      requestAnimationFrame(() => {
        detailPanelRef.current?.scrollIntoView({
          behavior: prefersReducedMotion ? "auto" : "smooth",
          block: "nearest",
        });
      });
    }
  };

  const handleDownloadAcademicRecordPdf = async () => {
    if (exportingPdf || data.academicHistory.periods.length === 0) return;
    setExportingPdf(true);
    try {
      const { downloadAcademicRecordPdf } = await import(
        "@/components/pdf/AcademicRecordPdf"
      );
      await downloadAcademicRecordPdf(data);
      toast.success("Récord académico descargado en PDF.");
    } catch {
      toast.error(
        "No se pudo generar el PDF en este navegador. Inténtalo nuevamente."
      );
    } finally {
      setExportingPdf(false);
    }
  };

  const { academicHistory } = data;

  return (
    <Tabs
      value={subsection}
      onValueChange={handleSubsectionChange}
      className="font-hero flex flex-col gap-5 pb-8"
    >
      {/* Cabecera + Selector de Subsecciones */}
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-[1.75rem] leading-tight font-normal tracking-[-0.03em] text-foreground sm:text-[2.1rem]">
            Asignaturas y Pensum
          </h1>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-[13px]">
            {data.hasEnrollment
              ? `${data.gradeYear}.º Año · Mención ${data.mencionName ?? "Técnica"}${data.sectionLetter ? ` · Sección ${data.sectionLetter}` : ""}${data.schoolYearName ? ` · ${data.schoolYearName}` : ""}`
              : "Consulta tus materias inscritas, balance del año e historial académico."}
          </p>
        </div>

        <TabsList className="siga-glass-surface h-auto w-full flex-wrap justify-start gap-1 rounded-2xl border p-1 group-data-[orientation=horizontal]/tabs:h-auto sm:w-fit">
          <TabsTrigger
            value="asignaturas"
            className="flex-none cursor-pointer rounded-xl px-3.5 py-2 text-xs font-medium"
          >
            <BookOpenCheck data-icon="inline-start" aria-hidden="true" />
            Mis Asignaturas ({data.enrolledSubjects.length})
          </TabsTrigger>
          <TabsTrigger
            value="mapa"
            className="flex-none cursor-pointer rounded-xl px-3.5 py-2 text-xs font-medium"
          >
            <History data-icon="inline-start" aria-hidden="true" />
            Balance e Historial
          </TabsTrigger>
        </TabsList>
      </header>

      {/* ==================== SUBSECCIÓN 1: MIS ASIGNATURAS ==================== */}
      <TabsContent value="asignaturas" className="mt-0 space-y-5">
        {data.enrolledSubjects.length > 0 ? (
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <p className="text-xs text-muted-foreground">
              Haz clic en cualquier asignatura para desplegar sus evaluaciones y
              simulador.
            </p>
            <div className="relative w-full sm:w-64">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar materia o docente…"
                aria-label="Buscar asignatura inscrita"
                className="siga-glass-inner h-9 rounded-xl pl-8 text-xs"
              />
            </div>
          </div>
        ) : null}

        {!data.hasEnrollment || data.enrolledSubjects.length === 0 ? (
          <Empty className="siga-glass-surface rounded-[24px] border border-dashed py-10">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <BookOpenCheck aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>
                {data.hasEnrollment
                  ? "Aún no hay asignaturas cargadas para tu año"
                  : "Tu matrícula del período vigente aún está pendiente"}
              </EmptyTitle>
              <EmptyDescription>
                Cuando Control de Estudios active tu sección y carga académica,
                verás aquí cada materia. Mientras tanto puedes consultar la
                pestaña Balance e Historial.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : filteredSubjects.length === 0 ? (
          <Empty className="siga-glass-surface rounded-[24px] border border-dashed py-8">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Search aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle className="text-base">
                Sin asignaturas que coincidan
              </EmptyTitle>
              <EmptyDescription>
                Ajusta o borra tu texto de búsqueda para ver todas tus materias
                inscritas.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            {/* Cuadrícula Kanban minimalista: Nombre, Docente y Hora */}
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {filteredSubjects.map((subject) => {
                const isSelected = selectedSubjectCode === subject.subjectCode;
                const compactHour = formatCompactScheduleLabel(subject);

                return (
                  <button
                    key={subject.curriculumSubjectId}
                    type="button"
                    aria-expanded={isSelected}
                    aria-controls="enrolled-subject-detail-panel"
                    onClick={() => handleToggleSubject(subject.subjectCode)}
                    className={cn(
                      "siga-glass-surface group flex cursor-pointer flex-col justify-between gap-3 rounded-2xl border p-4.5 text-left transition-all hover:border-primary/45 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none",
                      isSelected &&
                        "border-primary/60 ring-2 ring-primary/40 dark:border-sky-400/60 dark:ring-sky-400/35"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="text-[15px] leading-snug font-semibold text-foreground group-hover:text-primary dark:group-hover:text-sky-300">
                        {subject.subjectName}
                      </h2>
                      <ChevronDown
                        className={cn(
                          "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform duration-200",
                          isSelected &&
                            "rotate-180 text-primary dark:text-sky-300"
                        )}
                        aria-hidden="true"
                      />
                    </div>

                    <div className="space-y-1 text-xs text-muted-foreground">
                      <p className="flex items-center gap-1.5 truncate">
                        <UserCheck
                          className="size-3.5 shrink-0 opacity-75"
                          aria-hidden="true"
                        />
                        <span className="truncate">
                          {subject.teacherName ?? "Docente por asignar"}
                        </span>
                      </p>
                      <p className="flex items-center gap-1.5 font-medium text-foreground/85 tabular-nums">
                        <Clock
                          className="size-3.5 shrink-0 text-primary opacity-80 dark:text-sky-300"
                          aria-hidden="true"
                        />
                        <span>{compactHour}</span>
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Panel desplegable con el detalle de la asignatura seleccionada */}
            <AnimatePresence mode="wait">
              {selectedSubject ? (
                <motion.section
                  id="enrolled-subject-detail-panel"
                  ref={detailPanelRef}
                  key={selectedSubject.subjectCode}
                  aria-label={`Detalle completo de ${selectedSubject.subjectName}`}
                  initial={
                    prefersReducedMotion
                      ? { opacity: 1 }
                      : { opacity: 0, y: 8 }
                  }
                  animate={{ opacity: 1, y: 0 }}
                  exit={
                    prefersReducedMotion
                      ? { opacity: 0 }
                      : { opacity: 0, y: 6 }
                  }
                  transition={{
                    duration: prefersReducedMotion ? 0 : 0.2,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className="siga-glass-surface space-y-5 rounded-[28px] border p-5 shadow-md sm:p-6"
                >
                  <div className="flex flex-col justify-between gap-3 border-b border-border/60 pb-4 sm:flex-row sm:items-start">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant={
                            selectedSubject.isTechnicalCore
                              ? "default"
                              : "secondary"
                          }
                        >
                          {selectedSubject.axis.label}
                        </Badge>
                        <Badge variant="outline" className="font-mono">
                          {selectedSubject.subjectCode}
                        </Badge>
                        <Badge variant="outline" className="tabular-nums">
                          {formatCurriculumWorkload(
                            selectedSubject.weeklyHours,
                            selectedSubject.annualHours
                          )}{" "}
                          ·{" "}
                          {selectedSubject.gradingScale === "LITERAL_A_E"
                            ? "Escala A–E"
                            : "Escala 1–20"}
                        </Badge>
                        {selectedSubject.attendance &&
                        selectedSubject.attendance.attendancePercent !== null ? (
                          <Badge variant="secondary" className="tabular-nums">
                            Asistencia:{" "}
                            {selectedSubject.attendance.attendancePercent}% (
                            {selectedSubject.attendance.presentCount +
                              selectedSubject.attendance.lateCount +
                              selectedSubject.attendance.justifiedCount}
                            /{selectedSubject.attendance.totalSessions})
                          </Badge>
                        ) : null}
                      </div>

                      <h2 className="text-lg font-semibold text-foreground sm:text-xl">
                        {selectedSubject.subjectName}
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        {selectedSubject.teacherName ?? "Docente por asignar"}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="rounded-xl text-xs"
                      >
                        <Link
                          href={`/estudiante/asignaturas/${encodeURIComponent(selectedSubject.subjectCode)}`}
                        >
                          <span>Vista independiente</span>
                          <ArrowUpRight data-icon="inline-end" />
                        </Link>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedSubjectCode(null)}
                        aria-label="Cerrar detalle de asignatura"
                        className="rounded-xl text-xs"
                      >
                        <X data-icon="inline-start" />
                        Cerrar
                      </Button>
                    </div>
                  </div>

                  {(selectedSubject.scheduleBlocks.length > 0 ||
                    selectedSubject.progression) && (
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      {selectedSubject.scheduleBlocks.length > 0 ? (
                        <div className="siga-glass-inner space-y-2 rounded-2xl border p-4">
                          <h3 className="text-xs font-semibold text-foreground">
                            Horario y aula en la semana
                          </h3>
                          <ul className="flex flex-col gap-1.5">
                            {selectedSubject.scheduleBlocks.map((block) => (
                              <li
                                key={block.id}
                                className="flex flex-wrap items-center justify-between gap-2 text-xs"
                              >
                                <span className="font-medium text-foreground tabular-nums">
                                  {WEEKDAY_FULL[block.dayOfWeek] ?? "Día"} ·{" "}
                                  {block.startTime}–{block.endTime}
                                </span>
                                <span className="inline-flex items-center gap-1 text-muted-foreground">
                                  <MapPin
                                    className="size-3"
                                    aria-hidden="true"
                                  />
                                  {block.roomLabel}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      {selectedSubject.progression ? (
                        <div className="siga-glass-inner space-y-2 rounded-2xl border p-4">
                          <h3 className="text-xs font-semibold text-foreground">
                            Continuidad: {selectedSubject.progression.trackTitle}
                          </h3>
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                            {selectedSubject.progression.nodes.map(
                              (node, i) => (
                                <React.Fragment key={node.subjectCode}>
                                  <span
                                    className={cn(
                                      "rounded-lg border px-2 py-0.5",
                                      i ===
                                        selectedSubject.progression
                                          ?.currentIndex
                                        ? "border-primary/45 bg-primary/12 font-semibold text-primary dark:text-sky-200"
                                        : "border-border/60 bg-background/50 text-muted-foreground"
                                    )}
                                  >
                                    {node.subjectName}
                                  </span>
                                  {i <
                                  (selectedSubject.progression?.nodes.length ??
                                    0) -
                                    1 ? (
                                    <span
                                      aria-hidden="true"
                                      className="text-muted-foreground"
                                    >
                                      →
                                    </span>
                                  ) : null}
                                </React.Fragment>
                              )
                            )}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}

                  <SubjectMomentsWorkspace
                    accessTier={data.accessTier}
                    schoolYearName={data.schoolYearName}
                    subjectCode={selectedSubject.subjectCode}
                    subjectName={selectedSubject.subjectName}
                    gradingScale={selectedSubject.gradingScale}
                    activeMomentNumber={data.activeMomentNumber}
                    moments={selectedSubject.moments}
                  />
                </motion.section>
              ) : null}
            </AnimatePresence>
          </>
        )}
      </TabsContent>

      {/* ==================== SUBSECCIÓN 2: BALANCE E HISTORIAL ==================== */}
      <TabsContent value="mapa" className="mt-0 space-y-5">
        {/* Fila 1: Franja compacta de 4 KPIs reales */}
        <section
          aria-label="Resumen de promedios y trayectoria"
          className="grid grid-cols-2 gap-3 lg:grid-cols-4"
        >
          <div className="siga-glass-surface rounded-2xl border p-4">
            <div className="flex items-center justify-between gap-2 text-[11.5px] font-medium text-muted-foreground">
              <span>Promedio general</span>
              <Award
                className="size-3.5 text-primary dark:text-sky-300"
                aria-hidden="true"
              />
            </div>
            <div className="font-kpi-num mt-2 flex items-baseline gap-1.5 text-2xl font-light tracking-tight text-foreground sm:text-[26px]">
              <span>
                {formatPromedioDisplay(academicHistory.overallCumulativeAverage)}
              </span>
              {academicHistory.overallCumulativeAverage !== null ? (
                <span className="text-xs font-normal text-muted-foreground">
                  / 20
                </span>
              ) : null}
            </div>
            <p className="mt-1 truncate text-[11px] text-muted-foreground">
              {academicHistory.overallEvaluatedNumericCount > 0
                ? `Acumulado en ${academicHistory.overallEvaluatedNumericCount} área(s)`
                : "Sin notas definitivas aún"}
            </p>
          </div>

          <div className="siga-glass-surface rounded-2xl border p-4">
            <div className="flex items-center justify-between gap-2 text-[11.5px] font-medium text-muted-foreground">
              <span>Año actual</span>
              <TrendingUp
                className="size-3.5 text-sky-600 dark:text-sky-300"
                aria-hidden="true"
              />
            </div>
            <div className="font-kpi-num mt-2 flex items-baseline gap-1.5 text-2xl font-light tracking-tight text-foreground sm:text-[26px]">
              <span>
                {formatPromedioDisplay(academicHistory.currentYearAverage)}
              </span>
              {academicHistory.currentYearAverage !== null ? (
                <span className="text-xs font-normal text-muted-foreground">
                  / 20
                </span>
              ) : null}
            </div>
            <p className="mt-1 truncate text-[11px] text-muted-foreground">
              {academicHistory.currentYearLabel ?? "Sin período vigente"}
            </p>
          </div>

          <div className="siga-glass-surface rounded-2xl border p-4">
            <div className="flex items-center justify-between gap-2 text-[11.5px] font-medium text-muted-foreground">
              <span>Áreas aprobadas</span>
              <GraduationCap
                className="size-3.5 text-emerald-600 dark:text-emerald-400"
                aria-hidden="true"
              />
            </div>
            <div className="font-kpi-num mt-2 flex items-baseline gap-1.5 text-2xl font-light tracking-tight text-foreground sm:text-[26px]">
              <span>{academicHistory.totalApprovedSubjectsCount}</span>
              <span className="text-xs font-normal text-muted-foreground">
                / {academicHistory.totalTrackedSubjectsCount}
              </span>
            </div>
            <p className="mt-1 truncate text-[11px] text-muted-foreground">
              Con calificación aprobatoria
            </p>
          </div>

          <div className="siga-glass-surface rounded-2xl border p-4">
            <div className="flex items-center justify-between gap-2 text-[11.5px] font-medium text-muted-foreground">
              <span>Materias pendientes</span>
              <AlertTriangle
                className={cn(
                  "size-3.5",
                  academicHistory.pendingRecoveryCount > 0
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-emerald-600 dark:text-emerald-400"
                )}
                aria-hidden="true"
              />
            </div>
            <div className="font-kpi-num mt-2 flex items-baseline gap-1.5 text-2xl font-light tracking-tight text-foreground sm:text-[26px]">
              <span>{academicHistory.pendingRecoveryCount}</span>
            </div>
            <p className="mt-1 truncate text-[11px] text-muted-foreground">
              {academicHistory.pendingRecoveryCount === 0
                ? "Al día sin arrastres"
                : "En proceso de recuperación"}
            </p>
          </div>
        </section>

        {/* Fila 2: Visualizaciones compactas del año actual (Treemap + Radar, sin redundancia) */}
        <SigaAnalyticsBento data={data.bentoSnapshot} variant="curriculum" />

        {/* Fila 3: Bloque principal de Historial Académico por Período Escolar */}
        <section
          aria-label="Historial académico de calificaciones por año escolar"
          className="siga-glass-surface space-y-4 rounded-[24px] border p-5 sm:p-6"
        >
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-base font-semibold tracking-[-0.02em] text-foreground">
                Historial Académico por Período
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Consulta tus calificaciones por momento, nota definitiva y
                promedio en cada año cursado.
              </p>
            </div>

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleDownloadAcademicRecordPdf}
              disabled={exportingPdf || academicHistory.periods.length === 0}
              className="w-fit rounded-xl text-xs"
            >
              {exportingPdf ? (
                <Loader2 className="animate-spin" data-icon="inline-start" />
              ) : (
                <Download data-icon="inline-start" />
              )}
              Descargar Récord PDF
            </Button>
          </div>

          {academicHistory.periods.length === 0 ? (
            <Empty className="siga-glass-inner rounded-2xl border border-dashed py-8">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <History aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle className="text-base">
                  Aún no hay períodos registrados en tu expediente
                </EmptyTitle>
                <EmptyDescription>
                  Cuando Control de Estudios registre tus matrículas y
                  calificaciones oficiales, aparecerán organizadas por año
                  escolar en esta sección.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <>
              {/* Selector de períodos escolares cursados */}
              <div
                role="tablist"
                aria-label="Seleccionar período escolar"
                className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3.5"
              >
                {academicHistory.periods.map((period) => {
                  const isActive =
                    selectedPeriod?.enrollmentId === period.enrollmentId;
                  return (
                    <button
                      key={period.enrollmentId}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() =>
                        setSelectedEnrollmentId(period.enrollmentId)
                      }
                      className={cn(
                        "inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none",
                        isActive
                          ? "border-primary/40 bg-primary text-primary-foreground shadow-xs"
                          : "siga-glass-inner text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <span className="tabular-nums">
                        {period.schoolYearName} · {period.gradeYear}.º Año
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                          isActive
                            ? "bg-white/20 text-white"
                            : period.isCurrent
                              ? "bg-primary/12 text-primary dark:text-sky-300"
                              : "bg-muted text-muted-foreground"
                        )}
                      >
                        {period.enrollmentStatusLabel}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Resumen y tabla del período seleccionado */}
              {selectedPeriod ? (
                <div className="space-y-3">
                  <div className="siga-glass-inner flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-4 py-2.5 text-xs">
                    <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
                      <span className="font-semibold text-foreground">
                        {selectedPeriod.gradeYear}.º Año
                        {selectedPeriod.sectionLetter
                          ? ` · Sección ${selectedPeriod.sectionLetter}`
                          : ""}
                      </span>
                      {selectedPeriod.mencionName ? (
                        <span>· Mención {selectedPeriod.mencionName}</span>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 tabular-nums">
                      <span className="text-muted-foreground">
                        Aprobadas:{" "}
                        <strong className="text-foreground">
                          {selectedPeriod.passedCount}/
                          {selectedPeriod.totalSubjects}
                        </strong>
                      </span>
                      <span className="text-muted-foreground">
                        Promedio del período:{" "}
                        <strong className="text-primary dark:text-sky-300">
                          {selectedPeriod.periodAverage !== null
                            ? `${formatPromedioDisplay(selectedPeriod.periodAverage)} / 20`
                            : "—"}
                        </strong>
                      </span>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[540px] border-collapse text-xs sm:text-[13px]">
                      <thead>
                        <tr className="border-b border-border/70 text-[11px] font-medium text-muted-foreground">
                          <th className="py-2.5 pr-3 text-left">
                            Área de formación
                          </th>
                          <th className="px-2 py-2.5 text-center">I Mom.</th>
                          <th className="px-2 py-2.5 text-center">II Mom.</th>
                          <th className="px-2 py-2.5 text-center">III Mom.</th>
                          <th className="px-2 py-2.5 text-center">
                            Definitiva
                          </th>
                          <th className="py-2.5 pl-3 text-right">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedPeriod.subjects.map((sub) => {
                          const defLabel =
                            sub.definitiveNumeric !== null
                              ? `${sub.definitiveNumeric} pts`
                              : sub.definitiveLiteral
                                ? `Lit. ${sub.definitiveLiteral}`
                                : "—";

                          return (
                            <tr
                              key={sub.curriculumSubjectId}
                              className="border-b border-border/50 transition-colors last:border-0 hover:bg-muted/25"
                            >
                              <td className="py-2.5 pr-3 text-left">
                                <Link
                                  href={`/estudiante/asignaturas/${encodeURIComponent(sub.subjectCode)}`}
                                  className="group inline-flex items-center gap-1.5 font-medium text-foreground hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none dark:hover:text-sky-300"
                                >
                                  <span>{sub.subjectName}</span>
                                  <ArrowUpRight
                                    className="size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-75"
                                    aria-hidden="true"
                                  />
                                </Link>
                              </td>
                              <td className="px-2 py-2.5 text-center text-muted-foreground tabular-nums">
                                {formatMomentCell(sub.moment1)}
                              </td>
                              <td className="px-2 py-2.5 text-center text-muted-foreground tabular-nums">
                                {formatMomentCell(sub.moment2)}
                              </td>
                              <td className="px-2 py-2.5 text-center text-muted-foreground tabular-nums">
                                {formatMomentCell(sub.moment3)}
                              </td>
                              <td className="px-2 py-2.5 text-center font-semibold text-foreground tabular-nums">
                                <span>{defLabel}</span>
                                {sub.recoveredViaPending ? (
                                  <span
                                    className="ml-1 rounded bg-emerald-500/15 px-1 py-0.5 text-[9.5px] font-medium text-emerald-700 dark:text-emerald-300"
                                    title="Aprobada mediante evaluación de recuperación"
                                  >
                                    Recup.
                                  </span>
                                ) : null}
                              </td>
                              <td className="py-2.5 pl-3 text-right">
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-medium",
                                    getHistoryStatusTone(sub.status)
                                  )}
                                >
                                  {sub.status === "approved" ? (
                                    <CheckCircle2
                                      className="size-2.5"
                                      aria-hidden="true"
                                    />
                                  ) : null}
                                  {getHistorySubjectStatusLabel(sub.status)}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </>
          )}

          {/* Bloque separado de Materias Pendientes (solo visible si existen registros) */}
          {academicHistory.pendingAttempts.length > 0 ? (
            <div className="siga-glass-inner space-y-2.5 rounded-2xl border border-amber-500/35 p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle
                  className="size-4 shrink-0 text-amber-600 dark:text-amber-400"
                  aria-hidden="true"
                />
                <h3 className="text-xs font-semibold text-foreground">
                  Materias Pendientes y Evaluaciones de Recuperación
                </h3>
              </div>
              <ul className="divide-y divide-border/50 text-xs">
                {academicHistory.pendingAttempts.map((att) => (
                  <li
                    key={att.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <span className="font-medium text-foreground">
                        {att.subjectName}
                      </span>
                      <span className="ml-2 text-[11px] text-muted-foreground tabular-nums">
                        Intento #{att.attemptNumber} · {att.examDate}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 tabular-nums">
                      <span className="font-semibold text-foreground">
                        {att.finalNumeric}/20
                      </span>
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[10.5px] font-medium",
                          att.passed
                            ? "border-emerald-500/35 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                            : "border-amber-500/40 bg-amber-500/12 text-amber-700 dark:text-amber-300"
                        )}
                      >
                        {att.passed ? "Aprobada" : "En recuperación"}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      </TabsContent>
    </Tabs>
  );
}

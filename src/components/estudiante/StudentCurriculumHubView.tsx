"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowUpRight,
  BookOpen,
  BookOpenCheck,
  CheckCircle2,
  ChevronDown,
  Clock,
  Compass,
  Download,
  Loader2,
  MapPin,
  Search,
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
import { getCurriculumStatusLabel } from "@/features/estudiante/curriculum-tracks";
import type {
  CurriculumMatrixSubjectItem,
  CurriculumMencionCatalog,
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
    return `${subject.weeklyHours} h/sem`;
  }
  const first = subject.scheduleBlocks[0]!;
  const day = WEEKDAY_SHORT[first.dayOfWeek] ?? "Clase";
  const extraCount = subject.scheduleBlocks.length - 1;
  return extraCount > 0
    ? `${day} ${first.startTime}–${first.endTime} (+${extraCount})`
    : `${day} ${first.startTime}–${first.endTime}`;
}

function getMatrixStatusTone(status: CurriculumMatrixSubjectItem["status"]): string {
  switch (status) {
    case "enrolled":
      return "border-primary/40 bg-primary/10 text-primary dark:border-sky-400/40 dark:bg-sky-400/15 dark:text-sky-200";
    case "approved":
      return "border-emerald-500/35 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300";
    case "pending_recovery":
      return "border-amber-500/40 bg-amber-500/12 text-amber-700 dark:text-amber-300";
    case "prior_stage":
      return "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300";
    default:
      return "border-border/70 bg-background/50 text-muted-foreground";
  }
}

/**
 * Vista principal de `/estudiante/asignaturas`:
 * - Subsección `Mis Asignaturas`: cuadrícula tipo kanban minimalista (Nombre, Docente y Hora)
 *   donde al hacer clic en cualquier cuadrito se despliega toda su información.
 * - Subsección `Mapa Curricular`: Mapa Curricular (Treemap/Tabla + Balance de Competencias Radar)
 *   junto con la malla de 1.º a 6.º año por mención y descarga PDF.
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
  const [selectedMencionCode, setSelectedMencionCode] = React.useState<string>(
    () => data.mencionCode ?? data.menciones[0]?.code ?? "TELEMATICA"
  );
  const [selectedYearFilter, setSelectedYearFilter] = React.useState<
    "all" | number
  >("all");
  const [exportingPdf, setExportingPdf] = React.useState(false);

  React.useEffect(() => {
    if (data.mencionCode) {
      setSelectedMencionCode(data.mencionCode);
    }
  }, [data.mencionCode]);

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

  const handleSubsectionChange = React.useCallback((val: string) => {
    const next = val === "mapa" ? "mapa" : "asignaturas";
    setSubsection(next);
    try {
      const nextUrl = new URL(window.location.href);
      if (next === "mapa") {
        nextUrl.searchParams.set("vista", "mapa");
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

  const enrolledCodesSet = React.useMemo(
    () => new Set(data.enrolledSubjects.map((s) => s.subjectCode)),
    [data.enrolledSubjects]
  );

  const selectedMencion: CurriculumMencionCatalog | null = React.useMemo(
    () =>
      data.menciones.find((m) => m.code === selectedMencionCode) ??
      data.menciones[0] ??
      null,
    [data.menciones, selectedMencionCode]
  );

  const visibleYears = React.useMemo(() => {
    if (!selectedMencion) return [];
    if (selectedYearFilter === "all") return selectedMencion.years;
    return selectedMencion.years.filter(
      (y) => y.gradeYear === selectedYearFilter
    );
  }, [selectedMencion, selectedYearFilter]);

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

  const handleJumpToEnrolledSubject = (code: string) => {
    handleSubsectionChange("asignaturas");
    setSelectedSubjectCode(code);
  };

  const handleDownloadCurriculumPdf = async () => {
    if (!selectedMencion || exportingPdf) return;
    setExportingPdf(true);
    try {
      const { downloadCurriculumMapPdf } = await import(
        "@/components/pdf/CurriculumMapPdf"
      );
      await downloadCurriculumMapPdf(data, selectedMencion);
      toast.success(`Pensum de ${selectedMencion.name} descargado en PDF.`);
    } catch {
      toast.error(
        "No se pudo generar el PDF en este navegador. Inténtalo nuevamente."
      );
    } finally {
      setExportingPdf(false);
    }
  };

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
              : "Consulta tus materias inscritas, mapa curricular y balance de competencias."}
          </p>
        </div>

        <TabsList className="siga-glass-surface h-auto w-full justify-start gap-1 rounded-2xl border p-1 sm:w-fit">
          <TabsTrigger
            value="asignaturas"
            className="cursor-pointer rounded-xl px-3.5 py-2 text-xs font-medium"
          >
            <BookOpenCheck data-icon="inline-start" aria-hidden="true" />
            Mis Asignaturas ({data.enrolledSubjects.length})
          </TabsTrigger>
          <TabsTrigger
            value="mapa"
            className="cursor-pointer rounded-xl px-3.5 py-2 text-xs font-medium"
          >
            <Compass data-icon="inline-start" aria-hidden="true" />
            Mapa Curricular y Balance
          </TabsTrigger>
        </TabsList>
      </header>
        {/* ==================== SUBSECCIÓN 1: MIS ASIGNATURAS (CUADRITOS MINIMALISTAS + DETALLE AL CLIC) ==================== */}
        <TabsContent value="asignaturas" className="mt-0 space-y-5">
          {data.enrolledSubjects.length > 0 ? (
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
              <p className="text-xs text-muted-foreground">
                Haz clic en cualquier asignatura para desplegar sus evaluaciones
                y simulador.
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
                  verás aquí cada materia. Mientras tanto puedes explorar la
                  subsección Mapa Curricular y Balance.
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
                  Ajusta o borra tu texto de búsqueda para ver todos los
                  cuadritos de tus materias.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <>
              {/* Cuadrícula Kanban minimalista: ÚNICAMENTE Nombre, Docente y Hora */}
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

              {/* Panel desplegable con TODO el detalle de la asignatura seleccionada */}
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
                            {selectedSubject.weeklyHours} h/sem ·{" "}
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

        {/* ==================== SUBSECCIÓN 2: MAPA CURRICULAR + BALANCE DE COMPETENCIAS ==================== */}
        <TabsContent value="mapa" className="mt-0 space-y-6">
          {/* Bloque 1: Treemap Curricular y Balance de Competencias (trasladados desde Inicio) */}
          <SigaAnalyticsBento data={data.bentoSnapshot} variant="curriculum" />

          {/* Bloque 2: Pensum completo de 1.º a 6.º año por Mención */}
          <section
            aria-label="Malla curricular completa de primero a sexto año"
            className="siga-glass-surface space-y-4 rounded-[28px] border p-5 sm:p-6"
          >
            <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
              <div>
                <h2 className="text-base font-semibold tracking-[-0.02em] text-foreground">
                  Plan de Estudios por Mención (1.º a 6.º Año)
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Explora todas las asignaturas desde 1.º hasta 6.º año y
                  pasantías.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {data.menciones.map((m) => {
                  const active = m.code === selectedMencionCode;
                  const isOwn = m.code === data.mencionCode;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setSelectedMencionCode(m.code)}
                      className={cn(
                        "inline-flex cursor-pointer items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none",
                        active
                          ? "border-primary/40 bg-primary text-primary-foreground shadow-xs"
                          : "siga-glass-inner text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <span>{m.name}</span>
                      {isOwn ? (
                        <span
                          className={cn(
                            "rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold",
                            active
                              ? "bg-white/20 text-white"
                              : "bg-primary/12 text-primary dark:text-sky-300"
                          )}
                        >
                          Tuya
                        </span>
                      ) : null}
                    </button>
                  );
                })}

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleDownloadCurriculumPdf}
                  disabled={!selectedMencion || exportingPdf}
                  className="rounded-xl text-xs"
                >
                  {exportingPdf ? (
                    <Loader2
                      className="animate-spin"
                      data-icon="inline-start"
                    />
                  ) : (
                    <Download data-icon="inline-start" />
                  )}
                  Descargar PDF
                </Button>
              </div>
            </div>

            <div
              role="group"
              aria-label="Filtrar año del mapa curricular"
              className="flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-3"
            >
              <button
                type="button"
                aria-pressed={selectedYearFilter === "all"}
                onClick={() => setSelectedYearFilter("all")}
                className={cn(
                  "cursor-pointer rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                  selectedYearFilter === "all"
                    ? "bg-primary/15 text-primary dark:bg-sky-400/20 dark:text-sky-200"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Todos (1.º–6.º)
              </button>
              {[1, 2, 3, 4, 5, 6].map((yr) => {
                const isOwnYear =
                  data.mencionCode === selectedMencion?.code &&
                  data.gradeYear === yr;
                return (
                  <button
                    key={yr}
                    type="button"
                    aria-pressed={selectedYearFilter === yr}
                    onClick={() => setSelectedYearFilter(yr)}
                    className={cn(
                      "cursor-pointer rounded-lg px-2.5 py-1 text-xs font-medium transition-colors tabular-nums",
                      selectedYearFilter === yr
                        ? "bg-primary/15 text-primary dark:bg-sky-400/20 dark:text-sky-200"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {yr}.º Año{isOwnYear ? " · Actual" : ""}
                  </button>
                );
              })}
            </div>

            {selectedMencion ? (
              <div
                className={cn(
                  "grid grid-cols-1 gap-4",
                  visibleYears.length > 1 && "md:grid-cols-2 xl:grid-cols-3"
                )}
              >
                {visibleYears.map((yr) => {
                  const isCurrentYear =
                    data.mencionCode === selectedMencion.code &&
                    data.gradeYear === yr.gradeYear;

                  return (
                    <div
                      key={yr.gradeYear}
                      className={cn(
                        "siga-glass-inner flex flex-col gap-2.5 rounded-2xl border p-4",
                        isCurrentYear &&
                          "ring-2 ring-primary/50 dark:ring-sky-400/50"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-foreground">
                            {yr.gradeYear}.º Año
                          </h3>
                          {isCurrentYear ? (
                            <Badge className="text-[10px]">Tu año</Badge>
                          ) : yr.gradeYear === 6 ? (
                            <Badge variant="secondary" className="text-[10px]">
                              Pasantías
                            </Badge>
                          ) : null}
                        </div>
                        <span className="text-[11px] text-muted-foreground tabular-nums">
                          {yr.totalWeeklyHours} h/sem
                        </span>
                      </div>

                      <ul className="flex flex-col gap-1.5">
                        {yr.subjects.map((subj) => {
                          const canJumpInline =
                            isCurrentYear &&
                            enrolledCodesSet.has(subj.subjectCode);
                          const statusLabel = getCurriculumStatusLabel(
                            subj.status
                          );
                          const rightLabel =
                            subj.finalNumeric !== null
                              ? `${subj.finalNumeric}/20`
                              : subj.finalLiteral
                                ? `Lit. ${subj.finalLiteral}`
                                : statusLabel;

                          const rowContent = (
                            <>
                              <div className="flex min-w-0 items-center gap-2">
                                <BookOpen
                                  className={cn(
                                    "size-3.5 shrink-0",
                                    subj.isTechnicalCore
                                      ? "text-primary dark:text-sky-300"
                                      : "text-muted-foreground/70"
                                  )}
                                  aria-hidden="true"
                                />
                                <span className="truncate text-xs font-medium text-foreground">
                                  {subj.subjectName}
                                </span>
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                <span className="text-[11px] text-muted-foreground tabular-nums">
                                  {subj.weeklyHours}h
                                </span>
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium tabular-nums",
                                    getMatrixStatusTone(subj.status)
                                  )}
                                >
                                  {subj.status === "approved" ? (
                                    <CheckCircle2
                                      className="size-2.5"
                                      aria-hidden="true"
                                    />
                                  ) : null}
                                  {rightLabel}
                                </span>
                              </div>
                            </>
                          );

                          return (
                            <li key={subj.curriculumSubjectId}>
                              {canJumpInline ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleJumpToEnrolledSubject(
                                      subj.subjectCode
                                    )
                                  }
                                  className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl border border-border/60 bg-background/55 px-3 py-2 text-left transition-colors hover:border-primary/45 hover:bg-background/85 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none"
                                >
                                  {rowContent}
                                </button>
                              ) : (
                                <Link
                                  href={`/estudiante/asignaturas/${encodeURIComponent(subj.subjectCode)}`}
                                  className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-background/55 px-3 py-2 transition-colors hover:border-primary/45 hover:bg-background/85 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none"
                                >
                                  {rowContent}
                                </Link>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </section>
        </TabsContent>
    </Tabs>
  );
}

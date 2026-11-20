"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Clock,
  Compass,
  FileCheck2,
  GraduationCap,
  MapPin,
  Scale,
  UserCheck,
} from "lucide-react";
import { cn } from "cn";
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  formatCurriculumWorkload,
  getCurriculumStatusLabel,
} from "@/features/estudiante/curriculum-tracks";
import type { StudentSubjectDetailData } from "@/features/estudiante/subjects-data";

export interface StudentSubjectDetailViewProps {
  data: StudentSubjectDetailData;
}

const FULL_WEEKDAY_LABELS: Record<number, string> = {
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
  6: "Sábado",
  7: "Domingo",
};

/**
 * Expediente independiente por asignatura (`/estudiante/asignaturas/[codigo]`),
 * manteniendo paridad con la vista desplegable vía `SubjectMomentsWorkspace`.
 */
export function StudentSubjectDetailView({
  data,
}: StudentSubjectDetailViewProps) {
  const router = useRouter();
  const { subject } = data;

  const activeMomentDetail = React.useMemo(
    () =>
      data.moments.find((m) => m.momentNumber === data.activeMomentNumber) ??
      data.moments[0] ??
      null,
    [data.activeMomentNumber, data.moments]
  );

  const reviewRequestHref = React.useMemo(() => {
    const params = new URLSearchParams({
      requestType: "revision_notas",
      subject: `${subject.subjectName} (${subject.subjectCode})`,
    });
    return `/estudiante/tramites?${params.toString()}`;
  }, [subject.subjectCode, subject.subjectName]);

  const activeGradeLabel = React.useMemo(() => {
    if (!data.isCurrentlyEnrolledSubject) {
      return getCurriculumStatusLabel(subject.curriculumStatus);
    }
    const fg = activeMomentDetail?.finalGrade;
    if (subject.gradingScale === "LITERAL_A_E") {
      return fg?.finalLiteral ? `Literal ${fg.finalLiteral}` : "Escala A–E";
    }
    if (fg?.finalNumeric !== null && fg?.finalNumeric !== undefined) {
      return `${fg.finalNumeric} / 20 pts`;
    }
    return "En evaluación";
  }, [activeMomentDetail, data.isCurrentlyEnrolledSubject, subject]);

  return (
    <div className="font-hero flex flex-col gap-6 pb-8">
      <nav
        aria-label="Navegación de asignatura"
        className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"
      >
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Button asChild variant="outline" size="sm" className="rounded-xl">
            <Link href="/estudiante/asignaturas" prefetch={true}>
              <ArrowLeft data-icon="inline-start" />
              Asignaturas y Pensum
            </Link>
          </Button>
          <span aria-hidden="true">/</span>
          <span className="font-medium text-foreground">
            {subject.subjectName}
          </span>
        </div>

        {data.enrolledPeers.length > 0 ? (
          <div className="w-full sm:w-72">
            <Select
              value={subject.subjectCode}
              onValueChange={(code) =>
                router.push(
                  `/estudiante/asignaturas/${encodeURIComponent(code)}`
                )
              }
            >
              <SelectTrigger
                aria-label="Cambiar de asignatura rápidamente"
                className="siga-glass-surface w-full rounded-xl"
              >
                <SelectValue placeholder="Ir a otra asignatura" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {data.enrolledPeers.map((peer) => (
                    <SelectItem key={peer.subjectCode} value={peer.subjectCode}>
                      {peer.subjectName} ({peer.subjectCode})
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </nav>

      {/* Hero de la asignatura */}
      <section
        aria-label={`Resumen de ${subject.subjectName}`}
        className="siga-glass-hero relative overflow-hidden rounded-[28px] border p-6 text-white sm:p-7"
      >
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3 py-1 text-[11px] font-medium text-sky-100">
                <BookOpen className="size-3.5" aria-hidden="true" />
                {subject.axis.label}
              </span>
              <span className="inline-flex items-center rounded-full border border-white/25 bg-white/10 px-3 py-1 font-mono text-[11px] font-semibold text-white">
                {subject.subjectCode}
              </span>
              <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-medium text-sky-100">
                {getCurriculumStatusLabel(subject.curriculumStatus)}
              </span>
            </div>

            <h1 className="text-2xl leading-tight font-medium tracking-[-0.025em] text-white sm:text-3xl">
              {subject.subjectName}
            </h1>

            <p className="max-w-2xl text-xs leading-relaxed text-sky-100/85 sm:text-sm">
              {data.enrolledMencionName
                ? `Mención ${data.enrolledMencionName}`
                : "Plan oficial E.T.C. Andrés Bello"}
              {subject.gradeYearsInMencion.length > 0
                ? ` · Ubicada en ${subject.gradeYearsInMencion.map((y) => `${y}.º`).join(" y ")} año`
                : ""}
              {data.isCurrentlyEnrolledSubject && data.sectionLetter
                ? ` · Sección ${data.sectionLetter}`
                : ""}
              {data.schoolYearName ? ` · Período ${data.schoolYearName}` : ""}
            </p>
          </div>

          {data.isCurrentlyEnrolledSubject &&
          data.accessTier === "verified_workspace" ? (
            <Button
              asChild
              className="shrink-0 rounded-xl border border-white/25 bg-white text-slate-900 hover:bg-sky-50"
            >
              <Link href={reviewRequestHref}>
                <FileCheck2 data-icon="inline-start" />
                Solicitar revisión de nota
              </Link>
            </Button>
          ) : null}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-2xl border border-white/18 bg-white/10 p-3.5">
            <span className="flex items-center gap-1.5 text-[11px] text-sky-100/80">
              <UserCheck className="size-3.5" aria-hidden="true" />
              Docente titular
            </span>
            <p className="mt-1.5 truncate text-sm font-semibold text-white">
              {data.isCurrentlyEnrolledSubject
                ? (data.teacherName ?? "Por asignar")
                : "Según año escolar"}
            </p>
          </div>

          <div className="rounded-2xl border border-white/18 bg-white/10 p-3.5">
            <span className="flex items-center gap-1.5 text-[11px] text-sky-100/80">
              <Clock className="size-3.5" aria-hidden="true" />
              Intensidad horaria
            </span>
            <p className="font-kpi-num mt-1.5 text-lg font-light text-white tabular-nums">
              {subject.weeklyHours !== null
                ? formatCurriculumWorkload(
                    subject.weeklyHours,
                    subject.annualHours,
                    "long"
                  )
                : "—"}
            </p>
          </div>

          <div className="rounded-2xl border border-white/18 bg-white/10 p-3.5">
            <span className="flex items-center gap-1.5 text-[11px] text-sky-100/80">
              <GraduationCap className="size-3.5" aria-hidden="true" />
              {data.isCurrentlyEnrolledSubject ? "Corte activo" : "Estado"}
            </span>
            <p className="mt-1.5 text-sm font-semibold text-white tabular-nums">
              {activeGradeLabel}
            </p>
          </div>

          <div className="rounded-2xl border border-white/18 bg-white/10 p-3.5">
            <span className="flex items-center gap-1.5 text-[11px] text-sky-100/80">
              <Scale className="size-3.5" aria-hidden="true" />
              Asistencia en materia
            </span>
            <p className="mt-1.5 text-sm font-semibold text-white tabular-nums">
              {data.attendance && data.attendance.attendancePercent !== null
                ? `${data.attendance.attendancePercent}% (${data.attendance.presentCount + data.attendance.lateCount + data.attendance.justifiedCount}/${data.attendance.totalSessions})`
                : data.isCurrentlyEnrolledSubject
                  ? "Sin pases registrados"
                  : `Escala ${subject.gradingScale === "LITERAL_A_E" ? "A–E" : "1–20"}`}
            </p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="flex flex-col gap-6 xl:col-span-8">
          {!data.isCurrentlyEnrolledSubject ? (
            <section className="siga-glass-surface rounded-[28px] border p-6">
              <Empty className="border-0 p-2">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Compass aria-hidden="true" />
                  </EmptyMedia>
                  <EmptyTitle>
                    Asignatura del Mapa Curricular (
                    {getCurriculumStatusLabel(subject.curriculumStatus)})
                  </EmptyTitle>
                  <EmptyDescription>
                    Esta materia corresponde a{" "}
                    {subject.gradeYearsInMencion
                      .map((y) => `${y}.º año`)
                      .join(" y ")}{" "}
                    de la mención y no forma parte de tu carga inscrita del año
                    vigente.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </section>
          ) : data.moments.length === 0 ? (
            <section className="siga-glass-surface rounded-[28px] border p-6">
              <Empty className="border-0 p-2">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <CalendarClock aria-hidden="true" />
                  </EmptyMedia>
                  <EmptyTitle>
                    Sin momentos pedagógicos configurados aún
                  </EmptyTitle>
                  <EmptyDescription>
                    Cuando Control de Estudios active los cortes del período
                    escolar vigente, verás aquí cada evaluación y tu progreso.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </section>
          ) : (
            <section className="siga-glass-surface rounded-[28px] border p-5 sm:p-6">
              <SubjectMomentsWorkspace
                accessTier={data.accessTier}
                schoolYearName={data.schoolYearName}
                subjectCode={subject.subjectCode}
                subjectName={subject.subjectName}
                gradingScale={subject.gradingScale}
                activeMomentNumber={data.activeMomentNumber}
                moments={data.moments}
                showReviewAction={false}
              />
            </section>
          )}
        </div>

        <aside className="flex flex-col gap-5 xl:col-span-4">
          <section
            aria-label="Horario de clases de la asignatura"
            className="siga-glass-surface space-y-3.5 rounded-[24px] border p-5"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-foreground">
                Horario y Aula
              </h2>
              <Badge variant="outline" className="text-[10.5px] tabular-nums">
                {data.scheduleBlocks.length} bloque(s)
              </Badge>
            </div>

            {data.scheduleBlocks.length === 0 ? (
              <p className="text-xs leading-relaxed text-muted-foreground">
                No hay bloques horarios semanales asignados aún para esta
                asignatura en tu sección.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {data.scheduleBlocks.map((block) => (
                  <li
                    key={block.id}
                    className="siga-glass-inner flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">
                        {FULL_WEEKDAY_LABELS[block.dayOfWeek] ?? "Día"}{" "}
                        <span className="font-normal text-muted-foreground tabular-nums">
                          · {block.startTime}–{block.endTime}
                        </span>
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                        <MapPin className="size-3 shrink-0" aria-hidden="true" />
                        {block.roomLabel} ({block.blockLabel})
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {data.attendance && data.attendance.totalSessions > 0 ? (
            <section
              aria-label="Asistencia en la asignatura"
              className="siga-glass-surface space-y-3 rounded-[24px] border p-5"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">
                  Asistencia en Clase
                </h2>
                <Badge variant="secondary" className="tabular-nums">
                  {data.attendance.attendancePercent ?? 0}%
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="siga-glass-inner rounded-xl border p-2.5">
                  <span className="text-[10.5px] text-muted-foreground">
                    Presente
                  </span>
                  <p className="font-semibold text-emerald-700 tabular-nums dark:text-emerald-300">
                    {data.attendance.presentCount}
                  </p>
                </div>
                <div className="siga-glass-inner rounded-xl border p-2.5">
                  <span className="text-[10.5px] text-muted-foreground">
                    Retardo / Justif.
                  </span>
                  <p className="font-semibold text-foreground tabular-nums">
                    {data.attendance.lateCount + data.attendance.justifiedCount}
                  </p>
                </div>
                <div className="siga-glass-inner col-span-2 flex items-center justify-between rounded-xl border px-3 py-2">
                  <span className="text-[11px] text-muted-foreground">
                    Inasistencias injustificadas
                  </span>
                  <span className="font-semibold text-foreground tabular-nums">
                    {data.attendance.absentCount}
                  </span>
                </div>
              </div>
            </section>
          ) : null}

          {data.progression ? (
            <section
              aria-label="Trayectoria curricular"
              className="siga-glass-surface space-y-3.5 rounded-[24px] border p-5"
            >
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  Ruta en el Pensum (1.º–6.º)
                </h2>
                <p className="mt-1 text-xs font-medium text-primary dark:text-sky-300">
                  {data.progression.trackTitle}
                </p>
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
                  {data.progression.trackDescription}
                </p>
              </div>

              <ol className="space-y-2">
                {data.progression.nodes.map((node, index) => {
                  const isCurrent = index === data.progression?.currentIndex;
                  const isPrior =
                    data.progression !== null &&
                    index < data.progression.currentIndex;

                  return (
                    <li key={node.subjectCode}>
                      <Link
                        href={`/estudiante/asignaturas/${encodeURIComponent(node.subjectCode)}`}
                        className={cn(
                          "flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs transition-colors hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none",
                          isCurrent
                            ? "border-primary/50 bg-primary/10 font-semibold text-foreground dark:border-sky-400/50 dark:bg-sky-400/15"
                            : "siga-glass-inner text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <div className="min-w-0">
                          <span className="block truncate">
                            {node.subjectName}
                          </span>
                          <span className="text-[10.5px] text-muted-foreground tabular-nums">
                            {node.subjectCode} ·{" "}
                            {node.gradeYears.map((y) => `${y}.º`).join(", ")} año
                          </span>
                        </div>
                        {isCurrent ? (
                          <Badge className="shrink-0 text-[9.5px]">Actual</Badge>
                        ) : isPrior ? (
                          <CheckCircle2
                            className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                            aria-hidden="true"
                          />
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </section>
          ) : null}

          {data.pendingAttempts.length > 0 ? (
            <section
              aria-label="Intentos de materia pendiente"
              className="siga-glass-surface space-y-3 rounded-[24px] border p-5"
            >
              <h2 className="text-sm font-semibold text-foreground">
                Materia Pendiente (Intentos)
              </h2>
              <div className="flex flex-col gap-2">
                {data.pendingAttempts.map((att) => (
                  <div
                    key={att.id}
                    className="siga-glass-inner flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs"
                  >
                    <span className="text-muted-foreground tabular-nums">
                      Intento {att.attemptNumber}/4 · {att.examDate}
                    </span>
                    <Badge variant={att.passed ? "default" : "destructive"}>
                      {att.finalNumeric}/20 ·{" "}
                      {att.passed ? "Aprobada" : "Pendiente"}
                    </Badge>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

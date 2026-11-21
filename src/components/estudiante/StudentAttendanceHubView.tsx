"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarCheck2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Megaphone,
  Radio,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import type { StudentAttendanceOverviewData } from "@/features/estudiante/attendance-data";
import {
  buildAttendanceCalendarMonth,
  getAttendanceStatusLabel,
  getCaracasClockSnapshot,
  getHealthLevelLabel,
  getTeacherAbsenceStatusLabel,
  resolveLiveSchoolDayPulse,
  type AttendanceHealthLevel,
  type AttendanceRecordStatus,
} from "@/features/estudiante/attendance-metrics";
import {
  formatCompact12hTime,
  parseTimeToMinutes,
} from "@/features/estudiante/schedule-grid";

export interface StudentAttendanceHubViewProps {
  data: StudentAttendanceOverviewData;
}

const CALENDAR_WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"] as const;

function resolveWeekdayFromIso(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y ?? 2026, (m ?? 1) - 1, d ?? 1));
  const jsDay = dt.getUTCDay();
  return jsDay === 0 ? 7 : jsDay;
}

function formatVenezuelanDateIso(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function getHealthBadgeTone(level: AttendanceHealthLevel): string {
  switch (level) {
    case "green":
      return "border-emerald-500/35 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300";
    case "amber":
      return "border-amber-500/40 bg-amber-500/12 text-amber-700 dark:text-amber-300";
    case "red":
      return "border-rose-500/40 bg-rose-500/12 text-rose-700 dark:text-rose-300";
    default:
      return "border-border/70 bg-background/60 text-muted-foreground";
  }
}

function getHealthBarColor(level: AttendanceHealthLevel): string {
  switch (level) {
    case "green":
      return "bg-emerald-500";
    case "amber":
      return "bg-amber-500";
    case "red":
      return "bg-rose-500";
    default:
      return "bg-muted-foreground/40";
  }
}

function getRecordStatusTone(status: AttendanceRecordStatus): {
  dot: string;
  pill: string;
} {
  switch (status) {
    case "present":
      return {
        dot: "bg-emerald-500",
        pill: "border-emerald-500/35 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
      };
    case "late":
      return {
        dot: "bg-amber-500",
        pill: "border-amber-500/40 bg-amber-500/12 text-amber-700 dark:text-amber-300",
      };
    case "justified":
      return {
        dot: "bg-sky-500",
        pill: "border-sky-500/35 bg-sky-500/12 text-sky-700 dark:text-sky-300",
      };
    case "absent":
      return {
        dot: "bg-rose-500",
        pill: "border-rose-500/40 bg-rose-500/12 text-rose-700 dark:text-rose-300",
      };
  }
}

/**
 * Vista integral del Módulo 1.7 (`/estudiante/asistencia`):
 * 1) Mi Día Escolar en vivo (`America/Caracas`) + Avisos de ausencia docente (hoy + 7 días).
 * 2) Semáforo de Asistencia por Área de Formación (umbral 75 % MPPE + margen exacto).
 * 3) Calendario mensual interactivo de asistencias con detalle diario.
 */
export function StudentAttendanceHubView({
  data,
}: StudentAttendanceHubViewProps) {
  // Reloj vivo de Venezuela con estado inicial determinista (0 errores de hidratación)
  const [clock, setClock] = React.useState(() => ({
    hydrated: false,
    dateIso: data.todayIso,
    weekday: resolveWeekdayFromIso(data.todayIso),
    currentMinutes: 7 * 60,
    clockLabel12h: "",
    dateLabelEs: "",
  }));

  React.useEffect(() => {
    const syncClock = () => {
      const snap = getCaracasClockSnapshot(new Date());
      setClock({
        hydrated: true,
        dateIso: snap.dateIso,
        weekday: snap.weekday,
        currentMinutes: snap.currentMinutes,
        clockLabel12h: snap.clockLabel12h,
        dateLabelEs: snap.dateLabelEs,
      });
    };
    syncClock();
    const timer = window.setInterval(syncClock, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const [healthFilter, setHealthFilter] = React.useState<
    "all" | "red" | "amber" | "green"
  >("all");
  const [isTrafficLightExpanded, setIsTrafficLightExpanded] =
    React.useState(false);

  // Estado del calendario mensual (inicializado al mes de la sesión más reciente o mes actual)
  const initialDateIso = data.sessions[0]?.sessionDate ?? data.todayIso;
  const [calMonth, setCalMonth] = React.useState(() => {
    const [y, m] = initialDateIso.split("-").map(Number);
    return {
      year: y ?? 2026,
      monthIndex0: Math.max(0, Math.min(11, (m ?? 1) - 1)),
    };
  });
  const [selectedDateIso, setSelectedDateIso] = React.useState<string>(
    initialDateIso
  );

  const pulse = React.useMemo(
    () =>
      resolveLiveSchoolDayPulse({
        scheduleBlocks: data.scheduleBlocks,
        teacherAbsences: data.teacherAbsences,
        todayIso: clock.dateIso,
        weekday: clock.weekday,
        currentMinutes: clock.currentMinutes,
      }),
    [
      clock.currentMinutes,
      clock.dateIso,
      clock.weekday,
      data.scheduleBlocks,
      data.teacherAbsences,
    ]
  );

  const filteredSubjects = React.useMemo(() => {
    const priority: Record<AttendanceHealthLevel, number> = {
      red: 0,
      amber: 1,
      green: 2,
      neutral: 3,
    };
    const list =
      healthFilter === "all"
        ? data.subjects
        : data.subjects.filter((s) => s.healthLevel === healthFilter);

    return [...list].sort((a, b) => {
      const pDiff = priority[a.healthLevel] - priority[b.healthLevel];
      if (pDiff !== 0) return pDiff;
      if (b.totalSessions !== a.totalSessions) {
        return b.totalSessions - a.totalSessions;
      }
      return a.subjectName.localeCompare(b.subjectName, "es");
    });
  }, [data.subjects, healthFilter]);

  const handleSelectHealthFilter = (next: "all" | "red" | "amber" | "green") => {
    setHealthFilter(next);
    if (next !== "all") {
      setIsTrafficLightExpanded(true);
    }
  };

  const calendarGrid = React.useMemo(
    () =>
      buildAttendanceCalendarMonth({
        year: calMonth.year,
        monthIndex0: calMonth.monthIndex0,
        sessions: data.sessions,
        todayIso: clock.dateIso,
      }),
    [calMonth.monthIndex0, calMonth.year, clock.dateIso, data.sessions]
  );

  const selectedDaySessions = React.useMemo(
    () => data.sessions.filter((s) => s.sessionDate === selectedDateIso),
    [data.sessions, selectedDateIso]
  );

  const handleShiftMonth = (delta: number) => {
    setCalMonth((prev) => {
      const dt = new Date(Date.UTC(prev.year, prev.monthIndex0 + delta, 1));
      return { year: dt.getUTCFullYear(), monthIndex0: dt.getUTCMonth() };
    });
  };

  const handleJumpToday = () => {
    const [y, m] = clock.dateIso.split("-").map(Number);
    setCalMonth({
      year: y ?? 2026,
      monthIndex0: Math.max(0, Math.min(11, (m ?? 1) - 1)),
    });
    setSelectedDateIso(clock.dateIso);
  };

  return (
    <div className="font-hero flex flex-col gap-5 pb-8">
      {/* Cabecera */}
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-[1.75rem] leading-tight font-normal tracking-[-0.03em] text-foreground sm:text-[2.1rem]">
            Mi Día Escolar y Asistencia
          </h1>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-[13px]">
            {data.hasEnrollment
              ? `${data.gradeYear}.º Año · Mención ${data.mencionName ?? "Técnica"}${data.sectionLetter ? ` · Sección ${data.sectionLetter}` : ""}${data.schoolYearName ? ` · ${data.schoolYearName}` : ""}`
              : "Control de jornada escolar, avisos docentes y cumplimiento del 75 % reglamentario."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {clock.hydrated && clock.clockLabel12h ? (
            <span className="siga-glass-pill inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium text-foreground tabular-nums">
              <Radio
                className="size-3.5 text-primary dark:text-sky-300"
                aria-hidden="true"
              />
              <span>
                {clock.dateLabelEs} · {clock.clockLabel12h}
              </span>
            </span>
          ) : null}
          <Button
            asChild
            variant="outline"
            size="sm"
            className="siga-glass-inner rounded-xl text-xs"
          >
            <Link href="/estudiante?tab=horario">
              <span>Horario semanal</span>
              <ArrowUpRight data-icon="inline-end" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </header>

      {/* Franja compacta de 4 KPIs */}
      <section
        aria-label="Indicadores generales de asistencia"
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        <div className="siga-glass-surface rounded-2xl border p-4">
          <div className="flex items-center justify-between gap-2 text-[11.5px] font-medium text-muted-foreground">
            <span>Asistencia general</span>
            <CalendarCheck2
              className="size-3.5 text-primary dark:text-sky-300"
              aria-hidden="true"
            />
          </div>
          <div className="font-kpi-num mt-2 flex items-baseline gap-2 text-2xl font-light text-foreground sm:text-[26px]">
            <span>
              {data.overallHealth.attendancePercent !== null
                ? `${data.overallHealth.attendancePercent}%`
                : "—"}
            </span>
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                getHealthBadgeTone(data.overallHealth.healthLevel)
              )}
            >
              {getHealthLevelLabel(data.overallHealth.healthLevel)}
            </span>
          </div>
          <p className="mt-1 truncate text-[11px] text-muted-foreground tabular-nums">
            {data.overallHealth.totalSessions > 0
              ? `${data.overallHealth.attendedCount} cumplidas de ${data.overallHealth.totalSessions} sesiones`
              : "Sin pases registrados todavía"}
          </p>
        </div>

        <div className="siga-glass-surface rounded-2xl border p-4">
          <div className="flex items-center justify-between gap-2 text-[11.5px] font-medium text-muted-foreground">
            <span>Meta 75 % MPPE</span>
            {data.overallHealth.healthLevel === "red" ? (
              <ShieldAlert
                className="size-3.5 text-rose-600 dark:text-rose-400"
                aria-hidden="true"
              />
            ) : (
              <ShieldCheck
                className="size-3.5 text-emerald-600 dark:text-emerald-400"
                aria-hidden="true"
              />
            )}
          </div>
          <div className="font-kpi-num mt-2 text-2xl font-light text-foreground sm:text-[26px]">
            {data.overallHealth.totalSessions === 0
              ? "—"
              : data.overallHealth.healthLevel === "red"
                ? `+${data.overallHealth.sessionsNeededToRecover}`
                : `${data.overallHealth.allowedAdditionalAbsences}`}
          </div>
          <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
            {data.overallHealth.totalSessions === 0
              ? "Se calcula al iniciar registros"
              : data.overallHealth.healthLevel === "red"
                ? "Asistencias seguidas para volver al 75 %"
                : "Faltas globales de margen sobre 75 %"}
          </p>
        </div>

        <div className="siga-glass-surface rounded-2xl border p-4">
          <div className="flex items-center justify-between gap-2 text-[11.5px] font-medium text-muted-foreground">
            <span>Áreas en alerta</span>
            <AlertTriangle
              className={cn(
                "size-3.5",
                data.atRiskSubjectsCount > 0
                  ? "text-rose-600 dark:text-rose-400"
                  : data.observationSubjectsCount > 0
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-emerald-600 dark:text-emerald-400"
              )}
              aria-hidden="true"
            />
          </div>
          <div className="font-kpi-num mt-2 flex items-baseline gap-1.5 text-2xl font-light text-foreground sm:text-[26px]">
            <span>{data.atRiskSubjectsCount}</span>
            <span className="text-xs font-normal text-muted-foreground">
              en riesgo
            </span>
          </div>
          <p className="mt-1 truncate text-[11px] text-muted-foreground tabular-nums">
            {data.observationSubjectsCount} en observación ·{" "}
            {data.optimalSubjectsCount} óptimas
          </p>
        </div>

        <div className="siga-glass-surface rounded-2xl border p-4">
          <div className="flex items-center justify-between gap-2 text-[11.5px] font-medium text-muted-foreground">
            <span>Avisos docentes</span>
            <Megaphone
              className={cn(
                "size-3.5",
                data.teacherAbsences.length > 0
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-muted-foreground"
              )}
              aria-hidden="true"
            />
          </div>
          <div className="font-kpi-num mt-2 flex items-baseline gap-1.5 text-2xl font-light text-foreground sm:text-[26px]">
            <span>{data.teacherAbsences.length}</span>
            <span className="text-xs font-normal text-muted-foreground">
              en 7 días
            </span>
          </div>
          <p className="mt-1 truncate text-[11px] text-muted-foreground">
            {pulse.todayAbsenceAlerts.length > 0
              ? `${pulse.todayAbsenceAlerts.length} reporte(s) activo(s) hoy`
              : "Sin ausencias reportadas hoy"}
          </p>
        </div>
      </section>

      {!data.hasEnrollment ? (
        <Empty className="siga-glass-surface rounded-[24px] border border-dashed py-10">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CalendarCheck2 aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>
              Tu matrícula del período escolar vigente aún no está activa
            </EmptyTitle>
            <EmptyDescription>
              Cuando Control de Estudios active tu sección del año en curso,
              podrás consultar aquí tus clases diarias, avisos docentes y
              semáforo de asistencia.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          {/* BLOQUE 1: Mi Día Escolar + Alertas de Ausencia Docente */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            {/* Línea de tiempo del día escolar */}
            <section
              aria-label="Clases de hoy en el liceo"
              className="siga-glass-surface flex flex-col gap-4 rounded-[24px] border p-5 sm:p-6 lg:col-span-7"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold tracking-[-0.02em] text-foreground">
                    Hoy en el Liceo
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Secuencia horaria de tu sección en tiempo real (hora de
                    Venezuela).
                  </p>
                </div>
                {pulse.todayBlocks.length > 0 ? (
                  <Badge variant="secondary" className="tabular-nums">
                    {pulse.todayBlocks.length} bloque(s) hoy
                  </Badge>
                ) : null}
              </div>

              {pulse.todayBlocks.length === 0 ? (
                <div className="siga-glass-inner flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-4 py-8 text-center">
                  <CalendarDays
                    className="size-6 text-muted-foreground/75"
                    aria-hidden="true"
                  />
                  <p className="text-sm font-medium text-foreground">
                    {pulse.phase === "weekend"
                      ? "Hoy no hay jornada presencial (fin de semana)"
                      : "Sin bloques programados para hoy"}
                  </p>
                  {pulse.nextSchoolDayFirstBlock ? (
                    <p className="text-xs text-muted-foreground">
                      {pulse.nextSchoolDayLabel ?? "Próximo día"} inicias con{" "}
                      <strong className="font-medium text-foreground">
                        {pulse.nextSchoolDayFirstBlock.subjectName}
                      </strong>{" "}
                      a las{" "}
                      {formatCompact12hTime(
                        parseTimeToMinutes(
                          pulse.nextSchoolDayFirstBlock.startTime
                        )
                      )}{" "}
                      ({pulse.nextSchoolDayFirstBlock.roomLabel}).
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Cuando tu sección tenga horario publicado, verás cada
                      clase y su aula aquí.
                    </p>
                  )}
                </div>
              ) : (
                <ol className="flex flex-col gap-2.5">
                  {pulse.todayBlocks.map((block) => {
                    const isCurrent = clock.hydrated && block.state === "current";
                    const isCompleted =
                      clock.hydrated && block.state === "completed";

                    return (
                      <li
                        key={block.id}
                        className={cn(
                          "siga-glass-inner relative rounded-2xl border p-3.5 transition-all",
                          isCurrent &&
                            "border-primary/55 ring-2 ring-primary/25 dark:border-sky-400/55 dark:ring-sky-400/20",
                          block.hasTeacherAbsence &&
                            "border-amber-500/45 bg-amber-500/8",
                          isCompleted && !block.hasTeacherAbsence && "opacity-75"
                        )}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary tabular-nums dark:text-sky-300">
                                <Clock className="size-3" aria-hidden="true" />
                                {block.timeRangeCompact}
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                · {block.blockLabel}
                              </span>
                              {isCurrent ? (
                                <Badge className="px-2 py-0 text-[10px]">
                                  En curso ({pulse.currentBlockRemainingMinutes}{" "}
                                  min)
                                </Badge>
                              ) : isCompleted ? (
                                <Badge
                                  variant="secondary"
                                  className="px-2 py-0 text-[10px]"
                                >
                                  Concluida
                                </Badge>
                              ) : null}
                            </div>

                            <h3 className="mt-1 text-sm font-semibold text-foreground">
                              <Link
                                href={`/estudiante/asignaturas/${encodeURIComponent(block.subjectCode)}`}
                                className="hover:text-primary hover:underline dark:hover:text-sky-300"
                              >
                                {block.subjectName}
                              </Link>
                            </h3>

                            <div className="mt-1.5 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-muted-foreground">
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="size-3" aria-hidden="true" />
                                {block.roomLabel}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <UserCheck
                                  className="size-3"
                                  aria-hidden="true"
                                />
                                {block.teacherName}
                              </span>
                            </div>
                          </div>

                          {block.hasTeacherAbsence && block.absenceAlert ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/45 bg-amber-500/15 px-2.5 py-0.5 text-[10.5px] font-semibold text-amber-800 dark:text-amber-200">
                              <AlertTriangle
                                className="size-3"
                                aria-hidden="true"
                              />
                              Docente ausente
                            </span>
                          ) : null}
                        </div>

                        {isCurrent ? (
                          <div
                            className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-muted/80"
                            role="progressbar"
                            aria-label="Avance del bloque en curso"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={pulse.currentBlockProgressPercent}
                          >
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-primary to-sky-400 transition-all duration-500"
                              style={{
                                width: `${pulse.currentBlockProgressPercent}%`,
                              }}
                            />
                          </div>
                        ) : null}

                        {block.hasTeacherAbsence && block.absenceAlert ? (
                          <p className="mt-2 rounded-lg bg-amber-500/12 px-2.5 py-1.5 text-[11.5px] text-amber-900 dark:text-amber-100">
                            {getTeacherAbsenceStatusLabel(
                              block.absenceAlert.status
                            )}
                            . Atento a las orientaciones de Coordinación de tu
                            mención.
                          </p>
                        ) : null}
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>

            {/* Avisos verificados de Ausencia Docente (hoy + próximos 7 días) */}
            <section
              aria-label="Avisos verificados de ausencia docente"
              className="siga-glass-surface flex flex-col gap-4 rounded-[24px] border p-5 sm:p-6 lg:col-span-5"
            >
              <div>
                <h2 className="text-base font-semibold tracking-[-0.02em] text-foreground">
                  Avisos de Ausencia Docente
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Notificaciones verificadas para tu sección (hoy y próximos 7
                  días).
                </p>
              </div>

              {data.teacherAbsences.length === 0 ? (
                <div className="siga-glass-inner flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-4 py-8 text-center">
                  <CheckCircle2
                    className="size-6 text-emerald-600/85 dark:text-emerald-400"
                    aria-hidden="true"
                  />
                  <p className="text-sm font-medium text-foreground">
                    Actividades docentes con normalidad
                  </p>
                  <p className="max-w-xs text-xs text-muted-foreground">
                    No hay ausencias docentes reportadas para tu sección hoy ni
                    en los próximos 7 días.
                  </p>
                </div>
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {data.teacherAbsences.map((alert) => {
                    const isTodayAlert = alert.absenceDate === clock.dateIso;
                    return (
                      <li
                        key={alert.id}
                        className={cn(
                          "siga-glass-inner space-y-2 rounded-2xl border p-3.5",
                          isTodayAlert && "border-amber-500/45 bg-amber-500/8"
                        )}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground tabular-nums">
                            <Megaphone
                              className="size-3.5 text-amber-600 dark:text-amber-400"
                              aria-hidden="true"
                            />
                            {isTodayAlert
                              ? "Hoy"
                              : formatVenezuelanDateIso(alert.absenceDate)}
                          </span>
                          <span className="rounded-full border border-amber-500/35 bg-amber-500/12 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:text-amber-200">
                            {getTeacherAbsenceStatusLabel(alert.status)}
                          </span>
                        </div>

                        <p className="text-xs font-semibold text-foreground">
                          {alert.teacherName}
                        </p>

                        {alert.subjectNames.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {alert.subjectNames.map((name) => (
                              <Badge
                                key={name}
                                variant="secondary"
                                className="text-[10.5px]"
                              >
                                {name}
                              </Badge>
                            ))}
                          </div>
                        ) : null}

                        {alert.affectedBlocks.length > 0 ? (
                          <p className="text-[11px] text-muted-foreground">
                            Bloques afectados:{" "}
                            <span className="font-medium text-foreground">
                              {alert.affectedBlocks.join(", ")}
                            </span>
                          </p>
                        ) : (
                          <p className="text-[11px] text-muted-foreground">
                            Aplica a la jornada completa de este docente en tu
                            sección.
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>

          {/* BLOQUE 2: Semáforo de Asistencia por Área de Formación (75 % MPPE) */}
          <section
            aria-label="Semáforo de asistencia por área de formación"
            className="siga-glass-surface space-y-4 rounded-[24px] border p-5 sm:p-6"
          >
            <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-center">
              <div className="min-w-0">
                <h2 className="text-base font-semibold tracking-[-0.02em] text-foreground">
                  Semáforo de Asistencia por Área de Formación (75 % MPPE)
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Calculado sobre tus pases de asistencia reales. Asistencia,
                  retardo e inasistencia justificada cuentan como cumplidas.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div
                  role="group"
                  aria-label="Filtrar áreas por nivel de asistencia"
                  className="siga-glass-inner inline-flex flex-wrap items-center gap-0.5 rounded-xl border p-1 sm:flex-nowrap"
                >
                  {(
                    [
                      { id: "all", label: `Todas (${data.subjects.length})` },
                      {
                        id: "red",
                        label: `Riesgo (${data.atRiskSubjectsCount})`,
                      },
                      {
                        id: "amber",
                        label: `Observación (${data.observationSubjectsCount})`,
                      },
                      {
                        id: "green",
                        label: `Óptimas (${data.optimalSubjectsCount})`,
                      },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={healthFilter === item.id}
                      onClick={() => handleSelectHealthFilter(item.id)}
                      className={cn(
                        "cursor-pointer whitespace-nowrap rounded-lg px-2.5 py-1 text-[11.5px] font-medium transition-colors",
                        healthFilter === item.id
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                {data.subjects.length > 0 ? (
                  <Button
                    type="button"
                    size="sm"
                    variant={isTrafficLightExpanded ? "outline" : "default"}
                    aria-expanded={isTrafficLightExpanded}
                    onClick={() => setIsTrafficLightExpanded((prev) => !prev)}
                    className="rounded-xl text-xs whitespace-nowrap"
                  >
                    <span>
                      {isTrafficLightExpanded
                        ? "Contraer áreas"
                        : `Ver áreas (${filteredSubjects.length})`}
                    </span>
                    <ChevronDown
                      data-icon="inline-end"
                      className={cn(
                        "transition-transform duration-200",
                        isTrafficLightExpanded && "rotate-180"
                      )}
                      aria-hidden="true"
                    />
                  </Button>
                ) : null}
              </div>
            </div>

            {!isTrafficLightExpanded ? null : filteredSubjects.length === 0 ? (
              <div className="siga-glass-inner rounded-2xl border border-dashed py-8 text-center text-xs text-muted-foreground">
                No hay áreas de formación en esta categoría actualmente.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {filteredSubjects.map((sub) => {
                    const barWidth =
                      sub.attendancePercent !== null
                        ? Math.min(100, Math.max(0, sub.attendancePercent))
                        : 0;
                    return (
                      <article
                        key={sub.curriculumSubjectId}
                        className="siga-glass-inner flex flex-col justify-between gap-2.5 rounded-2xl border p-3.5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="text-sm font-semibold text-foreground">
                              <Link
                                href={`/estudiante/asignaturas/${encodeURIComponent(sub.subjectCode)}`}
                                className="hover:text-primary hover:underline dark:hover:text-sky-300"
                              >
                                {sub.subjectName}
                              </Link>
                            </h3>
                            <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">
                              {sub.teacherName ?? "Docente por asignar"} ·{" "}
                              {sub.totalSessions} sesión(es) registrada(s)
                            </p>
                          </div>

                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <span className="font-kpi-num text-xl leading-none font-semibold text-foreground tabular-nums">
                              {sub.attendancePercent !== null
                                ? `${sub.attendancePercent}%`
                                : "—"}
                            </span>
                            <span
                              className={cn(
                                "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                                getHealthBadgeTone(sub.healthLevel)
                              )}
                            >
                              {getHealthLevelLabel(sub.healthLevel)}
                            </span>
                          </div>
                        </div>

                        {/* Barra calibrada con marcador visual del mínimo reglamentario 75 % */}
                        <div className="space-y-1.5">
                          <div
                            className="relative h-2 w-full overflow-hidden rounded-full bg-muted/80"
                            role="progressbar"
                            aria-label={`Asistencia en ${sub.subjectName}: ${sub.attendancePercent ?? 0}%`}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={barWidth}
                          >
                            <div
                              className={cn(
                                "h-full rounded-full transition-all duration-500",
                                getHealthBarColor(sub.healthLevel)
                              )}
                              style={{ width: `${barWidth}%` }}
                            />
                            <span
                              aria-hidden="true"
                              title="Mínimo reglamentario 75 % MPPE"
                              className="absolute top-0 bottom-0 left-[75%] w-[2px] bg-foreground/75"
                            />
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground tabular-nums">
                            <div className="flex flex-wrap items-center gap-2.5">
                              <span>
                                Asistió:{" "}
                                <strong className="text-foreground">
                                  {sub.presentCount}
                                </strong>
                              </span>
                              <span>
                                Retardo:{" "}
                                <strong className="text-foreground">
                                  {sub.lateCount}
                                </strong>
                              </span>
                              <span>
                                Justif.:{" "}
                                <strong className="text-foreground">
                                  {sub.justifiedCount}
                                </strong>
                              </span>
                              <span>
                                Faltas:{" "}
                                <strong
                                  className={cn(
                                    sub.absentCount > 0
                                      ? "text-rose-600 dark:text-rose-400"
                                      : "text-foreground"
                                  )}
                                >
                                  {sub.absentCount}
                                </strong>
                              </span>
                            </div>
                            <span className="text-[10.5px]">Mín. 75 %</span>
                          </div>
                        </div>

                        <p
                          className={cn(
                            "rounded-xl px-3 py-1.5 text-[11.5px] font-medium",
                            sub.healthLevel === "red"
                              ? "bg-rose-500/12 text-rose-700 dark:text-rose-300"
                              : sub.healthLevel === "amber"
                                ? "bg-amber-500/12 text-amber-800 dark:text-amber-200"
                                : "bg-background/60 text-muted-foreground"
                          )}
                        >
                          {sub.marginSummary}
                        </p>
                      </article>
                    );
                  })}
                </div>

                <div className="flex justify-center pt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    aria-expanded={isTrafficLightExpanded}
                    onClick={() => setIsTrafficLightExpanded(false)}
                    className="siga-glass-inner rounded-xl text-xs"
                  >
                    <span>Contraer áreas</span>
                    <ChevronDown
                      data-icon="inline-end"
                      className="rotate-180 transition-transform duration-200"
                      aria-hidden="true"
                    />
                  </Button>
                </div>
              </>
            )}
          </section>

          {/* BLOQUE 3: Calendario Mensual Interactivo de Asistencia */}
          <section
            aria-label="Calendario mensual de asistencia"
            className="siga-glass-surface rounded-[24px] border p-5 sm:p-6"
          >
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-base font-semibold tracking-[-0.02em] text-foreground">
                  Calendario Mensual de Asistencia
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Selecciona cualquier fecha para revisar qué áreas registraron
                  asistencia ese día.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleShiftMonth(-1)}
                  aria-label="Mes anterior"
                  className="siga-glass-inner size-8 rounded-xl p-0"
                >
                  <ChevronLeft className="size-4" aria-hidden="true" />
                </Button>
                <span className="min-w-[136px] text-center text-xs font-semibold text-foreground">
                  {calendarGrid.monthLabel}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleShiftMonth(1)}
                  aria-label="Mes siguiente"
                  className="siga-glass-inner size-8 rounded-xl p-0"
                >
                  <ChevronRight className="size-4" aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={handleJumpToday}
                  className="rounded-xl text-xs"
                >
                  Hoy
                </Button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-12">
              {/* Cuadrícula de días */}
              <div className="space-y-3 lg:col-span-7">
                <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted-foreground">
                  {CALENDAR_WEEKDAYS.map((dayName) => (
                    <div key={dayName} className="py-1">
                      {dayName}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1.5">
                  {calendarGrid.days.map((cell) => {
                    const isSelected = cell.dateIso === selectedDateIso;
                    const tone = cell.dominantStatus
                      ? getRecordStatusTone(cell.dominantStatus)
                      : null;

                    return (
                      <button
                        key={cell.dateIso}
                        type="button"
                        onClick={() => setSelectedDateIso(cell.dateIso)}
                        aria-pressed={isSelected}
                        aria-label={`${formatVenezuelanDateIso(cell.dateIso)}: ${cell.sessions.length} pase(s) de asistencia`}
                        className={cn(
                          "relative flex h-12 cursor-pointer flex-col items-center justify-center rounded-xl border text-xs transition-all focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none",
                          cell.inCurrentMonth
                            ? "border-border/60 bg-background/55 text-foreground hover:border-primary/45"
                            : "border-transparent bg-transparent text-muted-foreground/45 hover:bg-muted/30",
                          cell.isToday &&
                            "border-primary/60 font-semibold text-primary dark:border-sky-400/60 dark:text-sky-300",
                          isSelected &&
                            "border-primary bg-primary/12 ring-2 ring-primary/30 dark:border-sky-400 dark:bg-sky-400/15"
                        )}
                      >
                        <span className="tabular-nums">{cell.dayNumber}</span>
                        {tone ? (
                          <span className="mt-1 flex items-center gap-0.5">
                            <span
                              className={cn("size-1.5 rounded-full", tone.dot)}
                            />
                            {cell.sessions.length > 1 ? (
                              <span className="text-[9px] text-muted-foreground tabular-nums">
                                {cell.sessions.length}
                              </span>
                            ) : null}
                          </span>
                        ) : (
                          <span className="mt-1 h-1.5" aria-hidden="true" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Leyenda de colores */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-3 text-[11px] text-muted-foreground">
                  <div className="flex flex-wrap items-center gap-3">
                    {(
                      [
                        { status: "present", label: "Asistió" },
                        { status: "late", label: "Retardo" },
                        { status: "justified", label: "Justificada" },
                        { status: "absent", label: "Inasistencia" },
                      ] as const
                    ).map((item) => (
                      <span
                        key={item.status}
                        className="inline-flex items-center gap-1.5"
                      >
                        <i
                          className={cn(
                            "size-2 rounded-full",
                            getRecordStatusTone(item.status).dot
                          )}
                        />
                        {item.label}
                      </span>
                    ))}
                  </div>
                  <span className="tabular-nums">
                    {calendarGrid.totalSessionsInMonth} registro(s) este mes
                  </span>
                </div>
              </div>

              {/* Detalle del día seleccionado */}
              <div className="siga-glass-inner flex flex-col gap-3 rounded-2xl border p-4 lg:col-span-5">
                <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2.5">
                  <div>
                    <h3 className="text-xs font-semibold text-foreground">
                      Detalle del {formatVenezuelanDateIso(selectedDateIso)}
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      {selectedDaySessions.length === 0
                        ? "Sin registros en esta fecha"
                        : `${selectedDaySessions.length} pase(s) de asistencia`}
                    </p>
                  </div>
                  {selectedDateIso === clock.dateIso ? (
                    <Badge variant="secondary" className="text-[10px]">
                      Hoy
                    </Badge>
                  ) : null}
                </div>

                {selectedDaySessions.length === 0 ? (
                  <div className="flex flex-1 flex-col items-center justify-center gap-1.5 py-8 text-center">
                    <CalendarDays
                      className="size-5 text-muted-foreground/65"
                      aria-hidden="true"
                    />
                    <p className="text-xs font-medium text-foreground">
                      Sin pases de asistencia ese día
                    </p>
                    <p className="max-w-[230px] text-[11px] text-muted-foreground">
                      Haz clic en una fecha marcada con punto de color para
                      consultar el registro completo por área.
                    </p>
                  </div>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {selectedDaySessions.map((sess) => {
                      const tone = getRecordStatusTone(sess.status);
                      return (
                        <li
                          key={sess.recordId}
                          className="rounded-xl border border-border/60 bg-background/65 p-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-xs font-semibold text-foreground">
                                {sess.subjectName}
                              </p>
                              <p className="mt-0.5 text-[11px] text-muted-foreground">
                                {sess.blockLabel} · {sess.momentName}
                              </p>
                            </div>
                            <span
                              className={cn(
                                "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                                tone.pill
                              )}
                            >
                              {getAttendanceStatusLabel(sess.status)}
                            </span>
                          </div>
                          {sess.teacherName ? (
                            <p className="mt-1.5 text-[11px] text-muted-foreground">
                              Docente: {sess.teacherName}
                            </p>
                          ) : null}
                          {sess.note ? (
                            <p className="mt-1 text-[11px] text-foreground/85 italic">
                              “{sess.note}”
                            </p>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

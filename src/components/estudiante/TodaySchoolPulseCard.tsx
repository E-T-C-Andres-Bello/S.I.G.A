"use client";

import * as React from "react";
import Link from "next/link";
import { useReducedMotion } from "motion/react";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarCheck2,
  Clock,
  MapPin,
  Megaphone,
  Radio,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { cn } from "cn";
import type { StudentScheduleBlock } from "@/features/estudiante/dashboard-data";
import {
  getCaracasClockSnapshot,
  getTeacherAbsenceStatusLabel,
  resolveLiveSchoolDayPulse,
  type StudentTeacherAbsenceAlert,
} from "@/features/estudiante/attendance-metrics";
import {
  formatCompact12hTime,
  parseTimeToMinutes,
} from "@/features/estudiante/schedule-grid";

export interface TodaySchoolPulseCardProps {
  scheduleBlocks: StudentScheduleBlock[];
  teacherAbsenceAlerts: StudentTeacherAbsenceAlert[];
  todayIso: string;
  canOpenAttendanceHub: boolean;
}

function resolveWeekdayFromIso(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y ?? 2026, (m ?? 1) - 1, d ?? 1));
  const jsDay = dt.getUTCDay();
  return jsDay === 0 ? 7 : jsDay;
}

function formatMinutesDelta(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}

/**
 * Franja viva «Hoy en el Liceo» integrada directamente dentro de la tarjeta Hero
 * de Inicio (`/estudiante`). Muestra la jornada diaria en tiempo real (hora de
 * Venezuela), avisos verificados de ausencia docente y acceso a `/estudiante/asistencia`.
 */
export function TodaySchoolPulseCard({
  scheduleBlocks,
  teacherAbsenceAlerts,
  todayIso,
  canOpenAttendanceHub,
}: TodaySchoolPulseCardProps) {
  const prefersReducedMotion = useReducedMotion();

  // Estado inicial determinista para evitar discrepancias de hidratación SSR/CSR
  const [clock, setClock] = React.useState(() => ({
    hydrated: false,
    dateIso: todayIso,
    weekday: resolveWeekdayFromIso(todayIso),
    currentMinutes: 7 * 60,
    clockLabel12h: "",
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
      });
    };
    syncClock();
    const timer = window.setInterval(syncClock, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const pulse = React.useMemo(
    () =>
      resolveLiveSchoolDayPulse({
        scheduleBlocks,
        teacherAbsences: teacherAbsenceAlerts,
        todayIso: clock.dateIso,
        weekday: clock.weekday,
        currentMinutes: clock.currentMinutes,
      }),
    [
      clock.currentMinutes,
      clock.dateIso,
      clock.weekday,
      scheduleBlocks,
      teacherAbsenceAlerts,
    ]
  );

  const hasTodayAlerts = pulse.todayAbsenceAlerts.length > 0;
  const hasUpcomingAlerts = pulse.upcomingAbsenceAlerts.length > 0;

  const statusPill = React.useMemo(() => {
    if (hasTodayAlerts) {
      return {
        label: `Aviso docente hoy (${pulse.todayAbsenceAlerts.length})`,
        tone: "border-amber-300/50 bg-amber-400/20 text-amber-100",
        dot: "bg-amber-300",
        live: true,
      };
    }
    if (clock.hydrated && pulse.phase === "in_class") {
      return {
        label: "En clase ahora",
        tone: "border-emerald-300/45 bg-emerald-400/20 text-emerald-100",
        dot: "bg-emerald-300",
        live: true,
      };
    }
    if (clock.hydrated && pulse.phase === "between_blocks") {
      return {
        label: "Receso · Próxima clase",
        tone: "border-sky-200/40 bg-white/15 text-sky-100",
        dot: "bg-sky-300",
        live: true,
      };
    }
    if (clock.hydrated && pulse.phase === "before_classes") {
      return {
        label: "Antes de iniciar jornada",
        tone: "border-white/25 bg-white/12 text-sky-100",
        dot: "bg-sky-300",
        live: false,
      };
    }
    return {
      label: "Hoy en el Liceo",
      tone: "border-white/25 bg-white/12 text-sky-100",
      dot: "bg-sky-300",
      live: false,
    };
  }, [clock.hydrated, hasTodayAlerts, pulse.phase, pulse.todayAbsenceAlerts.length]);

  return (
    <div
      aria-label="Pulso en vivo de hoy en el liceo y avisos de jornada"
      className={cn(
        "mt-5 rounded-2xl border p-3.5 backdrop-blur-md transition-colors sm:px-4 sm:py-3.5",
        hasTodayAlerts
          ? "border-amber-300/45 bg-amber-500/18"
          : "border-white/18 bg-white/10"
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1 space-y-1.5">
          {/* Etiquetas de pulso en vivo + hora Venezuela */}
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10.5px] font-semibold tracking-tight",
                statusPill.tone
              )}
            >
              <span className="relative flex size-1.5" aria-hidden="true">
                {statusPill.live && !prefersReducedMotion ? (
                  <span
                    className={cn(
                      "absolute inline-flex h-full w-full animate-ping rounded-full opacity-80",
                      statusPill.dot
                    )}
                  />
                ) : null}
                <span
                  className={cn(
                    "relative inline-flex size-1.5 rounded-full",
                    statusPill.dot
                  )}
                />
              </span>
              {statusPill.label}
            </span>

            {clock.hydrated && clock.clockLabel12h ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-white/18 bg-white/10 px-2 py-0.5 text-[10.5px] font-medium text-sky-100/90 tabular-nums">
                <Radio className="size-2.5 text-sky-200" aria-hidden="true" />
                {clock.clockLabel12h} · VE
              </span>
            ) : null}
          </div>

          {/* Estado principal de la jornada */}
          {clock.hydrated && pulse.phase === "in_class" && pulse.currentBlock ? (
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <p className="text-xs font-semibold text-white sm:text-[13.5px]">
                  {pulse.currentBlock.subjectName}
                </p>
                <span className="inline-flex items-center gap-1 rounded-md bg-white/15 px-1.5 py-0.5 text-[10.5px] font-medium text-white">
                  <MapPin className="size-2.5" aria-hidden="true" />
                  {pulse.currentBlock.roomLabel}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] text-sky-100/85">
                  <UserCheck className="size-3" aria-hidden="true" />
                  {pulse.currentBlock.teacherName}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-100 tabular-nums">
                  <Clock className="size-2.5" aria-hidden="true" />
                  Restan {formatMinutesDelta(pulse.currentBlockRemainingMinutes)}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <div
                  className="h-1 w-full max-w-[200px] overflow-hidden rounded-full bg-white/20"
                  role="progressbar"
                  aria-label="Progreso del bloque de clase en curso"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={pulse.currentBlockProgressPercent}
                >
                  <div
                    className="h-full rounded-full bg-sky-200 transition-all duration-500"
                    style={{ width: `${pulse.currentBlockProgressPercent}%` }}
                  />
                </div>
                {pulse.nextBlock ? (
                  <span className="text-[11px] text-sky-100/80">
                    Luego:{" "}
                    <strong className="font-medium text-white">
                      {pulse.nextBlock.subjectName}
                    </strong>{" "}
                    ({formatCompact12hTime(pulse.nextBlock.startMinutes)})
                  </span>
                ) : null}
              </div>
            </div>
          ) : clock.hydrated &&
            (pulse.phase === "before_classes" ||
              pulse.phase === "between_blocks") &&
            pulse.nextBlock ? (
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-sky-100/90">
              <span>
                Próxima clase:{" "}
                <strong className="font-semibold text-white">
                  {pulse.nextBlock.subjectName}
                </strong>
              </span>
              {pulse.nextBlockStartsInMinutes !== null ? (
                <span className="rounded-md bg-white/15 px-1.5 py-0.5 text-[10.5px] font-semibold text-white tabular-nums">
                  En {formatMinutesDelta(pulse.nextBlockStartsInMinutes)}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1 text-[11px] tabular-nums">
                <Clock className="size-2.5" aria-hidden="true" />
                {pulse.nextBlock.timeRangeCompact}
              </span>
              <span className="inline-flex items-center gap-1 text-[11px]">
                <MapPin className="size-2.5" aria-hidden="true" />
                {pulse.nextBlock.roomLabel}
              </span>
            </div>
          ) : pulse.nextSchoolDayFirstBlock ? (
            <p className="text-xs leading-relaxed text-sky-100/90">
              <strong className="font-semibold text-white">
                {pulse.phase === "weekend"
                  ? "Fin de semana escolar"
                  : "Jornada diaria concluida"}
              </strong>{" "}
              · {pulse.nextSchoolDayLabel ?? "Próximo día"} inicias con{" "}
              <strong className="font-medium text-white">
                {pulse.nextSchoolDayFirstBlock.subjectName}
              </strong>{" "}
              (
              {formatCompact12hTime(
                parseTimeToMinutes(pulse.nextSchoolDayFirstBlock.startTime)
              )}{" "}
              · {pulse.nextSchoolDayFirstBlock.roomLabel}).
            </p>
          ) : (
            <p className="flex items-center gap-1.5 text-xs text-sky-100/85">
              <Sparkles className="size-3.5 shrink-0 text-sky-200" aria-hidden="true" />
              <span>
                Tu horario diario y avisos de jornada aparecerán aquí en tiempo
                real.
              </span>
            </p>
          )}

          {/* Cinta de aviso docente dentro del Hero */}
          {hasTodayAlerts ? (
            <div
              role="status"
              className="mt-1.5 flex flex-col gap-1 rounded-xl border border-amber-300/35 bg-amber-950/30 px-2.5 py-1.5 text-[11px] text-amber-50"
            >
              {pulse.todayAbsenceAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex flex-wrap items-center justify-between gap-2"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Megaphone
                      className="size-3 shrink-0 text-amber-300"
                      aria-hidden="true"
                    />
                    <span>
                      <strong className="font-semibold">
                        {alert.teacherName}
                      </strong>{" "}
                      ausente hoy
                      {alert.subjectNames.length > 0
                        ? ` (${alert.subjectNames.join(", ")})`
                        : ""}
                    </span>
                  </span>
                  <span className="rounded-full bg-amber-400/25 px-2 py-0.5 text-[10px] font-semibold text-amber-100">
                    {getTeacherAbsenceStatusLabel(alert.status)}
                  </span>
                </div>
              ))}
            </div>
          ) : hasUpcomingAlerts ? (
            <p className="inline-flex items-center gap-1.5 text-[11px] text-amber-200">
              <AlertTriangle className="size-3 shrink-0" aria-hidden="true" />
              <span>
                {pulse.upcomingAbsenceAlerts.length} aviso(s) de ausencia
                docente programado(s) en los próximos 7 días.
              </span>
            </p>
          ) : null}
        </div>

        {canOpenAttendanceHub ? (
          <Link
            href="/estudiante/asistencia"
            className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 self-start rounded-full border border-white/25 bg-white/14 px-3.5 text-[11.5px] font-semibold text-white transition-colors hover:bg-white/24 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none sm:self-center"
          >
            <CalendarCheck2 className="size-3.5" aria-hidden="true" />
            <span>Mi asistencia</span>
            <ArrowUpRight className="size-3" aria-hidden="true" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}

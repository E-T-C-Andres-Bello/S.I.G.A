"use client";

import * as React from "react";
import { motion } from "motion/react";
import {
  ArrowUpRight,
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock,
  GraduationCap,
} from "lucide-react";
import { cn } from "cn";
import type { StudentDashboardData } from "@/features/estudiante/dashboard-data";
import type { DashboardUserProfile } from "@/lib/supabase/dashboard-session";
import { CountUp, SigaAnalyticsBento } from "./SigaAnalyticsBento";

export interface StudentDashboardViewProps {
  profile: DashboardUserProfile;
  data: StudentDashboardData;
  /** Fecha actual ISO (`YYYY-MM-DD`) en zona America/Caracas calculada en servidor. */
  todayIso: string;
  /** Saludo contextual ("Buenos días" | "Buenas tardes" | "Buenas noches"). */
  greeting?: string;
}

const WEEKDAY_SINGLE_LETTERS = ["L", "M", "M", "J", "V", "S", "D"];
const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];
const FULL_WEEKDAYS = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

const ORBIT_ANGLES_DEG = [-68, -14, 46, 138, 206];

function buildWeekDays(todayIso: string) {
  const [y, m, d] = todayIso.split("-").map(Number);
  const anchor = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  const jsDay = anchor.getUTCDay();
  const mondayOffset = jsDay === 0 ? -6 : 1 - jsDay;

  return Array.from({ length: 7 }, (_, idx) => {
    const dt = new Date(anchor);
    dt.setUTCDate(anchor.getUTCDate() + mondayOffset + idx);
    const iso = dt.toISOString().slice(0, 10);
    return {
      iso,
      letter: WEEKDAY_SINGLE_LETTERS[idx] ?? "",
      dayNumber: dt.getUTCDate(),
      isToday: iso === todayIso,
    };
  });
}

function formatEvaluationDate(iso: string): string {
  const [, month, day] = iso.split("-");
  const monthIdx = Number(month) - 1;
  const monthShort = (MONTH_NAMES[monthIdx] ?? "").slice(0, 3);
  return `${day} ${monthShort}`;
}

interface MiniSparklineProps {
  values: number[];
  strokeClassName: string;
}

function MiniSparkline({ values, strokeClassName }: MiniSparklineProps) {
  const width = 56;
  const height = 22;

  const pointsAttr = React.useMemo(() => {
    if (values.length < 2) {
      return `2,${height - 6} 18,${height - 6} 36,${height - 6} ${width - 4},${height - 6}`;
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const stepX = (width - 8) / (values.length - 1);

    return values
      .map((val, idx) => {
        const x = 4 + idx * stepX;
        const normalized = (val - min) / span;
        const y = height - 4 - normalized * (height - 8);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [values]);

  const lastPoint = pointsAttr.split(" ").at(-1)?.split(",") ?? ["52", "16"];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn("h-5.5 w-14 shrink-0 overflow-visible", strokeClassName)}
      fill="none"
      aria-hidden="true"
    >
      <polyline
        points={pointsAttr}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={values.length >= 2 ? 0.92 : 0.42}
      />
      <circle
        cx={lastPoint[0]}
        cy={lastPoint[1]}
        r="2.2"
        fill="currentColor"
        opacity={values.length >= 2 ? 1 : 0.58}
      />
    </svg>
  );
}

/**
 * Mini cuadrícula Waffle (10 celdas) para visualizar proporción de asignaturas
 * evaluadas sobre el total inscrito (Mejora #9 del Plan UI/UX Pro Max).
 */
function MiniSubjectWaffle({
  evaluated,
  total,
}: {
  evaluated: number;
  total: number;
}) {
  const cells = 10;
  const activeCount =
    total > 0 ? Math.min(cells, Math.round((evaluated / total) * cells)) : 0;

  return (
    <div
      aria-hidden="true"
      className="grid grid-cols-5 gap-1 self-end pb-0.5"
      title={`${evaluated} de ${total} asignaturas evaluadas`}
    >
      {Array.from({ length: cells }, (_, i) => (
        <span
          key={i}
          className={cn(
            "size-2 rounded-[2.5px] transition-colors",
            i < activeCount ? "bg-white" : "bg-white/25"
          )}
        />
      ))}
    </div>
  );
}

export function StudentDashboardView({
  profile,
  data,
  todayIso,
  greeting = "Bienvenido",
}: StudentDashboardViewProps) {
  const [y, m, d] = todayIso.split("-").map(Number);
  const todayDate = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  const todayDayNum = String(todayDate.getUTCDate()).padStart(2, "0");
  const todayWeekday = FULL_WEEKDAYS[todayDate.getUTCDay()] ?? "";
  const todayMonthName = MONTH_NAMES[todayDate.getUTCMonth()] ?? "";
  const todayMonthYear = `${todayMonthName} ${todayDate.getUTCFullYear()}`;
  const weekStrip = React.useMemo(() => buildWeekDays(todayIso), [todayIso]);

  const [selectedDayIso, setSelectedDayIso] = React.useState<string | null>(
    null
  );
  const heroRef = React.useRef<HTMLElement | null>(null);

  const progressRadius = 56;
  const progressCircumference = 2 * Math.PI * progressRadius;
  const clampedProgress = Math.max(0, Math.min(100, data.completionPercent));
  const strokeDashoffset =
    progressCircumference - (clampedProgress / 100) * progressCircumference;

  const gradedSubjectsCount = React.useMemo(
    () =>
      data.subjectsSummary.filter(
        (s) => s.finalNumeric !== null || s.finalLiteral !== null
      ).length,
    [data.subjectsSummary]
  );

  const numericGradeSeries = React.useMemo(
    () =>
      data.subjectsSummary
        .map((s) => s.finalNumeric)
        .filter((n): n is number => typeof n === "number"),
    [data.subjectsSummary]
  );

  const orbitBadges = React.useMemo(() => {
    if (data.subjectsSummary.length > 0) {
      return ORBIT_ANGLES_DEG.slice(
        0,
        Math.min(5, data.subjectsSummary.length)
      ).map((deg, idx) => ({
        angleDeg: deg,
        label:
          data.subjectsSummary[idx]?.subjectCode.slice(0, 3).toUpperCase() ??
          "AB",
      }));
    }
    return ORBIT_ANGLES_DEG.map((deg, idx) => ({
      angleDeg: deg,
      label: ["I", "II", "III", "IV", "V"][idx] ?? "•",
    }));
  }, [data.subjectsSummary]);

  const filteredEvaluations = React.useMemo(() => {
    if (!selectedDayIso) return data.upcomingEvaluations;
    return data.upcomingEvaluations.filter(
      (ev) => ev.scheduledDate === selectedDayIso
    );
  }, [data.upcomingEvaluations, selectedDayIso]);

  const enrollmentSubtitle = data.hasEnrollment
    ? `${data.gradeYear}.º Año · ${data.mencionName ?? "Mención"} · Sección ${data.sectionLetter ?? "—"}`
    : "Matrícula pendiente por asignar";

  /* Inclinación 3D sutil del Hero en puntero de ratón (Mejora #12 del Plan) */
  const handleHeroPointerMove = React.useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (e.pointerType !== "mouse") return;
      const el = heroRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width - 0.5;
      const ny = (e.clientY - rect.top) / rect.height - 0.5;
      el.style.setProperty("--rx", `${(-ny * 3.2).toFixed(2)}deg`);
      el.style.setProperty("--ry", `${(nx * 3.8).toFixed(2)}deg`);
    },
    []
  );

  const handleHeroPointerLeave = React.useCallback(() => {
    const el = heroRef.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  }, []);

  const statCards = [
    {
      title: "Promedio del Momento",
      numericValue: data.averageGrade,
      decimals: true,
      suffix: "",
      fallbackText: "—",
      subtitle: "Escala MPPE 1–20",
      badge: data.averageGrade !== null ? "Consolidado" : "Sin notas",
      badgePositive: data.averageGrade !== null && data.averageGrade >= 10,
      icon: Award,
      highlighted: false,
      series: numericGradeSeries,
      sparkClass: "text-primary dark:text-[#7dd3fc]",
      kind: "sparkline" as const,
    },
    {
      title: "Asistencia",
      numericValue: data.attendancePercent,
      decimals: false,
      suffix: "%",
      fallbackText: "—",
      subtitle:
        data.attendanceSessionsCount > 0
          ? `${data.attendanceSessionsCount} pases · Meta ≥75%`
          : "Sin pases · Meta ≥75%",
      badge:
        data.attendancePercent !== null
          ? data.attendancePercent >= 75
            ? "Óptima"
            : "En alerta"
          : "En espera",
      badgePositive:
        data.attendancePercent !== null && data.attendancePercent >= 75,
      icon: CheckCircle2,
      highlighted: false,
      series:
        data.attendancePercent !== null
          ? [data.attendancePercent]
          : ([] as number[]),
      sparkClass: "text-emerald-600 dark:text-emerald-400",
      kind: "sparkline" as const,
    },
    {
      title: "Asignaturas",
      numericValue: data.enrolledSubjectsCount,
      decimals: false,
      suffix: "",
      fallbackText: "0",
      subtitle: data.mencionName
        ? `Pensum ${data.mencionName}`
        : "Malla curricular pendiente",
      badge:
        data.enrolledSubjectsCount > 0
          ? `${gradedSubjectsCount}/${data.enrolledSubjectsCount} eval.`
          : "Sin malla",
      badgePositive: false,
      icon: BookOpen,
      highlighted: true,
      series: numericGradeSeries,
      sparkClass: "text-sky-200",
      kind: "waffle" as const,
    },
    {
      title: "En gestión",
      numericValue: data.activeLoansAndRequestsCount,
      decimals: false,
      suffix: "",
      fallbackText: "0",
      subtitle: "Biblioteca y constancias",
      badge: data.activeLoansAndRequestsCount > 0 ? "En curso" : "Al día",
      badgePositive: data.activeLoansAndRequestsCount === 0,
      icon: ClipboardList,
      highlighted: false,
      series: [] as number[],
      sparkClass: "text-primary dark:text-[#7dd3fc]",
      kind: "sparkline" as const,
    },
  ];

  return (
    <div className="font-hero flex flex-col gap-5 pb-8">
      {/* Encabezado abierto estilo Glassy Dashboard V24 */}
      <motion.div
        id="resumen"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"
      >
        <div>
          <h1 className="text-[1.85rem] leading-[1.22] font-normal tracking-[-0.03em] text-balance text-foreground sm:text-[2.25rem]">
            {greeting}, {profile.firstName}
          </h1>
          <p className="mt-1.5 text-[13px] leading-[1.55] text-muted-foreground">
            {todayWeekday}, {Number(todayDayNum)} de{" "}
            {todayMonthName.toLowerCase()} · {enrollmentSubtitle}
            {data.schoolYearName ? ` · ${data.schoolYearName}` : ""}
          </p>
        </div>

        <span className="siga-glass-pill inline-flex w-fit items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium text-foreground">
          <GraduationCap className="size-3.5 text-primary" aria-hidden="true" />
          <span>
            {data.activeMomentName ?? "Momento Pedagógico por definir"}
          </span>
        </span>
      </motion.div>

      {/* Fila 1 — Hero Card (8 cols) + Agenda Semanal Interactiva (4 cols) */}
      <div className="air-3d-perspective grid grid-cols-1 items-stretch gap-5 lg:grid-cols-12">
        {/* Tarjeta Hero Cobalt Glass (Nivel z3 + inclinación 3D sutil) */}
        <motion.section
          ref={heroRef}
          aria-label="Resumen del momento pedagógico"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
          onPointerMove={handleHeroPointerMove}
          onPointerLeave={handleHeroPointerLeave}
          className="siga-glass-hero air-3d-card relative flex flex-col justify-between overflow-hidden rounded-[28px] border p-6 text-white sm:p-7 lg:col-span-8"
        >
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/12 px-3 py-1 text-[11px] font-medium text-sky-100">
                <span
                  className="size-1.5 rounded-full bg-sky-300"
                  aria-hidden="true"
                />
                {profile.accessTier === "verified_workspace"
                  ? "Cuenta Workspace activa"
                  : "Acceso provisional por cédula"}
              </span>

              <h2 className="mt-4 text-2xl leading-[1.34] font-normal tracking-[-0.022em] text-balance text-white sm:text-[1.95rem] sm:leading-[1.3]">
                {data.hasEnrollment ? (
                  data.enrolledSubjectsCount > 0 ? (
                    <>
                      Tu período académico está en{" "}
                      <i className="font-cursive inline-block px-0.5 py-0.5 font-normal text-sky-200">
                        marcha
                      </i>{" "}
                      este lapso
                    </>
                  ) : (
                    <>
                      Tu matrícula ya está{" "}
                      <i className="font-cursive inline-block px-0.5 py-0.5 font-normal text-sky-200">
                        activa
                      </i>{" "}
                      este año
                    </>
                  )
                ) : (
                  <>
                    Tu ficha estudiantil está{" "}
                    <i className="font-cursive inline-block px-0.5 py-0.5 font-normal text-sky-200">
                      lista
                    </i>{" "}
                    para iniciar
                  </>
                )}
              </h2>

              <p className="mt-3 max-w-md text-[13.5px] leading-[1.65] text-sky-100/85">
                {profile.accessTier === "provisional_cedula"
                  ? "Vincula tu correo @etcandresbello.org para desbloquear todo el ecosistema escolar."
                  : "Consulta aquí tu avance oficial consolidado, evaluaciones y analítica curricular."}
              </p>

              {/* 3 cifras clave tabulares con CountUp */}
              <div className="mt-7 flex flex-wrap items-baseline gap-8">
                <div>
                  <span className="font-kpi-num block text-2xl leading-[1.15] font-light text-white">
                    <CountUp value={gradedSubjectsCount} />
                  </span>
                  <span className="mt-1.5 block text-xs leading-normal text-sky-100/80">
                    evaluadas
                  </span>
                </div>

                <div>
                  <span className="font-kpi-num block text-2xl leading-[1.15] font-light text-white">
                    <CountUp value={data.enrolledSubjectsCount} />
                  </span>
                  <span className="mt-1.5 block text-xs leading-normal text-sky-100/80">
                    asignaturas
                  </span>
                </div>

                <div>
                  <span className="font-kpi-num block text-2xl leading-[1.15] font-light text-white">
                    {data.attendancePercent !== null ? (
                      <CountUp value={data.attendancePercent} suffix="%" />
                    ) : (
                      "—"
                    )}
                  </span>
                  <span className="mt-1.5 block text-xs leading-normal text-sky-100/80">
                    asistencia
                  </span>
                </div>
              </div>

              {/* 2 píldoras de acción estilo V24 */}
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <a
                  href="#asignaturas"
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-4 text-xs font-semibold text-[#0b1d59] shadow-sm transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
                >
                  <span>Explorar analítica</span>
                  <ArrowUpRight className="size-3.5" aria-hidden="true" />
                </a>

                <a
                  href="#agenda"
                  className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-4 text-xs font-medium text-white transition-colors hover:bg-white/18 focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:outline-none"
                >
                  <span>Próximas citas ({data.upcomingEvaluations.length})</span>
                </a>
              </div>
            </div>

            {/* Anillo Orbital de Progreso estilo V24 */}
            <div
              className="relative flex size-44 shrink-0 items-center justify-center self-center sm:size-48"
              role="img"
              aria-label={`Avance de materias evaluadas en el momento: ${clampedProgress}%`}
            >
              <svg
                viewBox="0 0 140 140"
                className="size-full -rotate-90"
                aria-hidden="true"
              >
                <circle
                  cx="70"
                  cy="70"
                  r={progressRadius}
                  fill="none"
                  stroke="rgba(255,255,255,0.22)"
                  strokeWidth="7.5"
                />
                <motion.circle
                  cx="70"
                  cy="70"
                  r={progressRadius}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="7.5"
                  strokeLinecap="round"
                  strokeDasharray={progressCircumference}
                  initial={{ strokeDashoffset: progressCircumference }}
                  animate={{ strokeDashoffset }}
                  transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                />
              </svg>

              {orbitBadges.map((node) => {
                const rad = (node.angleDeg * Math.PI) / 180;
                const xPct = 50 + Math.cos(rad) * 40;
                const yPct = 50 + Math.sin(rad) * 40;
                return (
                  <span
                    key={`${node.label}-${node.angleDeg}`}
                    aria-hidden="true"
                    style={{ left: `${xPct}%`, top: `${yPct}%` }}
                    className="absolute flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/45 bg-white/20 text-[9.5px] font-semibold text-white backdrop-blur-md shadow-xs"
                  >
                    {node.label}
                  </span>
                );
              })}

              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="font-kpi-num text-[2.1rem] leading-[1.1] font-light text-white">
                  {data.enrolledSubjectsCount > 0 ? (
                    <CountUp value={clampedProgress} suffix="%" />
                  ) : (
                    "0%"
                  )}
                </span>
                <span className="mt-2 text-[11px] leading-normal font-medium text-sky-100/80">
                  cierre lapso
                </span>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Tarjeta Calendario Semanal e Interactiva (Mejora #14 del Plan) */}
        <motion.aside
          id="agenda"
          aria-label="Calendario y próximas evaluaciones"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
          className="siga-glass-surface flex flex-col justify-between rounded-[28px] border p-5 sm:p-6 lg:col-span-4"
        >
          <div>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <span className="font-kpi-num text-[2.85rem] leading-[1.08] font-light text-foreground">
                  {todayDayNum}
                </span>
                <div>
                  <p className="text-sm leading-snug font-medium text-foreground">
                    {todayWeekday}
                  </p>
                  <p className="mt-1 text-xs leading-normal text-muted-foreground">
                    {todayMonthYear} · {data.upcomingEvaluations.length} eventos
                  </p>
                </div>
              </div>

              {selectedDayIso ? (
                <button
                  type="button"
                  onClick={() => setSelectedDayIso(null)}
                  className="siga-glass-inner cursor-pointer rounded-xl border px-2.5 py-1.5 text-[11px] font-medium text-primary transition-colors hover:bg-primary/10 dark:text-[#7dd3fc]"
                >
                  Ver todos
                </button>
              ) : (
                <span className="siga-glass-inner flex size-9 shrink-0 items-center justify-center rounded-xl border text-primary dark:text-[#7dd3fc]">
                  <Calendar className="size-4" aria-hidden="true" />
                </span>
              )}
            </div>

            {/* Tira semanal interactiva L M M J V S D */}
            <div
              role="group"
              aria-label="Filtrar evaluaciones por día de la semana"
              className="siga-glass-inner mt-5 grid grid-cols-7 gap-1 rounded-2xl border p-1.5 text-center"
            >
              {weekStrip.map((day) => {
                const isSelected = selectedDayIso === day.iso;
                const isHighlighted = isSelected || (!selectedDayIso && day.isToday);
                return (
                  <button
                    key={day.iso}
                    type="button"
                    onClick={() =>
                      setSelectedDayIso((prev) =>
                        prev === day.iso ? null : day.iso
                      )
                    }
                    aria-pressed={isSelected}
                    aria-current={day.isToday ? "date" : undefined}
                    className={cn(
                      "flex cursor-pointer flex-col items-center justify-center rounded-xl py-2 transition-all focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none",
                      isHighlighted
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-primary/10 hover:text-foreground"
                    )}
                  >
                    <span className="text-[10px] font-medium">{day.letter}</span>
                    <span
                      className={cn(
                        "mt-1 text-xs font-semibold tabular-nums",
                        isHighlighted
                          ? "text-primary-foreground"
                          : "text-foreground"
                      )}
                    >
                      {day.dayNumber}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="my-4 h-px bg-border/60" />

          <div>
            {filteredEvaluations.length === 0 ? (
              <div className="siga-glass-inner flex items-center gap-3 rounded-2xl border border-dashed px-3.5 py-4">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary dark:text-[#7dd3fc]">
                  <Clock className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground">
                    {selectedDayIso
                      ? `Sin evaluaciones el ${formatEvaluationDate(selectedDayIso)}`
                      : "Agenda despejada esta semana"}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                    Las evaluaciones con fecha aparecerán listadas aquí.
                  </p>
                </div>
              </div>
            ) : (
              <ul className="flex flex-col gap-2">
                {filteredEvaluations.slice(0, 3).map((ev) => (
                  <li
                    key={ev.id}
                    className="siga-glass-inner flex items-center justify-between gap-3 rounded-2xl border px-3.5 py-2.5 transition-colors"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="shrink-0 text-[11px] font-medium tabular-nums text-muted-foreground">
                        {formatEvaluationDate(ev.scheduledDate)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-foreground">
                          {ev.title}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {ev.subjectName}
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-primary/14 px-2 py-0.5 text-[10.5px] font-semibold tabular-nums text-primary dark:text-[#7dd3fc]">
                      {ev.weightPercent}%
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </motion.aside>
      </div>

      {/* Fila 2 — 4 Tarjetas KPI a todo lo ancho (con CountUp, Waffle y Sparklines) */}
      <section
        aria-label="Indicadores académicos principales"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {statCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.35,
                delay: 0.05 * index,
                ease: [0.22, 1, 0.36, 1],
              }}
              whileHover={{ y: -3 }}
              className={cn(
                "flex flex-col justify-between rounded-[24px] border p-5 transition-shadow",
                card.highlighted
                  ? "siga-glass-hero text-white"
                  : "siga-glass-surface text-foreground"
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-xl border",
                    card.highlighted
                      ? "border-white/25 bg-white/15 text-white"
                      : "siga-glass-inner text-primary dark:text-[#7dd3fc]"
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                </span>

                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold",
                    card.highlighted
                      ? "bg-white/18 text-white"
                      : card.badgePositive
                        ? "bg-emerald-500/14 text-emerald-700 dark:text-emerald-300"
                        : "bg-primary/12 text-primary dark:text-[#7dd3fc]"
                  )}
                >
                  {card.badge}
                </span>
              </div>

              <div className="mt-6 flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p
                    className={cn(
                      "font-kpi-num text-[2.2rem] leading-[1.12] font-light",
                      card.highlighted ? "text-white" : "text-foreground"
                    )}
                  >
                    {card.numericValue !== null ? (
                      <CountUp
                        value={card.numericValue}
                        decimals={card.decimals}
                        suffix={card.suffix}
                      />
                    ) : (
                      card.fallbackText
                    )}
                  </p>
                  <p
                    className={cn(
                      "mt-3.5 text-[13px] leading-snug font-medium",
                      card.highlighted ? "text-white" : "text-foreground"
                    )}
                  >
                    {card.title}
                  </p>
                  <p
                    className={cn(
                      "mt-1 truncate text-xs leading-[1.45]",
                      card.highlighted
                        ? "text-sky-100/85"
                        : "text-muted-foreground"
                    )}
                  >
                    {card.subtitle}
                  </p>
                </div>

                {card.kind === "waffle" ? (
                  <MiniSubjectWaffle
                    evaluated={gradedSubjectsCount}
                    total={data.enrolledSubjectsCount}
                  />
                ) : (
                  <MiniSparkline
                    values={card.series}
                    strokeClassName={card.sparkClass}
                  />
                )}
              </div>
            </motion.div>
          );
        })}
      </section>

      {/* Fila 3 — Bloque AnalyticsBento (Curva MPPE, Ondas, Treemap y Radar) */}
      <SigaAnalyticsBento data={data} />
    </div>
  );
}

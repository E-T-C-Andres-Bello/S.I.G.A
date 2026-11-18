"use client";

import * as React from "react";
import { motion } from "motion/react";
import {
  BarChart3,
  BookOpen,
  Briefcase,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileSpreadsheet,
  FolderKanban,
  GraduationCap,
  HeartHandshake,
  Library,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "cn";
import type { DashboardUserProfile } from "@/lib/supabase/dashboard-session";
import { formatVenezuelanCedulaDisplay } from "@/lib/validators/auth";
import { ROLE_LABELS } from "./DashboardSidebar";
import { CountUp } from "./SigaAnalyticsBento";

export type RoleWorkspaceKey =
  | "docente"
  | "control-estudios"
  | "analitica"
  | "orientacion"
  | "pasantias"
  | "biblioteca"
  | "representante";

interface RoleModuleSpec {
  badge: string;
  headlineStart: string;
  headlineItalic: string;
  headlineEnd: string;
  description: string;
  routePath: string;
  kpis: {
    title: string;
    subtitle: string;
    badge: string;
    icon: LucideIcon;
    highlighted?: boolean;
  }[];
  modulesList: {
    title: string;
    detail: string;
    status: string;
  }[];
}

const ROLE_SPECS: Record<RoleWorkspaceKey, RoleModuleSpec> = {
  docente: {
    badge: "Espacio Docente y Coordinación",
    headlineStart: "Tu panel de aula está ",
    headlineItalic: "listo",
    headlineEnd: " para este período",
    description:
      "Base del módulo docente conectada a Supabase RLS. Aquí tu equipo puede integrar planes de evaluación, carga de calificaciones y diario de clases.",
    routePath: "src/app/(dashboard)/docente/page.tsx",
    kpis: [
      {
        title: "Secciones asignadas",
        subtitle: "Carga académica activa",
        badge: "En espera",
        icon: Users,
      },
      {
        title: "Planes de evaluación",
        subtitle: "Publicados en el lapso",
        badge: "0 publicados",
        icon: ClipboardCheck,
      },
      {
        title: "Pases de asistencia",
        subtitle: "Control diario de aula",
        badge: "Módulo base",
        icon: CheckCircle2,
        highlighted: true,
      },
      {
        title: "Diario de clases",
        subtitle: "Bitácora pedagógica",
        badge: "Al día",
        icon: BookOpen,
      },
    ],
    modulesList: [
      {
        title: "Planes de Evaluación (`evaluation_plans` & `evaluation_items`)",
        detail: "Creación y publicación de cortes evaluativos por sección.",
        status: "Tabla y RLS listos",
      },
      {
        title: "Carga de Notas (`siga_registrar_nota` RPC)",
        detail: "Registro en escala MPPE 1–20 con bitácora inmutable.",
        status: "RPC activo",
      },
      {
        title: "Asistencia y Diario (`attendance_records` & `class_diary_entries`)",
        detail: "Pase de lista por sesión y firma digital de contenidos.",
        status: "Tabla y RLS listos",
      },
    ],
  },
  "control-estudios": {
    badge: "Control de Estudios y Secretaría",
    headlineStart: "Gestión de matrícula ",
    headlineItalic: "centralizada",
    headlineEnd: " en tiempo real",
    description:
      "Base del módulo administrativo conectada a Supabase RLS. Lista para integrar inscripción de secciones, cierres de momento y emisión de constancias con QR.",
    routePath: "src/app/(dashboard)/control-estudios/page.tsx",
    kpis: [
      {
        title: "Matrícula activa",
        subtitle: "Estudiantes inscritos",
        badge: "Año escolar",
        icon: Users,
      },
      {
        title: "Secciones abiertas",
        subtitle: "1.º a 6.º Año Técnico",
        badge: "3 menciones",
        icon: FolderKanban,
      },
      {
        title: "Solicitudes y constancias",
        subtitle: "Verificación pública QR",
        badge: "Módulo base",
        icon: FileSpreadsheet,
        highlighted: true,
      },
      {
        title: "Cierres de momento",
        subtitle: "Auditoría de actas MPPE",
        badge: "Control",
        icon: ShieldCheck,
      },
    ],
    modulesList: [
      {
        title: "Pre-inscripción y Matrícula (`users` & `enrollments`)",
        detail: "Asignación de año, mención técnica y sección por estudiante.",
        status: "Tabla y RLS listos",
      },
      {
        title: "Solicitudes Estudiantiles (`student_requests` & `official_documents`)",
        detail: "Emisión de boletines y constancias verificables en `/verificar`.",
        status: "RPC QR activo",
      },
      {
        title: "Apertura y Cierre de Momentos (`momentos` & `school_years`)",
        detail: "Control de ventanas de calificación y reaperturas autorizadas.",
        status: "Tabla y RLS listos",
      },
    ],
  },
  analitica: {
    badge: "Dirección Institucional y Analítica",
    headlineStart: "Supervisión ejecutiva ",
    headlineItalic: "integral",
    headlineEnd: " del plantel",
    description:
      "Base del panel directivo para la E.T.C. \"Andrés Bello\". Lista para integrar indicadores de rendimiento por mención, auditoría MPPE y gestión de roles.",
    routePath: "src/app/(dashboard)/analitica/page.tsx",
    kpis: [
      {
        title: "Promedio institucional",
        subtitle: "Consolidado por mención",
        badge: "MPPE 1–20",
        icon: BarChart3,
      },
      {
        title: "Asistencia global",
        subtitle: "Meta institucional ≥75%",
        badge: "En espera",
        icon: CheckCircle2,
      },
      {
        title: "Personal y roles",
        subtitle: "8 roles institucionales",
        badge: "Activo",
        icon: ShieldCheck,
        highlighted: true,
      },
      {
        title: "Bitácora de auditoría",
        subtitle: "Trazabilidad inmutable",
        badge: "Protegido",
        icon: ClipboardCheck,
      },
    ],
    modulesList: [
      {
        title: "Rendimiento por Mención (`menciones` & `moment_final_grades`)",
        detail: "Comparativa entre Aduanas, Administración y Telemática.",
        status: "Esquema listo",
      },
      {
        title: "Gobierno de Roles (`user_roles` & `role_permissions`)",
        detail: "Asignación de coordinaciones, docentes y personal administrativo.",
        status: "RLS activo",
      },
      {
        title: "Auditoría de Calificaciones (`grade_audit_logs`)",
        detail: "Historial anti-tamper de modificaciones de notas.",
        status: "Trigger activo",
      },
    ],
  },
  orientacion: {
    badge: "Orientación y Bienestar Estudiantil",
    headlineStart: "Acompañamiento psicopedagógico ",
    headlineItalic: "protegido",
    headlineEnd: " y confidencial",
    description:
      "Base del módulo de Orientación con aislamiento estricto RLS. Lista para seguimiento socioeconómico, citaciones y actas de compromiso.",
    routePath: "src/app/(dashboard)/control-estudios/orientacion/page.tsx",
    kpis: [
      {
        title: "Expedientes activos",
        subtitle: "RLS confidencial",
        badge: "Privado",
        icon: HeartHandshake,
        highlighted: true,
      },
      {
        title: "Seguimientos del mes",
        subtitle: "Atenciones registradas",
        badge: "0 casos",
        icon: ClipboardCheck,
      },
      {
        title: "Alertas de asistencia",
        subtitle: "Detección temprana",
        badge: "Al día",
        icon: CheckCircle2,
      },
      {
        title: "Citaciones",
        subtitle: "Representantes y alumnos",
        badge: "0 pendientes",
        icon: Users,
      },
    ],
    modulesList: [
      {
        title: "Expedientes de Orientación (`orientation_records`)",
        detail: "Acceso exclusivo para Orientación y Dirección bajo RLS.",
        status: "Tabla y RLS listos",
      },
      {
        title: "Bitácora de Seguimiento (`orientation_followups`)",
        detail: "Acuerdos, entrevistas y evolución por estudiante.",
        status: "Tabla y RLS listos",
      },
    ],
  },
  pasantias: {
    badge: "Coordinación de Pasantías Técnicas",
    headlineStart: "Vinculación laboral ",
    headlineItalic: "técnica",
    headlineEnd: " de 6.º año",
    description:
      "Base del módulo de Pasantías. Lista para gestionar empresas aliadas, asignaciones de pasantes, bitácoras semanales y enlaces mágicos para tutores empresariales.",
    routePath: "src/app/(dashboard)/pasantias/page.tsx",
    kpis: [
      {
        title: "Empresas aliadas",
        subtitle: "Convenios activos",
        badge: "Puerto Ordaz",
        icon: Briefcase,
        highlighted: true,
      },
      {
        title: "Pasantes ubicados",
        subtitle: "Estudiantes de 6.º año",
        badge: "0 asignados",
        icon: Users,
      },
      {
        title: "Bitácoras semanales",
        subtitle: "Revisión de actividades",
        badge: "Al día",
        icon: ClipboardCheck,
      },
      {
        title: "Evaluaciones externas",
        subtitle: "Magic links de tutores",
        badge: "Seguro",
        icon: ShieldCheck,
      },
    ],
    modulesList: [
      {
        title: "Empresas y Plazas (`internship_companies` & `internship_placements`)",
        detail: "Registro de tutores académicos e industriales.",
        status: "Tabla y RLS listos",
      },
      {
        title: "Bitácoras e Informes (`internship_weekly_logs` & `internship_reports`)",
        detail: "Seguimiento semanal y validación por Magic Link.",
        status: "Tabla y RLS listos",
      },
    ],
  },
  biblioteca: {
    badge: "Biblioteca y Recursos Audiovisuales",
    headlineStart: "Catálogo bibliográfico ",
    headlineItalic: "abierto",
    headlineEnd: " a la comunidad",
    description:
      "Base del módulo de Biblioteca. Lista para controlar préstamos de ejemplares, solvencias y reservas de espacios o equipos audiovisuales.",
    routePath: "src/app/(dashboard)/biblioteca/page.tsx",
    kpis: [
      {
        title: "Ejemplares en catálogo",
        subtitle: "Inventario registrado",
        badge: "Catálogo",
        icon: Library,
        highlighted: true,
      },
      {
        title: "Préstamos activos",
        subtitle: "Alumnos y docentes",
        badge: "0 activos",
        icon: BookOpen,
      },
      {
        title: "Reservas audiovisuales",
        subtitle: "Equipos y laboratorios",
        badge: "Al día",
        icon: Calendar,
      },
      {
        title: "Solvencias",
        subtitle: "Control de entregas",
        badge: "100%",
        icon: CheckCircle2,
      },
    ],
    modulesList: [
      {
        title: "Inventario y Préstamos (`library_items` & `library_loans`)",
        detail: "Control de fechas de vencimiento y devoluciones.",
        status: "Tabla y RLS listos",
      },
      {
        title: "Recursos Audiovisuales (`audiovisual_resources` & `audiovisual_reservations`)",
        detail: "Reserva de proyectores, salas y laboratorios.",
        status: "Tabla y RLS listos",
      },
    ],
  },
  representante: {
    badge: "Portal de Representantes",
    headlineStart: "Seguimiento familiar ",
    headlineItalic: "directo",
    headlineEnd: " y verificable",
    description:
      "Base del módulo de Representantes. Lista para consultar boletines, asistencia y avisos de los estudiantes vinculados bajo tu representación.",
    routePath: "src/app/(dashboard)/representante/page.tsx",
    kpis: [
      {
        title: "Representados",
        subtitle: "Vínculos verificados",
        badge: "Familiar",
        icon: Users,
        highlighted: true,
      },
      {
        title: "Boletines disponibles",
        subtitle: "Con código QR oficial",
        badge: "En espera",
        icon: FileSpreadsheet,
      },
      {
        title: "Asistencia reportada",
        subtitle: "Resumen del lapso",
        badge: "Al día",
        icon: CheckCircle2,
      },
      {
        title: "Avisos del plantel",
        subtitle: "Comunicaciones oficiales",
        badge: "0 nuevos",
        icon: ClipboardCheck,
      },
    ],
    modulesList: [
      {
        title: "Vínculo Familiar (`student_guardians`)",
        detail: "Lectura autorizada exclusivamente para los alumnos representados.",
        status: "Tabla y RLS listos",
      },
    ],
  },
};

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

export interface RoleGenericDashboardViewProps {
  profile: DashboardUserProfile;
  workspaceKey: RoleWorkspaceKey;
  todayIso: string;
  greeting: string;
}

/**
 * Dashboard base Glassmorphism para los roles de Docente, Control de Estudios,
 * Dirección, Orientación, Pasantías, Biblioteca y Representante.
 * Evita errores 404 y entrega a cada compañero de equipo su plantilla lista para desarrollar.
 */
export function RoleGenericDashboardView({
  profile,
  workspaceKey,
  todayIso,
  greeting,
}: RoleGenericDashboardViewProps) {
  const spec = ROLE_SPECS[workspaceKey];
  const [y, m, d] = todayIso.split("-").map(Number);
  const todayDate = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  const todayDayNum = String(todayDate.getUTCDate()).padStart(2, "0");
  const todayWeekday = FULL_WEEKDAYS[todayDate.getUTCDay()] ?? "";
  const todayMonthName = MONTH_NAMES[todayDate.getUTCMonth()] ?? "";
  const todayMonthYear = `${todayMonthName} ${todayDate.getUTCFullYear()}`;
  const weekStrip = React.useMemo(() => buildWeekDays(todayIso), [todayIso]);

  return (
    <div className="font-hero flex flex-col gap-5 pb-8">
      {/* Encabezado abierto */}
      <motion.div
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
            {todayMonthName.toLowerCase()} · Rol activo:{" "}
            {ROLE_LABELS[profile.primaryRole]} ·{" "}
            {profile.institutionalEmail ??
              formatVenezuelanCedulaDisplay(profile.cedula)}
          </p>
        </div>

        <span className="siga-glass-pill inline-flex w-fit items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium text-foreground">
          <GraduationCap className="size-3.5 text-primary" aria-hidden="true" />
          <span>{spec.badge}</span>
        </span>
      </motion.div>

      {/* Fila 1 — Hero del Rol (8 cols) + Calendario Semanal (4 cols) */}
      <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-12">
        <motion.section
          aria-label={spec.badge}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
          className="siga-glass-hero relative flex flex-col justify-between overflow-hidden rounded-[28px] border p-6 text-white sm:p-7 lg:col-span-8"
        >
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/12 px-3 py-1 text-[11px] font-medium text-sky-100">
              <span
                className="size-1.5 rounded-full bg-emerald-300"
                aria-hidden="true"
              />
              Sesión autenticada · {ROLE_LABELS[profile.primaryRole]}
            </span>

            <h2 className="mt-4 text-2xl leading-[1.34] font-normal tracking-[-0.022em] text-balance text-white sm:text-[1.95rem] sm:leading-[1.3]">
              {spec.headlineStart}
              <i className="font-cursive inline-block px-0.5 py-0.5 font-normal text-sky-200">
                {spec.headlineItalic}
              </i>
              {spec.headlineEnd}
            </h2>

            <p className="mt-3 max-w-xl text-[13.5px] leading-[1.65] text-sky-100/85">
              {spec.description}
            </p>
          </div>

          <div className="mt-7 flex flex-wrap items-center justify-between gap-4 border-t border-white/15 pt-4">
            <div>
              <span className="block text-[11px] font-medium text-sky-200/85">
                 Punto de entrada para desarrollo del equipo
              </span>
              <code className="mt-1 inline-block rounded-lg bg-black/25 px-2.5 py-1 text-xs text-white">
                {spec.routePath}
              </code>
            </div>

            <span className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-[#0b1d59] shadow-xs">
              PostgreSQL RLS + Shell Activo
            </span>
          </div>
        </motion.section>

        {/* Calendario Semanal */}
        <motion.aside
          aria-label="Calendario institucional"
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
                    {todayMonthYear}
                  </p>
                </div>
              </div>
              <span className="siga-glass-inner flex size-9 shrink-0 items-center justify-center rounded-xl border text-primary dark:text-[#7dd3fc]">
                <Calendar className="size-4" aria-hidden="true" />
              </span>
            </div>

            <div className="siga-glass-inner mt-5 grid grid-cols-7 gap-1 rounded-2xl border p-1.5 text-center">
              {weekStrip.map((day) => (
                <div
                  key={day.iso}
                  aria-current={day.isToday ? "date" : undefined}
                  className={cn(
                    "flex flex-col items-center justify-center rounded-xl py-2",
                    day.isToday
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground"
                  )}
                >
                  <span className="text-[10px] font-medium">{day.letter}</span>
                  <span
                    className={cn(
                      "mt-1 text-xs font-semibold tabular-nums",
                      day.isToday ? "text-primary-foreground" : "text-foreground"
                    )}
                  >
                    {day.dayNumber}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="my-4 h-px bg-border/60" />

          <div className="siga-glass-inner flex items-center gap-3 rounded-2xl border border-dashed px-3.5 py-4">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary dark:text-[#7dd3fc]">
              <Clock className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground">
                Calendario operativo del rol
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                Listo para conectar eventos y cortes del módulo.
              </p>
            </div>
          </div>
        </motion.aside>
      </div>

      {/* Fila 2 — 4 Tarjetas KPI Base del Rol */}
      <section
        aria-label="Indicadores base del módulo"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {spec.kpis.map((card, index) => {
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
                      : "bg-primary/12 text-primary dark:text-[#7dd3fc]"
                  )}
                >
                  {card.badge}
                </span>
              </div>

              <div className="mt-6">
                <p
                  className={cn(
                    "font-kpi-num text-[2.2rem] leading-[1.12] font-light",
                    card.highlighted ? "text-white" : "text-foreground"
                  )}
                >
                  <CountUp value={0} />
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
            </motion.div>
          );
        })}
      </section>

      {/* Fila 3 — Guía de tablas y capacidades listas en Supabase para este rol */}
      <motion.section
        aria-label="Capas de base de datos listas para este módulo"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.14, ease: [0.22, 1, 0.36, 1] }}
        className="siga-glass-surface rounded-[28px] border p-5 sm:p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base leading-snug font-semibold tracking-tight text-foreground">
              Estructura de Base de Datos Lista para Integrar
            </h2>
            <p className="mt-1 text-xs leading-[1.5] text-muted-foreground">
              Tablas, políticas RLS y funciones disponibles en{" "}
              <code>00001_initial_baseline.sql</code> para este módulo
            </p>
          </div>
          <span className="siga-glass-inner rounded-full border px-3 py-1 text-[11px] font-medium text-foreground">
            {spec.modulesList.length} componentes base
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          {spec.modulesList.map((mod) => (
            <div
              key={mod.title}
              className="siga-glass-inner flex flex-col justify-between rounded-2xl border p-4"
            >
              <div>
                <span className="inline-flex rounded-full bg-emerald-500/14 px-2.5 py-0.5 text-[10.5px] font-semibold text-emerald-700 dark:text-emerald-300">
                  {mod.status}
                </span>
                <h3 className="mt-2.5 text-sm leading-snug font-semibold text-foreground">
                  {mod.title}
                </h3>
                <p className="mt-1.5 text-xs leading-[1.55] text-muted-foreground">
                  {mod.detail}
                </p>
              </div>
            </div>
          ))}
        </div>
      </motion.section>
    </div>
  );
}

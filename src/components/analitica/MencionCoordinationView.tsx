"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  AlertCircle,
  BookOpen,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  FlaskConical,
  Layers,
  Loader2,
  Plus,
  ShieldAlert,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { ROLE_LABELS } from "@/components/dashboard/DashboardSidebar";
import { CountUp } from "@/components/dashboard/SigaAnalyticsBento";
import {
  LAB_TOOL_TYPES,
  LAB_TOOL_TYPE_LABELS,
  type LabToolType,
  type MencionCoordinationData,
  type MencionLabScenarioItem,
  type MencionTeacherAbsenceItem,
} from "@/features/menciones/coordinacion-schemas";
import type { DashboardUserProfile } from "@/lib/auth/dashboard-session";
import { formatVenezuelanCedulaDisplay } from "@/lib/validators/auth";

type MencionTabKey = "supervision" | "escenarios" | "incidencias";

const PLAN_STATUS_LABELS: Record<string, string> = {
  published: "Publicado",
  locked: "Cerrado",
  draft: "Borrador",
  missing: "Sin plan",
};

const ABSENCE_REASON_LABELS: Record<string, string> = {
  medical: "Reposo médico",
  personal: "Motivo personal",
  institutional: "Comisión institucional",
};

const ABSENCE_STATUS_LABELS: Record<string, string> = {
  reported: "Reportada",
  acknowledged: "Acusada",
  reorganized: "Reorganizada",
};

const FULL_WEEKDAYS = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

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

export interface MencionCoordinationViewProps {
  profile: DashboardUserProfile;
  initialData: MencionCoordinationData | null;
  initialError?: string | null;
  todayIso: string;
  greeting: string;
}

export function MencionCoordinationView({
  profile,
  initialData,
  initialError = null,
  todayIso,
  greeting,
}: MencionCoordinationViewProps) {
  const router = useRouter();
  const [data, setData] = React.useState<MencionCoordinationData | null>(
    initialData
  );
  const [activeTab, setActiveTab] =
    React.useState<MencionTabKey>("supervision");
  const [showNewScenarioForm, setShowNewScenarioForm] = React.useState(false);

  // Formulario nuevo escenario
  const [gradeYear, setGradeYear] = React.useState<number>(1);
  const [toolType, setToolType] = React.useState<LabToolType>("telematica_sql");
  const [title, setTitle] = React.useState("");
  const [instructions, setInstructions] = React.useState("");
  const [isBaseCatalog, setIsBaseCatalog] = React.useState(true);
  const [submittingScenario, setSubmittingScenario] = React.useState(false);
  const submitLockRef = React.useRef(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  React.useEffect(() => {
    setData(initialData);
  }, [initialData]);

  React.useEffect(() => {
    const code = data?.selectedMencion?.code?.toUpperCase() ?? "";
    if (code.includes("ADUANA")) {
      setToolType("aduanas_tariff");
    } else if (code.includes("TURISMO")) {
      setToolType("turismo_routes");
    } else {
      setToolType("telematica_sql");
    }
  }, [data?.selectedMencion?.code]);

  const [y, m, d] = todayIso.split("-").map(Number);
  const todayDate = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  const todayDayNum = String(todayDate.getUTCDate()).padStart(2, "0");
  const todayWeekday = FULL_WEEKDAYS[todayDate.getUTCDay()] ?? "";
  const todayMonthName = MONTH_NAMES[todayDate.getUTCMonth()] ?? "";
  const todayMonthYear = `${todayMonthName} ${todayDate.getUTCFullYear()}`;

  const handleMencionSwitch = React.useCallback(
    (mencionId: string) => {
      router.push(`/analitica/mencion?mencionId=${encodeURIComponent(mencionId)}`);
    },
    [router]
  );

  const handleCreateScenario = React.useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!data?.selectedMencion || submitLockRef.current) return;
      submitLockRef.current = true;
      setSubmittingScenario(true);

      try {
        const res = await fetch("/api/menciones/coordinacion/scenarios", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mencionId: data.selectedMencion.id,
            gradeYear,
            toolType,
            title,
            instructions,
            isBaseCatalog,
          }),
        });
        const body = await res.json();
        if (!res.ok) {
          toast.error(body?.error ?? "No se pudo crear el escenario.");
          return;
        }

        const created = body.scenario as MencionLabScenarioItem;
        setData((prev) =>
          prev
            ? {
                ...prev,
                scenarios: [created, ...prev.scenarios],
                summary: {
                  ...prev.summary,
                  baseScenariosCount:
                    prev.summary.baseScenariosCount +
                    (created.isBaseCatalog ? 1 : 0),
                },
              }
            : prev
        );
        setTitle("");
        setInstructions("");
        setShowNewScenarioForm(false);
        toast.success("Escenario práctico registrado en el catálogo.");
      } catch {
        toast.error("Error de conexión al registrar el escenario.");
      } finally {
        submitLockRef.current = false;
        setSubmittingScenario(false);
      }
    },
    [data?.selectedMencion, gradeYear, instructions, isBaseCatalog, title, toolType]
  );

  const handleToggleBaseCatalog = React.useCallback(
    async (scenario: MencionLabScenarioItem) => {
      if (busyId) return;
      setBusyId(scenario.id);
      const nextValue = !scenario.isBaseCatalog;
      try {
        const res = await fetch(
          `/api/menciones/coordinacion/scenarios/${scenario.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isBaseCatalog: nextValue }),
          }
        );
        const body = await res.json();
        if (!res.ok) {
          toast.error(body?.error ?? "No se pudo actualizar el escenario.");
          return;
        }
        setData((prev) =>
          prev
            ? {
                ...prev,
                scenarios: prev.scenarios.map((s) =>
                  s.id === scenario.id ? { ...s, isBaseCatalog: nextValue } : s
                ),
                summary: {
                  ...prev.summary,
                  baseScenariosCount:
                    prev.summary.baseScenariosCount + (nextValue ? 1 : -1),
                },
              }
            : prev
        );
        toast.success(
          nextValue
            ? "Escenario aprobado como plantilla base de la mención."
            : "Escenario retirado del catálogo base."
        );
      } catch {
        toast.error("Error de conexión al actualizar.");
      } finally {
        setBusyId(null);
      }
    },
    [busyId]
  );

  const handleDeleteScenario = React.useCallback(
    async (scenario: MencionLabScenarioItem) => {
      if (busyId) return;
      setBusyId(scenario.id);
      try {
        const res = await fetch(
          `/api/menciones/coordinacion/scenarios/${scenario.id}`,
          { method: "DELETE" }
        );
        const body = await res.json();
        if (!res.ok) {
          toast.error(body?.error ?? "No se pudo eliminar el escenario.");
          return;
        }
        setData((prev) =>
          prev
            ? {
                ...prev,
                scenarios: prev.scenarios.filter((s) => s.id !== scenario.id),
                summary: {
                  ...prev.summary,
                  baseScenariosCount:
                    prev.summary.baseScenariosCount -
                    (scenario.isBaseCatalog ? 1 : 0),
                },
              }
            : prev
        );
        toast.success("Escenario eliminado del catálogo.");
      } catch {
        toast.error("Error de conexión al eliminar.");
      } finally {
        setBusyId(null);
      }
    },
    [busyId]
  );

  const handleAbsenceStatus = React.useCallback(
    async (
      absence: MencionTeacherAbsenceItem,
      nextStatus: "acknowledged" | "reorganized"
    ) => {
      if (busyId) return;
      setBusyId(absence.id);
      try {
        const res = await fetch(
          `/api/menciones/coordinacion/absences/${absence.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: nextStatus }),
          }
        );
        const body = await res.json();
        if (!res.ok) {
          toast.error(body?.error ?? "No se pudo actualizar la inasistencia.");
          return;
        }
        setData((prev) => {
          if (!prev) return prev;
          const updated = prev.teacherAbsences.map((a) =>
            a.id === absence.id ? { ...a, status: nextStatus } : a
          );
          return {
            ...prev,
            teacherAbsences: updated,
            summary: {
              ...prev.summary,
              openAbsencesCount: updated.filter((a) => a.status === "reported")
                .length,
            },
          };
        });
        toast.success(
          nextStatus === "acknowledged"
            ? "Aviso de inasistencia acusado."
            : "Suplencia y actividades marcadas como reorganizadas."
        );
      } catch {
        toast.error("Error de conexión al actualizar el aviso.");
      } finally {
        setBusyId(null);
      }
    },
    [busyId]
  );

  if (initialError && !data) {
    return (
      <div className="mx-auto max-w-4xl py-10">
        <div className="siga-glass-surface rounded-[28px] border p-8 text-center">
          <ShieldAlert className="mx-auto mb-3 size-10 text-amber-500" />
          <h1 className="text-xl font-semibold text-foreground">
            Coordinación de Mención no disponible
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{initialError}</p>
        </div>
      </div>
    );
  }

  const summary = data?.summary;
  const kpiCards = [
    {
      title: "Matrícula en Mención",
      subtitle: `${summary?.totalSections ?? 0} secciones activas`,
      badge: "Estudiantes",
      value: summary?.enrolledStudents ?? 0,
      icon: Users,
    },
    {
      title: "Cátedras Asignadas",
      subtitle: "Docentes activos en aula",
      badge: "Carga",
      value: summary?.activeAssignments ?? 0,
      icon: BookOpen,
    },
    {
      title: "Escenarios Base",
      subtitle: `${data?.scenarios.length ?? 0} registrados en total`,
      badge: "Laboratorio",
      value: summary?.baseScenariosCount ?? 0,
      icon: FlaskConical,
    },
    {
      title: "Inasistencias Abiertas",
      subtitle: `${summary?.incidentsCount ?? 0} incidencias en diario`,
      badge: "Atención",
      value: summary?.openAbsencesCount ?? 0,
      icon: AlertCircle,
    },
  ];

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
          <Layers className="size-3.5 text-primary" aria-hidden="true" />
          <span>
            Coordinación Técnica ·{" "}
            {data?.selectedMencion?.name ?? "Sin mención"}
          </span>
        </span>
      </motion.div>

      {/* Fila 1 — Hero Cobalto + Fecha */}
      <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-12">
        <motion.section
          aria-label="Resumen de coordinación de mención"
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
              Supervisión Acotada · {data?.selectedMencion?.name ?? "Mención"}
            </span>

            <h2 className="mt-4 text-2xl leading-[1.34] font-normal tracking-[-0.022em] text-balance text-white sm:text-[1.95rem] sm:leading-[1.3]">
              Gestión{" "}
              <i className="font-cursive inline-block px-0.5 py-0.5 font-normal text-sky-200">
                técnica
              </i>{" "}
              de 1.º a 6.º año
            </h2>

            <p className="mt-2.5 max-w-xl text-[13.5px] leading-[1.65] text-sky-100/85">
              Supervisión académica de secciones, estandarización del catálogo de
              prácticas de laboratorio y reorganización oportuna ante inasistencias
              docentes.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/15 pt-4">
            <div className="flex flex-wrap items-center gap-2">
              {!data?.isScopedToSingleMencion &&
              data &&
              data.allowedMenciones.length > 1 ? (
                <select
                  aria-label="Seleccionar mención técnica"
                  value={data.selectedMencion?.id ?? ""}
                  onChange={(e) => handleMencionSwitch(e.target.value)}
                  className="h-9 rounded-xl border border-white/25 bg-white/12 px-3 text-xs font-medium text-white outline-none backdrop-blur-md transition hover:bg-white/20 [&>option]:bg-[#0f172a] [&>option]:text-white"
                >
                  {data.allowedMenciones.map((mItem) => (
                    <option key={mItem.id} value={mItem.id}>
                      {mItem.name}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-sky-100">
                  Mención: {data?.selectedMencion?.name ?? "—"}
                </span>
              )}
            </div>

            <span className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-[#0b1d59] shadow-xs">
              {data?.activeSchoolYearName ?? "Período vigente"}
            </span>
          </div>
        </motion.section>

        <motion.aside
          aria-label="Calendario y corte de mención"
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

            <div className="siga-glass-inner mt-5 rounded-2xl border p-4">
              <span className="text-[11px] font-medium text-muted-foreground">
                Momento en curso
              </span>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {data?.activeMomentoName ?? "Sin momento activo"}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {data?.activeSchoolYearName ?? "Año escolar vigente"}
              </p>
            </div>
          </div>

          <div className="my-4 h-px bg-border/60" />

          <div className="siga-glass-inner flex items-center justify-between gap-3 rounded-2xl border px-4 py-3.5">
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground">
                Incidencias de diario
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Reportadas en tu mención
              </p>
            </div>
            <span className="font-kpi-num text-2xl font-light text-primary dark:text-[#7dd3fc]">
              <CountUp value={summary?.incidentsCount ?? 0} />
            </span>
          </div>
        </motion.aside>
      </div>

      {/* Fila 2 — 4 Tarjetas KPI */}
      <section
        aria-label="Indicadores de la mención"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {kpiCards.map((card, index) => {
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
              className="siga-glass-surface flex flex-col justify-between rounded-[24px] border p-5 text-foreground transition-shadow"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="siga-glass-inner flex size-9 items-center justify-center rounded-xl border text-primary dark:text-[#7dd3fc]">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <span className="siga-glass-pill rounded-full border px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {card.badge}
                </span>
              </div>

              <div className="mt-5">
                <span className="font-kpi-num block text-[2.45rem] leading-none font-light">
                  <CountUp value={card.value} />
                </span>
                <h3 className="mt-3 text-sm font-medium text-foreground">
                  {card.title}
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {card.subtitle}
                </p>
              </div>
            </motion.div>
          );
        })}
      </section>

      {/* Navegación por Pestañas */}
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            {
              key: "supervision",
              label: "Supervisión Académica",
              icon: ClipboardCheck,
            },
            {
              key: "escenarios",
              label: `Escenarios Prácticos (${data?.scenarios.length ?? 0})`,
              icon: FlaskConical,
            },
            {
              key: "incidencias",
              label: `Inasistencias e Incidencias (${
                (data?.teacherAbsences.length ?? 0) +
                (data?.diaryIncidents.length ?? 0)
              })`,
              icon: AlertCircle,
            },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium transition",
                isActive
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "siga-glass-pill text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="size-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: SUPERVISIÓN ACADÉMICA */}
      {activeTab === "supervision" && (
        <div className="space-y-5">
          <div className="siga-glass-surface rounded-[28px] border p-5 sm:p-6">
            <h2 className="text-base font-medium text-foreground">
              Secciones de la Mención
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Matrícula activa y capacidad instalada por año de estudio.
            </p>

            {!data || data.sections.length === 0 ? (
              <div className="siga-glass-inner mt-5 rounded-2xl border border-dashed p-6 text-center text-xs text-muted-foreground">
                No hay secciones registradas para esta mención en el período
                actual.
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.sections.map((sec) => (
                  <div
                    key={sec.sectionId}
                    className="siga-glass-inner flex items-center justify-between rounded-2xl border px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {sec.gradeYear}.º Año &quot;{sec.sectionLetter}&quot;
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {sec.enrolledCount} de {sec.capacity} cupos
                      </p>
                    </div>
                    <span className="siga-glass-pill rounded-full border px-2.5 py-0.5 text-xs font-medium text-primary dark:text-[#7dd3fc]">
                      {Math.round(
                        (sec.enrolledCount / Math.max(sec.capacity, 1)) * 100
                      )}
                      %
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="siga-glass-surface rounded-[28px] border p-5 sm:p-6">
            <h2 className="text-base font-medium text-foreground">
              Avance Docente y Planes de Evaluación
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Seguimiento de carga académica de las cátedras de tu mención.
            </p>

            {!data || data.assignments.length === 0 ? (
              <div className="siga-glass-inner mt-5 rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                No hay cátedras asignadas para esta mención en el período
                vigente.
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border/60 text-muted-foreground">
                      <th className="py-2.5 pr-4 font-medium">Docente</th>
                      <th className="py-2.5 pr-4 font-medium">Asignatura</th>
                      <th className="py-2.5 pr-4 font-medium">Sección</th>
                      <th className="py-2.5 pr-4 font-medium">Plan Evaluativo</th>
                      <th className="py-2.5 font-medium text-right">
                        Notas Cargadas
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {data.assignments.map((row) => (
                      <tr key={row.assignmentId} className="hover:bg-muted/20">
                        <td className="py-3 pr-4 font-medium text-foreground">
                          {row.teacherName}
                        </td>
                        <td className="py-3 pr-4 text-foreground">
                          {row.subjectName}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {row.gradeYear}.º &quot;{row.sectionLetter}&quot;
                        </td>
                        <td className="py-3 pr-4">
                          <span className="siga-glass-inner rounded-lg border px-2 py-0.5 text-[11px] font-medium text-foreground">
                            {PLAN_STATUS_LABELS[row.planStatus] ??
                              row.planStatus}
                          </span>
                        </td>
                        <td className="py-3 text-right font-medium text-foreground">
                          {row.gradedCount}/{row.enrolledCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: CATÁLOGO DE ESCENARIOS PRÁCTICOS */}
      {activeTab === "escenarios" && (
        <div className="siga-glass-surface rounded-[28px] border p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-medium text-foreground">
                Catálogo de Escenarios Prácticos
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Estandariza los ejercicios base para los laboratorios de{" "}
                {data?.selectedMencion?.name ?? "la mención"}.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowNewScenarioForm((v) => !v)}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-xs font-medium text-primary-foreground shadow-xs transition hover:bg-primary/90"
            >
              <Plus className="size-3.5" />
              <span>Nuevo escenario</span>
            </button>
          </div>

          {showNewScenarioForm && (
            <form
              onSubmit={handleCreateScenario}
              className="siga-glass-inner mt-5 space-y-4 rounded-2xl border p-4 sm:p-5"
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-foreground">
                    Año de estudio
                  </label>
                  <select
                    value={gradeYear}
                    onChange={(e) => setGradeYear(Number(e.target.value))}
                    className="h-9 w-full rounded-xl border border-border/70 bg-background/80 px-3 text-xs text-foreground outline-none focus:border-primary"
                  >
                    {[1, 2, 3, 4, 5, 6].map((yr) => (
                      <option key={yr} value={yr}>
                        {yr}.º Año
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-foreground">
                    Entorno de laboratorio
                  </label>
                  <select
                    value={toolType}
                    onChange={(e) => setToolType(e.target.value as LabToolType)}
                    className="h-9 w-full rounded-xl border border-border/70 bg-background/80 px-3 text-xs text-foreground outline-none focus:border-primary"
                  >
                    {LAB_TOOL_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {LAB_TOOL_TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">
                  Título del escenario práctico
                </label>
                <input
                  type="text"
                  required
                  minLength={4}
                  maxLength={140}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ej. Consulta de inventario y control de stock"
                  className="h-9 w-full rounded-xl border border-border/70 bg-background/80 px-3 text-xs text-foreground outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">
                  Consigna e instrucciones para el estudiante
                </label>
                <textarea
                  required
                  minLength={10}
                  maxLength={2000}
                  rows={3}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Describe los pasos, criterios de evaluación y entregables esperados..."
                  className="w-full rounded-xl border border-border/70 bg-background/80 p-3 text-xs text-foreground outline-none focus:border-primary"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="inline-flex items-center gap-2 text-xs text-foreground">
                  <input
                    type="checkbox"
                    checked={isBaseCatalog}
                    onChange={(e) => setIsBaseCatalog(e.target.checked)}
                    className="size-4 rounded border-border accent-primary"
                  />
                  <span>Aprobar como escenario base para todos los docentes</span>
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowNewScenarioForm(false)}
                    className="rounded-full border border-border/70 px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submittingScenario}
                    className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
                  >
                    {submittingScenario && (
                      <Loader2 className="size-3.5 animate-spin" />
                    )}
                    <span>Guardar escenario</span>
                  </button>
                </div>
              </div>
            </form>
          )}

          {!data || data.scenarios.length === 0 ? (
            <div className="siga-glass-inner mt-5 rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              Aún no hay escenarios prácticos registrados para esta mención.
            </div>
          ) : (
            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
              {data.scenarios.map((sc) => (
                <div
                  key={sc.id}
                  className="siga-glass-inner flex flex-col justify-between gap-3 rounded-2xl border p-4"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="siga-glass-pill rounded-full border px-2.5 py-0.5 text-[11px] font-medium text-primary dark:text-[#7dd3fc]">
                        {sc.gradeYear}.º Año ·{" "}
                        {LAB_TOOL_TYPE_LABELS[sc.toolType] ?? sc.toolType}
                      </span>
                      {sc.isBaseCatalog && (
                        <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-300">
                          Base aprobado
                        </span>
                      )}
                    </div>
                    <h3 className="mt-2.5 text-sm font-medium text-foreground">
                      {sc.title}
                    </h3>
                    <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                      {sc.instructions}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-2 border-t border-border/40 pt-3">
                    <button
                      type="button"
                      disabled={busyId === sc.id}
                      onClick={() => handleToggleBaseCatalog(sc)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border/70 px-3 py-1 text-[11px] font-medium text-foreground transition hover:bg-muted/40 disabled:opacity-50"
                    >
                      <CheckCircle2 className="size-3.5 text-emerald-500" />
                      <span>
                        {sc.isBaseCatalog
                          ? "Quitar de base"
                          : "Aprobar como base"}
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={busyId === sc.id}
                      onClick={() => handleDeleteScenario(sc)}
                      aria-label={`Eliminar ${sc.title}`}
                      className="inline-flex size-7 items-center justify-center rounded-full text-muted-foreground transition hover:bg-rose-500/15 hover:text-rose-500 disabled:opacity-50"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: INCIDENCIAS E INASISTENCIAS DOCENTES */}
      {activeTab === "incidencias" && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div className="siga-glass-surface rounded-[28px] border p-5 sm:p-6 lg:col-span-6">
            <h2 className="text-base font-medium text-foreground">
              Avisos de Inasistencia Docente
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Coordina suplencias o actividades de aula ante ausencias reportadas.
            </p>

            {!data || data.teacherAbsences.length === 0 ? (
              <div className="siga-glass-inner mt-5 rounded-2xl border border-dashed p-8 text-center text-xs text-muted-foreground">
                No hay avisos de inasistencia registrados en tu mención.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {data.teacherAbsences.map((ab) => (
                  <div
                    key={ab.id}
                    className="siga-glass-inner rounded-2xl border p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {ab.teacherName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {ab.absenceDate} ·{" "}
                          {ABSENCE_REASON_LABELS[ab.reasonCategory] ??
                            ab.reasonCategory}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                          ab.status === "reorganized"
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                            : ab.status === "acknowledged"
                              ? "bg-sky-500/15 text-sky-600 dark:text-sky-300"
                              : "bg-amber-500/15 text-amber-600 dark:text-amber-300"
                        )}
                      >
                        {ABSENCE_STATUS_LABELS[ab.status] ?? ab.status}
                      </span>
                    </div>

                    {ab.observation && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {ab.observation}
                      </p>
                    )}

                    {ab.status !== "reorganized" && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {ab.status === "reported" && (
                          <button
                            type="button"
                            disabled={busyId === ab.id}
                            onClick={() =>
                              handleAbsenceStatus(ab, "acknowledged")
                            }
                            className="rounded-full border border-border/70 px-3 py-1 text-[11px] font-medium text-foreground hover:bg-muted/40 disabled:opacity-50"
                          >
                            Acusar recibo
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={busyId === ab.id}
                          onClick={() => handleAbsenceStatus(ab, "reorganized")}
                          className="rounded-full bg-primary px-3 py-1 text-[11px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                        >
                          Marcar reorganizada
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="siga-glass-surface rounded-[28px] border p-5 sm:p-6 lg:col-span-6">
            <h2 className="text-base font-medium text-foreground">
              Incidencias en Diario de Clases
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Novedades pedagógicas y derivaciones registradas por docentes en
              aula.
            </p>

            {!data || data.diaryIncidents.length === 0 ? (
              <div className="siga-glass-inner mt-5 rounded-2xl border border-dashed p-8 text-center text-xs text-muted-foreground">
                No se han reportado incidencias recientes en el diario de clases.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {data.diaryIncidents.map((inc) => (
                  <div
                    key={inc.id}
                    className="siga-glass-inner rounded-2xl border p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {inc.subjectName} · {inc.gradeYear}.º &quot;
                          {inc.sectionLetter}&quot;
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {inc.entryDate} · {inc.teacherName}
                        </p>
                      </div>
                      {inc.deriveToOrientation && (
                        <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-300">
                          Derivado a Orientación
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-xs font-medium text-foreground">
                      Tema: {inc.topicCovered}
                    </p>
                    {inc.classroomIncidents && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {inc.classroomIncidents}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


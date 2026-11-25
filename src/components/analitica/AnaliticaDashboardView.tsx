"use client";

import * as React from "react";
import { motion } from "motion/react";
import {
  AlertTriangle,
  BarChart3,
  BookOpenCheck,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  GraduationCap,
  Layers,
  Loader2,
  ShieldAlert,
  TrendingDown,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { CountUp } from "@/components/dashboard/SigaAnalyticsBento";
import { ROLE_LABELS } from "@/components/dashboard/DashboardSidebar";
import {
  exportCdceMatrixCsv,
  exportFilterSubjectsCsv,
} from "@/features/analitica/export-cdce";
import type {
  AnalyticsBiOverview,
  TeacherSlaItem,
} from "@/features/analitica/schemas";
import type { DashboardUserProfile } from "@/lib/auth/dashboard-session";
import { formatVenezuelanCedulaDisplay } from "@/lib/validators/auth";

type AnaliticaTabKey = "sla" | "materias" | "riesgo" | "cdce";

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

const PLAN_STATUS_LABELS: Record<string, string> = {
  published: "Publicado",
  locked: "Cerrado",
  draft: "Borrador",
  missing: "Sin plan",
};

const MOMENTO_STATUS_LABELS: Record<string, string> = {
  open: "Carga abierta",
  locked: "Bloqueado",
  closed: "Cerrado",
  scheduled: "Programado",
};

function formatHoursLabel(hours: number | null): string {
  if (hours === null || Number.isNaN(hours)) return "—";
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 48) return `${hours.toFixed(1)} h`;
  return `${(hours / 24).toFixed(1)} días`;
}

export interface AnaliticaDashboardViewProps {
  profile: DashboardUserProfile;
  initialData: AnalyticsBiOverview | null;
  initialError?: string | null;
  todayIso: string;
  greeting: string;
}

export function AnaliticaDashboardView({
  profile,
  initialData,
  initialError = null,
  todayIso,
  greeting,
}: AnaliticaDashboardViewProps) {
  const [data, setData] = React.useState<AnalyticsBiOverview | null>(initialData);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(initialError);
  const [activeTab, setActiveTab] = React.useState<AnaliticaTabKey>("sla");
  const [selectedSchoolYearId, setSelectedSchoolYearId] = React.useState<string>(
    initialData?.activeSchoolYear?.id ?? ""
  );
  const [selectedMomento, setSelectedMomento] = React.useState<string>(
    initialData?.activeMomento ? String(initialData.activeMomento.momentNumber) : ""
  );
  const [mencionFilter, setMencionFilter] = React.useState<string>("all");
  const [slaStatusFilter, setSlaStatusFilter] = React.useState<
    "all" | TeacherSlaItem["slaStatus"]
  >("all");
  const [loadingFilter, setLoadingFilter] = React.useState(false);
  const [exportingPdf, setExportingPdf] = React.useState(false);

  const [y, m, d] = todayIso.split("-").map(Number);
  const todayDate = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  const todayDayNum = String(todayDate.getUTCDate()).padStart(2, "0");
  const todayWeekday = FULL_WEEKDAYS[todayDate.getUTCDay()] ?? "";
  const todayMonthName = MONTH_NAMES[todayDate.getUTCMonth()] ?? "";
  const todayMonthYear = `${todayMonthName} ${todayDate.getUTCFullYear()}`;

  const handleFilterChange = React.useCallback(
    async (nextSchoolYearId: string, nextMomento: string) => {
      setSelectedSchoolYearId(nextSchoolYearId);
      setSelectedMomento(nextMomento);
      setLoadingFilter(true);
      setErrorMsg(null);

      try {
        const params = new URLSearchParams();
        if (nextSchoolYearId) params.set("schoolYearId", nextSchoolYearId);
        if (nextMomento) params.set("momentoNumber", nextMomento);

        const res = await fetch(`/api/analitica/overview?${params.toString()}`, {
          method: "GET",
          cache: "no-store",
        });
        const body = await res.json();
        if (!res.ok) {
          setErrorMsg(
            body?.error ?? "No se pudieron actualizar los indicadores."
          );
          return;
        }
        setData(body as AnalyticsBiOverview);
      } catch {
        setErrorMsg("No fue posible actualizar los datos en este momento.");
      } finally {
        setLoadingFilter(false);
      }
    },
    []
  );

  const filteredTeacherSla = React.useMemo(() => {
    if (!data) return [];
    return data.teacherSla.filter((item) => {
      if (mencionFilter !== "all" && item.mencionId !== mencionFilter) {
        return false;
      }
      if (slaStatusFilter !== "all" && item.slaStatus !== slaStatusFilter) {
        return false;
      }
      return true;
    });
  }, [data, mencionFilter, slaStatusFilter]);

  const filteredSaturation = React.useMemo(() => {
    if (!data) return [];
    return data.sectionSaturation.filter(
      (item) => mencionFilter === "all" || item.mencionId === mencionFilter
    );
  }, [data, mencionFilter]);

  const filteredSubjects = React.useMemo(() => {
    if (!data) return [];
    return data.filterSubjects.filter(
      (item) => mencionFilter === "all" || item.mencionId === mencionFilter
    );
  }, [data, mencionFilter]);

  const filteredRiskAlerts = React.useMemo(() => {
    if (!data) return [];
    return data.riskAlerts.filter(
      (item) => mencionFilter === "all" || item.mencionId === mencionFilter
    );
  }, [data, mencionFilter]);

  const filteredCdce = React.useMemo(() => {
    if (!data) return [];
    return data.cdceMatrix.filter(
      (item) => mencionFilter === "all" || item.mencionId === mencionFilter
    );
  }, [data, mencionFilter]);

  const handleExportPdf = React.useCallback(async () => {
    if (!data || exportingPdf) return;
    setExportingPdf(true);
    try {
      const { downloadCdceReportPdf } = await import(
        "@/components/pdf/CdceReportPdfDocument"
      );
      await downloadCdceReportPdf(data, filteredCdce);
      toast.success("Reporte estadístico CDCE descargado en PDF.");
    } catch {
      toast.error("No se pudo generar el reporte PDF en este momento.");
    } finally {
      setExportingPdf(false);
    }
  }, [data, exportingPdf, filteredCdce]);

  const handleExportCsv = React.useCallback(() => {
    if (!data) return;
    exportCdceMatrixCsv(
      filteredCdce,
      data.activeSchoolYear?.name ?? "Periodo_Vigente"
    );
    toast.success("Matriz estadística CDCE exportada en formato compatible con Excel.");
  }, [data, filteredCdce]);

  if (errorMsg && !data) {
    return (
      <div className="mx-auto max-w-4xl py-10">
        <div className="siga-glass-surface rounded-[28px] border p-8 text-center">
          <ShieldAlert className="mx-auto mb-3 size-10 text-amber-500" />
          <h1 className="text-xl font-semibold text-foreground">
            Panel de Dirección y Analítica no disponible
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{errorMsg}</p>
        </div>
      </div>
    );
  }

  const summary = data?.summary;
  const secSla = data?.secretariatSla;

  const kpiCards = [
    {
      title: "Matrícula Activa",
      subtitle: `${summary?.totalSections ?? 0} secciones · ${summary?.totalAssignments ?? 0} cátedras`,
      badge: "Estudiantes",
      value: summary?.activeStudents ?? 0,
      suffix: "",
      decimals: false,
      icon: Users,
      highlighted: false,
    },
    {
      title: "Asistencia Institucional",
      subtitle: "Promedio registrado en aula",
      badge: "Asistencia",
      value: summary?.attendanceRatePct ?? null,
      suffix: "%",
      decimals: true,
      icon: CheckCircle2,
      highlighted: false,
    },
    {
      title: "Índice de Aprobación",
      subtitle: data?.activeMomento?.name ?? "Corte vigente",
      badge: "Rendimiento",
      value: summary?.passingRatePct ?? null,
      suffix: "%",
      decimals: true,
      icon: GraduationCap,
      highlighted: false,
    },
    {
      title: "Trámites en Secretaría",
      subtitle: `Respuesta media: ${formatHoursLabel(secSla?.avgResolutionHours ?? null)}`,
      badge: "Pendientes",
      value: summary?.pendingRequests ?? 0,
      suffix: "",
      decimals: false,
      icon: Clock,
      highlighted: false,
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
          <BarChart3 className="size-3.5 text-primary" aria-hidden="true" />
          <span>Dirección y Analítica Avanzada</span>
        </span>
      </motion.div>

      {/* Fila 1 — Hero Cobalto (8 cols) + Tarjeta de Corte y Fecha (4 cols) */}
      <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-12">
        <motion.section
          aria-label="Resumen ejecutivo y filtros"
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
              Inteligencia Institucional · {ROLE_LABELS[profile.primaryRole]}
            </span>

            <h2 className="mt-4 text-2xl leading-[1.34] font-normal tracking-[-0.022em] text-balance text-white sm:text-[1.95rem] sm:leading-[1.3]">
              Pulso{" "}
              <i className="font-cursive inline-block px-0.5 py-0.5 font-normal text-sky-200">
                directivo
              </i>{" "}
              y académico del plantel
            </h2>

            <p className="mt-2.5 max-w-xl text-[13.5px] leading-[1.65] text-sky-100/85">
              Monitoreo en tiempo real de carga docente, tiempos de secretaría,
              materias filtro, alertas tempranas y matrices oficiales para el CDCE.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/15 pt-4">
            <div className="flex flex-wrap items-center gap-2">
              {data && data.schoolYears.length > 0 && (
                <select
                  aria-label="Seleccionar año escolar"
                  value={selectedSchoolYearId}
                  onChange={(e) =>
                    handleFilterChange(e.target.value, selectedMomento)
                  }
                  disabled={loadingFilter}
                  className="h-9 rounded-xl border border-white/25 bg-white/12 px-3 text-xs font-medium text-white outline-none backdrop-blur-md transition hover:bg-white/20 [&>option]:bg-[#0f172a] [&>option]:text-white"
                >
                  {data.schoolYears.map((sy) => (
                    <option key={sy.id} value={sy.id}>
                      {sy.name}
                      {sy.isCurrent ? " (Vigente)" : ""}
                    </option>
                  ))}
                </select>
              )}

              <select
                aria-label="Seleccionar momento pedagógico"
                value={selectedMomento}
                onChange={(e) =>
                  handleFilterChange(selectedSchoolYearId, e.target.value)
                }
                disabled={loadingFilter}
                className="h-9 rounded-xl border border-white/25 bg-white/12 px-3 text-xs font-medium text-white outline-none backdrop-blur-md transition hover:bg-white/20 [&>option]:bg-[#0f172a] [&>option]:text-white"
              >
                <option value="1">1.er Momento</option>
                <option value="2">2.º Momento</option>
                <option value="3">3.er Momento</option>
              </select>

              {data && data.menciones.length > 1 && (
                <select
                  aria-label="Filtrar por mención técnica"
                  value={mencionFilter}
                  onChange={(e) => setMencionFilter(e.target.value)}
                  className="h-9 rounded-xl border border-white/25 bg-white/12 px-3 text-xs font-medium text-white outline-none backdrop-blur-md transition hover:bg-white/20 [&>option]:bg-[#0f172a] [&>option]:text-white"
                >
                  <option value="all">Todas las menciones</option>
                  {data.menciones.map((mItem) => (
                    <option key={mItem.id} value={mItem.id}>
                      {mItem.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportCsv}
                disabled={!data || filteredCdce.length === 0}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/25 bg-white/12 px-3.5 text-xs font-medium text-white transition hover:bg-white/22 disabled:opacity-50"
              >
                <FileSpreadsheet className="size-3.5 text-emerald-300" />
                <span>Excel (CSV)</span>
              </button>

              <button
                type="button"
                onClick={handleExportPdf}
                disabled={!data || exportingPdf}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-4 text-xs font-semibold text-[#0b1d59] shadow-xs transition hover:bg-sky-50 disabled:opacity-50"
              >
                {exportingPdf ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Download className="size-3.5" />
                )}
                <span>PDF CDCE</span>
              </button>
            </div>
          </div>
        </motion.section>

        {/* Tarjeta Derecha: Fecha y Corte Pedagógico */}
        <motion.aside
          aria-label="Corte pedagógico vigente"
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
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-muted-foreground">
                  Corte evaluado
                </span>
                {data?.activeMomento && (
                  <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-[10px] font-semibold text-primary dark:text-[#7dd3fc]">
                    {MOMENTO_STATUS_LABELS[data.activeMomento.status] ??
                      data.activeMomento.status}
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-sm font-semibold text-foreground">
                {data?.activeMomento?.name ?? "Sin momento registrado"}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {data?.activeSchoolYear?.name ?? "Año escolar vigente"}
              </p>
            </div>
          </div>

          <div className="my-4 h-px bg-border/60" />

          <div className="siga-glass-inner flex items-center justify-between gap-3 rounded-2xl border px-4 py-3.5">
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground">
                Documentos QR emitidos
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Constancias y boletines válidos
              </p>
            </div>
            <span className="font-kpi-num text-2xl font-light text-primary dark:text-[#7dd3fc]">
              <CountUp value={secSla?.officialDocumentsIssued ?? 0} />
            </span>
          </div>
        </motion.aside>
      </div>

      {/* Fila 2 — 4 Tarjetas KPI */}
      <section
        aria-label="Indicadores clave institucionales"
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
                    "flex size-9 items-center justify-center rounded-xl border",
                    card.highlighted
                      ? "border-white/25 bg-white/15 text-white"
                      : "siga-glass-inner text-primary dark:text-[#7dd3fc]"
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                    card.highlighted
                      ? "bg-white/20 text-white"
                      : "siga-glass-pill border text-muted-foreground"
                  )}
                >
                  {card.badge}
                </span>
              </div>

              <div className="mt-5">
                <span className="font-kpi-num block text-[2.45rem] leading-none font-light">
                  {card.value !== null ? (
                    <CountUp
                      value={card.value}
                      suffix={card.suffix}
                      decimals={card.decimals}
                    />
                  ) : (
                    "—"
                  )}
                </span>
                <h3
                  className={cn(
                    "mt-3 text-sm font-medium",
                    card.highlighted ? "text-white" : "text-foreground"
                  )}
                >
                  {card.title}
                </h3>
                <p
                  className={cn(
                    "mt-0.5 text-xs",
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

      {/* Navegación por Pestañas */}
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            {
              key: "sla",
              label: "Radar de Cuellos de Botella (SLA)",
              icon: Layers,
            },
            {
              key: "materias",
              label: `Materias Filtro (${filteredSubjects.length})`,
              icon: TrendingDown,
            },
            {
              key: "riesgo",
              label: `Alerta Temprana (${filteredRiskAlerts.length})`,
              icon: AlertTriangle,
            },
            {
              key: "cdce",
              label: "Matrices CDCE / Zona Educativa",
              icon: FileText,
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
        {loadingFilter && (
          <span className="inline-flex items-center gap-1.5 px-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Actualizando...
          </span>
        )}
      </div>

      {/* TAB 1: RADAR SLA */}
      {activeTab === "sla" && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            {/* Monitor de Tiempos de Secretaría */}
            <div className="siga-glass-surface rounded-[28px] border p-5 sm:p-6 lg:col-span-5">
              <h2 className="text-base font-medium text-foreground">
                Monitor de Tiempos de Secretaría
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Control de atención de constancias, solvencias y activaciones.
              </p>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="siga-glass-inner rounded-2xl border p-3.5">
                  <span className="text-[11px] text-muted-foreground">
                    Pendientes / Revisión
                  </span>
                  <div className="font-kpi-num mt-1.5 text-2xl font-light text-amber-500">
                    {(secSla?.pendingCount ?? 0) + (secSla?.inReviewCount ?? 0)}
                  </div>
                </div>
                <div className="siga-glass-inner rounded-2xl border p-3.5">
                  <span className="text-[11px] text-muted-foreground">
                    Emitidos / Entregados
                  </span>
                  <div className="font-kpi-num mt-1.5 text-2xl font-light text-emerald-500">
                    {(secSla?.approvedCount ?? 0) + (secSla?.deliveredCount ?? 0)}
                  </div>
                </div>
                <div className="siga-glass-inner rounded-2xl border p-3.5">
                  <span className="text-[11px] text-muted-foreground">
                    Espera más antigua
                  </span>
                  <div className="font-kpi-num mt-1.5 text-xl font-light text-foreground">
                    {formatHoursLabel(secSla?.oldestPendingHours ?? null)}
                  </div>
                </div>
                <div className="siga-glass-inner rounded-2xl border p-3.5">
                  <span className="text-[11px] text-muted-foreground">
                    Total de solicitudes
                  </span>
                  <div className="font-kpi-num mt-1.5 text-xl font-light text-primary dark:text-[#7dd3fc]">
                    {secSla?.totalRequests ?? 0}
                  </div>
                </div>
              </div>
            </div>

            {/* Detector de Saturación en Inscripciones */}
            <div className="siga-glass-surface rounded-[28px] border p-5 sm:p-6 lg:col-span-7">
              <div>
                <h2 className="text-base font-medium text-foreground">
                  Detector de Saturación en Inscripciones
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Ocupación por sección y estudiantes preinscritos por validar.
                </p>
              </div>

              {filteredSaturation.length === 0 ? (
                <div className="siga-glass-inner mt-5 rounded-2xl border border-dashed p-6 text-center text-xs text-muted-foreground">
                  No hay secciones registradas para el período seleccionado.
                </div>
              ) : (
                <div className="mt-4 max-h-60 space-y-2.5 overflow-y-auto pr-1">
                  {filteredSaturation.map((sec) => (
                    <div
                      key={sec.sectionId}
                      className="siga-glass-inner flex flex-col gap-1.5 rounded-2xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <div className="text-xs font-medium text-foreground">
                          {sec.gradeYear}.º Año &quot;{sec.sectionLetter}&quot; ·{" "}
                          {sec.mencionName}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {sec.enrolledCount} de {sec.capacity} cupos ocupados
                          {sec.preEnrolledCount > 0
                            ? ` · ${sec.preEnrolledCount} por validar`
                            : ""}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              sec.saturationStatus === "saturated"
                                ? "bg-rose-500"
                                : sec.saturationStatus === "high"
                                  ? "bg-amber-500"
                                  : "bg-emerald-500"
                            )}
                            style={{
                              width: `${Math.min(100, sec.occupancyPct)}%`,
                            }}
                          />
                        </div>
                        <span
                          className={cn(
                            "min-w-[46px] text-right text-xs font-semibold tabular-nums",
                            sec.saturationStatus === "saturated"
                              ? "text-rose-500"
                              : sec.saturationStatus === "high"
                                ? "text-amber-500"
                                : "text-emerald-500"
                          )}
                        >
                          {sec.occupancyPct}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Semáforo de Carga Docente */}
          <div className="siga-glass-surface rounded-[28px] border p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-medium text-foreground">
                  Semáforo de Carga Docente
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Avance de publicación de planes de evaluación y registro de
                  calificaciones por sección.
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                <Filter className="size-3.5 text-muted-foreground" />
                {(
                  [
                    { id: "all", label: "Todos" },
                    { id: "critical", label: "Atraso" },
                    { id: "warning", label: "En progreso" },
                    { id: "on_track", label: "Al día" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSlaStatusFilter(opt.id)}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-medium transition",
                      slaStatusFilter === opt.id
                        ? "bg-primary text-primary-foreground"
                        : "siga-glass-inner border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {filteredTeacherSla.length === 0 ? (
              <div className="siga-glass-inner mt-5 rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                No hay asignaciones docentes que coincidan con el filtro actual.
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
                      <th className="py-2.5 pr-4 font-medium">Notas Cargadas</th>
                      <th className="py-2.5 font-medium text-right">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {filteredTeacherSla.map((row) => (
                      <tr key={row.assignmentId} className="hover:bg-muted/20">
                        <td className="py-3 pr-4 font-medium text-foreground">
                          {row.teacherName}
                        </td>
                        <td className="py-3 pr-4 text-foreground">
                          {row.subjectName}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {row.gradeYear}.º &quot;{row.sectionLetter}&quot; ·{" "}
                          {row.mencionName}
                        </td>
                        <td className="py-3 pr-4">
                          <span className="siga-glass-inner rounded-lg border px-2 py-0.5 text-[11px] font-medium text-foreground">
                            {PLAN_STATUS_LABELS[row.planStatus] ?? row.planStatus}
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          <span className="font-medium text-foreground">
                            {row.gradedCount}/{row.enrolledCount}
                          </span>{" "}
                          <span className="text-[11px] text-muted-foreground">
                            ({row.completionPct}%)
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                              row.slaStatus === "on_track"
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                                : row.slaStatus === "warning"
                                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-300"
                                  : "bg-rose-500/15 text-rose-600 dark:text-rose-300"
                            )}
                          >
                            {row.slaStatus === "on_track"
                              ? "Al día"
                              : row.slaStatus === "warning"
                                ? "En progreso"
                                : "Atraso"}
                          </span>
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

      {/* TAB 2: MATERIAS FILTRO */}
      {activeTab === "materias" && (
        <div className="siga-glass-surface rounded-[28px] border p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-medium text-foreground">
                Auditoría de &quot;Materias Filtro&quot;
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Asignaturas ordenadas por mayor tasa de reprobación y estudiantes
                en materia pendiente.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                exportFilterSubjectsCsv(
                  filteredSubjects,
                  data?.activeSchoolYear?.name ?? "Periodo"
                )
              }
              disabled={filteredSubjects.length === 0}
              className="siga-glass-inner inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium text-foreground transition hover:bg-muted/40 disabled:opacity-50"
            >
              <FileSpreadsheet className="size-3.5 text-emerald-500" />
              <span>Exportar listado</span>
            </button>
          </div>

          {filteredSubjects.length === 0 ? (
            <div className="siga-glass-inner mt-5 rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              Aún no existen calificaciones finales consolidadas para auditar en
              este período.
            </div>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border/60 text-muted-foreground">
                    <th className="py-2.5 pr-4 font-medium">Asignatura</th>
                    <th className="py-2.5 pr-4 font-medium">Mención y Año</th>
                    <th className="py-2.5 pr-4 font-medium text-right">
                      Evaluados
                    </th>
                    <th className="py-2.5 pr-4 font-medium text-right">
                      Reprobados
                    </th>
                    <th className="py-2.5 pr-4 font-medium">
                      Tasa de Reprobación
                    </th>
                    <th className="py-2.5 pr-4 font-medium text-right">
                      Promedio
                    </th>
                    <th className="py-2.5 font-medium text-right">
                      Pendientes
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filteredSubjects.map((sub) => (
                    <tr
                      key={sub.curriculumSubjectId}
                      className="hover:bg-muted/20"
                    >
                      <td className="py-3 pr-4 font-medium text-foreground">
                        {sub.subjectName}
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {sub.mencionName} · {sub.gradeYear}.º Año
                      </td>
                      <td className="py-3 pr-4 text-right text-foreground">
                        {sub.totalGraded}
                      </td>
                      <td className="py-3 pr-4 text-right font-medium text-rose-500">
                        {sub.failedCount}
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
                            <div
                              className={cn(
                                "h-full rounded-full",
                                sub.failureRatePct >= 35
                                  ? "bg-rose-500"
                                  : sub.failureRatePct >= 15
                                    ? "bg-amber-500"
                                    : "bg-sky-500"
                              )}
                              style={{
                                width: `${Math.min(100, sub.failureRatePct)}%`,
                              }}
                            />
                          </div>
                          <span className="font-semibold text-foreground">
                            {sub.failureRatePct}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-right text-foreground">
                        {sub.avgNumeric !== null
                          ? `${sub.avgNumeric.toFixed(1)} pts`
                          : "—"}
                      </td>
                      <td className="py-3 text-right text-muted-foreground">
                        {sub.pendingStudents}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ALERTA TEMPRANA */}
      {activeTab === "riesgo" && (
        <div className="siga-glass-surface rounded-[28px] border p-5 sm:p-6">
          <div>
            <h2 className="text-base font-medium text-foreground">
              Alerta Temprana de Deserción y Riesgo Académico
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Estudiantes priorizados según inasistencias acumuladas, asignaturas
              bajo el mínimo aprobatorio y materias pendientes activas.
            </p>
          </div>

          {filteredRiskAlerts.length === 0 ? (
            <div className="siga-glass-inner mt-5 rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              <BookOpenCheck className="mx-auto mb-2 size-7 text-emerald-500" />
              No se detectan estudiantes con indicadores de riesgo académico o
              inasistencia crítica en este corte.
            </div>
          ) : (
            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
              {filteredRiskAlerts.map((st) => (
                <div
                  key={st.studentUserId}
                  className="siga-glass-inner flex flex-col justify-between gap-3 rounded-2xl border p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium text-foreground">
                        {st.fullName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {st.gradeYear}.º Año &quot;{st.sectionLetter}&quot; ·{" "}
                        {st.mencionName} · C.I. ***{st.cedulaLast4}
                      </div>
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                        st.riskLevel === "high"
                          ? "bg-rose-500/15 text-rose-600 dark:text-rose-300"
                          : "bg-amber-500/15 text-amber-600 dark:text-amber-300"
                      )}
                    >
                      Riesgo {st.riskLevel === "high" ? "Alto" : "Medio"} (
                      {st.riskScore})
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 text-[11px]">
                    {st.absenceRatePct >= 15 && (
                      <span className="rounded-lg bg-rose-500/10 px-2 py-1 font-medium text-rose-600 dark:text-rose-300">
                        Inasistencia: {st.absenceRatePct}%
                      </span>
                    )}
                    {st.failedSubjects > 0 && (
                      <span className="rounded-lg bg-amber-500/10 px-2 py-1 font-medium text-amber-600 dark:text-amber-300">
                        {st.failedSubjects} asignatura(s) reprobada(s)
                      </span>
                    )}
                    {st.pendingCount > 0 && (
                      <span className="rounded-lg bg-sky-500/10 px-2 py-1 font-medium text-sky-600 dark:text-sky-300">
                        {st.pendingCount} materia(s) pendiente(s)
                      </span>
                    )}
                    {st.avgGrade !== null && (
                      <span className="rounded-lg bg-muted px-2 py-1 font-medium text-foreground">
                        Promedio: {st.avgGrade} pts
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: MATRICES CDCE */}
      {activeTab === "cdce" && (
        <div className="siga-glass-surface rounded-[28px] border p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-medium text-foreground">
                Matriz Estadística Oficial (CDCE / Zona Educativa)
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Consolidado de matrícula, prosecución y rendimiento por mención
                técnica y año escolar.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportCsv}
                disabled={filteredCdce.length === 0}
                className="siga-glass-inner inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium text-foreground transition hover:bg-muted/40 disabled:opacity-50"
              >
                <FileSpreadsheet className="size-3.5 text-emerald-500" />
                <span>Descargar CSV</span>
              </button>
              <button
                type="button"
                onClick={handleExportPdf}
                disabled={exportingPdf}
                className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary px-3.5 text-xs font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
              >
                <Download className="size-3.5" />
                <span>Descargar PDF</span>
              </button>
            </div>
          </div>

          {filteredCdce.length === 0 ? (
            <div className="siga-glass-inner mt-5 rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              No hay secciones ni matrícula registrada para generar la matriz
              oficial en este período.
            </div>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border/60 text-muted-foreground">
                    <th className="py-2.5 pr-4 font-medium">Mención</th>
                    <th className="py-2.5 pr-4 font-medium">Año</th>
                    <th className="py-2.5 pr-4 font-medium text-right">
                      Secciones
                    </th>
                    <th className="py-2.5 pr-4 font-medium text-right">
                      Activos
                    </th>
                    <th className="py-2.5 pr-4 font-medium text-right">
                      Preinscritos
                    </th>
                    <th className="py-2.5 pr-4 font-medium text-right">
                      Retirados
                    </th>
                    <th className="py-2.5 pr-4 font-medium text-right">
                      Promovidos
                    </th>
                    <th className="py-2.5 pr-4 font-medium text-right">
                      Promedio
                    </th>
                    <th className="py-2.5 font-medium text-right">
                      Asistencia
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filteredCdce.map((row) => (
                    <tr
                      key={`${row.mencionId}-${row.gradeYear}`}
                      className="hover:bg-muted/20"
                    >
                      <td className="py-3 pr-4 font-medium text-foreground">
                        {row.mencionName}
                      </td>
                      <td className="py-3 pr-4 text-foreground">
                        {row.gradeYear}.º Año
                      </td>
                      <td className="py-3 pr-4 text-right text-muted-foreground">
                        {row.totalSections}
                      </td>
                      <td className="py-3 pr-4 text-right font-semibold text-foreground">
                        {row.activeStudents}
                      </td>
                      <td className="py-3 pr-4 text-right text-amber-500">
                        {row.preEnrolledStudents}
                      </td>
                      <td className="py-3 pr-4 text-right text-rose-500">
                        {row.withdrawnStudents}
                      </td>
                      <td className="py-3 pr-4 text-right text-emerald-500">
                        {row.promotedStudents}
                      </td>
                      <td className="py-3 pr-4 text-right text-foreground">
                        {row.avgGrade !== null
                          ? `${row.avgGrade.toFixed(1)} pts`
                          : "—"}
                      </td>
                      <td className="py-3 text-right text-foreground">
                        {row.attendancePct !== null
                          ? `${row.attendancePct.toFixed(1)}%`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

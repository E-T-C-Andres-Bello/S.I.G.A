"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRight,
  ArrowUpRight,
  Calendar,
  Clock,
  Cpu,
  FolderKanban,
  GraduationCap,
  MessageSquare,
  Search,
  Send,
  Sparkles,
  Star,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import {
  AulaVirtualParticleHero,
  type MoodleWorkspaceSection,
} from "@/components/aula-virtual/AulaVirtualParticleHero";
import {
  ROLE_HOME_PATH,
  ROLE_LABELS,
} from "@/components/dashboard/DashboardSidebar";
import {
  AdaptiveNavigationPill,
  type AdaptiveNavItem,
} from "@/components/ui/3d-adaptive-navigation-bar";
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
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import type { AulaVirtualCampusData } from "@/features/aula-virtual/aula-virtual-data";
import type { DashboardUserProfile } from "@/lib/supabase/dashboard-session";

export interface AulaVirtualCampusViewProps {
  profile: DashboardUserProfile;
  data: AulaVirtualCampusData;
  initialSection?: MoodleWorkspaceSection;
}

type CourseFilterTab = "all" | "technical" | "general" | "starred";

interface TutorChatMessage {
  id: string;
  sender: "student" | "tutor";
  text: string;
  timestamp: string;
}

const AULA_VIRTUAL_NAV_ITEMS: ReadonlyArray<
  AdaptiveNavItem<MoodleWorkspaceSection>
> = [
  { label: "Bienvenida", id: "overview" },
  { label: "Mis Cursos", id: "courses" },
  { label: "Laboratorios", id: "labs" },
];

function formatShortDate(iso: string | null): string {
  if (!iso) return "Por definir";
  const dt = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(dt.getTime())) return iso;
  return new Intl.DateTimeFormat("es-VE", {
    timeZone: "America/Caracas",
    day: "2-digit",
    month: "short",
  }).format(dt);
}

/**
 * Plataforma independiente del Aula Virtual (`/aula-virtual`):
 * - Barra superior Glassmorphism con el 3D Adaptive Navigation Pill (`Bienvenida`, `Mis Cursos`, `Laboratorios`)
 *   y selector de Modo Claro / Oscuro.
 * - En `Mis Cursos`: tarjetas minimalistas que abren la página propia de cada asignatura (`/aula-virtual/[courseId]`),
 *   con `Línea de Tiempo` y `Tutor IA` integrados en el panel lateral derecho.
 */
export function AulaVirtualCampusView({
  profile,
  data,
  initialSection = "overview",
}: AulaVirtualCampusViewProps) {
  const returnHref = ROLE_HOME_PATH[profile.primaryRole] ?? "/estudiante";
  const returnLabel = `Volver a S.I.G.A. (${ROLE_LABELS[profile.primaryRole]})`;

  const [activeSection, setActiveSection] =
    React.useState<MoodleWorkspaceSection>(initialSection);
  const [courseFilter, setCourseFilter] =
    React.useState<CourseFilterTab>("all");
  const [searchTerm, setSearchTerm] = React.useState("");
  const [timelineFilter, setTimelineFilter] = React.useState<
    "upcoming" | "all"
  >("upcoming");
  const [starredCodes, setStarredCodes] = React.useState<string[]>([]);

  // Tutor Socrático IA integrado en Mis Cursos
  const [tutorSubjectCode, setTutorSubjectCode] = React.useState<string>(
    () => data.courses[0]?.subjectCode ?? ""
  );
  const [tutorQuestion, setTutorQuestion] = React.useState("");
  const [tutorLoading, setTutorLoading] = React.useState(false);
  const [tutorMessages, setTutorMessages] = React.useState<TutorChatMessage[]>(
    []
  );

  const favStorageKey = `siga-moodle-starred-v1-${profile.internalUserId}`;

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(favStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          setStarredCodes(
            parsed.filter((x): x is string => typeof x === "string")
          );
        }
      }
    } catch {
      // Ignorar almacenamiento restringido.
    }
  }, [favStorageKey]);

  const toggleStarCourse = React.useCallback(
    (code: string) => {
      setStarredCodes((prev) => {
        const exists = prev.includes(code);
        const next = exists ? prev.filter((c) => c !== code) : [...prev, code];
        try {
          window.localStorage.setItem(favStorageKey, JSON.stringify(next));
        } catch {
          // Ignorar cuota.
        }
        return next;
      });
    },
    [favStorageKey]
  );

  const filteredCourses = React.useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return data.courses.filter((course) => {
      if (courseFilter === "technical" && !course.isTechnicalCore) return false;
      if (courseFilter === "general" && course.isTechnicalCore) return false;
      if (
        courseFilter === "starred" &&
        !starredCodes.includes(course.subjectCode)
      ) {
        return false;
      }
      if (!q) return true;
      return (
        course.subjectName.toLowerCase().includes(q) ||
        course.subjectCode.toLowerCase().includes(q) ||
        (course.teacherName ?? "").toLowerCase().includes(q)
      );
    });
  }, [courseFilter, data.courses, searchTerm, starredCodes]);

  const filteredTimeline = React.useMemo(() => {
    if (timelineFilter === "all") return data.timeline;
    return data.timeline.filter((item) => !item.isCompleted);
  }, [data.timeline, timelineFilter]);

  const handleSelectSection = React.useCallback(
    (section: MoodleWorkspaceSection) => {
      setActiveSection(section);
      try {
        const url = new URL(window.location.href);
        if (section === "overview") {
          url.searchParams.delete("seccion");
        } else {
          url.searchParams.set("seccion", section);
        }
        window.history.replaceState(null, "", url.toString());
      } catch {
        // Ignorar si history API está restringida.
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    []
  );

  const handleAskSocraticTutor = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanQ = tutorQuestion.trim();
    if (cleanQ.length < 4 || tutorLoading) return;

    const targetCourse =
      data.courses.find((c) => c.subjectCode === tutorSubjectCode) ??
      data.courses[0];

    const userMsg: TutorChatMessage = {
      id: crypto.randomUUID(),
      sender: "student",
      text: cleanQ,
      timestamp: new Date().toLocaleTimeString("es-VE", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setTutorMessages((prev) => [...prev, userMsg]);
    setTutorQuestion("");
    setTutorLoading(true);

    try {
      if (!targetCourse?.virtualCourseId) {
        setTutorMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            sender: "tutor",
            text: `Para ${targetCourse?.subjectName ?? "esta asignatura"}, tu docente aún no ha subido guías indexadas en este corte. Puedes consultar el aula de la materia o preguntar en clase a ${targetCourse?.teacherName ?? "tu profesor"}.`,
            timestamp: new Date().toLocaleTimeString("es-VE", {
              hour: "2-digit",
              minute: "2-digit",
            }),
          },
        ]);
        return;
      }

      const res = await fetch("/api/ai/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          virtualCourseId: targetCourse.virtualCourseId,
          question: cleanQ,
        }),
      });

      const payload = (await res.json()) as {
        ok?: boolean;
        message?: string;
      };

      setTutorMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          sender: "tutor",
          text:
            payload.message ??
            "Consulta recibida. Revisa los fragmentos de la guía oficial del docente.",
          timestamp: new Date().toLocaleTimeString("es-VE", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);
    } catch {
      toast.error("No se pudo conectar con el Tutor Socrático en este momento.");
    } finally {
      setTutorLoading(false);
    }
  };

  const heroSubtitle = React.useMemo(() => {
    if (data.roleMode === "student") {
      if (data.hasEnrollmentOrAssignment) {
        return `${data.gradeYear}.º Año · Mención ${data.mencionName ?? "Técnica"}${data.sectionLetter ? ` · Sección ${data.sectionLetter}` : ""}${data.schoolYearName ? ` · ${data.schoolYearName}` : ""}. Haz clic en la animación para emitir un pulso o entra directo a tus cursos.`;
      }
      return "Campus digital sincronizado con tu matrícula escolar, unidades de aprendizaje y Tutor Socrático IA.";
    }
    return "Entorno docente para administrar unidades, materiales, entregas y seguimiento académico por sección.";
  }, [data]);

  return (
    <div className="font-hero relative min-h-screen w-full bg-slate-50 text-slate-900 transition-colors duration-300 dark:bg-[#050811] dark:text-slate-100">
      {/* ==================== BARRA SUPERIOR GLASSMORPHISM CON MODO CLARO/OSCURO ==================== */}
      <header className="pointer-events-none fixed inset-x-0 top-4 z-50 mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 sm:px-8">
        {/* Marca izquierda Glass */}
        <button
          type="button"
          onClick={() => handleSelectSection("overview")}
          className="pointer-events-auto inline-flex h-10 cursor-pointer items-center gap-2.5 rounded-full border border-white/75 bg-white/45 px-3.5 text-xs font-semibold text-slate-900 shadow-sm backdrop-blur-2xl transition-transform hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none dark:border-sky-300/25 dark:bg-[#0a1428]/50 dark:text-white"
        >
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white p-0.5 shadow-2xs">
            <Image
              src="/images/institucion/logotipo.webp"
              alt='Escudo E.T.C. "Andrés Bello"'
              width={20}
              height={20}
              className="size-4.5 rounded-full object-contain"
            />
          </span>
          <span className="hidden sm:inline">Aula Virtual</span>
        </button>

        {/* Centro: 3D Adaptive Navigation Bar Glassmorphism */}
        <div className="pointer-events-auto flex justify-center">
          <AdaptiveNavigationPill
            items={AULA_VIRTUAL_NAV_ITEMS}
            activeId={activeSection}
            onSelect={handleSelectSection}
            collapsedWidth={172}
            expandedWidth={410}
          />
        </div>

        {/* Derecha: Modo Claro/Oscuro + Volver a S.I.G.A. */}
        <div className="pointer-events-auto flex items-center gap-2">
          <ThemeToggle />

          <Link
            href={returnHref}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/75 bg-white/45 px-3.5 text-xs font-medium text-slate-900 shadow-sm backdrop-blur-2xl transition-transform hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none dark:border-sky-300/25 dark:bg-[#0a1428]/50 dark:text-white"
          >
            <span className="hidden md:inline">{returnLabel}</span>
            <span className="md:hidden">S.I.G.A.</span>
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
      </header>

      {/* ==================== SECCIONES INDEPENDIENTES ==================== */}
      <AnimatePresence mode="wait">
        {activeSection === "overview" ? (
          /* SECCIÓN 1: BIENVENIDO AL AULA VIRTUAL (PANTALLA COMPLETA 3D CON 4 ESCULTURAS Y PULSO AL CLIC) */
          <motion.div
            key="section-overview"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <AulaVirtualParticleHero
              firstName={profile.firstName}
              subtitle={heroSubtitle}
              mencionName={data.mencionName}
              onExploreCourses={() => handleSelectSection("courses")}
            />
          </motion.div>
        ) : activeSection === "courses" ? (
          /* SECCIÓN 2: MIS CURSOS (TARJETAS LIMPIAS + LÍNEA DE TIEMPO Y TUTOR IA INTEGRADOS) */
          <motion.div
            key="section-courses"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="mx-auto max-w-7xl px-4 pt-24 pb-12 sm:px-8"
          >
            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
              {/* Columna izquierda (8 cols): Tarjetas limpias de Mis Cursos */}
              <section
                aria-label="Mis Cursos"
                className="space-y-5 lg:col-span-8"
              >
                <div className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-xs backdrop-blur-xl sm:flex-row sm:items-center dark:border-white/10 dark:bg-[#0a1020]/80">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl dark:text-white">
                        Mis Cursos
                      </h1>
                      {data.activeMomentName ? (
                        <Badge variant="secondary" className="text-[11px]">
                          <Calendar className="mr-1 size-3" aria-hidden="true" />
                          {data.activeMomentName}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Haz clic en cualquier asignatura para abrir su página de
                      curso.
                    </p>
                  </div>

                  <div className="relative w-full sm:w-60">
                    <Search
                      className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-slate-400"
                      aria-hidden="true"
                    />
                    <Input
                      type="search"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Buscar asignatura…"
                      aria-label="Buscar asignatura"
                      className="h-9 rounded-xl bg-white/90 pl-8 text-xs dark:bg-[#060a15]"
                    />
                  </div>
                </div>

                {/* Filtros limpios */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {(
                    [
                      { id: "all", label: `Todos (${data.courses.length})` },
                      { id: "technical", label: "Especialidad Técnica" },
                      { id: "general", label: "Formación General" },
                      {
                        id: "starred",
                        label: `Destacados ★ (${starredCodes.length})`,
                      },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setCourseFilter(tab.id)}
                      className={cn(
                        "cursor-pointer rounded-xl px-3.5 py-1.5 text-xs font-medium transition-colors",
                        courseFilter === tab.id
                          ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950"
                          : "border border-slate-200/70 bg-white/75 text-slate-600 hover:bg-white dark:border-white/10 dark:bg-[#0a1020]/70 dark:text-slate-300"
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Cuadrícula Minimalista de Cursos (al hacer clic abre su propia página `/aula-virtual/[courseId]`) */}
                {data.courses.length === 0 ? (
                  <Empty className="rounded-2xl border border-dashed bg-white/80 py-12 dark:bg-[#0a1020]/80">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <GraduationCap aria-hidden="true" />
                      </EmptyMedia>
                      <EmptyTitle className="text-base">
                        Sin cursos matriculados todavía en este período
                      </EmptyTitle>
                      <EmptyDescription>
                        En cuanto Control de Estudios active tu sección, tus
                        cursos aparecerán aquí automáticamente.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : filteredCourses.length === 0 ? (
                  <Empty className="rounded-2xl border border-dashed bg-white/80 py-10 dark:bg-[#0a1020]/80">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <Search aria-hidden="true" />
                      </EmptyMedia>
                      <EmptyTitle className="text-base">
                        No hay cursos en este filtro
                      </EmptyTitle>
                      <EmptyDescription>
                        Cambia de categoría o limpia el término de búsqueda.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {filteredCourses.map((course) => {
                      const isStarred = starredCodes.includes(
                        course.subjectCode
                      );
                      const courseHref = `/aula-virtual/${encodeURIComponent(course.subjectCode)}`;

                      return (
                        <article
                          key={`${course.curriculumSubjectId}-${course.sectionLabel ?? ""}`}
                          className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/85 bg-white/90 shadow-xs backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md dark:border-white/10 dark:bg-[#0a1020]/90"
                        >
                          {/* Franja superior limpia: solo código y estrella */}
                          <div
                            className={cn(
                              "flex h-12 items-center justify-between px-4 text-white",
                              course.isTechnicalCore
                                ? "bg-gradient-to-r from-[#0b2366] to-[#0891b2]"
                                : "bg-gradient-to-r from-[#1e293b] to-[#1e3a8a]"
                            )}
                          >
                            <span className="font-mono text-xs font-semibold tracking-wider text-sky-100">
                              {course.subjectCode}
                            </span>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                toggleStarCourse(course.subjectCode);
                              }}
                              aria-label={
                                isStarred
                                  ? "Quitar de destacados"
                                  : "Destacar curso"
                              }
                              className="relative z-10 cursor-pointer rounded-lg bg-black/20 p-1.5 text-white transition-colors hover:bg-black/40"
                            >
                              <Star
                                className={cn(
                                  "size-3.5",
                                  isStarred && "fill-amber-400 text-amber-400"
                                )}
                                aria-hidden="true"
                              />
                            </button>
                          </div>

                          {/* Cuerpo minimalista clicable hacia `/aula-virtual/[courseId]` */}
                          <Link
                            href={courseHref}
                            className="flex flex-1 flex-col justify-between gap-4 p-5 focus-visible:outline-none"
                          >
                            <div>
                              <h2 className="text-base leading-snug font-semibold text-slate-900 transition-colors group-hover:text-primary dark:text-white dark:group-hover:text-cyan-300">
                                {course.subjectName}
                              </h2>
                              <p className="mt-1.5 flex items-center gap-1.5 truncate text-xs text-slate-500 dark:text-slate-400">
                                <UserCheck
                                  className="size-3.5 shrink-0"
                                  aria-hidden="true"
                                />
                                <span className="truncate">
                                  {course.teacherName ?? "Docente por asignar"}
                                </span>
                              </p>
                            </div>

                            <div className="space-y-2">
                              <Progress
                                value={course.progressPercent}
                                aria-label={`Avance en ${course.subjectName}: ${course.progressPercent}%`}
                                className="h-1.5"
                              />
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
                                  {course.progressPercent}% completado
                                </span>
                                <span className="inline-flex items-center gap-1 font-semibold text-primary dark:text-cyan-300">
                                  <span>Entrar al curso</span>
                                  <ArrowRight
                                    className="size-3.5 transition-transform group-hover:translate-x-0.5"
                                    aria-hidden="true"
                                  />
                                </span>
                              </div>
                            </div>
                          </Link>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Columna derecha (4 cols): Línea de Tiempo y Tutor IA integrados en Mis Cursos */}
              <aside className="flex flex-col gap-5 lg:col-span-4">
                {/* Bloque 1: Línea de Tiempo de Actividades */}
                <section
                  aria-label="Línea de tiempo de actividades"
                  className="rounded-2xl border border-slate-200/80 bg-white/85 p-5 shadow-xs backdrop-blur-xl dark:border-white/10 dark:bg-[#0a1020]/85"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-slate-200/70 pb-3 dark:border-white/10">
                    <div className="flex items-center gap-2">
                      <Clock
                        className="size-4 text-primary dark:text-cyan-300"
                        aria-hidden="true"
                      />
                      <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                        Línea de Tiempo
                      </h2>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setTimelineFilter("upcoming")}
                        className={cn(
                          "cursor-pointer rounded-lg px-2 py-1 text-[11px] font-medium",
                          timelineFilter === "upcoming"
                            ? "bg-primary/12 text-primary dark:bg-cyan-400/15 dark:text-cyan-300"
                            : "text-slate-500 hover:text-slate-900 dark:text-slate-400"
                        )}
                      >
                        Pendientes
                      </button>
                      <button
                        type="button"
                        onClick={() => setTimelineFilter("all")}
                        className={cn(
                          "cursor-pointer rounded-lg px-2 py-1 text-[11px] font-medium",
                          timelineFilter === "all"
                            ? "bg-primary/12 text-primary dark:bg-cyan-400/15 dark:text-cyan-300"
                            : "text-slate-500 hover:text-slate-900 dark:text-slate-400"
                        )}
                      >
                        Todas
                      </button>
                    </div>
                  </div>

                  {filteredTimeline.length === 0 ? (
                    <div className="py-7 text-center">
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        Sin actividades pendientes próximas
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                        Las entregas con fecha aparecerán listadas aquí.
                      </p>
                    </div>
                  ) : (
                    <ul className="mt-3 divide-y divide-slate-200/60 dark:divide-white/10">
                      {filteredTimeline.slice(0, 6).map((ev) => (
                        <li key={ev.id} className="py-2.5 first:pt-1 last:pb-0">
                          <Link
                            href={`/aula-virtual/${encodeURIComponent(ev.subjectCode)}`}
                            className="group flex items-start justify-between gap-2.5"
                          >
                            <div className="min-w-0">
                              <span className="inline-block rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-300">
                                {formatShortDate(ev.scheduledDate)} ·{" "}
                                {ev.subjectCode}
                              </span>
                              <p className="mt-1 truncate text-xs font-semibold text-slate-900 group-hover:text-primary dark:text-white dark:group-hover:text-cyan-300">
                                {ev.title}
                              </p>
                              <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                                {ev.subjectName}
                              </p>
                            </div>

                            <Badge
                              variant={ev.isCompleted ? "default" : "outline"}
                              className="shrink-0 text-[10px] tabular-nums"
                            >
                              {ev.scoreLabel ?? `${ev.weightPercent}%`}
                            </Badge>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {/* Bloque 2: Tutor Socrático IA integrado en Mis Cursos */}
                <section
                  aria-label="Tutor Socrático IA 24/7"
                  className="rounded-2xl border border-slate-200/80 bg-white/85 p-5 shadow-xs backdrop-blur-xl dark:border-white/10 dark:bg-[#0a1020]/85"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-300">
                      <MessageSquare className="size-4" aria-hidden="true" />
                    </span>
                    <div>
                      <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                        Tutor Socrático IA
                      </h2>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Orientación 24/7 sobre las guías de tus cursos.
                      </p>
                    </div>
                  </div>

                  {data.courses.length > 0 ? (
                    <div className="mt-3">
                      <label
                        htmlFor="integrated-tutor-subject"
                        className="block text-[11px] font-medium text-slate-500 dark:text-slate-400"
                      >
                        Curso de consulta
                      </label>
                      <select
                        id="integrated-tutor-subject"
                        value={tutorSubjectCode}
                        onChange={(e) => setTutorSubjectCode(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 dark:border-white/15 dark:bg-[#060a15] dark:text-slate-100"
                      >
                        {data.courses.map((c) => (
                          <option key={c.subjectCode} value={c.subjectCode}>
                            {c.subjectName}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}

                  {tutorMessages.length > 0 ? (
                    <div className="mt-3 max-h-44 space-y-2 overflow-y-auto rounded-xl border border-slate-200/70 bg-slate-50 p-2.5 text-xs dark:border-white/10 dark:bg-[#060a15]">
                      {tutorMessages.slice(-3).map((msg) => (
                        <div
                          key={msg.id}
                          className={cn(
                            "rounded-lg p-2.5",
                            msg.sender === "student"
                              ? "bg-primary text-primary-foreground"
                              : "border border-slate-200 bg-white text-slate-800 dark:border-white/10 dark:bg-[#0d152a] dark:text-slate-100"
                          )}
                        >
                          <p className="leading-relaxed">{msg.text}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <form
                    onSubmit={handleAskSocraticTutor}
                    className="mt-3 space-y-2"
                  >
                    <Textarea
                      rows={2}
                      value={tutorQuestion}
                      onChange={(e) => setTutorQuestion(e.target.value)}
                      placeholder="Escribe tu duda sobre la materia..."
                      className="rounded-xl text-xs"
                    />
                    <Button
                      type="submit"
                      size="sm"
                      disabled={tutorLoading || tutorQuestion.trim().length < 4}
                      className="w-full rounded-xl text-xs"
                    >
                      {tutorLoading ? (
                        <>
                          <Spinner data-icon="inline-start" />
                          Analizando...
                        </>
                      ) : (
                        <>
                          <Send data-icon="inline-start" />
                          Consultar al Tutor IA
                        </>
                      )}
                    </Button>
                  </form>
                </section>
              </aside>
            </div>
          </motion.div>
        ) : (
          /* SECCIÓN 3: LABORATORIOS PRÁCTICOS POR MENCIÓN TÉCNICA */
          <motion.div
            key="section-labs"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="mx-auto max-w-6xl px-4 pt-24 pb-12 sm:px-8"
          >
            <section
              aria-label="Laboratorios prácticos por mención técnica"
              className="rounded-2xl border border-slate-200/80 bg-white/85 p-6 shadow-xs backdrop-blur-xl dark:border-white/10 dark:bg-[#0a1020]/85"
            >
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div className="flex items-start gap-3.5">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-300">
                    <Cpu className="size-5.5" aria-hidden="true" />
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl dark:text-white">
                        {data.labShortcut?.title ??
                          "Laboratorios Prácticos de Especialidad"}
                      </h1>
                      {data.mencionName ? (
                        <Badge variant="secondary">
                          Mención {data.mencionName}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-slate-500 sm:text-sm dark:text-slate-400">
                      {data.labShortcut?.description ??
                        "Entornos interactivos especializados integrados al Aula Virtual para Telemática, Aduanas y Turismo."}
                    </p>
                  </div>
                </div>

                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="shrink-0 rounded-xl text-xs"
                >
                  <Link href="/estudiante/asignaturas?vista=mapa">
                    <Sparkles data-icon="inline-start" />
                    <span>Ver Pensum de la Mención</span>
                    <ArrowUpRight data-icon="inline-end" />
                  </Link>
                </Button>
              </div>

              {data.labShortcut ? (
                <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {data.labShortcut.tools.map((toolName, i) => (
                    <div
                      key={toolName}
                      className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-white/[0.03]"
                    >
                      <div className="flex items-center justify-between">
                        <span className="flex size-8 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-300">
                          <FolderKanban
                            className="size-4"
                            aria-hidden="true"
                          />
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          Módulo 0{i + 1}
                        </Badge>
                      </div>
                      <div>
                        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                          {toolName}
                        </h2>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          Disponible para prácticas guiadas de las asignaturas
                          técnicas de {data.labShortcut?.mencionName}.
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  Clock,
  Layers,
  UserCheck,
} from "lucide-react";
import {
  ROLE_HOME_PATH,
  ROLE_LABELS,
} from "@/components/dashboard/DashboardSidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { getAulaVirtualCampusData } from "@/features/aula-virtual/aula-virtual-data";
import { getAuthenticatedDashboardContext } from "@/lib/auth/dashboard-session";
import { canRoleAccessDashboardPath } from "@/lib/auth/rbac";

interface AulaVirtualCoursePageProps {
  params: Promise<{
    courseId: string;
  }>;
}

export async function generateMetadata({
  params,
}: AulaVirtualCoursePageProps): Promise<Metadata> {
  const { courseId } = await params;
  const code = decodeURIComponent(courseId).trim().toUpperCase();
  return {
    title: `${code || "Curso"} · Aula Virtual · S.I.G.A.`,
  };
}

/**
 * Página propia de la asignatura en el Aula Virtual (`/aula-virtual/[courseId]`),
 * estructurada tipo Moodle y preparada para su futura implementación de módulos y entregas.
 */
export default async function AulaVirtualCourseStandalonePage({
  params,
}: AulaVirtualCoursePageProps) {
  const [profile, resolvedParams] = await Promise.all([
    getAuthenticatedDashboardContext(),
    params,
  ]);

  if (!canRoleAccessDashboardPath(profile.primaryRole, "/aula-virtual")) {
    redirect(ROLE_HOME_PATH[profile.primaryRole] ?? "/");
  }

  if (
    profile.primaryRole === "estudiante" &&
    profile.accessTier !== "verified_workspace"
  ) {
    redirect("/estudiante");
  }

  const cleanCode = decodeURIComponent(resolvedParams.courseId)
    .trim()
    .toUpperCase();
  const campusData = await getAulaVirtualCampusData(profile);
  const course =
    campusData.courses.find(
      (c) =>
        c.subjectCode.toUpperCase() === cleanCode ||
        c.virtualCourseId === resolvedParams.courseId ||
        c.curriculumSubjectId === resolvedParams.courseId
    ) ?? null;

  const returnHref = ROLE_HOME_PATH[profile.primaryRole] ?? "/estudiante";

  return (
    <div className="font-hero min-h-screen w-full bg-slate-50 text-slate-900 transition-colors duration-300 dark:bg-[#050811] dark:text-slate-100">
      {/* Barra superior Glassmorphism de la página de curso */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/70 backdrop-blur-2xl dark:border-white/10 dark:bg-[#070d1c]/70">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-8">
          <div className="flex items-center gap-3">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="rounded-full text-xs"
            >
              <Link href="/aula-virtual?seccion=courses">
                <ArrowLeft data-icon="inline-start" />
                Volver a Mis Cursos
              </Link>
            </Button>

            <div className="hidden items-center gap-2 text-xs text-slate-500 sm:flex dark:text-slate-400">
              <span className="flex size-5 items-center justify-center rounded-full bg-white p-0.5 shadow-2xs">
                <Image
                  src="/images/institucion/logotipo.webp"
                  alt='Escudo E.T.C. "Andrés Bello"'
                  width={16}
                  height={16}
                  className="size-4 rounded-full object-contain"
                />
              </span>
              <span>Aula Virtual</span>
              <span aria-hidden="true">/</span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {course?.subjectName ?? cleanCode}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href={returnHref}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-200/90 bg-white/75 px-3.5 text-xs font-medium text-slate-900 shadow-2xs backdrop-blur-xl transition-colors hover:border-primary/40 dark:border-white/15 dark:bg-white/10 dark:text-white"
            >
              <span className="hidden sm:inline">
                S.I.G.A. ({ROLE_LABELS[profile.primaryRole]})
              </span>
              <span className="sm:hidden">S.I.G.A.</span>
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>

      {/* Cuerpo de la página propia de la asignatura tipo Moodle */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
        {/* Cabecera del Curso */}
        <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xs dark:border-white/10 dark:bg-[#0a1020]">
          <div className="bg-gradient-to-r from-[#0b1d59] via-[#13328f] to-[#0891b2] p-6 text-white sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-white/25 bg-white/15 font-mono text-white">
                {course?.subjectCode ?? cleanCode}
              </Badge>
              {course?.categoryLabel ? (
                <Badge className="border-white/20 bg-black/20 text-cyan-100">
                  {course.categoryLabel}
                </Badge>
              ) : null}
              {course?.sectionLabel ? (
                <Badge className="border-white/20 bg-white/10 text-white">
                  {course.sectionLabel}
                </Badge>
              ) : null}
            </div>

            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              {course?.subjectName ?? `Asignatura ${cleanCode}`}
            </h1>

            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-sky-100/90 sm:text-sm">
              <span className="inline-flex items-center gap-1.5">
                <UserCheck className="size-4" aria-hidden="true" />
                {course?.teacherName ?? "Docente titular por asignar"}
              </span>
              {course?.scheduleSummary ? (
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="size-4" aria-hidden="true" />
                  {course.scheduleSummary}
                </span>
              ) : null}
            </div>
          </div>
        </section>

        {/* Estructura base Moodle (Índice izquierdo + Lienzo de Unidades preparado para implementar) */}
        <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          <aside className="rounded-2xl border border-slate-200/80 bg-white/85 p-4 shadow-xs backdrop-blur-xl lg:col-span-3 dark:border-white/10 dark:bg-[#0a1020]/85">
            <span className="block border-b border-slate-200/70 pb-2.5 text-xs font-bold tracking-wide text-slate-800 uppercase dark:border-white/10 dark:text-slate-200">
              Índice del Curso
            </span>
            <ul className="mt-3 space-y-1 text-xs text-slate-600 dark:text-slate-300">
              <li className="rounded-xl bg-primary/10 px-3 py-2 font-semibold text-primary dark:bg-cyan-400/15 dark:text-cyan-300">
                Presentación de la Materia
              </li>
              <li className="rounded-xl px-3 py-2">Unidad I · I Momento</li>
              <li className="rounded-xl px-3 py-2">Unidad II · II Momento</li>
              <li className="rounded-xl px-3 py-2">Unidad III · III Momento</li>
              <li className="rounded-xl px-3 py-2">Recursos y Entregas</li>
            </ul>
          </aside>

          <section className="rounded-2xl border border-slate-200/80 bg-white/85 p-6 shadow-xs backdrop-blur-xl lg:col-span-9 dark:border-white/10 dark:bg-[#0a1020]/85">
            <Empty className="rounded-2xl border border-dashed py-14">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Layers aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle className="text-base">
                  Página de curso lista para construcción ({course?.subjectName ?? cleanCode})
                </EmptyTitle>
                <EmptyDescription>
                  Este es el espacio individual estilo Moodle de la asignatura.
                  Aquí se integrarán próximamente los módulos, guías descargables,
                  buzón de entregas y cuestionarios del curso.
                </EmptyDescription>
              </EmptyHeader>
              {profile.primaryRole === "estudiante" && course ? (
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="mt-2 rounded-xl text-xs"
                >
                  <Link
                    href={`/estudiante/asignaturas/${encodeURIComponent(course.subjectCode)}`}
                  >
                    <BookOpen data-icon="inline-start" />
                    Consultar notas y simulador de esta materia
                  </Link>
                </Button>
              ) : null}
            </Empty>
          </section>
        </div>
      </div>
    </div>
  );
}

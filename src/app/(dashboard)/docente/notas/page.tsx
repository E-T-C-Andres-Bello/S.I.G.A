import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  AlertCircle,
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  FileSpreadsheet,
  GraduationCap,
  Lock,
  ShieldCheck,
  Users,
} from "lucide-react";
import { getAuthenticatedDashboardContext } from "@/lib/supabase/dashboard-session";
import {
  getActiveMomentos,
  getSectionStudents,
  getTeacherAssignments,
} from "@/features/docente/docente-service";

export const metadata: Metadata = {
  title: 'Planilla de Calificaciones MPPE · S.I.G.A. — E.T.C. "Andrés Bello"',
  description:
    'Planilla oficial de calificaciones en escala MPPE 1–20 con auditoría inmutable y ponderación automática.',
};

export default async function DocenteNotasPage() {
  const profile = await getAuthenticatedDashboardContext();

  if (
    profile.primaryRole !== "docente" &&
    profile.primaryRole !== "coordinador_mencion" &&
    profile.primaryRole !== "direccion"
  ) {
    redirect("/docente");
  }

  const assignments = await getTeacherAssignments();
  const firstAssignment = assignments[0];
  const schoolYearId = firstAssignment?.schoolYearId ?? "";

  const [momentos, students] = await Promise.all([
    schoolYearId ? getActiveMomentos(schoolYearId) : Promise.resolve([]),
    firstAssignment ? getSectionStudents(firstAssignment.sectionId) : Promise.resolve([]),
  ]);

  return (
    <div className="font-hero flex flex-col gap-6 pb-12">
      {/* Encabezado */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <span className="siga-glass-pill inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium text-primary">
            <FileSpreadsheet className="size-3.5" />
            Módulo 2.3 · Matriz Oficial de Calificaciones
          </span>
          <h1 className="mt-2 text-2xl font-normal tracking-tight text-foreground sm:text-3xl">
            Carga y Ponderación de Calificaciones (MPPE 1–20)
          </h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Planilla consolidada por momento pedagógico conectada a la bitácora inmutable de auditoría.
          </p>
        </div>

        <span className="siga-glass-inner flex w-fit items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
          <ShieldCheck className="size-4" />
          Auditoría Anti-Tamper Activa
        </span>
      </div>

      {/* Tarjeta de Información de la Asignatura */}
      <div className="siga-glass-surface flex flex-wrap items-center justify-between gap-4 rounded-[24px] border p-5">
        <div className="flex items-center gap-3.5">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <BookOpen className="size-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {firstAssignment?.subjectName ?? "Sin Asignatura Seleccionada"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {firstAssignment?.sectionFullName ?? "Sin sección"} · Código: {firstAssignment?.subjectCode ?? "N/A"} · Escala: 1–20 MPPE
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {momentos.map((m) => (
            <span
              key={m.id}
              className="rounded-full border bg-background/60 px-3 py-1 text-xs font-medium text-foreground"
            >
              {m.name}
            </span>
          ))}
        </div>
      </div>

      {/* Nómina de Calificaciones */}
      <div className="siga-glass-surface overflow-hidden rounded-[24px] border">
        <div className="border-b p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-foreground">
            Estudiantes Matriculados ({students.length})
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Las calificaciones ingresadas se calculan automáticamente con el promedio ponderado oficial.
          </p>
        </div>

        {students.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            No hay estudiantes asignados en esta sección para calificar.
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {students.map((student, idx) => (
              <div
                key={student.enrollmentId}
                className="flex items-center justify-between gap-4 p-4 text-xs transition-colors hover:bg-accent/20"
              >
                <div className="flex items-center gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">
                    {idx + 1}
                  </span>
                  <div>
                    <p className="font-semibold text-foreground">
                      {student.lastName}, {student.firstName}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{student.cedula}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-muted-foreground">Promedio:</span>
                    <span className="font-mono text-sm font-bold text-foreground">— / 20</span>
                  </div>
                  <span className="rounded-full bg-accent/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                    En espera de corte
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

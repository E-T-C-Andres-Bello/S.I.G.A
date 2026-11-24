import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthenticatedDashboardContext } from "@/lib/supabase/dashboard-session";
import { DocenteAsistenciaView } from "@/features/docente/components/DocenteAsistenciaView";
import {
  getActiveMomentos,
  getClassDiaryEntries,
  getSectionStudents,
  getTeacherAbsences,
  getTeacherAssignments,
} from "@/features/docente/docente-service";

export const metadata: Metadata = {
  title: 'Control de Asistencia y Diario · S.I.G.A. — E.T.C. "Andrés Bello"',
  description:
    'Pase de lista diario, diario pedagógico de clases y notificación formal de inasistencias docentes.',
};

function getCaracasTodayIso(): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Caracas",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date());
}

export default async function DocenteAsistenciaPage() {
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

  const [momentos, initialStudents, initialDiary, initialAbsences] = await Promise.all([
    schoolYearId ? getActiveMomentos(schoolYearId) : Promise.resolve([]),
    firstAssignment ? getSectionStudents(firstAssignment.sectionId) : Promise.resolve([]),
    firstAssignment ? getClassDiaryEntries(firstAssignment.assignmentId) : Promise.resolve([]),
    getTeacherAbsences(),
  ]);

  const todayIso = getCaracasTodayIso();

  return (
    <DocenteAsistenciaView
      assignments={assignments}
      momentos={momentos}
      initialStudents={initialStudents}
      initialDiary={initialDiary}
      initialAbsences={initialAbsences}
      todayIso={todayIso}
    />
  );
}

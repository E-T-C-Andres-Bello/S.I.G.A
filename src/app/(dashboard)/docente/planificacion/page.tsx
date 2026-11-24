import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthenticatedDashboardContext } from "@/lib/supabase/dashboard-session";
import { DocentePlanificacionView } from "@/features/docente/components/DocentePlanificacionView";
import {
  getActiveMomentos,
  getTeacherAssignments,
} from "@/features/docente/docente-service";

export const metadata: Metadata = {
  title: 'Planificación Académica MPPE · S.I.G.A. — E.T.C. "Andrés Bello"',
  description:
    'Elaboración y ponderación de planes de evaluación académica alineados con la normativa del MPPE para la Educación Media Técnica.',
};

export default async function DocentePlanificacionPage() {
  const profile = await getAuthenticatedDashboardContext();

  // Asegurar acceso a docentes o coordinadores
  if (
    profile.primaryRole !== "docente" &&
    profile.primaryRole !== "coordinador_mencion" &&
    profile.primaryRole !== "direccion"
  ) {
    redirect("/docente");
  }

  const assignments = await getTeacherAssignments();
  const schoolYearId = assignments[0]?.schoolYearId ?? "";
  const momentos = schoolYearId ? await getActiveMomentos(schoolYearId) : [];

  return (
    <DocentePlanificacionView
      assignments={assignments}
      momentos={momentos}
    />
  );
}

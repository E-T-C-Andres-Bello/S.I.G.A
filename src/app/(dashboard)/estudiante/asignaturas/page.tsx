import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ROLE_HOME_PATH } from "@/components/dashboard/DashboardSidebar";
import { StudentCurriculumHubView } from "@/components/estudiante/StudentCurriculumHubView";
import { getStudentCurriculumOverviewData } from "@/features/estudiante/subjects-data";
import { getAuthenticatedDashboardContext } from "@/lib/auth/dashboard-session";

export const metadata: Metadata = {
  title: 'Asignaturas y Pensum · S.I.G.A. — E.T.C. "Andrés Bello"',
};

interface EstudianteAsignaturasPageProps {
  searchParams: Promise<{
    vista?: string;
  }>;
}

export default async function EstudianteAsignaturasPage({
  searchParams,
}: EstudianteAsignaturasPageProps) {
  const [profile, params] = await Promise.all([
    getAuthenticatedDashboardContext(),
    searchParams,
  ]);

  if (profile.primaryRole !== "estudiante") {
    redirect(ROLE_HOME_PATH[profile.primaryRole] ?? "/");
  }

  if (profile.accessTier !== "verified_workspace") {
    redirect("/estudiante");
  }

  const data = await getStudentCurriculumOverviewData(profile);
  const initialSubsection =
    params.vista === "mapa" || params.vista === "historial"
      ? "mapa"
      : "asignaturas";

  return (
    <StudentCurriculumHubView
      data={data}
      initialSubsection={initialSubsection}
    />
  );
}

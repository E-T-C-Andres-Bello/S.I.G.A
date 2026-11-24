import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ROLE_HOME_PATH } from "@/components/dashboard/DashboardSidebar";
import { StudentAttendanceHubView } from "@/components/estudiante/StudentAttendanceHubView";
import { getStudentAttendanceOverviewData } from "@/features/estudiante/attendance-data";
import { getAuthenticatedDashboardContext } from "@/lib/auth/dashboard-session";

export const metadata: Metadata = {
  title: 'Mi Día Escolar y Asistencia · S.I.G.A. — E.T.C. "Andrés Bello"',
};

export default async function EstudianteAsistenciaPage() {
  const profile = await getAuthenticatedDashboardContext();

  if (profile.primaryRole !== "estudiante") {
    redirect(ROLE_HOME_PATH[profile.primaryRole] ?? "/");
  }

  if (profile.accessTier !== "verified_workspace") {
    redirect("/estudiante");
  }

  const data = await getStudentAttendanceOverviewData(profile);

  return <StudentAttendanceHubView data={data} />;
}

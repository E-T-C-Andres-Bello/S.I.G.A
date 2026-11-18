import type { Metadata } from "next";
import { StudentDashboardView } from "@/components/dashboard/StudentDashboardView";
import { getStudentDashboardData } from "@/features/estudiante/dashboard-data";
import { getAuthenticatedDashboardContext } from "@/lib/supabase/dashboard-session";

export const metadata: Metadata = {
  title: 'Inicio Estudiante · S.I.G.A. — E.T.C. "Andrés Bello"',
};

function getCaracasTimeContext(): { todayIso: string; greeting: string } {
  const now = new Date();
  const dateFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Caracas",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const hourFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Caracas",
    hour: "numeric",
    hour12: false,
  });

  const hour = Number(hourFormatter.format(now));
  const greeting =
    hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";

  return {
    todayIso: dateFormatter.format(now),
    greeting,
  };
}

export default async function EstudianteHomePage() {
  const profile = await getAuthenticatedDashboardContext();
  const [{ todayIso, greeting }, dashboardData] = await Promise.all([
    Promise.resolve(getCaracasTimeContext()),
    getStudentDashboardData(profile.internalUserId),
  ]);

  return (
    <StudentDashboardView
      profile={profile}
      data={dashboardData}
      todayIso={todayIso}
      greeting={greeting}
    />
  );
}

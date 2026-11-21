import type { Metadata } from "next";
import { AnaliticaDashboardView } from "@/components/analitica/AnaliticaDashboardView";
import { getInstitutionalAnalyticsData } from "@/features/analitica/server";
import { getAuthenticatedDashboardContext } from "@/lib/supabase/dashboard-session";

export const metadata: Metadata = {
  title: 'Dirección y Analítica · S.I.G.A. — E.T.C. "Andrés Bello"',
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

export default async function AnaliticaHomePage() {
  const profile = await getAuthenticatedDashboardContext();
  const { todayIso, greeting } = getCaracasTimeContext();
  const analyticsResult = await getInstitutionalAnalyticsData(profile);

  return (
    <AnaliticaDashboardView
      profile={profile}
      initialData={analyticsResult.ok ? analyticsResult.data : null}
      initialError={analyticsResult.ok ? null : analyticsResult.message}
      todayIso={todayIso}
      greeting={greeting}
    />
  );
}

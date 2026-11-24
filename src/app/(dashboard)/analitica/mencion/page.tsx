import type { Metadata } from "next";
import { MencionCoordinationView } from "@/components/analitica/MencionCoordinationView";
import { getMencionCoordinationData } from "@/features/menciones/coordinacion-server";
import { getAuthenticatedDashboardContext } from "@/lib/auth/dashboard-session";

export const metadata: Metadata = {
  title: 'Coordinación de Mención · S.I.G.A. — E.T.C. "Andrés Bello"',
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

export default async function MencionCoordinationPage({
  searchParams,
}: {
  searchParams: Promise<{ mencionId?: string }>;
}) {
  const [profile, resolvedParams] = await Promise.all([
    getAuthenticatedDashboardContext(),
    searchParams,
  ]);
  const { todayIso, greeting } = getCaracasTimeContext();
  const result = await getMencionCoordinationData(
    profile,
    resolvedParams.mencionId ?? null
  );

  return (
    <MencionCoordinationView
      profile={profile}
      initialData={result.ok ? result.data : null}
      initialError={result.ok ? null : result.message}
      todayIso={todayIso}
      greeting={greeting}
    />
  );
}


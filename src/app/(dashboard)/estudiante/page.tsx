import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BellistaBulletinCardFan } from "@/components/cartelera/BellistaBulletinCardFan";
import {
  StudentDashboardView,
  type StudentPortalTab,
} from "@/components/dashboard/StudentDashboardView";
import { ProvisionalStudentOnboardingView } from "@/components/estudiante/ProvisionalStudentOnboardingView";
import { getDashboardBulletinHighlights } from "@/features/cartelera/announcements-data";
import { getStudentDashboardData } from "@/features/estudiante/dashboard-data";
import { getProvisionalStudentOnboardingData } from "@/features/estudiante/provisional-data";
import { generateStudentCarnetTokenAction } from "@/features/estudiante/student-actions";
import {
  getAuthenticatedDashboardContext,
  type DashboardUserProfile,
} from "@/lib/auth/dashboard-session";

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

interface EstudianteHomePageProps {
  searchParams: Promise<{
    auth_error?: string;
    workspace_linked?: string;
    tab?: string;
    requestType?: string;
    subject?: string;
  }>;
}

const VALID_TABS = new Set<StudentPortalTab>([
  "resumen",
  "horario",
  "carnet",
]);

async function StreamedDashboardBulletin({
  profile,
}: {
  profile: DashboardUserProfile;
}) {
  const highlights = await getDashboardBulletinHighlights(profile, 25);
  if (highlights.length === 0) return null;
  return <BellistaBulletinCardFan items={highlights} variant="dashboard" />;
}

export default async function EstudianteHomePage({
  searchParams,
}: EstudianteHomePageProps) {
  const [profile, params] = await Promise.all([
    getAuthenticatedDashboardContext(),
    searchParams,
  ]);

  if (profile.accessTier === "provisional_cedula") {
    const [onboarding, bulletinHighlights] = await Promise.all([
      getProvisionalStudentOnboardingData(profile.internalUserId),
      getDashboardBulletinHighlights(profile, 25),
    ]);
    return (
      <ProvisionalStudentOnboardingView
        profile={profile}
        onboarding={onboarding}
        bulletinHighlights={bulletinHighlights}
        authErrorCode={params.auth_error ?? null}
      />
    );
  }

  // Compatibilidad con enlaces previos (?tab=tramites en correos o accesos guardados)
  if (params.tab === "tramites") {
    const nextParams = new URLSearchParams();
    if (params.requestType) nextParams.set("requestType", params.requestType);
    if (params.subject) nextParams.set("subject", params.subject);
    const qs = nextParams.toString();
    redirect(qs ? `/estudiante/tramites?${qs}` : "/estudiante/tramites");
  }

  const initialTab: StudentPortalTab =
    params.tab && VALID_TABS.has(params.tab as StudentPortalTab)
      ? (params.tab as StudentPortalTab)
      : "resumen";

  const { todayIso, greeting } = getCaracasTimeContext();
  const [dashboardData, carnetResult] = await Promise.all([
    getStudentDashboardData(profile.internalUserId, profile.accessTier, {
      authUserId: profile.authUserId,
      email: profile.authEmail,
    }),
    initialTab === "carnet"
      ? generateStudentCarnetTokenAction(120)
      : Promise.resolve(null),
  ]);

  return (
    <StudentDashboardView
      profile={profile}
      data={dashboardData}
      bulletinSlot={
        <Suspense fallback={null}>
          <StreamedDashboardBulletin profile={profile} />
        </Suspense>
      }
      initialCarnetToken={carnetResult && carnetResult.ok ? carnetResult.data : null}
      initialCarnetError={
        carnetResult && !carnetResult.ok ? carnetResult.message : null
      }
      todayIso={todayIso}
      greeting={greeting}
      initialTab={initialTab}
      justLinkedWorkspace={params.workspace_linked === "1"}
    />
  );
}

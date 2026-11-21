import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AulaVirtualCampusView } from "@/components/aula-virtual/AulaVirtualCampusView";
import type { MoodleWorkspaceSection } from "@/components/aula-virtual/AulaVirtualParticleHero";
import { ROLE_HOME_PATH } from "@/components/dashboard/DashboardSidebar";
import { getAulaVirtualCampusData } from "@/features/aula-virtual/aula-virtual-data";
import { getAuthenticatedDashboardContext } from "@/lib/supabase/dashboard-session";
import { canRoleAccessDashboardPath } from "@/lib/supabase/rbac";

export const metadata: Metadata = {
  title: 'Aula Virtual LMS · S.I.G.A. — E.T.C. "Andrés Bello"',
};

interface AulaVirtualPageProps {
  searchParams: Promise<{
    seccion?: string;
  }>;
}

export default async function AulaVirtualPage({
  searchParams,
}: AulaVirtualPageProps) {
  const [profile, params] = await Promise.all([
    getAuthenticatedDashboardContext(),
    searchParams,
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

  const campusData = await getAulaVirtualCampusData(profile);
  const initialSection: MoodleWorkspaceSection =
    params.seccion === "courses" || params.seccion === "cursos"
      ? "courses"
      : params.seccion === "labs" || params.seccion === "laboratorios"
        ? "labs"
        : "overview";

  return (
    <AulaVirtualCampusView
      profile={profile}
      data={campusData}
      initialSection={initialSection}
    />
  );
}

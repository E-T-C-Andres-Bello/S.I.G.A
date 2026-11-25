import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StudentPortfolioStudioView } from "@/components/portafolio/StudentPortfolioStudioView";
import { getStudentPortfolioWorkspaceData } from "@/features/portafolio/portfolio-data";
import { getAuthenticatedDashboardContext } from "@/lib/auth/dashboard-session";
import { canRoleAccessDashboardPath } from "@/lib/auth/rbac";

export const metadata: Metadata = {
  title: 'Portafolio Técnico y CV · S.I.G.A. — E.T.C. "Andrés Bello"',
};

export default async function EstudiantePortafolioPage() {
  const profile = await getAuthenticatedDashboardContext();

  if (!canRoleAccessDashboardPath(profile.primaryRole, "/estudiante/portafolio")) {
    redirect("/estudiante");
  }

  if (profile.accessTier !== "verified_workspace") {
    redirect("/estudiante");
  }

  const initialData = await getStudentPortfolioWorkspaceData(profile);
  return <StudentPortfolioStudioView initialData={initialData} />;
}

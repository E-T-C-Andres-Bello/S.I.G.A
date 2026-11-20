import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ROLE_HOME_PATH } from "@/components/dashboard/DashboardSidebar";
import { StudentTramitesView } from "@/components/estudiante/StudentTramitesView";
import { getStudentTramitesData } from "@/features/estudiante/tramites-data";
import { getAuthenticatedDashboardContext } from "@/lib/supabase/dashboard-session";

export const metadata: Metadata = {
  title: 'Trámites y Constancias · S.I.G.A. — E.T.C. "Andrés Bello"',
};

interface EstudianteTramitesPageProps {
  searchParams: Promise<{
    requestType?: string;
    subject?: string;
  }>;
}

const VALID_REQUEST_TYPES = new Set([
  "constancia_estudio",
  "constancia_inscripcion",
  "solvencia",
  "revision_notas",
] as const);

export default async function EstudianteTramitesPage({
  searchParams,
}: EstudianteTramitesPageProps) {
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

  const initialRequestType =
    params.requestType &&
    VALID_REQUEST_TYPES.has(
      params.requestType as
        | "constancia_estudio"
        | "constancia_inscripcion"
        | "solvencia"
        | "revision_notas"
    )
      ? (params.requestType as
          | "constancia_estudio"
          | "constancia_inscripcion"
          | "solvencia"
          | "revision_notas")
      : undefined;

  const cleanSubject = params.subject?.trim().slice(0, 120);
  const initialRequestReason =
    initialRequestType === "revision_notas" && cleanSubject
      ? `Solicito revisión formal de calificación en ${cleanSubject}: `
      : undefined;

  const tramitesData = await getStudentTramitesData(profile.internalUserId);

  return (
    <StudentTramitesView
      profile={profile}
      initialData={tramitesData}
      showBackLink={false}
      initialRequestType={initialRequestType}
      initialRequestReason={initialRequestReason}
    />
  );
}

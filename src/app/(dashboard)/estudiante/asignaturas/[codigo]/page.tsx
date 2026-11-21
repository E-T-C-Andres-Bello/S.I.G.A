import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ROLE_HOME_PATH } from "@/components/dashboard/DashboardSidebar";
import { StudentSubjectDetailView } from "@/components/estudiante/StudentSubjectDetailView";
import { getStudentSubjectDetailData } from "@/features/estudiante/subjects-data";
import { getAuthenticatedDashboardContext } from "@/lib/supabase/dashboard-session";

interface EstudianteAsignaturaDetailPageProps {
  params: Promise<{
    codigo: string;
  }>;
}

export async function generateMetadata({
  params,
}: EstudianteAsignaturaDetailPageProps): Promise<Metadata> {
  const { codigo } = await params;
  const cleanCode = decodeURIComponent(codigo).trim().toUpperCase();
  return {
    title: `${cleanCode || "Asignatura"} · S.I.G.A. — E.T.C. "Andrés Bello"`,
  };
}

export default async function EstudianteAsignaturaDetailPage({
  params,
}: EstudianteAsignaturaDetailPageProps) {
  const [profile, resolvedParams] = await Promise.all([
    getAuthenticatedDashboardContext(),
    params,
  ]);

  if (profile.primaryRole !== "estudiante") {
    redirect(ROLE_HOME_PATH[profile.primaryRole] ?? "/");
  }

  if (profile.accessTier !== "verified_workspace") {
    redirect("/estudiante");
  }

  const data = await getStudentSubjectDetailData(profile, resolvedParams.codigo);
  if (!data) {
    notFound();
  }

  return <StudentSubjectDetailView data={data} />;
}

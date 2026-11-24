import { redirect } from "next/navigation";
import { ROLE_HOME_PATH } from "@/components/dashboard/DashboardSidebar";
import { StudentProfileView } from "@/components/estudiante/StudentProfileView";
import { getStudentProfilePageData } from "@/features/estudiante/profile-data";
import { getAuthenticatedDashboardContext } from "@/lib/auth/dashboard-session";

type StudentProfileSection =
  | "identidad"
  | "contacto"
  | "seguridad"
  | "preferencias";

function resolveInitialSection(
  raw?: string | string[]
): StudentProfileSection {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (
    value === "contacto" ||
    value === "seguridad" ||
    value === "preferencias"
  ) {
    return value;
  }
  return "identidad";
}

export default async function EstudiantePerfilPage({
  searchParams,
}: {
  searchParams?: Promise<{ seccion?: string | string[] }>;
}) {
  const profile = await getAuthenticatedDashboardContext();

  if (profile.primaryRole !== "estudiante") {
    redirect(ROLE_HOME_PATH[profile.primaryRole] ?? "/");
  }

  const resolvedParams = searchParams ? await searchParams : undefined;
  const initialSection = resolveInitialSection(resolvedParams?.seccion);
  const data = await getStudentProfilePageData(profile);

  return (
    <StudentProfileView
      data={data}
      initialSection={initialSection}
    />
  );
}

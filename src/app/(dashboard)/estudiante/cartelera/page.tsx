import type { Metadata } from "next";
import { SchoolBulletinView } from "@/components/shared/SchoolBulletinView";
import { getSchoolBulletinData } from "@/features/cartelera/announcements-data";
import { getAuthenticatedDashboardContext } from "@/lib/auth/dashboard-session";

export const metadata: Metadata = {
  title: 'La Cartelera Bellista · S.I.G.A. — E.T.C. "Andrés Bello"',
};

interface EstudianteCarteleraPageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function EstudianteCarteleraPage({
  searchParams,
}: EstudianteCarteleraPageProps) {
  const [profile, params] = await Promise.all([
    getAuthenticatedDashboardContext(),
    searchParams,
  ]);
  const initialData = await getSchoolBulletinData(profile, {
    includeEditorial: true,
    limit: 60,
  });

  const initialSection = params.tab === "leidos" ? "leidos" : "por_leer";

  return (
    <SchoolBulletinView
      profile={profile}
      initialData={initialData}
      initialSection={initialSection}
    />
  );
}

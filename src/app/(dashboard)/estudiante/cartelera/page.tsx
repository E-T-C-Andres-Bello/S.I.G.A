import type { Metadata } from "next";
import { SchoolBulletinView } from "@/components/shared/SchoolBulletinView";
import { getSchoolBulletinData } from "@/features/cartelera/announcements-data";
import { getAuthenticatedDashboardContext } from "@/lib/auth/dashboard-session";

export const metadata: Metadata = {
  title: 'La Cartelera Bellista · S.I.G.A. — E.T.C. "Andrés Bello"',
};

export default async function EstudianteCarteleraPage() {
  const profile = await getAuthenticatedDashboardContext();
  const initialData = await getSchoolBulletinData(profile, {
    includeEditorial: true,
    limit: 40,
  });

  return <SchoolBulletinView profile={profile} initialData={initialData} />;
}

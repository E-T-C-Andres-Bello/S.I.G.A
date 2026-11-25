import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BulletinEditorialStudioView } from "@/components/cartelera/BulletinEditorialStudioView";
import { getSchoolBulletinData } from "@/features/cartelera/announcements-data";
import { getAuthenticatedDashboardContext } from "@/lib/auth/dashboard-session";

export const metadata: Metadata = {
  title: 'Gestionar Cartelera · S.I.G.A. — E.T.C. "Andrés Bello"',
};

interface CarteleraGestionPageProps {
  searchParams: Promise<{ edit?: string }>;
}

export default async function CarteleraGestionPage({
  searchParams,
}: CarteleraGestionPageProps) {
  const [profile, params] = await Promise.all([
    getAuthenticatedDashboardContext(),
    searchParams,
  ]);

  const initialData = await getSchoolBulletinData(profile, {
    includeEditorial: true,
    limit: 80,
  });

  if (!initialData.canPublish) {
    redirect("/estudiante/cartelera");
  }

  return (
    <BulletinEditorialStudioView
      profile={profile}
      initialData={initialData}
      initialEditId={params.edit ?? null}
    />
  );
}

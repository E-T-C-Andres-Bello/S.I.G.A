import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { getAuthenticatedDashboardContext } from "@/lib/supabase/dashboard-session";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const profile = await getAuthenticatedDashboardContext();

  return <DashboardShell profile={profile}>{children}</DashboardShell>;
}

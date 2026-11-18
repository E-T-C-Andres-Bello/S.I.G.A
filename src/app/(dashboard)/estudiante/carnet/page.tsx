import { redirect } from "next/navigation";
import { getAuthenticatedDashboardContext } from "@/lib/supabase/dashboard-session";

export default async function EstudianteCarnetPage() {
  const profile = await getAuthenticatedDashboardContext();

  if (
    profile.primaryRole !== "estudiante" ||
    profile.accessTier !== "verified_workspace"
  ) {
    redirect("/estudiante");
  }

  redirect("/estudiante?tab=carnet");
}

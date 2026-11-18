import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { StudentDevToolbar } from "@/components/dev/StudentDevToolbar";
import { getQaStudentSandboxState } from "@/features/estudiante/dev-sandbox";
import { getAuthenticatedDashboardContext } from "@/lib/supabase/dashboard-session";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const profile = await getAuthenticatedDashboardContext();
  const qaSandboxState = await getQaStudentSandboxState(profile);

  return (
    <DashboardShell
      profile={profile}
      devToolbar={
        qaSandboxState ? (
          <StudentDevToolbar initialState={qaSandboxState} />
        ) : null
      }
    >
      {children}
    </DashboardShell>
  );
}

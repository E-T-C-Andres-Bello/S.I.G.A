import { NotificationsInboxView } from "@/components/shared/NotificationsInboxView";
import { getNotificationsInboxData } from "@/features/notificaciones/notifications-data";
import { getAuthenticatedDashboardContext } from "@/lib/auth/dashboard-session";

export default async function NotificacionesPage() {
  const profile = await getAuthenticatedDashboardContext();
  const initialData = await getNotificationsInboxData(profile);

  return <NotificationsInboxView initialData={initialData} />;
}

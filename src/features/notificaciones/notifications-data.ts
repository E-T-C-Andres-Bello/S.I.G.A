import type { DashboardUserProfile } from "@/lib/auth/dashboard-session";
import { isNeonDatabaseConfigured, withUserDb } from "@/lib/db/neon";
import {
  normalizeNotificationCategory,
  sanitizeNotificationActionUrl,
  type NotificationItem,
} from "./notification-meta";

interface NotificationRow {
  id: string;
  category: string;
  title: string;
  body: string;
  action_url: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface NotificationsInboxData {
  notifications: NotificationItem[];
  unreadCount: number;
  totalCount: number;
  userEmail: string | null;
  recoveryEmail: string | null;
}

/**
 * Carga en servidor la bandeja personal de notificaciones del usuario autenticado (bajo RLS en Neon).
 */
export async function getNotificationsInboxData(
  profile: DashboardUserProfile,
  limit = 60
): Promise<NotificationsInboxData> {
  if (!isNeonDatabaseConfigured()) {
    return {
      notifications: [],
      unreadCount: 0,
      totalCount: 0,
      userEmail: profile.institutionalEmail,
      recoveryEmail: profile.recoveryEmail,
    };
  }

  const rows = await withUserDb(
    { authUserId: profile.authUserId, email: profile.authEmail },
    async (client) => {
      const res = await client.query<NotificationRow>(
        `SELECT id, category, title, body, action_url, is_read, read_at, created_at
           FROM public.notifications
          WHERE recipient_user_id = $1::uuid
          ORDER BY created_at DESC
          LIMIT $2`,
        [profile.internalUserId, limit]
      );
      return res.rows;
    }
  );

  const notifications: NotificationItem[] = rows.map((row) => ({
    id: row.id,
    category: normalizeNotificationCategory(row.category),
    title: row.title,
    body: row.body,
    actionUrl: sanitizeNotificationActionUrl(row.action_url),
    isRead: Boolean(row.is_read),
    readAt: row.read_at,
    createdAt: row.created_at,
  }));

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return {
    notifications,
    unreadCount,
    totalCount: notifications.length,
    userEmail: profile.institutionalEmail,
    recoveryEmail: profile.recoveryEmail,
  };
}

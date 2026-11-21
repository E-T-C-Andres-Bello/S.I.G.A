import type { DashboardUserProfile } from "@/lib/supabase/dashboard-session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
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
 * Carga en servidor la bandeja personal de notificaciones del usuario autenticado (bajo RLS).
 */
export async function getNotificationsInboxData(
  profile: DashboardUserProfile,
  limit = 60
): Promise<NotificationsInboxData> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return {
      notifications: [],
      unreadCount: 0,
      totalCount: 0,
      userEmail: profile.institutionalEmail,
      recoveryEmail: profile.recoveryEmail,
    };
  }

  const { data } = await supabase
    .from("notifications")
    .select("id, category, title, body, action_url, is_read, read_at, created_at")
    .eq("recipient_user_id", profile.internalUserId)
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<NotificationRow[]>();

  const notifications: NotificationItem[] = (data ?? []).map((row) => ({
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

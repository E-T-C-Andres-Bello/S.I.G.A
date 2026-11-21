"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  normalizeNotificationCategory,
  sanitizeNotificationActionUrl,
  type NotificationItem,
} from "@/features/notificaciones/notification-meta";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/features/notificaciones/notifications-actions";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";

interface RawNotificationRow {
  id: string;
  category: string;
  title: string;
  body: string;
  action_url: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface NotificationsContextValue {
  notifications: NotificationItem[];
  unreadCount: number;
  loading: boolean;
  realtimeConnected: boolean;
  busyAll: boolean;
  markAsRead: (id: string, isRead?: boolean) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refresh: () => Promise<void>;
  hydrateFromServer: (items: NotificationItem[]) => void;
}

const NotificationsContext =
  React.createContext<NotificationsContextValue | null>(null);

// Contador monotónico para tópicos Realtime (evita colisiones en React StrictMode)
let notificationTopicCounter = 0;

function mapRow(row: RawNotificationRow): NotificationItem {
  return {
    id: row.id,
    category: normalizeNotificationCategory(row.category),
    title: row.title,
    body: row.body,
    actionUrl: sanitizeNotificationActionUrl(row.action_url),
    isRead: Boolean(row.is_read),
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

export function NotificationsProvider({
  internalUserId,
  initialUnreadCount,
  children,
}: {
  internalUserId: string;
  initialUnreadCount: number;
  children: React.ReactNode;
}) {
  const [notifications, setNotifications] = React.useState<NotificationItem[]>(
    []
  );
  const [loadedOnce, setLoadedOnce] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [realtimeConnected, setRealtimeConnected] = React.useState(false);
  const [busyAll, setBusyAll] = React.useState(false);

  const markAllLockRef = React.useRef(false);
  const pendingIdsRef = React.useRef<Set<string>>(new Set());

  const fetchNotifications = React.useCallback(async () => {
    const supabase = getBrowserSupabaseClient();
    if (!supabase || !internalUserId) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("notifications")
        .select(
          "id, category, title, body, action_url, is_read, read_at, created_at"
        )
        .eq("recipient_user_id", internalUserId)
        .order("created_at", { ascending: false })
        .limit(60)
        .returns<RawNotificationRow[]>();

      if (!error && Array.isArray(data)) {
        setNotifications(data.map(mapRow));
        setLoadedOnce(true);
      }
    } finally {
      setLoading(false);
    }
  }, [internalUserId]);

  React.useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  // Suscripción en tiempo real a `public.notifications` filtrada por destinatario
  React.useEffect(() => {
    const supabase = getBrowserSupabaseClient();
    if (!supabase || !internalUserId) return;

    const topic = `siga-notifications-${internalUserId}-${++notificationTopicCounter}`;
    const channel = supabase.channel(topic);

    channel
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_user_id=eq.${internalUserId}`,
        },
        (payload) => {
          const raw = payload.new as RawNotificationRow | undefined;
          if (!raw?.id) return;
          const item = mapRow(raw);
          setNotifications((prev) => {
            if (prev.some((n) => n.id === item.id)) return prev;
            return [item, ...prev].slice(0, 80);
          });
          setLoadedOnce(true);
          toast.info(item.title, {
            description: item.body,
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `recipient_user_id=eq.${internalUserId}`,
        },
        (payload) => {
          const raw = payload.new as RawNotificationRow | undefined;
          if (!raw?.id) return;
          const updated = mapRow(raw);
          setNotifications((prev) =>
            prev.map((n) => (n.id === updated.id ? updated : n))
          );
        }
      )
      .subscribe((status) => {
        setRealtimeConnected(status === "SUBSCRIBED");
      });

    return () => {
      setRealtimeConnected(false);
      void supabase.removeChannel(channel);
    };
  }, [internalUserId]);

  const hydrateFromServer = React.useCallback((items: NotificationItem[]) => {
    setNotifications((prev) => {
      if (prev.length === 0) return items;
      const byId = new Map<string, NotificationItem>();
      for (const it of items) byId.set(it.id, it);
      for (const it of prev) byId.set(it.id, it);
      return Array.from(byId.values()).sort(
        (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
      );
    });
    setLoadedOnce(true);
    setLoading(false);
  }, []);

  const markAsRead = React.useCallback(async (id: string, isRead = true) => {
    if (pendingIdsRef.current.has(id)) return;
    pendingIdsRef.current.add(id);

    let previousItem: NotificationItem | undefined;
    const optimisticReadAt = isRead ? new Date().toISOString() : null;

    setNotifications((prev) =>
      prev.map((n) => {
        if (n.id !== id) return n;
        previousItem = n;
        return { ...n, isRead, readAt: optimisticReadAt };
      })
    );

    try {
      const res = await markNotificationReadAction(id, isRead);
      if (!res.ok) {
        if (previousItem) {
          const rollback = previousItem;
          setNotifications((prev) =>
            prev.map((n) => (n.id === id ? rollback : n))
          );
        }
        toast.error(res.message);
        return;
      }

      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id
            ? { ...n, isRead: res.data.isRead, readAt: res.data.readAt }
            : n
        )
      );
    } finally {
      pendingIdsRef.current.delete(id);
    }
  }, []);

  const markAllAsRead = React.useCallback(async () => {
    if (markAllLockRef.current) return;
    markAllLockRef.current = true;
    setBusyAll(true);

    const nowIso = new Date().toISOString();
    let snapshot: NotificationItem[] = [];

    setNotifications((prev) => {
      snapshot = prev;
      return prev.map((n) =>
        n.isRead ? n : { ...n, isRead: true, readAt: nowIso }
      );
    });

    try {
      const res = await markAllNotificationsReadAction();
      if (!res.ok) {
        setNotifications(snapshot);
        toast.error(res.message);
        return;
      }

      if (res.data.updatedCount > 0) {
        toast.success(
          res.data.updatedCount === 1
            ? "1 notificación marcada como leída."
            : `${res.data.updatedCount} notificaciones marcadas como leídas.`
        );
      }
    } finally {
      markAllLockRef.current = false;
      setBusyAll(false);
    }
  }, []);

  const unreadCount = loadedOnce
    ? notifications.filter((n) => !n.isRead).length
    : initialUnreadCount;

  const value = React.useMemo<NotificationsContextValue>(
    () => ({
      notifications,
      unreadCount,
      loading,
      realtimeConnected,
      busyAll,
      markAsRead,
      markAllAsRead,
      refresh: fetchNotifications,
      hydrateFromServer,
    }),
    [
      busyAll,
      fetchNotifications,
      hydrateFromServer,
      loading,
      markAllAsRead,
      markAsRead,
      notifications,
      realtimeConnected,
      unreadCount,
    ]
  );

  return (
    <NotificationsContext value={value}>{children}</NotificationsContext>
  );
}

export function useNotifications(): NotificationsContextValue {
  const ctx = React.use(NotificationsContext);
  if (!ctx) {
    throw new Error(
      "useNotifications debe usarse dentro de NotificationsProvider."
    );
  }
  return ctx;
}

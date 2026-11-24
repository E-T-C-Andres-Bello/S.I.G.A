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

const POLL_INTERVAL_MS = 30_000;

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
  const seenIdsRef = React.useRef<Set<string>>(new Set());
  const initializedRef = React.useRef(false);

  const fetchNotifications = React.useCallback(async () => {
    if (!internalUserId) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/notificaciones/feed", {
        cache: "no-store",
      });
      if (!res.ok) {
        setRealtimeConnected(false);
        return;
      }

      const payload = (await res.json()) as {
        ok?: boolean;
        items?: Array<{
          id: string;
          category: string;
          title: string;
          body: string;
          actionUrl: string | null;
          isRead: boolean;
          readAt: string | null;
          createdAt: string;
        }>;
      };

      if (payload.ok && Array.isArray(payload.items)) {
        const mapped: NotificationItem[] = payload.items.map((row) => ({
          id: row.id,
          category: normalizeNotificationCategory(row.category),
          title: row.title,
          body: row.body,
          actionUrl: sanitizeNotificationActionUrl(row.actionUrl),
          isRead: Boolean(row.isRead),
          readAt: row.readAt,
          createdAt: row.createdAt,
        }));

        if (initializedRef.current) {
          for (const item of mapped) {
            if (!seenIdsRef.current.has(item.id) && !item.isRead) {
              toast.info(item.title, { description: item.body });
            }
          }
        }
        seenIdsRef.current = new Set(mapped.map((m) => m.id));
        initializedRef.current = true;

        setNotifications(mapped);
        setLoadedOnce(true);
        setRealtimeConnected(true);
      }
    } catch {
      setRealtimeConnected(false);
    } finally {
      setLoading(false);
    }
  }, [internalUserId]);

  React.useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  // Actualización periódica ligera cuando la pestaña está visible y al recuperar foco
  React.useEffect(() => {
    if (!internalUserId) return;

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void fetchNotifications();
      }
    }, POLL_INTERVAL_MS);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void fetchNotifications();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [internalUserId, fetchNotifications]);

  const hydrateFromServer = React.useCallback((items: NotificationItem[]) => {
    for (const it of items) seenIdsRef.current.add(it.id);
    initializedRef.current = true;

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

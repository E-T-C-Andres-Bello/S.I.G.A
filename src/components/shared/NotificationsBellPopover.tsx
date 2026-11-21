"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Popover } from "radix-ui";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  BookOpen,
  Briefcase,
  CheckCheck,
  FileText,
  GraduationCap,
  HeartHandshake,
  Library,
  Loader2,
  UserX,
  type LucideIcon,
} from "lucide-react";
import { cn } from "cn";
import {
  formatRelativeNotificationTime,
  NOTIFICATION_CATEGORY_META,
  type NotificationCategory,
  type NotificationItem,
} from "@/features/notificaciones/notification-meta";
import { useNotifications } from "./NotificationsProvider";

export const NOTIFICATION_CATEGORY_ICONS: Record<
  NotificationCategory,
  LucideIcon
> = {
  academic_grade: GraduationCap,
  lms_task: BookOpen,
  request_status: FileText,
  library_due: Library,
  pasantias: Briefcase,
  teacher_absence: UserX,
  sla_alert: AlertTriangle,
  early_risk: HeartHandshake,
};

export interface NotificationsBellPopoverProps {
  /** Disparador personalizado (si se omite, renderiza la píldora «Avisos» del encabezado). */
  trigger?: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  sideOffset?: number;
  onNavigate?: () => void;
}

/**
 * Campana interactiva en tiempo real compartida entre la barra superior y el sidebar.
 */
export function NotificationsBellPopover({
  trigger,
  side = "bottom",
  align = "end",
  sideOffset = 8,
  onNavigate,
}: NotificationsBellPopoverProps) {
  const router = useRouter();
  const {
    notifications,
    unreadCount,
    loading,
    busyAll,
    markAsRead,
    markAllAsRead,
  } = useNotifications();

  const [open, setOpen] = React.useState(false);
  const [filterMode, setFilterMode] = React.useState<"all" | "unread">("all");

  const visibleItems = React.useMemo(() => {
    const base =
      filterMode === "unread"
        ? notifications.filter((n) => !n.isRead)
        : notifications;
    return base.slice(0, 6);
  }, [filterMode, notifications]);

  const handleOpenItem = async (item: NotificationItem) => {
    if (!item.isRead) {
      void markAsRead(item.id, true);
    }
    setOpen(false);
    onNavigate?.();
    if (item.actionUrl) {
      router.push(item.actionUrl);
    } else {
      router.push("/notificaciones");
    }
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        {trigger ?? (
          <button
            type="button"
            aria-label={`Notificaciones (${unreadCount} sin leer)`}
            className="siga-glass-pill relative inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border px-3 text-xs font-medium text-foreground transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none"
          >
            <Bell className="size-3.5 text-primary" aria-hidden="true" />
            <span className="hidden md:inline">Avisos</span>
            {unreadCount > 0 ? (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold tabular-nums text-primary-foreground">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            ) : null}
          </button>
        )}
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          side={side}
          align={align}
          sideOffset={sideOffset}
          className="siga-glass-surface font-hero z-50 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border text-xs text-foreground shadow-2xl outline-none"
        >
          {/* Cabecera */}
          <div className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold text-foreground">
                Notificaciones
              </p>
              {unreadCount > 0 ? (
                <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary tabular-nums">
                  {unreadCount} sin leer
                </span>
              ) : null}
            </div>

            {unreadCount > 0 ? (
              <button
                type="button"
                disabled={busyAll}
                onClick={() => void markAllAsRead()}
                className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
              >
                {busyAll ? (
                  <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                ) : (
                  <CheckCheck className="size-3.5" aria-hidden="true" />
                )}
                <span>Leer todo</span>
              </button>
            ) : null}
          </div>

          {/* Filtro rápido */}
          <div className="flex items-center gap-1 border-b border-border/50 px-3 py-2">
            {(
              [
                { id: "all", label: "Todas" },
                { id: "unread", label: `Sin leer (${unreadCount})` },
              ] as const
            ).map((tab) => {
              const active = filterMode === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFilterMode(tab.id)}
                  className={cn(
                    "cursor-pointer rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors",
                    active
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Lista de avisos */}
          <div className="max-h-80 overflow-y-auto p-2">
            {loading && notifications.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                <span>Cargando avisos…</span>
              </div>
            ) : visibleItems.length === 0 ? (
              <div className="px-3 py-8 text-center">
                <Bell
                  className="mx-auto size-6 text-muted-foreground/50"
                  aria-hidden="true"
                />
                <p className="mt-2 font-medium text-foreground">
                  {filterMode === "unread"
                    ? "Estás al día"
                    : "Sin notificaciones recientes"}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {filterMode === "unread"
                    ? "No tienes avisos pendientes por leer."
                    : "Aquí aparecerán tus avisos de notas, tareas y trámites."}
                </p>
              </div>
            ) : (
              <ul className="space-y-1">
                {visibleItems.map((item) => {
                  const meta = NOTIFICATION_CATEGORY_META[item.category];
                  const Icon = NOTIFICATION_CATEGORY_ICONS[item.category];
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => void handleOpenItem(item)}
                        className={cn(
                          "group flex w-full cursor-pointer items-start gap-2.5 rounded-xl p-2.5 text-left transition-colors hover:bg-primary/8 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none",
                          !item.isRead && "bg-primary/[0.06]"
                        )}
                      >
                        <span
                          className={cn(
                            "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl",
                            meta.iconBgTone
                          )}
                        >
                          <Icon className="size-4" aria-hidden="true" />
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p
                              className={cn(
                                "line-clamp-1 text-xs leading-snug",
                                item.isRead
                                  ? "font-medium text-foreground/85"
                                  : "font-semibold text-foreground"
                              )}
                            >
                              {item.title}
                            </p>
                            {!item.isRead ? (
                              <span
                                aria-label="Sin leer"
                                className="mt-1 size-2 shrink-0 rounded-full bg-primary"
                              />
                            ) : null}
                          </div>

                          <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                            {item.body}
                          </p>

                          <div className="mt-1.5 flex items-center justify-between gap-2 text-[10.5px] text-muted-foreground">
                            <span>{meta.label}</span>
                            <span className="tabular-nums">
                              {formatRelativeNotificationTime(item.createdAt)}
                            </span>
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Pie de enlace a la bandeja completa */}
          <div className="border-t border-border/60 p-2">
            <Link
              href="/notificaciones"
              prefetch={true}
              onClick={() => {
                setOpen(false);
                onNavigate?.();
              }}
              className="siga-glass-inner flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border text-xs font-medium text-foreground transition-colors hover:border-primary/45 hover:text-primary"
            >
              <span>Ver bandeja completa</span>
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

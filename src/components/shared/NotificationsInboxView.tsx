"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Bell,
  Check,
  CheckCheck,
  Circle,
  Loader2,
  Mail,
  RefreshCw,
  Search,
  Sparkles,
} from "lucide-react";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
  formatFullNotificationDate,
  formatRelativeNotificationTime,
  NOTIFICATION_CATEGORY_META,
  resolveNotificationDateBucket,
  type NotificationCategory,
  type NotificationDateBucket,
  type NotificationItem,
} from "@/features/notificaciones/notification-meta";
import type { NotificationsInboxData } from "@/features/notificaciones/notifications-data";
import { NOTIFICATION_CATEGORY_ICONS } from "./NotificationsBellPopover";
import { useNotifications } from "./NotificationsProvider";

export interface NotificationsInboxViewProps {
  initialData: NotificationsInboxData;
}

const DATE_BUCKET_ORDER: readonly NotificationDateBucket[] = [
  "Hoy",
  "Ayer",
  "Esta semana",
  "Anteriores",
];

/**
 * Bandeja completa de Notificaciones Internas (`/notificaciones`)
 * conectada en tiempo real al contexto compartido del portal.
 */
export function NotificationsInboxView({
  initialData,
}: NotificationsInboxViewProps) {
  const router = useRouter();
  const {
    notifications,
    unreadCount,
    realtimeConnected,
    busyAll,
    markAsRead,
    markAllAsRead,
    refresh,
    hydrateFromServer,
  } = useNotifications();

  const [statusFilter, setStatusFilter] = React.useState<
    "all" | "unread" | "read"
  >("all");
  const [categoryFilter, setCategoryFilter] = React.useState<
    "all" | NotificationCategory
  >("all");
  const [searchTerm, setSearchTerm] = React.useState("");
  const [refreshing, setRefreshing] = React.useState(false);

  React.useEffect(() => {
    hydrateFromServer(initialData.notifications);
  }, [hydrateFromServer, initialData.notifications]);

  const effectiveList =
    notifications.length > 0 ? notifications : initialData.notifications;

  const categoryCounts = React.useMemo(() => {
    const map = new Map<NotificationCategory, number>();
    for (const item of effectiveList) {
      map.set(item.category, (map.get(item.category) ?? 0) + 1);
    }
    return map;
  }, [effectiveList]);

  const availableCategories = React.useMemo(
    () =>
      Array.from(categoryCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([cat]) => cat),
    [categoryCounts]
  );

  const filteredNotifications = React.useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return effectiveList.filter((item) => {
      if (statusFilter === "unread" && item.isRead) return false;
      if (statusFilter === "read" && !item.isRead) return false;
      if (categoryFilter !== "all" && item.category !== categoryFilter) {
        return false;
      }
      if (!q) return true;
      const catLabel = NOTIFICATION_CATEGORY_META[item.category].label.toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        item.body.toLowerCase().includes(q) ||
        catLabel.includes(q)
      );
    });
  }, [categoryFilter, effectiveList, searchTerm, statusFilter]);

  const groupedByDate = React.useMemo(() => {
    const groups = new Map<NotificationDateBucket, NotificationItem[]>();
    const nowMs = Date.now();
    for (const item of filteredNotifications) {
      const bucket = resolveNotificationDateBucket(item.createdAt, nowMs);
      const list = groups.get(bucket) ?? [];
      list.push(item);
      groups.set(bucket, list);
    }
    return DATE_BUCKET_ORDER.map((bucket) => ({
      bucket,
      items: groups.get(bucket) ?? [],
    })).filter((g) => g.items.length > 0);
  }, [filteredNotifications]);

  const readCount = Math.max(0, effectiveList.length - unreadCount);

  const handleManualRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

  const handleOpenAction = (item: NotificationItem) => {
    if (!item.isRead) {
      void markAsRead(item.id, true);
    }
    if (item.actionUrl) {
      router.push(item.actionUrl);
    }
  };

  return (
    <div className="font-hero flex flex-col gap-5 pb-8">
      {/* Cabecera */}
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-[1.75rem] leading-tight font-normal tracking-[-0.03em] text-foreground sm:text-[2.1rem]">
            Bandeja de Notificaciones
          </h1>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-[13px]">
            Avisos en tiempo real de calificaciones, Aula Virtual, trámites
            escolares, Biblioteca y pasantías.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={refreshing}
            onClick={() => void handleManualRefresh()}
            className="siga-glass-inner rounded-xl text-xs"
          >
            <RefreshCw
              className={cn(refreshing && "animate-spin")}
              data-icon="inline-start"
              aria-hidden="true"
            />
            Actualizar
          </Button>

          <Button
            type="button"
            size="sm"
            disabled={busyAll || unreadCount === 0}
            onClick={() => void markAllAsRead()}
            className="rounded-xl text-xs"
          >
            {busyAll ? (
              <Loader2 className="animate-spin" data-icon="inline-start" />
            ) : (
              <CheckCheck data-icon="inline-start" aria-hidden="true" />
            )}
            Marcar todas como leídas
          </Button>
        </div>
      </header>

      {/* Resumen KPI */}
      <section
        aria-label="Resumen de notificaciones"
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        <div className="siga-glass-surface rounded-2xl border p-4">
          <span className="text-[11px] font-medium text-muted-foreground">
            Sin leer
          </span>
          <p className="font-kpi-num mt-1 text-2xl font-light text-primary tabular-nums">
            {unreadCount}
          </p>
        </div>

        <div className="siga-glass-surface rounded-2xl border p-4">
          <span className="text-[11px] font-medium text-muted-foreground">
            Total recibidas
          </span>
          <p className="font-kpi-num mt-1 text-2xl font-light text-foreground tabular-nums">
            {effectiveList.length}
          </p>
        </div>

        <div className="siga-glass-surface rounded-2xl border p-4">
          <span className="text-[11px] font-medium text-muted-foreground">
            Leídas
          </span>
          <p className="font-kpi-num mt-1 text-2xl font-light text-foreground tabular-nums">
            {readCount}
          </p>
        </div>

        <div className="siga-glass-surface flex flex-col justify-between rounded-2xl border p-4">
          <span className="text-[11px] font-medium text-muted-foreground">
            Canal en vivo y correo
          </span>
          <div className="mt-1.5 flex items-center gap-2 text-xs font-semibold text-foreground">
            <span
              aria-hidden="true"
              className={cn(
                "size-2 rounded-full",
                realtimeConnected
                  ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.75)]"
                  : "bg-amber-400"
              )}
            />
            <span>
              {realtimeConnected ? "Conectado en vivo" : "Sincronizando…"}
            </span>
          </div>
          {initialData.userEmail || initialData.recoveryEmail ? (
            <p className="mt-1 flex items-center gap-1 truncate text-[10.5px] text-muted-foreground">
              <Mail className="size-3 shrink-0" aria-hidden="true" />
              <span className="truncate">
                {initialData.userEmail ?? initialData.recoveryEmail}
              </span>
            </p>
          ) : null}
        </div>
      </section>

      {/* Barra de búsqueda y filtros */}
      <section
        aria-label="Filtros de notificaciones"
        className="siga-glass-surface space-y-3 rounded-[24px] border p-4"
      >
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div
            role="group"
            aria-label="Filtrar por estado de lectura"
            className="flex flex-wrap items-center gap-1.5"
          >
            {(
              [
                { id: "all", label: `Todas (${effectiveList.length})` },
                { id: "unread", label: `Sin leer (${unreadCount})` },
                { id: "read", label: `Leídas (${readCount})` },
              ] as const
            ).map((tab) => {
              const active = statusFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setStatusFilter(tab.id)}
                  className={cn(
                    "cursor-pointer rounded-xl px-3 py-1.5 text-xs font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "siga-glass-inner border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="relative w-full md:w-72">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar avisos…"
              aria-label="Buscar notificaciones"
              className="siga-glass-inner h-9 rounded-xl pl-8 text-xs"
            />
          </div>
        </div>

        {availableCategories.length > 1 ? (
          <div
            role="group"
            aria-label="Filtrar por categoría"
            className="flex flex-wrap items-center gap-1.5 border-t border-border/50 pt-3"
          >
            <button
              type="button"
              aria-pressed={categoryFilter === "all"}
              onClick={() => setCategoryFilter("all")}
              className={cn(
                "cursor-pointer rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors",
                categoryFilter === "all"
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Todas las áreas
            </button>
            {availableCategories.map((cat) => {
              const meta = NOTIFICATION_CATEGORY_META[cat];
              const active = categoryFilter === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setCategoryFilter(cat)}
                  className={cn(
                    "cursor-pointer rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors",
                    active
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {meta.label} ({categoryCounts.get(cat) ?? 0})
                </button>
              );
            })}
          </div>
        ) : null}
      </section>

      {/* Listado agrupado por fecha */}
      {groupedByDate.length === 0 ? (
        <Empty className="siga-glass-surface rounded-[28px] border border-dashed py-12">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              {statusFilter === "unread" ? (
                <Sparkles aria-hidden="true" />
              ) : (
                <Bell aria-hidden="true" />
              )}
            </EmptyMedia>
            <EmptyTitle>
              {statusFilter === "unread"
                ? "No tienes notificaciones sin leer"
                : searchTerm.trim()
                  ? "Sin coincidencias para tu búsqueda"
                  : "Tu bandeja está vacía"}
            </EmptyTitle>
            <EmptyDescription>
              {statusFilter === "unread"
                ? "Todos tus avisos escolares están al día. Cuando se publique una nota, guía o trámite aparecerá aquí al instante."
                : searchTerm.trim()
                  ? "Prueba con otra palabra clave o limpia los filtros activos."
                  : "Aquí recibirás avisos de calificaciones, Aula Virtual, Biblioteca, pasantías y trámites de Secretaría."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-5">
          {groupedByDate.map(({ bucket, items }) => (
            <section
              key={bucket}
              aria-label={`Notificaciones de ${bucket}`}
              className="space-y-2.5"
            >
              <div className="flex items-center justify-between px-1">
                <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {bucket}
                </h2>
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {items.length} {items.length === 1 ? "aviso" : "avisos"}
                </span>
              </div>

              <ul className="space-y-2.5">
                {items.map((item) => {
                  const meta = NOTIFICATION_CATEGORY_META[item.category];
                  const Icon = NOTIFICATION_CATEGORY_ICONS[item.category];

                  return (
                    <li
                      key={item.id}
                      className={cn(
                        "siga-glass-surface group rounded-2xl border p-4 transition-all",
                        !item.isRead &&
                          "border-primary/40 ring-1 ring-primary/20"
                      )}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                          <span
                            className={cn(
                              "mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-2xl",
                              meta.iconBgTone
                            )}
                          >
                            <Icon className="size-4.5" aria-hidden="true" />
                          </span>

                          <div className="min-w-0 flex-1 space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge
                                variant="outline"
                                className={cn("text-[10.5px]", meta.badgeTone)}
                              >
                                {meta.label}
                              </Badge>
                              {!item.isRead ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-primary/14 px-2 py-0.5 text-[10px] font-semibold text-primary">
                                  <span
                                    aria-hidden="true"
                                    className="size-1.5 rounded-full bg-primary"
                                  />
                                  Nuevo
                                </span>
                              ) : null}
                              <span
                                title={formatFullNotificationDate(
                                  item.createdAt
                                )}
                                className="text-[11px] text-muted-foreground tabular-nums"
                              >
                                {formatRelativeNotificationTime(item.createdAt)}
                              </span>
                            </div>

                            <h3
                              className={cn(
                                "text-sm leading-snug",
                                item.isRead
                                  ? "font-medium text-foreground/90"
                                  : "font-semibold text-foreground"
                              )}
                            >
                              {item.title}
                            </h3>

                            <p className="text-xs leading-relaxed text-muted-foreground">
                              {item.body}
                            </p>
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-end">
                          {item.actionUrl ? (
                            <Button
                              type="button"
                              size="sm"
                              variant={item.isRead ? "outline" : "default"}
                              onClick={() => handleOpenAction(item)}
                              className="rounded-xl text-xs"
                            >
                              <span>Abrir</span>
                              <ArrowUpRight
                                data-icon="inline-end"
                                aria-hidden="true"
                              />
                            </Button>
                          ) : null}

                          <button
                            type="button"
                            onClick={() => void markAsRead(item.id, !item.isRead)}
                            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
                          >
                            {item.isRead ? (
                              <>
                                <Circle className="size-3" aria-hidden="true" />
                                <span>Marcar sin leer</span>
                              </>
                            ) : (
                              <>
                                <Check className="size-3.5" aria-hidden="true" />
                                <span>Marcar leída</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {/* Aviso de respaldo por correo */}
      <div className="siga-glass-inner flex flex-col justify-between gap-2 rounded-2xl border px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center">
        <span>
          Los avisos importantes de trámites y cuenta también se respaldan por
          correo electrónico institucional.
        </span>
        <Link
          href="/estudiante/perfil?seccion=contacto"
          className="shrink-0 font-medium text-primary hover:underline"
        >
          Revisar correo de respaldo
        </Link>
      </div>
    </div>
  );
}

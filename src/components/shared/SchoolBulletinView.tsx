"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  Building2,
  CalendarDays,
  Check,
  CheckCheck,
  Inbox,
  MapPin,
  Megaphone,
  Pencil,
  Pin,
  Search,
  SquarePen,
  Users,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { BellistaBulletinCardFan } from "@/components/cartelera/BellistaBulletinCardFan";
import { BulletinDetailDialog } from "@/components/cartelera/BulletinDetailDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  archiveSchoolAnnouncementAction,
  confirmAnnouncementReadAction,
} from "@/features/cartelera/announcements-actions";
import type { SchoolBulletinData } from "@/features/cartelera/announcements-data";
import { searchBulletinAnnouncements } from "@/features/cartelera/search-adapter";
import type { DashboardUserProfile } from "@/lib/auth/dashboard-session";
import {
  loadCachedBulletinItems,
  saveCachedBulletinItems,
} from "@/lib/offline/bulletin-cache";
import {
  enqueueOfflineMutation,
  flushPendingOfflineMutations,
} from "@/lib/offline/mutation-queue";
import {
  ANNOUNCEMENT_CATEGORIES,
  ANNOUNCEMENT_CATEGORY_META,
  formatAnnouncementAudience,
  formatAnnouncementCountdown,
  hexToRgba,
  stripRichFormatting,
  type AnnouncementCategory,
  type SchoolAnnouncementItem,
} from "@/lib/validators/bulletin";

export type BulletinSectionTab = "por_leer" | "leidos";

export interface SchoolBulletinViewProps {
  profile: DashboardUserProfile;
  initialData: SchoolBulletinData;
  initialSection?: BulletinSectionTab;
}

function formatShortDate(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  return new Intl.DateTimeFormat("es-VE", {
    timeZone: "America/Caracas",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(ms));
}

export function SchoolBulletinView({
  profile,
  initialData,
  initialSection = "por_leer",
}: SchoolBulletinViewProps) {
  const router = useRouter();
  const publishedInitial = React.useMemo(
    () => initialData.items.filter((it) => it.isPublished),
    [initialData.items]
  );
  const [items, setItems] =
    React.useState<SchoolAnnouncementItem[]>(publishedInitial);
  const [activeSection, setActiveSection] =
    React.useState<BulletinSectionTab>(initialSection);
  const [searchText, setSearchText] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState<
    AnnouncementCategory | "all"
  >("all");
  const [isOffline, setIsOffline] = React.useState(false);
  const [usingOfflineCache, setUsingOfflineCache] = React.useState(false);

  const [detailItem, setDetailItem] =
    React.useState<SchoolAnnouncementItem | null>(null);
  const [archivingId, setArchivingId] = React.useState<string | null>(null);
  const confirmingIdsRef = React.useRef<Set<string>>(new Set());

  React.useEffect(() => {
    setItems(publishedInitial);
  }, [publishedInitial]);

  React.useEffect(() => {
    setActiveSection(initialSection);
  }, [initialSection]);

  const handleSectionChange = React.useCallback((nextValue: string) => {
    const nextSection: BulletinSectionTab =
      nextValue === "leidos" ? "leidos" : "por_leer";
    setActiveSection(nextSection);
    try {
      const nextUrl = new URL(window.location.href);
      if (nextSection === "leidos") {
        nextUrl.searchParams.set("tab", "leidos");
      } else {
        nextUrl.searchParams.delete("tab");
      }
      window.history.replaceState(null, "", nextUrl.toString());
    } catch {
      // Ignorar si history API está restringida
    }
  }, []);

  // Caché Offline-First de los últimos 20 anuncios + sincronización al reconectar
  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => {
      setIsOffline(false);
      void flushPendingOfflineMutations().then(({ syncedCount }) => {
        if (syncedCount > 0) {
          toast.success(
            `Se sincronizaron ${syncedCount} confirmaciones pendientes.`
          );
          router.refresh();
        }
      });
    };
    const handleOffline = () => setIsOffline(true);

    setIsOffline(!window.navigator.onLine);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    if (initialData.items.length > 0) {
      void saveCachedBulletinItems(profile.internalUserId, initialData.items);
      setUsingOfflineCache(false);
    } else if (!window.navigator.onLine) {
      void loadCachedBulletinItems(profile.internalUserId).then((snapshot) => {
        if (snapshot && snapshot.items.length > 0) {
          setItems(snapshot.items);
          setUsingOfflineCache(true);
        }
      });
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [initialData.items, profile.internalUserId, router]);

  const canEditAnnouncement = React.useCallback(
    (item: SchoolAnnouncementItem): boolean => Boolean(item.canEdit),
    []
  );

  const unreadItems = React.useMemo(
    () => items.filter((it) => !it.hasRead),
    [items]
  );

  const readItems = React.useMemo(
    () =>
      items
        .filter((it) => it.hasRead)
        .sort((a, b) => {
          const aMs = Date.parse(a.readAt ?? a.publishedAt);
          const bMs = Date.parse(b.readAt ?? b.publishedAt);
          return (Number.isFinite(bMs) ? bMs : 0) - (Number.isFinite(aMs) ? aMs : 0);
        }),
    [items]
  );

  const sectionItems = activeSection === "leidos" ? readItems : unreadItems;

  const filteredItems = React.useMemo(
    () =>
      searchBulletinAnnouncements(sectionItems, {
        text: searchText,
        category: categoryFilter,
        onlyUnread: false,
      }),
    [sectionItems, searchText, categoryFilter]
  );

  const handleReadConfirmed = React.useCallback(
    (announcementId: string, nextCount: number, readAt: string) => {
      setItems((prev) => {
        const updated = prev.map((it) =>
          it.id === announcementId
            ? { ...it, hasRead: true, readCount: nextCount, readAt }
            : it
        );
        void saveCachedBulletinItems(profile.internalUserId, updated);
        return updated;
      });
      setDetailItem((prev) =>
        prev && prev.id === announcementId
          ? { ...prev, hasRead: true, readCount: nextCount, readAt }
          : prev
      );
    },
    [profile.internalUserId]
  );

  const handleConfirmFromCard = React.useCallback(
    async (
      target: SchoolAnnouncementItem,
      options?: { silent?: boolean }
    ) => {
      const silent = Boolean(options?.silent);
      if (target.hasRead) {
        if (!silent) {
          toast.info("Este comunicado ya está guardado en tu sección de Leídos.");
        }
        return;
      }

      if (confirmingIdsRef.current.has(target.id)) return;
      confirmingIdsRef.current.add(target.id);

      const optimisticReadAt = new Date().toISOString();
      handleReadConfirmed(target.id, target.readCount + 1, optimisticReadAt);

      try {
        if (typeof window !== "undefined" && !window.navigator.onLine) {
          await enqueueOfflineMutation({
            dedupKey: `announcement_read:${target.id}`,
            kind: "announcement_read",
            payload: { announcementId: target.id },
          });
          toast.success(
            "Marcado como leído sin conexión. Se sincronizará al recuperar internet."
          );
          return;
        }

        const res = await confirmAnnouncementReadAction(target.id);
        if (!res.ok) {
          await enqueueOfflineMutation({
            dedupKey: `announcement_read:${target.id}`,
            kind: "announcement_read",
            payload: { announcementId: target.id },
          }).catch(() => {});
          if (!silent) {
            toast.info(
              "Lectura guardada localmente para reintento automático."
            );
          }
          return;
        }

        handleReadConfirmed(target.id, res.data.readCount, res.data.readAt);
        if (!silent) {
          toast.success("Marcado como leído y movido a tu sección de Leídos.");
        }
      } finally {
        confirmingIdsRef.current.delete(target.id);
      }
    },
    [handleReadConfirmed]
  );

  const openDetailAndMarkRead = React.useCallback(
    (target: SchoolAnnouncementItem) => {
      const optimisticReadAt = target.readAt ?? new Date().toISOString();
      setDetailItem(
        target.hasRead
          ? target
          : {
              ...target,
              hasRead: true,
              readCount: target.readCount + 1,
              readAt: optimisticReadAt,
            }
      );
      if (!target.hasRead) {
        void handleConfirmFromCard(target, { silent: true });
      }
    },
    [handleConfirmFromCard]
  );

  const handleArchive = async (item: SchoolAnnouncementItem) => {
    if (archivingId) return;
    setArchivingId(item.id);
    try {
      const res = await archiveSchoolAnnouncementAction(item.id);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      setItems((prev) => prev.filter((it) => it.id !== item.id));
      toast.success("Comunicado archivado.");
      router.refresh();
    } finally {
      setArchivingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-8">
      {/* Cabecera institucional */}
      <header className="siga-glass-surface flex flex-col justify-between gap-4 rounded-[28px] border p-5 sm:flex-row sm:items-center sm:p-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="siga-glass-inner inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold text-primary dark:text-[#7dd3fc]">
              <Megaphone className="size-3.5" aria-hidden="true" />
              Canal Oficial E.T.C. &ldquo;Andrés Bello&rdquo;
            </span>
            {unreadItems.length > 0 ? (
              <Badge variant="secondary" className="rounded-full text-[11px]">
                {unreadItems.length} por leer
              </Badge>
            ) : readItems.length > 0 ? (
              <Badge
                variant="outline"
                className="gap-1 rounded-full border-emerald-500/35 bg-emerald-500/12 text-[11px] text-emerald-700 dark:text-emerald-300"
              >
                <CheckCheck className="size-3" aria-hidden="true" />
                Todo al día
              </Badge>
            ) : null}
            {isOffline || usingOfflineCache ? (
              <Badge
                variant="outline"
                className="gap-1 rounded-full border-amber-500/40 bg-amber-500/12 text-[11px] text-amber-700 dark:text-amber-300"
              >
                <WifiOff className="size-3" aria-hidden="true" />
                Modo sin conexión
              </Badge>
            ) : null}
          </div>

          <h1 className="mt-2.5 text-2xl font-semibold tracking-[-0.02em] text-foreground sm:text-3xl">
            La Cartelera Bellista
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Al abrir un comunicado se marca automáticamente como leído y se
            guarda en tu sección de Leídos para mantener tu tablero despejado.
          </p>
        </div>

        {initialData.canPublish ? (
          <Button className="shrink-0 rounded-full px-5" asChild>
            <Link href="/cartelera/gestion">
              <SquarePen className="mr-1.5 size-4" aria-hidden="true" />
              <span>Gestionar Cartelera</span>
            </Link>
          </Button>
        ) : null}
      </header>

      {/* Selector de sección: Por leer vs Leídos */}
      <Tabs
        value={activeSection}
        onValueChange={handleSectionChange}
        className="w-full"
      >
        <TabsList className="siga-glass-surface h-auto w-fit gap-1 rounded-2xl border p-1.5">
          <TabsTrigger
            value="por_leer"
            className="cursor-pointer rounded-xl px-4 py-2 text-xs font-medium"
          >
            <Inbox className="mr-1.5 size-3.5" aria-hidden="true" />
            <span>Por leer ({unreadItems.length})</span>
          </TabsTrigger>
          <TabsTrigger
            value="leidos"
            className="cursor-pointer rounded-xl px-4 py-2 text-xs font-medium"
          >
            <CheckCheck className="mr-1.5 size-3.5" aria-hidden="true" />
            <span>Leídos ({readItems.length})</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Abanico interactivo solo en la pestaña Por leer (oculta los ya leídos) */}
      {activeSection === "por_leer" && items.length > 0 ? (
        <BellistaBulletinCardFan
          items={items}
          variant="full"
          hideRead
          onOpenReadArchive={() => handleSectionChange("leidos")}
          canEditItem={canEditAnnouncement}
          onEditItem={(item) => {
            router.push(`/cartelera/gestion?edit=${item.id}`);
          }}
          onItemReadConfirmed={handleReadConfirmed}
        />
      ) : null}

      {/* Barra de búsqueda (adaptador listo para Algolia) y filtros */}
      <section
        aria-label="Filtros y buscador de comunicados"
        className="siga-glass-surface flex flex-col gap-3.5 rounded-[24px] border p-4 sm:p-5"
      >
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder={
              activeSection === "leidos"
                ? "Buscar en tus comunicados leídos..."
                : "Buscar avisos pendientes, eventos, fechas o lugares..."
            }
            aria-label="Buscar en La Cartelera Bellista"
            className="h-10 rounded-full pl-10"
          />
        </div>

        <div
          role="group"
          aria-label="Filtrar por categoría"
          className="flex flex-wrap items-center gap-2"
        >
          <button
            type="button"
            onClick={() => setCategoryFilter("all")}
            aria-pressed={categoryFilter === "all"}
            className={cn(
              "cursor-pointer rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
              categoryFilter === "all"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border/70 bg-background/60 text-muted-foreground hover:text-foreground"
            )}
          >
            Todos ({sectionItems.length})
          </button>

          {ANNOUNCEMENT_CATEGORIES.map((cat) => {
            const meta = ANNOUNCEMENT_CATEGORY_META[cat];
            const count = sectionItems.filter((it) => it.category === cat).length;
            const active = categoryFilter === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                aria-pressed={active}
                className={cn(
                  "cursor-pointer rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border/70 bg-background/60 text-muted-foreground hover:text-foreground"
                )}
              >
                {meta.shortLabel} ({count})
              </button>
            );
          })}
        </div>
      </section>

      {/* Feed de comunicados de la sección activa */}
      {filteredItems.length === 0 ? (
        <section className="siga-glass-surface flex flex-col items-center justify-center rounded-[28px] border border-dashed px-6 py-14 text-center">
          <span
            className={cn(
              "siga-glass-inner flex size-14 items-center justify-center rounded-2xl border",
              activeSection === "por_leer" && readItems.length > 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-primary dark:text-[#7dd3fc]"
            )}
          >
            {activeSection === "por_leer" && readItems.length > 0 ? (
              <CheckCheck className="size-6" aria-hidden="true" />
            ) : (
              <Megaphone className="size-6" aria-hidden="true" />
            )}
          </span>
          <h2 className="mt-4 text-base font-semibold text-foreground">
            {sectionItems.length === 0
              ? activeSection === "leidos"
                ? "Aún no tienes comunicados leídos"
                : readItems.length > 0
                  ? "¡No tienes comunicados pendientes por leer!"
                  : "Todavía no hay comunicados publicados"
              : "Ningún comunicado coincide con tu búsqueda"}
          </h2>
          <p className="mt-1.5 max-w-md text-xs leading-relaxed text-muted-foreground">
            {sectionItems.length === 0
              ? activeSection === "leidos"
                ? "Cada vez que abras una noticia desde el inicio o desde Por leer, se guardará automáticamente aquí para consulta futura."
                : readItems.length > 0
                  ? `Tus ${readItems.length} comunicados ya leídos se mantienen ordenados en la sección de Leídos.`
                  : "Cuando Dirección, Control de Estudios o Coordinación de Mención publiquen anuncios oficiales, aparecerán aquí y en el inicio."
              : "Prueba limpiar los filtros o buscar con otras palabras clave."}
          </p>
          {sectionItems.length > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-4 rounded-full"
              onClick={() => {
                setSearchText("");
                setCategoryFilter("all");
              }}
            >
              Limpiar filtros
            </Button>
          ) : activeSection === "por_leer" && readItems.length > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-4 rounded-full"
              onClick={() => handleSectionChange("leidos")}
            >
              <CheckCheck className="mr-1.5 size-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              Ir a Leídos ({readItems.length})
            </Button>
          ) : activeSection === "leidos" && unreadItems.length > 0 ? (
            <Button
              type="button"
              size="sm"
              className="mt-4 rounded-full"
              onClick={() => handleSectionChange("por_leer")}
            >
              <Inbox className="mr-1.5 size-4" aria-hidden="true" />
              Ver comunicados por leer ({unreadItems.length})
            </Button>
          ) : initialData.canPublish ? (
            <Button size="sm" className="mt-4 rounded-full" asChild>
              <Link href="/cartelera/gestion">
                <SquarePen className="mr-1.5 size-4" aria-hidden="true" />
                Redactar primer comunicado
              </Link>
            </Button>
          ) : null}
        </section>
      ) : (
        <section
          aria-label={
            activeSection === "leidos"
              ? "Comunicados leídos"
              : "Comunicados pendientes por leer"
          }
          className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3"
        >
          {filteredItems.map((item) => {
            const meta = ANNOUNCEMENT_CATEGORY_META[item.category];
            const countdown = formatAnnouncementCountdown(item.eventDate);
            const editable = canEditAnnouncement(item);

            return (
              <article
                key={item.id}
                className="siga-glass-surface group flex flex-col overflow-hidden rounded-[24px] border transition-transform duration-200 hover:-translate-y-0.5"
              >
                {/* Portada o cabecera cromática */}
                <button
                  type="button"
                  onClick={() => openDetailAndMarkRead(item)}
                  className="relative h-40 w-full cursor-pointer overflow-hidden text-left focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                  style={{
                    background: `linear-gradient(135deg, ${item.themePalette.primary}, ${item.themePalette.secondary})`,
                  }}
                >
                  {item.coverWebpUrl ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.coverWebpUrl}
                        alt={item.title}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-black/25"
                      />
                    </>
                  ) : (
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0"
                      style={{
                        background: `radial-gradient(circle at 80% 20%, ${hexToRgba(item.themePalette.glow, 0.55)}, transparent 55%)`,
                      }}
                    />
                  )}

                  <div className="absolute inset-x-3.5 top-3 flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full border border-white/30 bg-black/35 px-2.5 py-0.5 text-[10.5px] font-semibold text-white backdrop-blur-md">
                      {meta.shortLabel}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {countdown ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-black/40 px-2 py-0.5 text-[10.5px] font-semibold text-white backdrop-blur-md">
                          <CalendarDays className="size-3" aria-hidden="true" />
                          {countdown.label}
                        </span>
                      ) : null}
                      {item.isPinned ? (
                        <span
                          className="inline-flex size-6 items-center justify-center rounded-full border border-amber-200/45 bg-amber-400/30 text-amber-100 backdrop-blur-md"
                          title="Fijado"
                        >
                          <Pin className="size-3" aria-hidden="true" />
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="absolute inset-x-3.5 bottom-3">
                    <span
                      className="block truncate text-lg leading-none font-semibold text-white drop-shadow-xs"
                      style={{
                        fontFamily:
                          'var(--font-handwritten, "Caveat", cursive)',
                      }}
                    >
                      {item.shortNote}
                    </span>
                  </div>
                </button>

                {/* Cuerpo de tarjeta */}
                <div className="flex flex-1 flex-col justify-between gap-4 p-4 sm:p-5">
                  <div>
                    <button
                      type="button"
                      onClick={() => openDetailAndMarkRead(item)}
                      className="cursor-pointer text-left text-[15px] leading-snug font-semibold text-foreground transition-colors hover:text-primary focus-visible:underline focus-visible:outline-none"
                    >
                      {item.title}
                    </button>
                    <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                      {stripRichFormatting(item.body)}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1 font-medium text-foreground/75">
                        <Building2 className="size-3" aria-hidden="true" />
                        {item.authorDepartment}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Users className="size-3" aria-hidden="true" />
                        {formatAnnouncementAudience(
                          item.targetMencionName,
                          item.targetGradeYear
                        )}
                      </span>
                      {item.locationLabel ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="size-3" aria-hidden="true" />
                          {item.locationLabel}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-3">
                    <span className="text-[11px] text-muted-foreground">
                      {item.hasRead && item.readAt
                        ? `Leído el ${formatShortDate(item.readAt)}`
                        : formatShortDate(item.publishedAt)}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {editable ? (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 rounded-full"
                            aria-label={`Editar ${item.title}`}
                            asChild
                          >
                            <Link href={`/cartelera/gestion?edit=${item.id}`}>
                              <Pencil className="size-3.5" aria-hidden="true" />
                            </Link>
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8 rounded-full text-muted-foreground hover:text-destructive"
                            aria-label={`Archivar ${item.title}`}
                            disabled={archivingId === item.id}
                            onClick={() => handleArchive(item)}
                          >
                            <Archive className="size-3.5" aria-hidden="true" />
                          </Button>
                        </>
                      ) : null}

                      {item.hasRead ? (
                        <span
                          className="inline-flex h-8 items-center gap-1 rounded-full border px-3 text-xs font-medium"
                          style={{
                            background: hexToRgba(
                              item.themePalette.primary,
                              0.14
                            ),
                            color: item.themePalette.primary,
                            borderColor: hexToRgba(
                              item.themePalette.primary,
                              0.32
                            ),
                          }}
                        >
                          <CheckCheck className="size-3.5" aria-hidden="true" />
                          <span>Leído · {item.readCount}</span>
                        </span>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 rounded-full px-3 text-xs"
                          onClick={() => handleConfirmFromCard(item)}
                        >
                          <Check className="mr-1 size-3.5" aria-hidden="true" />
                          <span>Marcar leído</span>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}

      <BulletinDetailDialog
        item={detailItem}
        open={detailItem !== null}
        onOpenChange={(open) => {
          if (!open) setDetailItem(null);
        }}
        canEdit={Boolean(detailItem && canEditAnnouncement(detailItem))}
        onEdit={(it) => {
          setDetailItem(null);
          router.push(`/cartelera/gestion?edit=${it.id}`);
        }}
        onConfirmRead={(it) => handleConfirmFromCard(it)}
      />
    </div>
  );
}

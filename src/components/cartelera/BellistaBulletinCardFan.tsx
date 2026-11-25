"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Check,
  CheckCheck,
  Compass,
  Megaphone,
  Pin,
  Sparkles,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { confirmAnnouncementReadAction } from "@/features/cartelera/announcements-actions";
import { enqueueOfflineMutation } from "@/lib/offline/mutation-queue";
import {
  ANNOUNCEMENT_CATEGORY_META,
  formatAnnouncementAudience,
  formatAnnouncementCountdown,
  hexToRgba,
  stripRichFormatting,
  type AnnouncementCategory,
  type SchoolAnnouncementItem,
} from "@/lib/validators/bulletin";
import { BulletinDetailDialog } from "./BulletinDetailDialog";

export interface BellistaBulletinCardFanProps {
  items: SchoolAnnouncementItem[];
  variant?: "dashboard" | "full";
  autoplay?: boolean;
  interval?: number;
  /** Cuando está activo (por defecto), el abanico muestra únicamente comunicados sin leer. */
  hideRead?: boolean;
  /** Acción opcional en vista completa para abrir directamente la pestaña de Leídos. */
  onOpenReadArchive?: () => void;
  canEditItem?: (item: SchoolAnnouncementItem) => boolean;
  onEditItem?: (item: SchoolAnnouncementItem) => void;
  onItemReadConfirmed?: (
    announcementId: string,
    nextCount: number,
    readAt: string
  ) => void;
  className?: string;
}

const ARROWS = {
  down: "M10 6 C 2 22, 30 22, 26 10 C 22 0, 8 16, 22 34 C 28 42, 38 46, 46 48",
  side: "M6 8 C 18 2, 34 6, 30 18 C 26 28, 12 22, 20 14 C 30 6, 46 20, 52 46",
  up: "M24 50 C 30 40, 40 38, 36 30 C 32 24, 22 30, 28 22 C 34 12, 30 8, 26 4",
};

function tip(d: string): string {
  const n = d.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [0, 0, 0, 0];
  const x = n[n.length - 2] ?? 0;
  const y = n[n.length - 1] ?? 0;
  const cx = n[n.length - 4] ?? 0;
  const cy = n[n.length - 3] ?? 0;
  const angle = (Math.atan2(y - cy, x - cx) * 180) / Math.PI;
  return `translate(${x} ${y}) rotate(${angle + 45})`;
}

function CategoryGlyph({
  category,
  className,
}: {
  category: AnnouncementCategory;
  className?: string;
}) {
  switch (category) {
    case "urgente":
      return <AlertTriangle className={className} aria-hidden="true" />;
    case "academico":
      return <BookOpen className={className} aria-hidden="true" />;
    case "mencion":
      return <Compass className={className} aria-hidden="true" />;
    case "cultura_deporte":
      return <Trophy className={className} aria-hidden="true" />;
    default:
      return <Sparkles className={className} aria-hidden="true" />;
  }
}

function HandwrittenNote({
  text,
  place,
  drawKey,
  sc,
}: {
  text: string;
  place: number;
  drawKey: string;
  sc: string;
}) {
  const common =
    "pointer-events-none absolute z-10 flex select-none items-center whitespace-nowrap";
  const fontStyle: React.CSSProperties = {
    fontFamily: 'var(--font-handwritten, "Caveat", "Segoe Print", cursive)',
    color: "var(--ink)",
  };

  const renderArrow = (d: string, flip: boolean, rot: number, delay: number) => (
    <svg
      width="56"
      height="50"
      viewBox="0 0 64 56"
      className="shrink-0 overflow-visible"
      style={{ transform: `${flip ? "scaleX(-1) " : ""}rotate(${rot}deg)` }}
      aria-hidden="true"
    >
      <path
        key={drawKey}
        d={d}
        fill="none"
        stroke="var(--ink)"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        style={{
          strokeDasharray: 1,
          strokeDashoffset: 1,
          animation: `${sc}-draw .7s ${delay}s cubic-bezier(.6,.1,.3,1) forwards`,
        }}
      />
      <path
        key={`${drawKey}h`}
        d="M0 0 l-7 -4 M0 0 l-3 -7"
        transform={tip(d)}
        fill="none"
        stroke="var(--ink)"
        strokeWidth="1.75"
        strokeLinecap="round"
        style={{
          opacity: 0,
          animation: `${sc}-fade .2s ${delay + 0.62}s forwards`,
        }}
      />
    </svg>
  );

  const renderLabel = (delay: number) => (
    <span
      key={`${drawKey}t`}
      className="max-w-[200px] truncate text-[19px] leading-none font-semibold sm:max-w-[230px] sm:text-[22px]"
      style={{
        ...fontStyle,
        opacity: 0,
        animation: `${sc}-ink .55s ${delay}s cubic-bezier(.2,.8,.2,1) forwards`,
      }}
    >
      {text}
    </span>
  );

  if (place === 0) {
    return (
      <div
        className={cn(common, "top-full left-1/2 -translate-x-1/2 flex-col")}
        style={{ marginTop: 2 }}
        data-note
      >
        <div style={{ marginLeft: 44 }}>
          {renderArrow(ARROWS.up, false, 0, 0.05)}
        </div>
        <div className="-mt-1">{renderLabel(0.45)}</div>
      </div>
    );
  }

  const isLeft = place < 0;
  return (
    <div
      className={cn(common, "bottom-full flex-col")}
      style={
        isLeft
          ? { left: "-4%", marginBottom: 2, alignItems: "flex-start" }
          : { right: "-4%", marginBottom: 2, alignItems: "flex-end" }
      }
      data-note
    >
      <div style={isLeft ? { marginLeft: -12 } : { marginRight: -12 }}>
        {renderLabel(0.1)}
      </div>
      <div style={isLeft ? { marginLeft: 32 } : { marginRight: 32 }}>
        {renderArrow(ARROWS.side, !isLeft, isLeft ? 4 : -4, 0.35)}
      </div>
    </div>
  );
}

/**
 * Afiche editorial generado con la paleta de la categoría o mención
 * cuando un comunicado no incluye fotografía de portada.
 */
function EditorialPosterSurface({ item }: { item: SchoolAnnouncementItem }) {
  const { primary, secondary, accent, glow } = item.themePalette;
  const meta = ANNOUNCEMENT_CATEGORY_META[item.category];
  const countdown = formatAnnouncementCountdown(item.eventDate);

  return (
    <div
      className="relative flex h-full w-full flex-col justify-between overflow-hidden p-4 text-white"
      style={{
        background: `radial-gradient(125% 100% at 15% 10%, ${primary} 0%, color-mix(in srgb, ${secondary} 75%, #070b17) 58%, #070b17 100%)`,
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-10 -right-10 size-36 rounded-full opacity-55 blur-2xl"
        style={{ background: glow }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-10 -left-8 size-32 rounded-full opacity-40 blur-2xl"
        style={{ background: accent }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.45) 1px, transparent 1px)",
          backgroundSize: "16px 16px",
        }}
      />

      <div className="relative z-10 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-black/25 px-2.5 py-1 text-[10px] font-semibold tracking-wide backdrop-blur-md">
          <CategoryGlyph category={item.category} className="size-3" />
          <span>{meta.shortLabel}</span>
        </span>
        {item.isPinned ? (
          <span
            className="inline-flex size-6 items-center justify-center rounded-full border border-amber-200/45 bg-amber-400/25 text-amber-100 backdrop-blur-md"
            title="Fijado por Dirección"
          >
            <Pin className="size-3" aria-hidden="true" />
          </span>
        ) : null}
      </div>

      <div className="relative z-10 my-auto py-2">
        <p className="line-clamp-3 break-words text-[15px] leading-snug font-semibold tracking-[-0.015em] text-white drop-shadow-xs sm:text-[17px]">
          {item.title}
        </p>
        <p className="mt-1.5 line-clamp-2 break-words text-[11px] leading-relaxed text-white/80">
          {stripRichFormatting(item.body)}
        </p>
      </div>

      <div className="relative z-10 flex items-center justify-between gap-2 border-t border-white/15 pt-2 text-[10px] text-white/85">
        <span className="truncate font-medium">
          {item.targetMencionName ?? "Comunidad Bellista"}
        </span>
        {countdown ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/18 px-2 py-0.5 font-semibold">
            <CalendarDays className="size-2.5" aria-hidden="true" />
            {countdown.label}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Superficie fotográfica `.webp` con degradado inferior WCAG AA y metadatos del evento.
 */
function PhotoPosterSurface({ item }: { item: SchoolAnnouncementItem }) {
  const meta = ANNOUNCEMENT_CATEGORY_META[item.category];
  const countdown = formatAnnouncementCountdown(item.eventDate);

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-950">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.coverWebpUrl ?? ""}
        alt={item.title}
        draggable={false}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(6,10,20,0.42) 0%, rgba(6,10,20,0.08) 38%, rgba(6,10,20,0.88) 100%)",
        }}
      />

      <div className="relative z-10 flex h-full flex-col justify-between p-3.5 text-white">
        <div className="flex items-center justify-between gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-white/25 px-2.5 py-1 text-[10px] font-semibold backdrop-blur-md"
            style={{ background: hexToRgba(item.themePalette.primary, 0.72) }}
          >
            <CategoryGlyph category={item.category} className="size-3" />
            <span>{meta.shortLabel}</span>
          </span>
          {item.isPinned ? (
            <span
              className="inline-flex size-6 items-center justify-center rounded-full border border-amber-200/50 bg-amber-500/35 text-amber-100 backdrop-blur-md"
              title="Fijado por Dirección"
            >
              <Pin className="size-3" aria-hidden="true" />
            </span>
          ) : null}
        </div>

        <div className="min-w-0">
          {countdown ? (
            <span className="mb-1.5 inline-flex items-center gap-1 rounded-full border border-white/25 bg-black/45 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-md">
              <CalendarDays className="size-2.5" aria-hidden="true" />
              {countdown.label}
            </span>
          ) : null}
          <p className="line-clamp-2 break-words text-[14px] leading-snug font-semibold tracking-[-0.015em] text-white sm:text-[15.5px]">
            {item.title}
          </p>
          <p className="mt-1 truncate text-[10.5px] text-white/80">
            {formatAnnouncementAudience(
              item.targetMencionName,
              item.targetGradeYear
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

export function BellistaBulletinCardFan({
  items,
  variant = "dashboard",
  autoplay = true,
  interval = 4200,
  hideRead = true,
  onOpenReadArchive,
  canEditItem,
  onEditItem,
  onItemReadConfirmed,
  className,
}: BellistaBulletinCardFanProps) {
  const sc = "cf" + React.useId().replace(/[^a-zA-Z0-9]/g, "");
  const [localItems, setLocalItems] = React.useState<SchoolAnnouncementItem[]>(items);

  React.useEffect(() => {
    setLocalItems(items);
  }, [items]);

  const visibleItems = React.useMemo(
    () =>
      (hideRead ? localItems.filter((it) => !it.hasRead) : localItems).slice(
        0,
        9
      ),
    [hideRead, localItems]
  );
  const readCountTotal = React.useMemo(
    () => localItems.filter((it) => it.hasRead).length,
    [localItems]
  );
  const n = visibleItems.length;
  const stageRef = React.useRef<HTMLDivElement | null>(null);
  const cardRefs = React.useRef<(HTMLDivElement | null)[]>([]);
  const [active, setActive] = React.useState(0);
  const [stageW, setStageW] = React.useState(900);
  const [drawGen, setDrawGen] = React.useState(0);
  const [detailItem, setDetailItem] = React.useState<SchoolAnnouncementItem | null>(
    null
  );
  const [bursts, setBursts] = React.useState<number[]>([]);
  const confirmingIdsRef = React.useRef<Set<string>>(new Set());

  const sim = React.useRef({
    pos: 0,
    vel: 0,
    target: 0,
    dragging: false,
    lastX: 0,
    lastT: 0,
    dragV: 0,
    moved: 0,
    hover: false,
    settled: true,
  });
  const activeRef = React.useRef(0);

  // Reiniciar posición segura si cambia la cantidad de anuncios
  React.useEffect(() => {
    if (n === 0) return;
    const clamped = Math.min(activeRef.current, n - 1);
    sim.current.pos = clamped;
    sim.current.target = clamped;
    sim.current.vel = 0;
    activeRef.current = clamped;
    setActive(clamped);
  }, [n]);

  const narrow = stageW < 600;
  const cardW = Math.round(
    narrow
      ? Math.max(170, Math.min(230, stageW * 0.56))
      : Math.max(185, Math.min(258, stageW * 0.25))
  );
  const cardH = Math.round(cardW * 1.12);
  const topPad = narrow ? 78 : 88;
  const stageH = topPad + cardH + (narrow ? 142 : 148);

  React.useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0) setStageW(rect.width);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const wrap = React.useCallback(
    (offset: number) => {
      if (n <= 1) return 0;
      if (n === 2) {
        const mod = ((offset % 2) + 2) % 2;
        return mod > 1 ? mod - 2 : mod;
      }
      let x = ((offset % n) + n) % n;
      if (x > n / 2) x -= n;
      return x;
    },
    [n]
  );

  const layout = React.useCallback(
    (offset: number) => {
      const a = Math.abs(offset);
      const s = Math.sign(offset);
      const k1 = cardW * (narrow ? 0.92 : 0.98);
      const k2 = cardW * (narrow ? 0.45 : 0.62);
      const x = s * (a <= 1 ? a * k1 : k1 + (a - 1) * k2);
      const y = Math.pow(a, 1.35) * cardW * 0.068;
      const rot = s * Math.min(a, 2.6) * 7.2;
      const scale = 1 - Math.min(a, 3) * 0.085;
      const blur = Math.max(0, a - 1.05) * 3.0;
      const gray = Math.max(0, Math.min(1, (a - 1.08) * 1.15));
      const op = a > 2.6 ? Math.max(0, 1 - (a - 2.6) * 1.6) : 1;
      return { x, y, rot, scale, blur, gray, op, z: 100 - Math.round(a * 10) };
    },
    [cardW, narrow]
  );

  React.useEffect(() => {
    if (n === 0) return;
    let raf = 0;
    let last = performance.now();

    const step = (t: number) => {
      raf = requestAnimationFrame(step);
      const dt = Math.min(0.033, (t - last) / 1000);
      last = t;
      const s = sim.current;

      if (!s.dragging) {
        let d = s.target - s.pos;
        const f = 190 * d - 24 * s.vel;
        s.vel += f * dt;
        s.pos += s.vel * dt;
        d = s.target - s.pos;
        if (Math.abs(d) < 0.0005 && Math.abs(s.vel) < 0.002) {
          s.pos = s.target;
          s.vel = 0;
        }
      }

      for (let i = 0; i < n; i++) {
        const el = cardRefs.current[i];
        if (!el) continue;
        const o = wrap(i - s.pos);
        const L = layout(o);
        el.style.transform = `translate(-50%,-50%) translate3d(${L.x.toFixed(2)}px,${L.y.toFixed(2)}px,0) rotate(${L.rot.toFixed(3)}deg) scale(${L.scale.toFixed(4)})`;
        el.style.zIndex = String(L.z);
        el.style.opacity = L.op.toFixed(3);
        const inner = el.firstElementChild as HTMLElement | null;
        if (inner) {
          inner.style.filter =
            L.blur > 0.05 || L.gray > 0.02
              ? `blur(${L.blur.toFixed(2)}px) grayscale(${L.gray.toFixed(2)}) brightness(${(1 - L.gray * 0.08).toFixed(3)})`
              : "none";
        }
        const note = el.querySelector("[data-note]") as HTMLElement | null;
        if (note) {
          const slot = Math.round(wrap(i - s.target));
          note.style.opacity = Math.max(0, 1 - Math.abs(o - slot) * 3).toFixed(3);
          note.style.rotate = `${(-L.rot * 0.55).toFixed(2)}deg`;
        }
        el.style.pointerEvents = L.op < 0.2 ? "none" : "auto";
      }

      const r = ((Math.round(s.pos) % n) + n) % n;
      if (r !== activeRef.current && Math.abs(s.pos - Math.round(s.pos)) < 0.25) {
        activeRef.current = r;
        setActive(r);
      }

      const settled = Math.abs(s.pos - s.target) < 0.02 && !s.dragging;
      if (settled !== s.settled) {
        s.settled = settled;
        if (settled) setDrawGen((g) => g + 1);
      }
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [n, layout, wrap]);

  const go = React.useCallback(
    (delta: number) => {
      if (n <= 1) return;
      sim.current.target = Math.round(sim.current.target) + delta;
    },
    [n]
  );

  const goTo = React.useCallback(
    (i: number) => {
      if (n <= 1) return;
      const s = sim.current;
      const cur = ((Math.round(s.target) % n) + n) % n;
      s.target = Math.round(s.target) + wrap(i - cur);
    },
    [n, wrap]
  );

  React.useEffect(() => {
    if (!autoplay || n <= 1) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    let visible = true;
    const io = new IntersectionObserver((entries) => {
      visible = Boolean(entries[0]?.isIntersecting);
    });
    if (stageRef.current) io.observe(stageRef.current);

    const timer = window.setInterval(() => {
      const s = sim.current;
      if (visible && !s.hover && !s.dragging && !document.hidden && !detailItem) {
        go(1);
      }
    }, interval);

    return () => {
      window.clearInterval(timer);
      io.disconnect();
    };
  }, [autoplay, interval, go, n, detailItem]);

  const onDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || n <= 1) return;
    const s = sim.current;
    s.dragging = true;
    s.lastX = e.clientX;
    s.lastT = performance.now();
    s.dragV = 0;
    s.moved = 0;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onMove = (e: React.PointerEvent) => {
    const s = sim.current;
    if (!s.dragging) return;
    const now = performance.now();
    const dx = e.clientX - s.lastX;
    const k = 1 / (cardW * 0.97);
    s.pos -= dx * k;
    s.moved += Math.abs(dx);
    const v = (-dx * k) / Math.max(0.001, (now - s.lastT) / 1000);
    s.dragV = s.dragV * 0.7 + v * 0.3;
    s.lastX = e.clientX;
    s.lastT = now;
  };

  const onUp = () => {
    const s = sim.current;
    if (!s.dragging) return;
    s.dragging = false;
    const proj = s.pos + Math.max(-3, Math.min(3, s.dragV * 0.22));
    s.target = Math.round(proj);
    s.vel = s.dragV * 0.6;
  };

  const tilt = (e: React.PointerEvent, i: number) => {
    if (i !== active || sim.current.dragging) return;
    const el = e.currentTarget as HTMLElement;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.setProperty("--rx", `${((0.5 - py) * 11).toFixed(2)}deg`);
    el.style.setProperty("--ry", `${((px - 0.5) * 13).toFixed(2)}deg`);
    el.style.setProperty("--mx", `${(px * 100).toFixed(1)}%`);
    el.style.setProperty("--my", `${(py * 100).toFixed(1)}%`);
    el.style.setProperty("--sh", "1");
  };

  const untilt = (e: React.PointerEvent) => {
    const el = e.currentTarget as HTMLElement;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
    el.style.setProperty("--sh", "0");
  };

  const activeItem = visibleItems[active] ?? visibleItems[0] ?? null;

  const triggerBurst = React.useCallback(() => {
    const id = Date.now() + Math.random();
    setBursts((prev) => [...prev, id]);
    window.setTimeout(() => {
      setBursts((prev) => prev.filter((x) => x !== id));
    }, 1050);
  }, []);

  const handleConfirmRead = React.useCallback(
    async (
      target: SchoolAnnouncementItem,
      options?: { silent?: boolean }
    ) => {
      const silent = Boolean(options?.silent);
      if (target.hasRead) {
        if (!silent) {
          triggerBurst();
          toast.info("Este comunicado ya está guardado en tu sección de Leídos.");
        }
        return;
      }

      if (confirmingIdsRef.current.has(target.id)) return;
      confirmingIdsRef.current.add(target.id);
      if (!silent) triggerBurst();

      const optimisticReadAt = new Date().toISOString();
      const optimisticCount = target.readCount + 1;

      const applyState = (count: number, readAt: string) => {
        setLocalItems((prev) =>
          prev.map((it) =>
            it.id === target.id
              ? { ...it, hasRead: true, readCount: count, readAt }
              : it
          )
        );
        setDetailItem((prev) =>
          prev && prev.id === target.id
            ? { ...prev, hasRead: true, readCount: count, readAt }
            : prev
        );
        onItemReadConfirmed?.(target.id, count, readAt);
      };

      applyState(optimisticCount, optimisticReadAt);

      try {
        if (typeof window !== "undefined" && !window.navigator.onLine) {
          await enqueueOfflineMutation({
            dedupKey: `announcement_read:${target.id}`,
            kind: "announcement_read",
            payload: { announcementId: target.id },
          });
          toast.success(
            "Marcado como leído sin conexión. Se sincronizará al volver internet."
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

        applyState(res.data.readCount, res.data.readAt);
        if (!silent) {
          toast.success("Marcado como leído y movido a tu sección de Leídos.");
        }
      } finally {
        confirmingIdsRef.current.delete(target.id);
      }
    },
    [onItemReadConfirmed, triggerBurst]
  );

  const openDetailAndMarkRead = React.useCallback(
    (targetItem: SchoolAnnouncementItem) => {
      const optimisticReadAt = targetItem.readAt ?? new Date().toISOString();
      const previewItem = targetItem.hasRead
        ? targetItem
        : {
            ...targetItem,
            hasRead: true,
            readCount: targetItem.readCount + 1,
            readAt: optimisticReadAt,
          };
      setDetailItem(previewItem);
      if (!targetItem.hasRead) {
        void handleConfirmRead(targetItem, { silent: true });
      }
    },
    [handleConfirmRead]
  );

  const handleCardClick = (i: number) => {
    if (sim.current.moved > 6) return;
    if (i === active) {
      const targetItem = visibleItems[i];
      if (targetItem) openDetailAndMarkRead(targetItem);
      return;
    }
    goTo(i);
  };

  const detailDialog = (
    <BulletinDetailDialog
      item={detailItem}
      open={detailItem !== null}
      onOpenChange={(open) => {
        if (!open) setDetailItem(null);
      }}
      showFullBulletinLink={variant === "dashboard"}
      canEdit={Boolean(detailItem && canEditItem?.(detailItem))}
      onEdit={(it) => {
        setDetailItem(null);
        onEditItem?.(it);
      }}
      onConfirmRead={(it) => handleConfirmRead(it)}
    />
  );

  if (n === 0 || !activeItem) {
    const allCaughtUp = hideRead && readCountTotal > 0;
    return (
      <>
        <section
          aria-label="La Cartelera Bellista"
          className={cn(
            "siga-glass-surface flex flex-col items-start justify-between gap-4 rounded-[28px] border p-5 sm:flex-row sm:items-center sm:p-6",
            className
          )}
        >
          <div className="flex items-center gap-3.5">
            <span
              className={cn(
                "siga-glass-inner flex size-11 shrink-0 items-center justify-center rounded-2xl border",
                allCaughtUp
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-primary dark:text-[#7dd3fc]"
              )}
            >
              {allCaughtUp ? (
                <CheckCheck className="size-5" aria-hidden="true" />
              ) : (
                <Megaphone className="size-5" aria-hidden="true" />
              )}
            </span>
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                {allCaughtUp
                  ? "Estás al día con La Cartelera Bellista"
                  : "La Cartelera Bellista"}
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {allCaughtUp
                  ? `Ya leíste ${readCountTotal} ${readCountTotal === 1 ? "comunicado reciente" : "comunicados recientes"}. Todos quedan guardados en tu sección de Leídos.`
                  : "Aún no hay anuncios publicados para tu sección. Cuando Dirección o tu coordinación publiquen un comunicado aparecerá aquí."}
              </p>
            </div>
          </div>

          {allCaughtUp ? (
            onOpenReadArchive ? (
              <button
                type="button"
                onClick={onOpenReadArchive}
                className="siga-glass-inner inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-4 text-xs font-medium text-foreground transition-colors hover:bg-primary/10"
              >
                <CheckCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                <span>Ver leídos ({readCountTotal})</span>
              </button>
            ) : (
              <Link
                href="/estudiante/cartelera?tab=leidos"
                className="siga-glass-inner inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-4 text-xs font-medium text-foreground transition-colors hover:bg-primary/10"
              >
                <CheckCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                <span>Ver leídos ({readCountTotal})</span>
                <ArrowUpRight className="size-3.5" aria-hidden="true" />
              </Link>
            )
          ) : variant === "dashboard" ? (
            <Link
              href="/estudiante/cartelera"
              className="siga-glass-inner inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-4 text-xs font-medium text-foreground transition-colors hover:bg-primary/10"
            >
              <span>Abrir Cartelera</span>
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </Link>
          ) : null}
        </section>
        {detailDialog}
      </>
    );
  }

  const unreadCount = localItems.filter((it) => !it.hasRead).length;
  const palette = activeItem.themePalette;
  const dynamicVars = {
    "--b1": hexToRgba(palette.primary, 0.42),
    "--b2": hexToRgba(palette.secondary, 0.38),
    "--b3": hexToRgba(palette.accent, 0.3),
    "--b4": hexToRgba(palette.glow, 0.22),
    "--spot": hexToRgba(palette.glow, 0.28),
    "--evt-accent": palette.primary,
    "--evt-glow": palette.accent,
  } as React.CSSProperties;

  const css = `
.${sc}{--bg:rgba(248,250,252,.74);--grid:rgba(15,23,42,.055);--bezel:#ffffff;--bezel-bd:rgba(15,23,42,.08);--ink:#1e293b;--tx:#0f172a;--tx3:rgba(15,23,42,.52);--shadow:0 1px 1px rgba(0,0,0,.04),0 10px 22px -6px rgba(15,23,42,.15),0 28px 56px -20px rgba(15,23,42,.24);--glass:rgba(255,255,255,.78);--glass-bd:rgba(15,23,42,.09);color:var(--tx)}
.dark .${sc},.${sc}.dark{--bg:rgba(11,15,26,.78);--grid:rgba(255,255,255,.055);--bezel:#151c2c;--bezel-bd:rgba(255,255,255,.12);--ink:#e2e8f0;--tx:#f8fafc;--tx3:rgba(248,250,252,.52);--shadow:0 1px 0 rgba(255,255,255,.06) inset,0 12px 24px -8px rgba(0,0,0,.62),0 36px 72px -24px rgba(0,0,0,.8);--glass:rgba(15,23,42,.72);--glass-bd:rgba(255,255,255,.12)}
@keyframes ${sc}-draw{to{stroke-dashoffset:0}}
@keyframes ${sc}-fade{to{opacity:1}}
@keyframes ${sc}-ink{from{opacity:0;transform:translateY(4px) rotate(-2deg);filter:blur(3px)}to{opacity:1;transform:none;filter:none}}
@keyframes ${sc}-pop{0%{transform:scale(1)}30%{transform:scale(1.32)}60%{transform:scale(.92)}100%{transform:scale(1)}}
@keyframes ${sc}-burst{0%{transform:translate(-50%,-50%) rotate(var(--a)) translateY(0) scale(.65);opacity:1}100%{transform:translate(-50%,-50%) rotate(var(--a)) translateY(-34px) scale(0);opacity:0}}
@keyframes ${sc}-drift1{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(6%,-8%) scale(1.12)}}
@keyframes ${sc}-drift2{0%,100%{transform:translate(0,0) scale(1.05)}50%{transform:translate(-7%,6%) scale(.92)}}
@keyframes ${sc}-drift3{0%,100%{transform:translate(0,0)}50%{transform:translate(4%,7%) scale(1.14)}}
@keyframes ${sc}-roll{from{transform:translateY(60%);opacity:0}to{transform:none;opacity:1}}
.${sc} .cf-card{position:absolute;left:50%;top:50%;will-change:transform;touch-action:pan-y}
.${sc} .cf-tilt{transform:perspective(900px) rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg));transition:transform .35s cubic-bezier(.2,.8,.2,1)}
.${sc} .cf-sheen{background:radial-gradient(360px circle at var(--mx,50%) var(--my,30%),rgba(255,255,255,.52),transparent 42%);mix-blend-mode:overlay;opacity:var(--sh,0);transition:opacity .3s}
.${sc} .cf-blob{transition:background .75s ease}
@media (prefers-reduced-motion: reduce){.${sc} *{animation-duration:1ms!important;animation-delay:0ms!important;transition-duration:1ms!important}}
`;

  return (
    <>
      <section
        className={cn(
          sc,
          "relative w-full select-none overflow-hidden rounded-[28px] border border-border/70 backdrop-blur-xl",
          className
        )}
        style={{ background: "var(--bg)", ...dynamicVars }}
        role="region"
        aria-roledescription="carousel"
        aria-label="La Cartelera Bellista — Anuncios destacados"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") {
            e.preventDefault();
            go(1);
          } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            go(-1);
          } else if (e.key === "Enter" || e.key === " ") {
            if (document.activeElement === e.currentTarget) {
              e.preventDefault();
              openDetailAndMarkRead(activeItem);
            }
          }
        }}
      >
        <style>{css}</style>

        {/* Aurora dinámica con los colores dominantes de la imagen/categoría del evento activo */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <div
            className="cf-blob absolute rounded-full"
            style={{
              left: "-8%",
              top: "-30%",
              width: "56%",
              height: "120%",
              background: "radial-gradient(closest-side, var(--b1), transparent)",
              filter: "blur(32px)",
              animation: `${sc}-drift1 16s ease-in-out infinite`,
            }}
          />
          <div
            className="cf-blob absolute rounded-full"
            style={{
              right: "-10%",
              top: "-22%",
              width: "58%",
              height: "125%",
              background: "radial-gradient(closest-side, var(--b2), transparent)",
              filter: "blur(32px)",
              animation: `${sc}-drift2 19s ease-in-out infinite`,
            }}
          />
          <div
            className="cf-blob absolute rounded-full"
            style={{
              left: "26%",
              bottom: "-55%",
              width: "48%",
              height: "100%",
              background: "radial-gradient(closest-side, var(--b3), transparent)",
              filter: "blur(36px)",
              animation: `${sc}-drift3 22s ease-in-out infinite`,
            }}
          />
          <div
            className="cf-blob absolute rounded-full"
            style={{
              right: "18%",
              top: "-45%",
              width: "30%",
              height: "80%",
              background: "radial-gradient(closest-side, var(--b4), transparent)",
              filter: "blur(40px)",
              animation: `${sc}-drift1 25s ease-in-out infinite reverse`,
            }}
          />
          <div
            className="cf-blob absolute left-1/2 -translate-x-1/2 rounded-full"
            style={{
              top: topPad - cardH * 0.15,
              width: cardW * 2.5,
              height: cardH * 1.25,
              background: "radial-gradient(closest-side, var(--spot), transparent)",
              filter: "blur(22px)",
            }}
          />
        </div>

        {/* Cuadrícula sutil enmascarada */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(var(--grid) 1px, transparent 1px), linear-gradient(90deg, var(--grid) 1px, transparent 1px)",
            backgroundSize: `${Math.round(cardW * 0.25)}px ${Math.round(cardW * 0.25)}px`,
            backgroundPosition: "center center",
            maskImage:
              "radial-gradient(ellipse 78% 72% at 50% 50%, #000 38%, transparent 100%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 78% 72% at 50% 50%, #000 38%, transparent 100%)",
          }}
        />

        {/* Píldora institucional superior + acceso a Cartelera completa */}
        <div className="pointer-events-none absolute inset-x-4 top-3.5 z-[180] flex items-center justify-between gap-2 sm:inset-x-5 sm:top-4">
          <div
            className="pointer-events-auto inline-flex items-center gap-2 rounded-full py-1.5 pr-3 pl-2 backdrop-blur-md"
            style={{
              background: "var(--glass)",
              boxShadow:
                "0 0 0 1px var(--glass-bd), 0 6px 20px -10px rgba(0,0,0,.22)",
            }}
          >
            <span
              className="grid size-6 place-items-center rounded-full text-white transition-colors duration-500"
              style={{ background: "var(--evt-accent)" }}
            >
              <Megaphone className="size-3.5" aria-hidden="true" />
            </span>
            <span className="text-xs font-semibold tracking-[-0.01em]">
              La Cartelera Bellista
            </span>
            {unreadCount > 0 ? (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white transition-colors duration-500"
                style={{ background: "var(--evt-accent)" }}
              >
                {unreadCount} sin leer
              </span>
            ) : null}
          </div>

          <div className="pointer-events-auto flex items-center gap-1.5">
            {readCountTotal > 0 ? (
              onOpenReadArchive ? (
                <button
                  type="button"
                  onClick={onOpenReadArchive}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium backdrop-blur-md transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:outline-none"
                  style={{
                    background: "var(--glass)",
                    boxShadow:
                      "0 0 0 1px var(--glass-bd), 0 6px 20px -10px rgba(0,0,0,.2)",
                  }}
                >
                  <CheckCheck className="size-3.5 text-emerald-500" aria-hidden="true" />
                  <span>Leídos ({readCountTotal})</span>
                </button>
              ) : (
                <Link
                  href="/estudiante/cartelera?tab=leidos"
                  onPointerDown={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium backdrop-blur-md transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:outline-none"
                  style={{
                    background: "var(--glass)",
                    boxShadow:
                      "0 0 0 1px var(--glass-bd), 0 6px 20px -10px rgba(0,0,0,.2)",
                  }}
                >
                  <CheckCheck className="size-3.5 text-emerald-500" aria-hidden="true" />
                  <span>Leídos ({readCountTotal})</span>
                </Link>
              )
            ) : null}

            {variant === "dashboard" ? (
              <Link
                href="/estudiante/cartelera"
                onPointerDown={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold backdrop-blur-md transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:outline-none"
                style={{
                  background: "var(--glass)",
                  boxShadow:
                    "0 0 0 1px var(--glass-bd), 0 6px 20px -10px rgba(0,0,0,.2)",
                }}
              >
                <span>Ver cartelera</span>
                <ArrowUpRight className="size-3.5" aria-hidden="true" />
              </Link>
            ) : null}
          </div>
        </div>

        {/* Escenario interactivo del abanico */}
        <div
          ref={stageRef}
          className={cn(
            "relative w-full",
            n > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
          )}
          style={{ height: stageH }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onPointerEnter={() => {
            sim.current.hover = true;
          }}
          onPointerLeave={() => {
            sim.current.hover = false;
            onUp();
          }}
        >
          <div
            className="absolute inset-x-0"
            style={{ top: topPad, height: cardH }}
          >
            {visibleItems.map((item, i) => {
              const slot = Math.round(wrap(i - active));
              const showFrontNote = narrow ? slot === 0 : Math.abs(slot) <= 1;
              return (
                <div
                  key={item.id}
                  ref={(el) => {
                    cardRefs.current[i] = el;
                  }}
                  className="cf-card"
                  style={{ width: cardW, height: cardH, top: "50%" }}
                  onClick={() => handleCardClick(i)}
                  role="button"
                  tabIndex={i === active ? 0 : -1}
                  aria-label={`${item.title}. ${i === active ? "Abrir detalle del comunicado" : "Traer comunicado al frente"}`}
                  aria-current={i === active ? "true" : undefined}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleCardClick(i);
                    }
                  }}
                >
                  <div
                    className="cf-tilt relative h-full w-full p-[7px]"
                    style={{
                      background: "var(--bezel)",
                      boxShadow: "var(--shadow), 0 0 0 1px var(--bezel-bd)",
                      borderRadius: Math.round(cardW * 0.11),
                    }}
                    onPointerMove={(e) => tilt(e, i)}
                    onPointerLeave={untilt}
                  >
                    <div
                      className="relative h-full w-full overflow-hidden"
                      style={{ borderRadius: Math.round(cardW * 0.08) }}
                    >
                      {item.coverWebpUrl ? (
                        <PhotoPosterSurface item={item} />
                      ) : (
                        <EditorialPosterSurface item={item} />
                      )}
                      <div className="cf-sheen pointer-events-none absolute inset-0" />
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0"
                        style={{
                          boxShadow:
                            "inset 0 0 0 1px rgba(255,255,255,.12), inset 0 -40px 60px -40px rgba(0,0,0,.22)",
                          borderRadius: "inherit",
                        }}
                      />
                    </div>
                  </div>
                  {showFrontNote ? (
                    <HandwrittenNote
                      text={item.shortNote}
                      place={slot}
                      drawKey={`${item.id}-${drawGen}-${slot}`}
                      sc={sc}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        {/* Sugerencia sutil izquierda */}
        <button
          type="button"
          onClick={() => openDetailAndMarkRead(activeItem)}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute bottom-4 left-4 z-[170] hidden cursor-pointer items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium backdrop-blur-md transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:outline-none sm:inline-flex sm:bottom-5 sm:left-5"
          style={{
            background: "var(--glass)",
            boxShadow:
              "0 0 0 1px var(--glass-bd), 0 8px 20px -10px rgba(0,0,0,.2)",
          }}
        >
          <span>Leer comunicado</span>
          <ArrowUpRight className="size-3.5" aria-hidden="true" />
        </button>

        {/* Puntos de paginación */}
        {n > 1 ? (
          <div
            className="absolute bottom-5 left-1/2 z-[170] flex -translate-x-1/2 items-center gap-1.5 rounded-full px-2.5 py-2 backdrop-blur-md"
            style={{
              background: "var(--glass)",
              boxShadow: "0 0 0 1px var(--glass-bd)",
            }}
          >
            {visibleItems.map((it, i) => (
              <button
                key={it.id}
                type="button"
                aria-label={`Ver comunicado: ${it.title}`}
                onClick={() => goTo(i)}
                className="h-1.5 cursor-pointer rounded-full outline-none transition-all duration-300 focus-visible:ring-2"
                style={{
                  width: i === active ? 18 : 6,
                  background: i === active ? "var(--evt-accent)" : "var(--tx3)",
                  opacity: i === active ? 1 : 0.48,
                }}
              />
            ))}
          </div>
        ) : null}

        {/* Botón animado oficial "Enterado" con explosión de partículas + contador */}
        <button
          type="button"
          onClick={() => handleConfirmRead(activeItem)}
          onPointerDown={(e) => e.stopPropagation()}
          aria-pressed={activeItem.hasRead}
          aria-label={
            activeItem.hasRead
              ? `Enterado confirmado · ${activeItem.readCount} confirmaciones`
              : `Confirmar lectura (Enterado) · ${activeItem.readCount} confirmaciones`
          }
          className="group absolute right-4 bottom-4 z-[170] flex cursor-pointer items-center gap-2 rounded-full py-2 pr-3.5 pl-2.5 outline-none backdrop-blur-md transition-transform active:scale-95 focus-visible:ring-2 focus-visible:ring-primary/60 sm:right-5 sm:bottom-5"
          style={{
            background: activeItem.hasRead
              ? hexToRgba(palette.primary, 0.18)
              : "var(--glass)",
            boxShadow: activeItem.hasRead
              ? `0 0 0 1px ${hexToRgba(palette.primary, 0.45)}, 0 8px 24px -10px rgba(0,0,0,.28)`
              : "0 0 0 1px var(--glass-bd), 0 8px 24px -10px rgba(0,0,0,.25)",
          }}
        >
          <span className="relative grid size-6 place-items-center">
            {bursts.map((burstId) => (
              <React.Fragment key={burstId}>
                {Array.from({ length: 10 }, (_, k) => (
                  <span
                    key={k}
                    className="pointer-events-none absolute top-1/2 left-1/2 size-1.5 rounded-full"
                    style={
                      {
                        background:
                          k % 2 === 0 ? "var(--evt-accent)" : "var(--evt-glow)",
                        "--a": `${k * 36}deg`,
                        animation: `${sc}-burst .72s cubic-bezier(.2,.8,.2,1) forwards`,
                      } as React.CSSProperties
                    }
                  />
                ))}
              </React.Fragment>
            ))}
            <span
              key={`${activeItem.id}-${activeItem.hasRead}`}
              className="grid size-6 place-items-center rounded-full transition-colors duration-300"
              style={{
                background: activeItem.hasRead
                  ? "var(--evt-accent)"
                  : "transparent",
                color: activeItem.hasRead ? "#ffffff" : "var(--tx)",
                animation: activeItem.hasRead
                  ? `${sc}-pop .5s cubic-bezier(.2,.8,.2,1)`
                  : undefined,
              }}
            >
              {activeItem.hasRead ? (
                <CheckCheck className="size-3.5" aria-hidden="true" />
              ) : (
                <Check className="size-4" aria-hidden="true" />
              )}
            </span>
          </span>

          <span className="text-xs font-semibold">
            {activeItem.hasRead ? "Leído" : "Marcar leído"}
          </span>

          <span className="relative h-4 overflow-hidden text-xs leading-4 font-bold tabular-nums opacity-85">
            <span
              key={`${activeItem.id}-${activeItem.readCount}`}
              className="block"
              style={{
                animation: activeItem.hasRead
                  ? `${sc}-roll .35s cubic-bezier(.2,.8,.2,1)`
                  : undefined,
              }}
            >
              {activeItem.readCount.toLocaleString("es-VE")}
            </span>
          </span>
        </button>
      </section>

      {detailDialog}
    </>
  );
}

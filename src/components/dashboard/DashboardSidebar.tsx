"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Popover } from "radix-ui";
import {
  Bell,
  Home,
  Loader2,
  LogOut,
  Moon,
  SlidersHorizontal,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { cn } from "cn";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import type { DashboardUserProfile } from "@/lib/supabase/dashboard-session";
import { GlassCustomizer } from "./GlassCustomizer";

export interface SidebarNavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
}

export const ROLE_HOME_PATH: Record<DashboardUserProfile["primaryRole"], string> = {
  estudiante: "/estudiante",
  docente: "/docente",
  coordinador_mencion: "/docente",
  control_estudios: "/control-estudios",
  orientacion: "/control-estudios/orientacion",
  coordinador_pasantias: "/pasantias",
  biblioteca: "/biblioteca",
  direccion: "/analitica",
};

export const ROLE_LABELS: Record<DashboardUserProfile["primaryRole"], string> = {
  estudiante: "Estudiante",
  docente: "Docente",
  coordinador_mencion: "Coord. Mención",
  control_estudios: "Control de Estudios",
  orientacion: "Orientación",
  coordinador_pasantias: "Coord. Pasantías",
  biblioteca: "Biblioteca",
  direccion: "Dirección",
};

/**
 * Construye el trazado SVG biconcavo ("Curved Sidebar" del video de referencia):
 * esquinas redondeadas arriba/abajo y cintura suavemente arqueada hacia adentro
 * en los costados izquierdo y derecho.
 */
function buildConcaveSidebarPath(
  w: number,
  h: number,
  cornerRadius: number,
  waistIndent: number,
  inset = 0
): string {
  const width = Math.max(48, w);
  const height = Math.max(240, h);
  const r = Math.min(cornerRadius, width * 0.34, height * 0.12);
  const c = Math.max(0, waistIndent);

  const left = inset;
  const right = width - inset;
  const top = inset;
  const bottom = height - inset;
  const midY = height * 0.5;
  const ctrlSpan = (bottom - top - 2 * r) * 0.32;

  return [
    `M ${(left + r).toFixed(1)} ${top.toFixed(1)}`,
    `L ${(right - r).toFixed(1)} ${top.toFixed(1)}`,
    `Q ${right.toFixed(1)} ${top.toFixed(1)} ${right.toFixed(1)} ${(top + r).toFixed(1)}`,
    `C ${right.toFixed(1)} ${(top + r + ctrlSpan).toFixed(1)} ${(right - c).toFixed(1)} ${(midY - ctrlSpan * 0.7).toFixed(1)} ${(right - c).toFixed(1)} ${midY.toFixed(1)}`,
    `C ${(right - c).toFixed(1)} ${(midY + ctrlSpan * 0.7).toFixed(1)} ${right.toFixed(1)} ${(bottom - r - ctrlSpan).toFixed(1)} ${right.toFixed(1)} ${(bottom - r).toFixed(1)}`,
    `Q ${right.toFixed(1)} ${bottom.toFixed(1)} ${(right - r).toFixed(1)} ${bottom.toFixed(1)}`,
    `L ${(left + r).toFixed(1)} ${bottom.toFixed(1)}`,
    `Q ${left.toFixed(1)} ${bottom.toFixed(1)} ${left.toFixed(1)} ${(bottom - r).toFixed(1)}`,
    `C ${left.toFixed(1)} ${(bottom - r - ctrlSpan).toFixed(1)} ${(left + c).toFixed(1)} ${(midY + ctrlSpan * 0.7).toFixed(1)} ${(left + c).toFixed(1)} ${midY.toFixed(1)}`,
    `C ${(left + c).toFixed(1)} ${(midY - ctrlSpan * 0.7).toFixed(1)} ${left.toFixed(1)} ${(top + r + ctrlSpan).toFixed(1)} ${left.toFixed(1)} ${(top + r).toFixed(1)}`,
    `Q ${left.toFixed(1)} ${top.toFixed(1)} ${(left + r).toFixed(1)} ${top.toFixed(1)}`,
    "Z",
  ].join(" ");
}

/** Ícono `>|` / `<|` idéntico al conmutador superior del video Curved Sidebar */
function DockToggleGlyph({ expanded }: { expanded: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {expanded ? (
        <>
          <path d="M9.5 4.5 6 8l3.5 3.5" />
          <path d="M3.5 3.5v9" />
        </>
      ) : (
        <>
          <path d="M6.5 4.5 10 8l-3.5 3.5" />
          <path d="M12.5 3.5v9" />
        </>
      )}
    </svg>
  );
}

/** Cristal octaédrico 3D facetado (inspirado en el diamante del bloque inferior del video) */
function PrismaticCrystalGem({
  uid,
  className,
}: {
  uid: string;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn("siga-prism-float select-none", className)}
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${uid}-top-l`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e0f2fe" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>
        <linearGradient id={`${uid}-top-r`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7dd3fc" />
          <stop offset="100%" stopColor="#1c47c4" />
        </linearGradient>
        <linearGradient id={`${uid}-bot-l`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#1e3a8a" />
        </linearGradient>
        <linearGradient id={`${uid}-bot-r`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1c47c4" />
          <stop offset="100%" stopColor="#091538" />
        </linearGradient>
        <radialGradient id={`${uid}-glow`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#1c47c4" stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx="32" cy="32" r="28" fill={`url(#${uid}-glow)`} />
      <polygon points="32,7 13,31 32,26" fill={`url(#${uid}-top-l)`} />
      <polygon points="32,7 51,31 32,26" fill={`url(#${uid}-top-r)`} />
      <polygon points="13,31 32,57 32,26" fill={`url(#${uid}-bot-l)`} />
      <polygon points="51,31 32,57 32,26" fill={`url(#${uid}-bot-r)`} />
      <path
        d="M32 7L13 31L32 57L51 31L32 7ZM13 31L32 26L51 31M32 7V57"
        stroke="rgba(255,255,255,0.68)"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <circle cx="14" cy="16" r="1.3" fill="#bae6fd" opacity="0.85" />
      <circle cx="50" cy="46" r="1.1" fill="#e0f2fe" opacity="0.75" />
    </svg>
  );
}

export interface DashboardSidebarProps {
  profile: DashboardUserProfile;
  expanded?: boolean;
  onToggleExpand?: () => void;
  onNavigate?: () => void;
  className?: string;
}

/**
 * Curved Glass Sidebar inspirado en el video de referencia:
 * - Silueta biconcava real en ambos costados con doble borde especular SVG.
 * - Spotlight reactivo al cursor y pastillas deslizantes con física spring.
 * - Sin sub-secciones desplegables y con el logo apuntando al inicio del rol (`homeHref`).
 */
export function DashboardSidebar({
  profile,
  expanded = false,
  onToggleExpand,
  onNavigate,
  className,
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const rawUid = React.useId().replace(/:/g, "");
  const clipId = `siga-curved-clip-${rawUid}`;
  const borderGradId = `siga-curved-border-${rawUid}`;
  const innerGradId = `siga-curved-inner-${rawUid}`;

  const homeHref = ROLE_HOME_PATH[profile.primaryRole] ?? "/estudiante";

  const navItems = React.useMemo<SidebarNavItem[]>(
    () => [
      {
        id: "home",
        label: "Inicio",
        href: homeHref,
        icon: Home,
      },
    ],
    [homeHref]
  );

  const asideRef = React.useRef<HTMLElement | null>(null);
  const [size, setSize] = React.useState({
    w: expanded ? 248 : 76,
    h: 680,
  });
  const [hoveredNavId, setHoveredNavId] = React.useState<string | null>(null);
  const [hoveredUtilId, setHoveredUtilId] = React.useState<string | null>(null);
  const [signingOut, setSigningOut] = React.useState(false);
  const [isDark, setIsDark] = React.useState(false);

  React.useEffect(() => {
    const syncTheme = () => {
      setIsDark(document.documentElement.classList.contains("dark"));
    };
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    const el = asideRef.current;
    if (!el) return;
    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setSize({
          w: Math.round(rect.width),
          h: Math.round(rect.height),
        });
      }
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, [expanded]);

  const handlePointerMove = React.useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const el = asideRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      el.style.setProperty("--mx", `${x.toFixed(0)}px`);
      el.style.setProperty("--my", `${y.toFixed(0)}px`);
      el.style.setProperty("--spot-opacity", "1");
    },
    []
  );

  const handlePointerLeave = React.useCallback(() => {
    const el = asideRef.current;
    if (el) {
      el.style.setProperty("--spot-opacity", "0");
    }
    setHoveredNavId(null);
    setHoveredUtilId(null);
  }, []);

  const handleToggleTheme = React.useCallback(() => {
    const root = document.documentElement;
    const nextDark = !root.classList.contains("dark");
    root.classList.toggle("dark", nextDark);
    setIsDark(nextDark);
    try {
      window.localStorage.setItem("siga-theme", nextDark ? "dark" : "light");
    } catch {
      // Ignorar si almacenamiento local está restringido.
    }
  }, []);

  const handleSignOut = React.useCallback(async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      const supabase = getBrowserSupabaseClient();
      await supabase?.auth.signOut();
    } finally {
      router.push("/");
      router.refresh();
    }
  }, [router, signingOut]);

  const waistIndent = expanded ? 8.5 : 4.2;
  const cornerRadius = expanded ? 28 : 24;

  const outerPath = React.useMemo(
    () =>
      buildConcaveSidebarPath(
        size.w,
        size.h,
        cornerRadius,
        waistIndent,
        0.75
      ),
    [cornerRadius, size.h, size.w, waistIndent]
  );

  const innerPath = React.useMemo(
    () =>
      buildConcaveSidebarPath(
        size.w,
        size.h,
        Math.max(18, cornerRadius - 2),
        waistIndent,
        2.5
      ),
    [cornerRadius, size.h, size.w, waistIndent]
  );

  return (
    <aside
      ref={asideRef}
      aria-label="Navegación principal S.I.G.A."
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className={cn(
        "font-hero relative flex h-full flex-col justify-between select-none",
        expanded ? "px-4 py-4" : "px-2.5 py-3.5",
        className
      )}
    >
      {/* Definición del ClipPath cóncavo + Bordes Especulares Curvos en SVG */}
      <svg
        width={size.w}
        height={size.h}
        viewBox={`0 0 ${size.w} ${size.h}`}
        className="pointer-events-none absolute inset-0 z-0 overflow-visible"
        aria-hidden="true"
      >
        <defs>
          <clipPath id={clipId}>
            <path d={outerPath} />
          </clipPath>
          <linearGradient id={borderGradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop
              offset="0%"
              stopColor="#ffffff"
              stopOpacity={isDark ? "0.62" : "0.95"}
            />
            <stop
              offset="28%"
              stopColor={isDark ? "#7dd3fc" : "#93c5fd"}
              stopOpacity={isDark ? "0.22" : "0.55"}
            />
            <stop
              offset="50%"
              stopColor={isDark ? "#38bdf8" : "#1c47c4"}
              stopOpacity={isDark ? "0.14" : "0.28"}
            />
            <stop
              offset="75%"
              stopColor={isDark ? "#7dd3fc" : "#93c5fd"}
              stopOpacity={isDark ? "0.24" : "0.55"}
            />
            <stop
              offset="100%"
              stopColor="#ffffff"
              stopOpacity={isDark ? "0.52" : "0.92"}
            />
          </linearGradient>
          <linearGradient id={innerGradId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop
              offset="0%"
              stopColor="#ffffff"
              stopOpacity={isDark ? "0.18" : "0.65"}
            />
            <stop
              offset="50%"
              stopColor="#38bdf8"
              stopOpacity={isDark ? "0.04" : "0.15"}
            />
            <stop
              offset="100%"
              stopColor="#ffffff"
              stopOpacity={isDark ? "0.14" : "0.55"}
            />
          </linearGradient>
        </defs>
      </svg>

      {/* Fondo de cristal esmerilado y Spotlight recortados exactamente por la curva cóncava */}
      <div
        aria-hidden="true"
        style={{ clipPath: `url(#${clipId})` }}
        className="siga-curved-backdrop pointer-events-none absolute inset-0 -z-10 shadow-2xl"
      >
        <div className="siga-curved-spotlight absolute inset-0" />
      </div>

      {/* Trazo especular doble por encima del fondo */}
      <svg
        width={size.w}
        height={size.h}
        viewBox={`0 0 ${size.w} ${size.h}`}
        className="pointer-events-none absolute inset-0 z-20 overflow-visible"
        aria-hidden="true"
      >
        <path
          d={innerPath}
          fill="none"
          stroke={`url(#${innerGradId})`}
          strokeWidth="0.9"
        />
        <path
          d={outerPath}
          fill="none"
          stroke={`url(#${borderGradId})`}
          strokeWidth="1.4"
        />
      </svg>

      {/* ==================== BLOQUE SUPERIOR: CONMUTADOR ›| + ESCUDO + SECCIÓN ==================== */}
      <div className="relative z-10 flex flex-col gap-3.5">
        {expanded ? (
          /* Cabecera expandida: el logo lleva al inicio del panel actual (`homeHref`) */
          <div className="flex items-center justify-between gap-2 px-1 pt-0.5">
            <Link
              href={homeHref}
              onClick={onNavigate}
              className="flex min-w-0 items-center gap-2.5 rounded-xl py-0.5 transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-white/80 bg-white/95 p-1 shadow-xs">
                <Image
                  src="/images/institucion/logotipo.webp"
                  alt='Escudo E.T.C. "Andrés Bello"'
                  width={24}
                  height={24}
                  className="size-6 rounded-full object-contain"
                />
              </span>
              <div className="min-w-0">
                <span className="block text-xs font-semibold tracking-[0.22em] text-foreground uppercase">
                  S.I.G.A.
                </span>
                <span className="block truncate text-[10px] text-muted-foreground">
                  {ROLE_LABELS[profile.primaryRole]}
                </span>
              </div>
            </Link>

            {onToggleExpand ? (
              <button
                type="button"
                onClick={onToggleExpand}
                aria-expanded={expanded}
                aria-label="Contraer barra lateral"
                title="Contraer barra lateral"
                className="siga-glass-inner inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-xl border text-muted-foreground transition-all hover:scale-105 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none"
              >
                <DockToggleGlyph expanded />
              </button>
            ) : null}
          </div>
        ) : (
          /* Cabecera dock de íconos: el logo lleva al inicio del panel actual (`homeHref`) */
          <div className="flex flex-col items-center gap-2.5">
            {onToggleExpand ? (
              <button
                type="button"
                onClick={onToggleExpand}
                aria-expanded={expanded}
                aria-label="Expandir barra lateral"
                title="Expandir barra lateral"
                className="siga-glass-inner inline-flex h-8 w-11 cursor-pointer items-center justify-center rounded-2xl border text-muted-foreground transition-all hover:scale-105 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none"
              >
                <DockToggleGlyph expanded={false} />
              </button>
            ) : null}

            <Link
              href={homeHref}
              onClick={onNavigate}
              aria-label="Ir al inicio de tu panel S.I.G.A."
              title="Inicio del panel S.I.G.A."
              className="siga-glass-inner flex size-11 items-center justify-center rounded-2xl border p-1.5 transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none"
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-white/95 p-0.5 shadow-xs">
                <Image
                  src="/images/institucion/logotipo.webp"
                  alt='Escudo E.T.C. "Andrés Bello"'
                  width={24}
                  height={24}
                  className="size-6 rounded-full object-contain"
                />
              </span>
            </Link>
          </div>
        )}

        <div className="mx-auto h-px w-4/5 bg-border/60" />

        {/* Navegación limpia de la Sección (sin subsecciones) */}
        <nav
          aria-label="Secciones del módulo"
          className="flex flex-col gap-1.5"
          onMouseLeave={() => setHoveredNavId(null)}
        >
          {expanded ? (
            <span className="px-2 text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
              Sección
            </span>
          ) : null}

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            const isHovered = hoveredNavId === item.id;

            return expanded ? (
              <Link
                key={item.id}
                href={item.href}
                onClick={onNavigate}
                onMouseEnter={() => setHoveredNavId(item.id)}
                onFocus={() => setHoveredNavId(item.id)}
                aria-current={isActive ? "page" : undefined}
                className="siga-glass-inner relative z-10 flex items-center justify-between rounded-2xl border p-2 text-[13px] font-semibold text-foreground transition-transform hover:scale-[1.01] focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none"
              >
                {isHovered ? (
                  <motion.span
                    layoutId={`siga-nav-pill-${rawUid}`}
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    className="siga-curved-sub-pill pointer-events-none absolute inset-0 -z-10 rounded-2xl"
                  />
                ) : null}
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="siga-active-icon-glow flex size-7.5 shrink-0 items-center justify-center rounded-xl">
                    <Icon className="size-3.5" aria-hidden="true" />
                  </span>
                  <span className="truncate">{item.label}</span>
                </span>
                {isActive ? (
                  <span
                    aria-hidden="true"
                    className="mr-1.5 size-1.5 shrink-0 rounded-full bg-primary shadow-[0_0_8px_currentColor] dark:bg-sky-300"
                  />
                ) : null}
              </Link>
            ) : (
              <Link
                key={item.id}
                href={item.href}
                onClick={onNavigate}
                aria-current={isActive ? "page" : undefined}
                aria-label={item.label}
                title={item.label}
                className="siga-active-icon-glow mx-auto flex size-10.5 items-center justify-center rounded-2xl transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:outline-none"
              >
                <Icon className="size-4.5" strokeWidth={2} aria-hidden="true" />
              </Link>
            );
          })}
        </nav>
      </div>

      {/* ==================== BLOQUE INFERIOR: PRISMA DE SECCIÓN + OPCIONES DEL SISTEMA ==================== */}
      <div className="relative z-10 flex flex-col gap-3">
        {expanded ? (
          <div className="relative flex items-center justify-between gap-2 overflow-hidden rounded-2xl border border-white/30 bg-gradient-to-br from-[#0b1739]/90 via-[#0f2356]/85 to-[#060d24]/95 p-3 text-white shadow-lg">
            <div className="min-w-0">
              <span className="block text-[9.5px] font-semibold tracking-[0.16em] text-sky-300/90 uppercase">
                Módulo Activo
              </span>
              <p className="mt-1 truncate text-xs font-bold tracking-[0.06em] uppercase">
                {ROLE_LABELS[profile.primaryRole]}
              </p>
              <p className="mt-0.5 truncate text-[10.5px] text-sky-100/75">
                E.T.C. &ldquo;Andrés Bello&rdquo;
              </p>
            </div>
            <PrismaticCrystalGem
              uid={rawUid}
              className="size-12 shrink-0"
            />
          </div>
        ) : (
          <div
            title={`Sección activa: ${ROLE_LABELS[profile.primaryRole]}`}
            className="mx-auto flex w-11 flex-col items-center justify-center rounded-2xl border border-white/25 bg-gradient-to-b from-[#0f2356]/85 to-[#060d24]/95 py-2.5 shadow-md"
          >
            <PrismaticCrystalGem uid={rawUid} className="size-8" />
          </div>
        )}

        <div className="mx-auto h-px w-4/5 bg-border/60" />

        {/* Opciones del sistema (Avisos, Efecto Cristal, Tema, Cerrar sesión) — SIN perfil */}
        <div
          className="flex flex-col gap-1"
          onMouseLeave={() => setHoveredUtilId(null)}
        >
          {/* 1. Notificaciones */}
          <Popover.Root>
            <Popover.Trigger asChild>
              <button
                type="button"
                onMouseEnter={() => setHoveredUtilId("notifications")}
                onFocus={() => setHoveredUtilId("notifications")}
                aria-label={`Notificaciones (${profile.unreadNotificationsCount} sin leer)`}
                title={expanded ? undefined : "Notificaciones"}
                className={cn(
                  "relative z-10 flex h-9.5 cursor-pointer items-center rounded-xl text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none",
                  expanded
                    ? "w-full gap-2.5 px-3"
                    : "mx-auto w-10 justify-center"
                )}
              >
                {hoveredUtilId === "notifications" ? (
                  <motion.span
                    layoutId={`siga-util-pill-${rawUid}`}
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    className="siga-curved-sub-pill pointer-events-none absolute inset-0 -z-10 rounded-xl"
                  />
                ) : null}
                <span className="relative inline-flex shrink-0">
                  <Bell
                    className="size-4"
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />
                  {profile.unreadNotificationsCount > 0 ? (
                    <span
                      aria-hidden="true"
                      className="absolute -top-1 -right-1 size-2 rounded-full bg-primary ring-2 ring-white dark:ring-[#07122e]"
                    />
                  ) : null}
                </span>
                {expanded ? (
                  <span className="flex flex-1 items-center justify-between truncate">
                    <span>Notificaciones</span>
                    {profile.unreadNotificationsCount > 0 ? (
                      <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-primary dark:text-[#7dd3fc]">
                        {profile.unreadNotificationsCount}
                      </span>
                    ) : null}
                  </span>
                ) : null}
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                side="right"
                align="end"
                sideOffset={14}
                className="siga-glass-surface font-hero z-50 w-72 rounded-2xl border p-4 text-xs text-foreground shadow-xl outline-none"
              >
                <p className="font-semibold">Notificaciones escolares</p>
                <p className="mt-1.5 leading-relaxed text-muted-foreground">
                  {profile.unreadNotificationsCount > 0
                    ? `Tienes ${profile.unreadNotificationsCount} aviso(s) institucional(es) pendiente(s).`
                    : "No tienes notificaciones pendientes en este momento."}
                </p>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>

          {/* 2. Efecto Cristal */}
          <GlassCustomizer
            side="right"
            align="end"
            trigger={
              <button
                type="button"
                onMouseEnter={() => setHoveredUtilId("glass")}
                onFocus={() => setHoveredUtilId("glass")}
                aria-label="Personalizar efecto cristal"
                title={expanded ? undefined : "Efecto cristal"}
                className={cn(
                  "relative z-10 flex h-9.5 cursor-pointer items-center rounded-xl text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none",
                  expanded
                    ? "w-full gap-2.5 px-3"
                    : "mx-auto w-10 justify-center"
                )}
              >
                {hoveredUtilId === "glass" ? (
                  <motion.span
                    layoutId={`siga-util-pill-${rawUid}`}
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    className="siga-curved-sub-pill pointer-events-none absolute inset-0 -z-10 rounded-xl"
                  />
                ) : null}
                <SlidersHorizontal
                  className="size-4 shrink-0"
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
                {expanded ? (
                  <span className="truncate">Efecto cristal</span>
                ) : null}
              </button>
            }
          />

          {/* 3. Modo Claro / Oscuro */}
          <button
            type="button"
            onClick={handleToggleTheme}
            onMouseEnter={() => setHoveredUtilId("theme")}
            onFocus={() => setHoveredUtilId("theme")}
            aria-label={
              isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"
            }
            aria-pressed={isDark}
            title={
              expanded
                ? undefined
                : isDark
                  ? "Cambiar a modo claro"
                  : "Cambiar a modo oscuro"
            }
            className={cn(
              "relative z-10 flex h-9.5 cursor-pointer items-center rounded-xl text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none",
              expanded ? "w-full gap-2.5 px-3" : "mx-auto w-10 justify-center"
            )}
          >
            {hoveredUtilId === "theme" ? (
              <motion.span
                layoutId={`siga-util-pill-${rawUid}`}
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
                className="siga-curved-sub-pill pointer-events-none absolute inset-0 -z-10 rounded-xl"
              />
            ) : null}
            {isDark ? (
              <Sun
                className="size-4 shrink-0"
                strokeWidth={1.8}
                aria-hidden="true"
              />
            ) : (
              <Moon
                className="size-4 shrink-0"
                strokeWidth={1.8}
                aria-hidden="true"
              />
            )}
            {expanded ? (
              <span className="truncate">
                {isDark ? "Modo claro" : "Modo oscuro"}
              </span>
            ) : null}
          </button>

          {/* 4. Cerrar sesión */}
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            onMouseEnter={() => setHoveredUtilId("signout")}
            onFocus={() => setHoveredUtilId("signout")}
            aria-label="Cerrar sesión"
            title={expanded ? undefined : "Cerrar sesión"}
            className={cn(
              "relative z-10 flex h-9.5 cursor-pointer items-center rounded-xl text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none disabled:opacity-60",
              expanded ? "w-full gap-2.5 px-3" : "mx-auto w-10 justify-center"
            )}
          >
            {hoveredUtilId === "signout" ? (
              <motion.span
                layoutId={`siga-util-pill-${rawUid}`}
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
                className="siga-curved-sub-pill pointer-events-none absolute inset-0 -z-10 rounded-xl"
              />
            ) : null}
            {signingOut ? (
              <Loader2
                className="size-4 shrink-0 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <LogOut
                className="size-4 shrink-0"
                strokeWidth={1.8}
                aria-hidden="true"
              />
            )}
            {expanded ? <span className="truncate">Cerrar sesión</span> : null}
          </button>
        </div>
      </div>
    </aside>
  );
}

"use client";

import * as React from "react";
import { AnimatePresence, motion, useSpring } from "motion/react";
import { cn } from "cn";

export interface AdaptiveNavItem<T extends string = string> {
  label: string;
  id: T;
}

export interface AdaptiveNavigationPillProps<T extends string = string> {
  items?: ReadonlyArray<AdaptiveNavItem<T>>;
  activeId?: T;
  onSelect?: (id: T) => void;
  collapsedWidth?: number;
  expandedWidth?: number;
  className?: string;
}

const DEFAULT_ITEMS: ReadonlyArray<AdaptiveNavItem<string>> = [
  { label: "Bienvenida", id: "overview" },
  { label: "Mis Cursos", id: "courses" },
  { label: "Laboratorios", id: "labs" },
];

/**
 * 3D Adaptive Navigation Pill — Edición Glassmorphism (Modo Claro y Modo Oscuro).
 * - Expansión suave con física `useSpring` al pasar el cursor.
 * - Transparencia real de cristal esmerilado (`backdrop-blur-2xl`) sin fondo blanco opaco
 *   ni barras de desplazamiento internas al desplegarse.
 */
export function AdaptiveNavigationPill<T extends string = string>({
  items,
  activeId,
  onSelect,
  collapsedWidth = 176,
  expandedWidth = 420,
  className,
}: AdaptiveNavigationPillProps<T>) {
  const navItems = (items ?? DEFAULT_ITEMS) as ReadonlyArray<
    AdaptiveNavItem<T>
  >;
  const [internalActive, setInternalActive] = React.useState<T>(
    () => activeId ?? navItems[0]!.id
  );
  const currentActive = activeId ?? internalActive;

  const [expanded, setExpanded] = React.useState(false);
  const [hovering, setHovering] = React.useState(false);
  const [isTransitioning, setIsTransitioning] = React.useState(false);
  const hoverTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const pillWidth = useSpring(collapsedWidth, {
    stiffness: 240,
    damping: 26,
    mass: 0.95,
  });

  React.useEffect(() => {
    const targetExpanded =
      typeof window !== "undefined"
        ? Math.min(expandedWidth, Math.max(280, window.innerWidth - 36))
        : expandedWidth;

    if (hovering) {
      setExpanded(true);
      pillWidth.set(targetExpanded);
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    } else {
      hoverTimeoutRef.current = setTimeout(() => {
        setExpanded(false);
        pillWidth.set(collapsedWidth);
      }, 450);
    }

    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, [collapsedWidth, expandedWidth, hovering, pillWidth]);

  const handleSectionClick = (sectionId: T) => {
    setIsTransitioning(true);
    setInternalActive(sectionId);
    onSelect?.(sectionId);
    setHovering(false);

    setTimeout(() => {
      setIsTransitioning(false);
    }, 350);
  };

  const activeItem =
    navItems.find((item) => item.id === currentActive) ?? navItems[0];

  return (
    <motion.nav
      aria-label="Navegación adaptativa del Aula Virtual"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocus={() => setHovering(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setHovering(false);
        }
      }}
      style={{ width: pillWidth }}
      className={cn(
        "relative h-[50px] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-full border backdrop-blur-2xl transition-[box-shadow,border-color,background-color] duration-300 select-none",
        // Modo Claro: cristal translúcido perlado con borde especular
        "border-white/75 bg-white/42 text-slate-900 shadow-[0_10px_30px_-8px_rgba(15,35,86,0.18),inset_0_1px_1px_rgba(255,255,255,0.9),inset_0_-2px_6px_rgba(28,71,196,0.08)]",
        // Modo Oscuro: cristal translúcido obsidiana-cobalto con borde cian sutil
        "dark:border-sky-300/25 dark:bg-[#0a1428]/48 dark:text-white dark:shadow-[0_12px_34px_-8px_rgba(0,0,0,0.65),inset_0_1px_1px_rgba(255,255,255,0.22),inset_0_-2px_8px_rgba(56,189,248,0.10)]",
        expanded &&
          "border-white/90 bg-white/55 dark:border-sky-300/40 dark:bg-[#0c1830]/60",
        isTransitioning && "scale-[0.99]",
        className
      )}
    >
      {/* Filete especular superior de cristal */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-3 top-0 h-[1.5px] rounded-full bg-gradient-to-r from-transparent via-white/95 to-transparent dark:via-sky-200/70"
      />

      {/* Reflejo hemisférico superior */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-full bg-gradient-to-b from-white/45 to-transparent dark:from-white/12"
      />

      {/* Destello elíptico diagonal tipo lente de cristal */}
      <div
        aria-hidden="true"
        style={{
          left: expanded ? "16%" : "14%",
          width: expanded ? "120px" : "56px",
        }}
        className="pointer-events-none absolute top-1.5 h-3 -rotate-12 rounded-full bg-white/45 blur-[3px] transition-all duration-300 dark:bg-sky-300/20"
      />

      {/* Contenedor interno sin barras de scroll */}
      <div className="relative z-10 flex h-full w-full items-center justify-center px-4">
        {!expanded ? (
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="size-2 rounded-full bg-primary shadow-[0_0_8px_currentColor] dark:bg-cyan-300"
            />
            <AnimatePresence mode="wait">
              {activeItem ? (
                <motion.span
                  key={activeItem.id}
                  initial={{ opacity: 0, y: 7, filter: "blur(4px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -7, filter: "blur(4px)" }}
                  transition={{
                    duration: 0.28,
                    ease: [0.4, 0.0, 0.2, 1],
                  }}
                  className="text-[14px] font-semibold tracking-[0.02em] whitespace-nowrap text-slate-900 dark:text-white"
                >
                  {activeItem.label}
                </motion.span>
              ) : null}
            </AnimatePresence>
          </div>
        ) : (
          <div className="flex w-full items-center justify-evenly gap-1">
            {navItems.map((item, index) => {
              const isActive = item.id === currentActive;

              return (
                <motion.button
                  key={item.id}
                  type="button"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{
                    delay: index * 0.05,
                    duration: 0.2,
                    ease: "easeOut",
                  }}
                  onClick={() => handleSectionClick(item.id)}
                  className={cn(
                    "relative cursor-pointer rounded-full px-3.5 py-1.5 text-[13.5px] tracking-[0.015em] whitespace-nowrap transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none",
                    isActive
                      ? "bg-primary/14 font-semibold text-primary shadow-2xs dark:bg-sky-400/20 dark:text-cyan-200"
                      : "font-medium text-slate-600 hover:bg-white/40 hover:text-slate-950 dark:text-slate-300/85 dark:hover:bg-white/10 dark:hover:text-white"
                  )}
                >
                  {item.label}
                </motion.button>
              );
            })}
          </div>
        )}
      </div>
    </motion.nav>
  );
}

export const PillBase: React.FC = () => {
  return <AdaptiveNavigationPill />;
};

"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import type Lenis from "lenis";
import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
  Pause,
  Play,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  GoogleWorkspaceGlyph,
  SigaCredentialsFields,
  resolveAuthErrorMessage,
} from "@/components/auth/SigaCredentialsFields";
import { startGoogleWorkspaceOAuth } from "@/lib/auth/client";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { cn } from "@/lib/utils";
import { AtmosphericGradient } from "./AtmosphericGradient";
import {
  CORE_HIGHLIGHT_ROWS,
  ROLE_MODULES,
  SPONSORS,
} from "./siga-landing-data";

const SponsorWarpCarousel = dynamic(() =>
  import("./SponsorWarpCarousel").then((m) => m.SponsorWarpCarousel)
);

const HalftoneWordmarkFooter = dynamic(() =>
  import("@/components/ui/halftone-wordmark-footer").then(
    (m) => m.HalftoneWordmarkFooter
  )
);

const STATUS_DOT: Record<"ok" | "accent" | "neutral", string> = {
  ok: "bg-[#2e8b3d]",
  accent: "bg-primary",
  neutral: "bg-muted-foreground/50",
};

/* ---------- Primitivas de Animación por Scroll (Air + Baseline) ---------- */
function StackedLines({
  lines,
  baseDelay = 0,
  stagger = 120,
  duration = 950,
  className = "",
}: {
  lines: string[];
  baseDelay?: number;
  stagger?: number;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold: 0.16 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <span ref={ref} className={cn("block", className)}>
      {lines.map((line, i) => (
        <span key={`${line}-${i}`} className="clip-line-wrap block">
          <span
            className={cn("clip-line-inner block", inView && "is-revealed")}
            style={{
              transitionDuration: `${duration}ms`,
              transitionDelay: `${baseDelay + i * stagger}ms`,
            }}
          >
            {line}
          </span>
        </span>
      ))}
    </span>
  );
}

function WordFadeText({
  text,
  delayIn = 160,
  wordStagger = 24,
  duration = 700,
  className = "",
}: {
  text: string;
  delayIn?: number;
  wordStagger?: number;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold: 0.18 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const words = text.split(" ");

  return (
    <p ref={ref} className={className}>
      {words.map((word, idx) => (
        <React.Fragment key={`${word}-${idx}`}>
          <span
            className={cn("word-fade-inner", inView && "is-revealed")}
            style={{
              transitionDuration: `${duration}ms`,
              transitionDelay: `${delayIn + idx * wordStagger}ms`,
            }}
          >
            {word}
          </span>
          {idx < words.length - 1 ? " " : ""}
        </React.Fragment>
      ))}
    </p>
  );
}

function InviewReveal({
  children,
  delayIn = 0,
  fromY = 28,
  fromScale = 1,
  className = "",
}: {
  children: React.ReactNode;
  delayIn?: number;
  fromY?: number;
  fromScale?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold: 0.14 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn("siga-inview-reveal", className)}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView
          ? "translate3d(0, 0px, 0) scale(1)"
          : `translate3d(0, ${fromY}px, 0) scale(${fromScale})`,
        transition: `opacity 760ms cubic-bezier(0.22, 1, 0.36, 1) ${delayIn}ms, transform 820ms cubic-bezier(0.22, 1, 0.36, 1) ${delayIn}ms`,
      }}
    >
      {children}
    </div>
  );
}

export function SigaBaselineLanding() {
  const [heroReady, setHeroReady] = useState(false);
  const [isDarkTheme, setIsDarkTheme] = useState(false);
  const [activeRoleIdx, setActiveRoleIdx] = useState(0);
  const [isAutoPlayPaused, setIsAutoPlayPaused] = useState(false);
  const [pillMorphing, setPillMorphing] = useState(false);
  const [pillMetrics, setPillMetrics] = useState<{ left: number; width: number }>({
    left: 6,
    width: 118,
  });
  const [activeSponsorIdx, setActiveSponsorIdx] = useState(0);
  const [heroCredsOpen, setHeroCredsOpen] = useState(false);
  const [googlePending, setGooglePending] = useState(false);
  const [heroAuthError, setHeroAuthError] = useState<string | null>(null);

  const lenisRef = useRef<Lenis | null>(null);
  const tabButtonsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const stage3DRef = useRef<HTMLDivElement>(null);
  const googleLockRef = useRef(false);
  const heroIdentifierRef = useRef<HTMLInputElement | null>(null);

  const activeRole = ROLE_MODULES[activeRoleIdx] ?? ROLE_MODULES[0];
  const activeSponsor = SPONSORS[activeSponsorIdx] ?? SPONSORS[0];

  const handleDirectGoogleLogin = useCallback(async () => {
    if (googleLockRef.current) return;
    googleLockRef.current = true;
    setHeroAuthError(null);
    setGooglePending(true);

    const result = await startGoogleWorkspaceOAuth("/");
    if (!result.ok) {
      setHeroAuthError(result.message);
      setGooglePending(false);
      googleLockRef.current = false;
      if (lenisRef.current) {
        lenisRef.current.scrollTo(0);
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }
  }, []);

  const toggleHeroCreds = useCallback(() => {
    setHeroCredsOpen((prev) => {
      const next = !prev;
      if (next) {
        window.setTimeout(() => {
          heroIdentifierRef.current?.focus({ preventScroll: true });
        }, 200);
      }
      return next;
    });
  }, []);

  const openHeroCredsFromSection = useCallback(() => {
    setHeroCredsOpen(true);
    if (lenisRef.current) {
      lenisRef.current.scrollTo(0);
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    window.setTimeout(() => {
      heroIdentifierRef.current?.focus({ preventScroll: true });
    }, 360);
  }, []);

  /* Si Google OAuth devolvió error (ej. dominio externo), mostrar aviso en el Hero */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("auth_error");
    if (!code) return;

    const msg = resolveAuthErrorMessage(code);
    if (msg) {
      setHeroAuthError(msg);
    }

    params.delete("auth_error");
    const nextSearch = params.toString();
    const cleanedUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash}`;
    window.history.replaceState(null, "", cleanedUrl);
  }, []);

  /* Permitir cerrar los campos desplegados con Esc */
  useEffect(() => {
    if (!heroCredsOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setHeroCredsOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [heroCredsOpen]);

  /* Sincronizar estado visual Claro / Oscuro con el DOM raíz */
  useEffect(() => {
    const syncTheme = () => {
      setIsDarkTheme(document.documentElement.classList.contains("dark"));
    };
    syncTheme();

    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  /* Inicializar desplazamiento suave (Lenis) en diferido tras el primer pintado */
  useEffect(() => {
    const t = window.setTimeout(() => setHeroReady(true), 40);
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reducedMotion) {
      return () => window.clearTimeout(t);
    }

    let cancelled = false;
    let lenisInstance: Lenis | null = null;
    let lenisRafId = 0;
    let idleTimerId = 0;

    const startLenis = async () => {
      try {
        const { default: LenisCtor } = await import("lenis");
        if (cancelled) return;
        const lenis = new LenisCtor({ smoothWheel: true });
        lenisInstance = lenis;
        lenisRef.current = lenis;

        const raf = (time: number) => {
          if (cancelled || document.visibilityState !== "visible") {
            lenisRafId = 0;
            return;
          }
          lenis.raf(time);
          lenisRafId = window.requestAnimationFrame(raf);
        };

        const onVis = () => {
          if (
            document.visibilityState === "visible" &&
            !cancelled &&
            lenisRafId === 0
          ) {
            lenisRafId = window.requestAnimationFrame(raf);
          }
        };

        document.addEventListener("visibilitychange", onVis);
        lenisRafId = window.requestAnimationFrame(raf);

        return () => {
          document.removeEventListener("visibilitychange", onVis);
        };
      } catch {
        return undefined;
      }
    };

    let removeVisListener: (() => void) | undefined;
    if (typeof window.requestIdleCallback === "function") {
      idleTimerId = window.requestIdleCallback(
        () => {
          void startLenis().then((cleanup) => {
            removeVisListener = cleanup;
          });
        },
        { timeout: 600 }
      );
    } else {
      idleTimerId = window.setTimeout(() => {
        void startLenis().then((cleanup) => {
          removeVisListener = cleanup;
        });
      }, 180);
    }

    return () => {
      cancelled = true;
      window.clearTimeout(t);
      if (typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleTimerId);
      } else {
        window.clearTimeout(idleTimerId);
      }
      removeVisListener?.();
      window.cancelAnimationFrame(lenisRafId);
      lenisInstance?.destroy();
      lenisRef.current = null;
    };
  }, []);

  /* Medir posición exacta de la píldora activa del TabBar */
  const updatePillGeometry = useCallback((idx: number) => {
    const btn = tabButtonsRef.current[idx];
    if (!btn) return;
    setPillMetrics({
      left: btn.offsetLeft,
      width: btn.offsetWidth,
    });
  }, []);

  useEffect(() => {
    updatePillGeometry(activeRoleIdx);
    const onResize = () => updatePillGeometry(activeRoleIdx);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [activeRoleIdx, updatePillGeometry]);

  const selectRole = useCallback((idx: number) => {
    setPillMorphing(true);
    setActiveRoleIdx(idx);
    window.setTimeout(() => setPillMorphing(false), 280);
  }, []);

  /* Auto-avance de 5 segundos entre pestañas */
  useEffect(() => {
    if (isAutoPlayPaused) return;
    const timer = window.setTimeout(() => {
      selectRole((activeRoleIdx + 1) % ROLE_MODULES.length);
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [activeRoleIdx, isAutoPlayPaused, selectRole]);

  /* Inclinación 3D con el mouse */
  const handleStageMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = stage3DRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    const ry = (nx * 7.0).toFixed(2);
    const rx = (-ny * 6.0).toFixed(2);
    el.style.setProperty("--rx", `${rx}deg`);
    el.style.setProperty("--ry", `${ry}deg`);
  };

  const handleStageMouseLeave = () => {
    const el = stage3DRef.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  };

  const handleAnchorClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    href: string
  ) => {
    if (!href.startsWith("#")) return;
    e.preventDefault();
    const target = document.querySelector(href);
    if (target && lenisRef.current) {
      lenisRef.current.scrollTo(target as HTMLElement, { offset: -16 });
    } else if (target) {
      target.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* ==================== SECCIÓN 1: HERO ATMOSFÉRICO ==================== */}
      <section
        aria-labelledby="hero-title"
        className="relative isolate flex min-h-[100svh] flex-col justify-between overflow-hidden"
      >
        <AtmosphericGradient />

        {/* Barra superior limpia: S.I.G.A. + logotipo en el centro | Claro/Oscuro + "Entrar a SIGA" a la derecha */}
        <header className="relative z-30 mx-auto w-full max-w-7xl px-4 pt-5 sm:px-8 sm:pt-6">
          <div className="flex items-center justify-between gap-3 md:grid md:grid-cols-12">
            {/* Espaciador izquierdo para centrar S.I.G.A. */}
            <div className="hidden md:col-span-4 md:block" aria-hidden="true" />

            {/* Columna Central: Únicamente S.I.G.A. con el logotipo de la E.T.C. Andrés Bello */}
            <div className="flex items-center justify-start md:col-span-4 md:justify-center">
              <Link
                href="/"
                aria-label="S.I.G.A. — E.T.C. Andrés Bello"
                className="air-logo-mark inline-flex items-center gap-2.5 rounded-full px-2 py-1 text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
              >
                <span className="relative inline-flex size-7 items-center justify-center">
                  <svg
                    viewBox="0 0 28 28"
                    className="absolute inset-0 size-full -rotate-90"
                    fill="none"
                    aria-hidden="true"
                  >
                    <circle
                      cx="14"
                      cy="14"
                      r="12"
                      stroke="rgba(255,255,255,0.22)"
                      strokeWidth="1.25"
                    />
                    <circle
                      cx="14"
                      cy="14"
                      r="12"
                      stroke="#7dd3fc"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      className="air-logo-ring"
                    />
                  </svg>
                  <Image
                    src="/images/institucion/logotipo.webp"
                    alt='Escudo de la E.T.C. "Andrés Bello"'
                    width={22}
                    height={22}
                    className="size-5.5 rounded-full bg-white/95 object-contain p-0.5"
                    priority
                  />
                </span>

                <span className="font-hero text-[15px] font-semibold tracking-[0.22em] text-white uppercase">
                  S.I.G.A.
                </span>
                <span
                  aria-hidden="true"
                  className="air-logo-dot -ml-1.5 size-1.5 rounded-full bg-[#7dd3fc]"
                />
              </Link>
            </div>

            {/* Columna Derecha: Interruptor Claro/Oscuro (encabezado minimalista sin botón extra) */}
            <div className="flex shrink-0 items-center justify-end md:col-span-4">
              <ThemeToggle className="size-8.5 shrink-0 border-white/20 bg-white/10 text-white backdrop-blur-md hover:bg-white/20 focus-visible:outline-white" />
            </div>
          </div>
        </header>

        {/* Titular principal + acceso minimalista directo debajo */}
        <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-6 py-10 text-center">
          <h1
            id="hero-title"
            className="font-hero text-[5.7vw] leading-[1.12] font-medium tracking-[0.004em] text-white sm:text-[2.85rem] md:text-[3.35rem]"
          >
            <span className="clip-line-wrap block">
              <span
                className={cn(
                  "clip-line-inner block whitespace-nowrap",
                  heroReady && "is-revealed"
                )}
                style={{ transitionDuration: "1050ms", transitionDelay: "80ms" }}
              >
                El corazón académico del
              </span>
            </span>
            <span className="clip-line-wrap block">
              <span
                className={cn(
                  "clip-line-inner block whitespace-nowrap",
                  heroReady && "is-revealed"
                )}
                style={{
                  transitionDuration: "1050ms",
                  transitionDelay: "220ms",
                }}
              >
                Andrés Bello,{" "}
                <em className="font-semibold italic">ahora</em> digital
              </span>
            </span>
          </h1>

          {/* Acciones directas minimalistas debajo del titular */}
          <div
            className={cn(
              "air-phrase-reveal mt-7 flex w-full max-w-[20.5rem] flex-col items-center",
              heroReady && "is-visible"
            )}
            style={{ transitionDelay: "340ms" }}
          >
            {heroAuthError ? (
              <div
                role="alert"
                aria-live="polite"
                className="mb-3.5 flex w-full items-start gap-2 rounded-xl border border-red-400/40 bg-red-950/70 px-3 py-2 text-left text-xs leading-relaxed text-red-100 backdrop-blur-md"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-300" aria-hidden="true" />
                <span>{heroAuthError}</span>
              </div>
            ) : null}

            <button
              type="button"
              onClick={handleDirectGoogleLogin}
              disabled={googlePending}
              className="air-btn-primary inline-flex h-11 cursor-pointer items-center justify-center rounded-full bg-white px-6 text-[13.5px] font-medium text-[#020617] shadow-[0_14px_34px_-12px_rgba(2,6,23,0.65)] transition-all hover:bg-white/95 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white disabled:pointer-events-none disabled:opacity-60"
            >
              <span className="!gap-2.5 whitespace-nowrap">
                {googlePending ? (
                  <Loader2 className="size-4 animate-spin text-[#1c47c4]" aria-hidden="true" />
                ) : (
                  <GoogleWorkspaceGlyph />
                )}
                <span>Ingresar con Google</span>
              </span>
            </button>

            <button
              type="button"
              onClick={toggleHeroCreds}
              aria-expanded={heroCredsOpen}
              aria-controls="siga-hero-creds-panel"
              className="mt-3 inline-flex cursor-pointer items-center gap-1.5 py-1 text-xs font-medium tracking-[0.01em] text-white/80 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
            >
              <span>Usar correo y contraseña</span>
              <ChevronDown
                className={cn(
                  "size-3.5 transition-transform duration-300",
                  heroCredsOpen && "rotate-180"
                )}
                aria-hidden="true"
              />
            </button>

            {/* Despliegue limpio con únicamente correo/cédula y contraseña */}
            <div
              id="siga-hero-creds-panel"
              data-state={heroCredsOpen ? "open" : "closed"}
              aria-hidden={!heroCredsOpen}
              inert={!heroCredsOpen ? true : undefined}
              className="siga-creds-fold w-full"
            >
              <div className="siga-creds-fold-inner">
                <div className="siga-creds-fold-content pt-3.5">
                  <div className="siga-sheen-card relative overflow-hidden rounded-2xl border border-white/22 bg-[#06112d]/76 p-5 text-left shadow-[0_24px_60px_-16px_rgba(2,6,23,0.75)] backdrop-blur-xl">
                    <SigaCredentialsFields
                      identifierInputRef={heroIdentifierRef}
                      onErrorMessage={setHeroAuthError}
                      disabled={googlePending}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Fila inferior alineada correctamente */}
        <div
          className={cn(
            "air-phrase-reveal relative z-10 mx-auto flex w-full max-w-7xl flex-col items-start justify-between gap-4 px-5 pb-7 sm:flex-row sm:items-end sm:px-8 sm:pb-9",
            heroReady && "is-visible"
          )}
          style={{ transitionDelay: "420ms" }}
        >
          <div className="hidden lg:block lg:w-36" aria-hidden="true" />
          <p className="font-hero max-w-md text-[13.5px] leading-relaxed font-medium tracking-[0.005em] text-[#090d16] drop-shadow-[0_1px_1px_rgba(255,255,255,0.65)] transition-colors dark:font-normal dark:text-slate-100 dark:drop-shadow-[0_1px_2px_rgba(2,6,23,0.75)]">
            SIGA reúne notas, aulas virtuales, biblioteca, pasantías de 6.º año
            y documentos académicos para la E.T.C. &ldquo;Andrés Bello&rdquo; en
            Puerto Ordaz.
          </p>
          <div className="flex items-center gap-5 self-end sm:self-auto">
            <a
              href="#funciones"
              onClick={(e) => handleAnchorClick(e, "#funciones")}
              className="group font-hero inline-flex items-center gap-1.5 text-[13.5px] font-medium tracking-[0.01em] text-[#090d16] transition-colors hover:text-primary dark:text-white dark:hover:text-[#7dd3fc]"
            >
              <span>Explorar SIGA</span>
              <ChevronRight
                className="size-3.5 transition-transform duration-200 group-hover:translate-x-1"
                aria-hidden="true"
              />
            </a>
          </div>
        </div>
      </section>

      {/* ==================== CAPA SÓLIDA DE CONTENIDO (CERO MANCHAS O SOLAPAMIENTOS) ==================== */}
      <div className="relative z-20 bg-background transition-colors">
        {/* ==================== SECCIÓN 2: PLATAFORMA ACADÉMICA ==================== */}
        <section
          id="funciones"
          aria-labelledby="funciones-title"
          className="relative isolate mx-auto w-full max-w-6xl px-5 pt-20 pb-24 sm:px-8 sm:pt-28 sm:pb-28"
        >
          <div
            aria-hidden="true"
            className="air-dot-grid pointer-events-none absolute inset-x-0 top-10 -z-10 h-[560px]"
          />

          <div className="mb-12 flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div className="max-w-xl">
              <span className="inline-flex items-center gap-2 text-xs font-medium tracking-[0.2em] text-primary uppercase">
                <span
                  className="size-1.5 rounded-full bg-primary"
                  aria-hidden="true"
                />
                Plataforma escolar unificada
              </span>
              <h2
                id="funciones-title"
                className="mt-3 font-sans text-3xl leading-[1.1] font-normal tracking-[0.005em] text-foreground sm:text-4xl md:text-[2.6rem]"
              >
                <StackedLines
                  lines={["Todo lo necesario para", "el día a día del liceo"]}
                />
              </h2>
            </div>

            <WordFadeText
              text="Sin menús complicados ni trámites repetidos: elige tu rol o deja que el recorrido avance solo para ver cómo SIGA simplifica tu rutina."
              className="max-w-sm text-sm leading-relaxed tracking-[0.012em] text-muted-foreground"
            />
          </div>

          {/* Barra de pestañas con píldora elástica + barra de progreso de 5s */}
          <InviewReveal delayIn={80} fromY={24}>
            <div
              onMouseEnter={() => setIsAutoPlayPaused(true)}
              onMouseLeave={() => setIsAutoPlayPaused(false)}
              className="flex flex-col gap-7"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div
                  role="tablist"
                  aria-label="Roles de S.I.G.A."
                  className="relative inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-border bg-card/90 p-1.5 shadow-sm backdrop-blur-md"
                >
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1.5 bottom-1.5 left-0 overflow-hidden rounded-full bg-[#090d16] shadow-sm transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] dark:bg-white"
                    style={{
                      transform: `translate3d(${pillMetrics.left}px, 0, 0) scale(${
                        pillMorphing ? "1.08, 0.9" : "1, 1"
                      })`,
                      width: `${pillMetrics.width}px`,
                    }}
                  >
                    <span
                      key={`${activeRole.id}-${isAutoPlayPaused ? "paused" : "play"}`}
                      className={cn(
                        "air-tab-progress-bar absolute inset-x-0 bottom-0 h-[2.5px] bg-[#38bdf8] dark:bg-primary",
                        isAutoPlayPaused && "air-tab-progress-paused"
                      )}
                    />
                  </div>

                  {ROLE_MODULES.map((role, idx) => {
                    const isActive = idx === activeRoleIdx;
                    return (
                      <button
                        key={role.id}
                        ref={(el) => {
                          tabButtonsRef.current[idx] = el;
                        }}
                        role="tab"
                        type="button"
                        aria-selected={isActive}
                        onClick={() => selectRole(idx)}
                        className={cn(
                          "relative z-10 shrink-0 rounded-full px-4 py-2 text-xs font-medium tracking-[0.015em] transition-colors duration-200 sm:text-[13px]",
                          isActive
                            ? "text-white dark:text-[#020617]"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {role.label}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => setIsAutoPlayPaused((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-[11px] font-medium tracking-[0.015em] text-muted-foreground transition-colors hover:text-foreground"
                >
                  {isAutoPlayPaused ? (
                    <>
                      <Play className="size-3 text-primary" />
                      <span>Reanudar recorrido</span>
                    </>
                  ) : (
                    <>
                      <Pause className="size-3 text-primary" />
                      <span>Recorrido automático (5s)</span>
                    </>
                  )}
                </button>
              </div>

              {/* Escenario 3D con inclinación del mouse + Borde luminoso giratorio */}
              <div
                onMouseMove={handleStageMouseMove}
                onMouseLeave={handleStageMouseLeave}
                className="air-3d-perspective relative py-2"
              >
                <div ref={stage3DRef} className="air-3d-card relative">
                  <div
                    aria-hidden="true"
                    className="air-3d-layer-back pointer-events-none absolute -inset-x-3 -top-3 bottom-3 hidden rounded-3xl border border-primary/15 bg-gradient-to-b from-primary/5 to-transparent dark:border-white/10 dark:from-white/[0.04] lg:block"
                  />

                  <div className="air-animated-border-spin rounded-2xl shadow-lg">
                    <div
                      key={activeRole.id}
                      className="relative z-10 grid items-stretch gap-8 rounded-[15px] bg-card p-6 sm:p-10 lg:grid-cols-12"
                    >
                      <div className="flex flex-col justify-between gap-6 lg:col-span-7">
                        <div className="flex flex-col gap-3">
                          <div className="flex flex-wrap items-center gap-2.5">
                            <Badge
                              variant="secondary"
                              className="w-fit font-normal tracking-[0.015em]"
                            >
                              {activeRole.eyebrow}
                            </Badge>
                            <span className="text-xs tracking-[0.04em] text-muted-foreground">
                              0{activeRoleIdx + 1} / 0{ROLE_MODULES.length}
                            </span>
                          </div>

                          <h3 className="font-sans text-xl leading-snug font-normal tracking-[0.005em] text-foreground sm:text-2xl md:text-[1.65rem]">
                            {activeRole.title}
                          </h3>

                          <p className="max-w-xl text-sm leading-relaxed tracking-[0.012em] text-muted-foreground sm:text-[15px]">
                            {activeRole.summary}
                          </p>
                        </div>

                        <ul className="flex flex-col gap-3.5 pt-2">
                          {activeRole.features.map((feat, fIdx) => (
                            <li
                              key={feat}
                              style={{ transitionDelay: `${fIdx * 60}ms` }}
                              className="flex items-start gap-3 text-sm leading-relaxed tracking-[0.01em] text-foreground/90"
                            >
                              <CheckCircle2
                                className="mt-0.5 size-4 shrink-0 text-primary"
                                aria-hidden="true"
                              />
                              <span>{feat}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Panel derecho flotante en Z */}
                      <div className="air-3d-layer-front flex flex-col justify-between rounded-xl border border-border bg-background p-6 shadow-md lg:col-span-5">
                        <div className="flex items-center justify-between gap-2 border-b border-border pb-4">
                          <div className="flex flex-col gap-1">
                            <p className="text-sm font-medium tracking-[0.01em] text-foreground">
                              {activeRole.previewTitle}
                            </p>
                            <p className="text-xs tracking-[0.012em] text-muted-foreground">
                              {activeRole.previewSubtitle}
                            </p>
                          </div>
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium tracking-[0.015em] text-primary">
                            <Sparkles className="size-3" aria-hidden="true" />
                            En vivo
                          </span>
                        </div>

                        <div className="my-5 flex flex-col gap-3">
                          {activeRole.previewItems.map((item) => (
                            <div
                              key={item.label}
                              className="flex items-center justify-between gap-3 rounded-lg border border-border/80 bg-card px-3.5 py-2.5 shadow-2xs transition-transform duration-200 md:hover:-translate-y-0.5"
                            >
                              <span className="text-xs tracking-[0.012em] text-muted-foreground">
                                {item.label}
                              </span>
                              <span className="inline-flex items-center gap-2 text-right text-xs font-medium tracking-[0.01em] text-foreground">
                                <span
                                  className={cn(
                                    "size-1.5 rounded-full",
                                    STATUS_DOT[item.status ?? "neutral"]
                                  )}
                                  aria-hidden="true"
                                />
                                {item.value}
                              </span>
                            </div>
                          ))}
                        </div>

                        <div className="flex items-center justify-between text-[11px] tracking-[0.012em] text-muted-foreground">
                          <span>Mueve el cursor para inclinar la vista</span>
                          <button
                            type="button"
                            onClick={handleDirectGoogleLogin}
                            disabled={googlePending}
                            className="cursor-pointer font-medium text-primary hover:underline disabled:opacity-60"
                          >
                            Ingresar con Google →
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </InviewReveal>

          {/* 3 Tarjetas clave con bordes luminosos */}
          <div id="pilares" className="mt-16 grid gap-5 md:grid-cols-3">
            {CORE_HIGHLIGHT_ROWS.map((row, idx) => {
              const isExternal = row.href.startsWith("http");
              return (
                <InviewReveal key={row.index} delayIn={idx * 110} fromY={24}>
                  <Link
                    href={row.href}
                    target={isExternal ? "_blank" : undefined}
                    rel={isExternal ? "noopener noreferrer" : undefined}
                    className="air-animated-border group flex h-full flex-col justify-between gap-6 rounded-2xl border border-border/80 bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
                  >
                    <div className="flex flex-col gap-3.5">
                      <div className="flex items-center justify-between">
                        <span className="font-display text-xs font-medium tracking-[0.18em] text-primary">
                          {row.index}
                        </span>
                        <span className="inline-flex size-8 items-center justify-center rounded-full border border-border bg-background text-foreground transition-colors group-hover:border-primary/40 group-hover:text-primary">
                          <ChevronRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                        </span>
                      </div>
                      <h3 className="font-sans text-lg leading-snug font-medium tracking-[0.008em] text-foreground transition-colors group-hover:text-primary">
                        {row.name}
                      </h3>
                      <p className="text-sm leading-relaxed tracking-[0.014em] text-muted-foreground">
                        {row.description}
                      </p>
                    </div>
                  </Link>
                </InviewReveal>
              );
            })}
          </div>
        </section>

        {/* ==================== SECCIÓN 3: POWERED BY / IMPULSADO POR (WARP CAROUSEL 3D INTEGRADO) ==================== */}
        <section
          id="aliados"
          aria-labelledby="aliados-title"
          className="bg-background py-16 transition-colors sm:py-24"
        >
          <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
            <div className="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <div className="max-w-xl">
                <span className="inline-flex items-center gap-2 text-xs font-medium tracking-[0.2em] text-primary uppercase">
                  <span
                    className="size-1.5 rounded-full bg-primary"
                    aria-hidden="true"
                  />
                  Powered by / Impulsado por
                </span>
                <h2
                  id="aliados-title"
                  className="mt-3 font-sans text-3xl leading-[1.1] font-normal tracking-[0.005em] text-foreground sm:text-4xl"
                >
                  <StackedLines
                    lines={[
                      "Impulsado por plataformas",
                      "de clase mundial",
                    ]}
                  />
                </h2>
              </div>

              <WordFadeText
                text="Plataformas tecnológicas, herramientas de desarrollo e infraestructura abierta con las que está impulsado S.I.G.A. sin fines de lucro."
                className="max-w-sm text-sm leading-relaxed tracking-[0.012em] text-muted-foreground"
              />
            </div>
          </div>

          {/* Carrusel 3D WebGL fundido directamente con el fondo de la página */}
          <InviewReveal delayIn={70} fromY={24}>
            <div className="mx-auto w-full max-w-7xl px-2 sm:px-6">
              <SponsorWarpCarousel
                sponsors={SPONSORS}
                index={activeSponsorIdx}
                onIndexChange={setActiveSponsorIdx}
                background={isDarkTheme ? "#020617" : "#f7fafb"}
                isDark={isDarkTheme}
                className="w-full"
                style={{ height: 500 }}
              />
            </div>

            <div className="mx-auto mt-6 flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-5 sm:flex-row sm:px-8">
              <div
                role="group"
                aria-label="Seleccionar plataforma tecnológica"
                className="flex flex-wrap items-center justify-center gap-2 sm:justify-start"
              >
                {SPONSORS.map((item, idx) => {
                  const isCurrent = idx === activeSponsorIdx;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={isCurrent}
                      onClick={() => setActiveSponsorIdx(idx)}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                        isCurrent
                          ? "border-primary/60 bg-primary/10 text-primary shadow-2xs"
                          : "border-border/80 bg-transparent text-muted-foreground hover:border-primary/35 hover:text-foreground"
                      )}
                    >
                      <span
                        className="size-1.5 rounded-full"
                        style={{ backgroundColor: item.accent }}
                        aria-hidden="true"
                      />
                      <span>{item.name}</span>
                    </button>
                  );
                })}
              </div>

              <a
                href={activeSponsor.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium tracking-[0.015em] text-primary transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
              >
                <span>Visitar {activeSponsor.name}</span>
                <ArrowUpRight className="size-3.5" aria-hidden="true" />
              </a>
            </div>
          </InviewReveal>
        </section>

        {/* ==================== CTA FINAL ==================== */}
        <section
          id="siga-cta-acceso"
          aria-label="Acceso directo a S.I.G.A."
          className="mx-auto w-full max-w-6xl px-5 pb-16 sm:px-8 sm:pb-20"
        >
          <InviewReveal fromY={22}>
            <div className="air-animated-border-spin rounded-3xl shadow-xl">
              <div className="relative isolate overflow-hidden rounded-[22px] bg-[#040a18] px-6 py-7 text-white sm:px-10 sm:py-8">
                <div
                  aria-hidden="true"
                  className="air-cta-orbs pointer-events-none absolute -top-24 -right-24 -z-10 size-96 opacity-90 blur-2xl"
                >
                  <div className="air-cta-orb-1 absolute top-0 left-8 size-60 rounded-full" />
                  <div className="air-cta-orb-2 absolute right-4 bottom-4 size-56 rounded-full" />
                  <div className="air-cta-orb-3 absolute bottom-10 left-0 size-52 rounded-full" />
                </div>

                <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
                  <div className="max-w-xl">
                    <span className="inline-flex items-center gap-2 text-xs font-medium tracking-[0.18em] text-[#7dd3fc] uppercase">
                      <span
                        className="size-1.5 rounded-full bg-[#7dd3fc]"
                        aria-hidden="true"
                      />
                      E.T.C. &ldquo;Andrés Bello&rdquo; · Puerto Ordaz
                    </span>
                    <h2 className="mt-2 font-sans text-xl leading-snug font-normal tracking-[0.008em] text-white sm:text-2xl md:text-3xl">
                      Forma parte del{" "}
                      <i className="font-cursive text-[#bae6fd]">
                        entorno académico
                      </i>{" "}
                      del plantel
                    </h2>
                    <p className="mt-2 max-w-lg text-sm leading-relaxed tracking-[0.014em] text-white/75">
                      Estudiantes, docentes y coordinación acceden desde
                      cualquier teléfono o computadora.
                    </p>
                  </div>

                  <div className="flex flex-col items-start gap-2.5 sm:items-end">
                    <button
                      type="button"
                      onClick={handleDirectGoogleLogin}
                      disabled={googlePending}
                      className="air-btn-primary inline-flex h-11 cursor-pointer items-center justify-center rounded-full bg-white px-6 text-sm font-medium tracking-[0.01em] text-[#020617] disabled:opacity-60"
                    >
                      <span className="!gap-2.5 whitespace-nowrap">
                        {googlePending ? (
                          <Loader2 className="size-4 animate-spin text-[#1c47c4]" aria-hidden="true" />
                        ) : (
                          <GoogleWorkspaceGlyph />
                        )}
                        <span>Ingresar con Google</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={openHeroCredsFromSection}
                      className="cursor-pointer text-xs font-medium text-white/75 transition-colors hover:text-white hover:underline"
                    >
                      Usar correo y contraseña ↑
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </InviewReveal>
        </section>

        {/* ==================== FOOTER HALFTONE WORDMARK ==================== */}
        <HalftoneWordmarkFooter
          wordmark="siga"
          label='S.I.G.A. · E.T.C. "Andrés Bello"'
          meta="© 1998–2026 · Código DEA OD01340701 · Unare II, Puerto Ordaz"
          preset={isDarkTheme ? "night" : "paper"}
          palette={
            isDarkTheme
              ? { background: "#030816", ink: "#e2e8f0", warm: "#38bdf8" }
              : { background: "#eef2f6", ink: "#090d16", warm: "#1c47c4" }
          }
          columns={[
            {
              title: "Plataforma",
              links: [
                { label: "Explorar SIGA", href: "#funciones" },
                { label: "Impulsado por", href: "#aliados" },
                {
                  label: "Ingresar con Google",
                  onClick: handleDirectGoogleLogin,
                },
              ],
            },
            {
              title: "Institución",
              links: [
                {
                  label: "Portal del Liceo ↗",
                  href: "https://www.etcandresbello.org",
                  external: true,
                },
                { label: "Verificar constancia", href: "/verificar" },
                { label: "Aviso legal", href: "/legal" },
              ],
            },
            {
              title: "Contacto",
              links: [
                {
                  label: "admin@etcandresbello.org",
                  href: "mailto:admin@etcandresbello.org",
                },
                {
                  label: "Puerto Ordaz · Bolívar",
                  href: "https://www.etcandresbello.org",
                  external: true,
                },
              ],
            },
          ]}
          backToTopLabel="Volver arriba ↑"
          onBackToTop={() => {
            if (lenisRef.current) {
              lenisRef.current.scrollTo(0);
            } else {
              window.scrollTo({ top: 0, behavior: "smooth" });
            }
          }}
          ruleContent={
            <>
              <Image
                src="/images/institucion/logotipo.webp"
                alt='Escudo de la E.T.C. "Andrés Bello"'
                width={22}
                height={22}
                className="size-5.5 rounded-full bg-white/95 object-contain p-0.5"
              />
              <ThemeToggle
                showLabel
                className="h-7 border-current/20 bg-transparent px-2.5 text-[10.5px] font-medium tracking-[0.1em] opacity-85 hover:opacity-100"
              />
            </>
          }
          dotGap={6}
          radius={84}
          crop={0.2}
          grain={0.45}
          height="540px"
        />
      </div>
    </main>
  );
}

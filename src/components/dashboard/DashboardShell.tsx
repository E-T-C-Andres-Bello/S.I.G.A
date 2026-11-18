"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Dialog, Popover } from "radix-ui";
import { Bell, ChevronDown, Loader2, LogOut, Menu, X } from "lucide-react";
import { MotionConfig } from "motion/react";
import { cn } from "cn";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { SigaGlobalLoader } from "@/components/ui/ai-loader";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import type { DashboardUserProfile } from "@/lib/supabase/dashboard-session";
import { formatVenezuelanCedulaDisplay } from "@/lib/validators/auth";
import { DashboardSidebar, ROLE_LABELS } from "./DashboardSidebar";
import { GlassCustomizer } from "./GlassCustomizer";
import { GlassThemeProvider } from "./GlassThemeContext";

const SIDEBAR_STORAGE_KEY = "siga-sidebar-expanded-v1";
const INTRO_SHOWN_KEY = "siga-intro-shown-v1";

export interface DashboardShellProps {
  profile: DashboardUserProfile;
  children: React.ReactNode;
}

/**
 * Shell compartido para `(dashboard)` con fondo gradiente Perla-Cobalto (sin foto),
 * Curved Glass Sidebar en el lateral izquierdo y perfil del usuario en la esquina superior derecha.
 */
export function DashboardShell({ profile, children }: DashboardShellProps) {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [sidebarExpanded, setSidebarExpanded] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);
  const [showIntroLoader, setShowIntroLoader] = React.useState(false);

  React.useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
      if (saved === "true") {
        setSidebarExpanded(true);
      }
    } catch {
      // Ignorar si almacenamiento local está restringido.
    }

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reduced) return;

    let alreadyShown = false;
    try {
      alreadyShown = window.sessionStorage.getItem(INTRO_SHOWN_KEY) === "1";
    } catch {
      // Ignorar si sessionStorage está restringido.
    }

    if (alreadyShown) {
      setShowIntroLoader(false);
      return;
    }

    setShowIntroLoader(true);
    const timer = window.setTimeout(() => {
      try {
        window.sessionStorage.setItem(INTRO_SHOWN_KEY, "1");
      } catch {
        // Ignorar fallo de cuota.
      }
      setShowIntroLoader(false);
    }, 1250);

    return () => window.clearTimeout(timer);
  }, []);

  const toggleSidebarExpanded = React.useCallback(() => {
    setSidebarExpanded((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      } catch {
        // Ignorar fallo de cuota.
      }
      return next;
    });
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

  const initials = `${profile.firstName.charAt(0)}${profile.lastName.charAt(0)}`.toUpperCase();

  return (
    <MotionConfig reducedMotion="user">
      <GlassThemeProvider>
        <div className="siga-dashboard-bg font-hero relative min-h-screen text-foreground transition-colors duration-300">
          {showIntroLoader ? (
            <SigaGlobalLoader
              text="S.I.G.A."
              subtitle={`Módulo ${ROLE_LABELS[profile.primaryRole]} · ${profile.firstName}`}
              className="animate-siga-loader-autohide pointer-events-none z-[120]"
            />
          ) : null}
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-xs focus:font-medium focus:text-primary-foreground"
          >
            Saltar al contenido principal
          </a>

          <div className="mx-auto flex min-h-screen w-full max-w-[1440px] gap-4 p-3.5 sm:gap-5 sm:p-5 lg:gap-6 lg:p-6">
            {/* Curved Glass Sidebar de escritorio */}
            <div
              className={cn(
                "hidden shrink-0 transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] lg:block",
                sidebarExpanded ? "w-[248px]" : "w-[78px]"
              )}
            >
              <div className="sticky top-6 h-[calc(100vh-3rem)]">
                <DashboardSidebar
                  profile={profile}
                  expanded={sidebarExpanded}
                  onToggleExpand={toggleSidebarExpanded}
                />
              </div>
            </div>

            {/* Escenario principal abierto */}
            <div className="flex min-w-0 flex-1 flex-col gap-3 sm:gap-4">
              {/* Franja superior abierta con controles y Perfil en la esquina superior derecha */}
              <header className="flex min-h-10 shrink-0 flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <Dialog.Root
                    open={mobileMenuOpen}
                    onOpenChange={setMobileMenuOpen}
                  >
                    <Dialog.Trigger asChild>
                      <button
                        type="button"
                        aria-label="Abrir menú lateral"
                        className="siga-glass-pill inline-flex size-9 cursor-pointer items-center justify-center rounded-full border text-foreground transition-transform hover:scale-105 lg:hidden focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none"
                      >
                        <Menu className="size-4" aria-hidden="true" />
                      </button>
                    </Dialog.Trigger>
                    <Dialog.Portal>
                      <Dialog.Overlay className="fixed inset-0 z-50 bg-[#020617]/55 backdrop-blur-sm" />
                      <Dialog.Content className="fixed inset-y-3 left-3 z-50 w-68 outline-none">
                        <Dialog.Title className="sr-only">
                          Navegación S.I.G.A.
                        </Dialog.Title>
                        <Dialog.Description className="sr-only">
                          Menú principal del panel escolar S.I.G.A.
                        </Dialog.Description>
                        <div className="relative h-full">
                          <Dialog.Close asChild>
                            <button
                              type="button"
                              aria-label="Cerrar menú lateral"
                              className="siga-glass-pill absolute top-4 right-3.5 z-30 inline-flex size-8 cursor-pointer items-center justify-center rounded-full border text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none"
                            >
                              <X className="size-4" aria-hidden="true" />
                            </button>
                          </Dialog.Close>
                          <DashboardSidebar
                            profile={profile}
                            expanded
                            onNavigate={() => setMobileMenuOpen(false)}
                          />
                        </div>
                      </Dialog.Content>
                    </Dialog.Portal>
                  </Dialog.Root>

                  <span className="truncate text-[11.5px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                    S.I.G.A. · E.T.C. &ldquo;Andrés Bello&rdquo;
                  </span>
                </div>

                {/* Esquina superior derecha: Cristal, Avisos, Tema y Píldora de Perfil */}
                <div className="flex shrink-0 items-center gap-2">
                  <GlassCustomizer />

                  <Popover.Root>
                    <Popover.Trigger asChild>
                      <button
                        type="button"
                        aria-label={`Notificaciones (${profile.unreadNotificationsCount} sin leer)`}
                        className="siga-glass-pill relative inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border px-3 text-xs font-medium text-foreground transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none"
                      >
                        <Bell className="size-3.5 text-primary" aria-hidden="true" />
                        <span className="hidden md:inline">Avisos</span>
                        {profile.unreadNotificationsCount > 0 ? (
                          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold tabular-nums text-primary-foreground">
                            {profile.unreadNotificationsCount > 9
                              ? "9+"
                              : profile.unreadNotificationsCount}
                          </span>
                        ) : null}
                      </button>
                    </Popover.Trigger>
                    <Popover.Portal>
                      <Popover.Content
                        align="end"
                        sideOffset={8}
                        className="siga-glass-surface font-hero z-50 w-72 rounded-2xl border p-4 text-xs text-foreground shadow-xl outline-none"
                      >
                        <p className="font-semibold">Notificaciones</p>
                        <p className="mt-1.5 leading-relaxed text-muted-foreground">
                          {profile.unreadNotificationsCount > 0
                            ? `Tienes ${profile.unreadNotificationsCount} aviso(s) escolar(es) pendiente(s) por revisar.`
                            : "No tienes notificaciones nuevas en este momento."}
                        </p>
                      </Popover.Content>
                    </Popover.Portal>
                  </Popover.Root>

                  <ThemeToggle
                    showLabel
                    className="h-9 cursor-pointer border-transparent bg-[#0b132b] px-3.5 text-xs font-medium text-white shadow-sm hover:bg-[#132044] dark:bg-white dark:text-[#090d16] dark:hover:bg-slate-100"
                  />

                  {/* Píldora + Popover de Perfil del Usuario (Esquina Superior Derecha) */}
                  <Popover.Root>
                    <Popover.Trigger asChild>
                      <button
                        type="button"
                        aria-label={`Perfil de ${profile.firstName} ${profile.lastName}`}
                        className="siga-glass-pill inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border py-1 pr-2.5 pl-1 text-xs font-medium text-foreground transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none"
                      >
                        <span className="relative flex size-7 shrink-0 items-center justify-center rounded-full border border-white/75 bg-gradient-to-br from-[#1c47c4] to-[#0b1d59] text-[10.5px] font-semibold text-white shadow-xs">
                          {initials || "AB"}
                          <span
                            aria-hidden="true"
                            className="absolute -right-0.5 -bottom-0.5 size-2 rounded-full bg-emerald-400 ring-1 ring-white dark:ring-[#07122e]"
                          />
                        </span>
                        <span className="hidden max-w-28 truncate font-semibold sm:inline">
                          {profile.firstName}
                        </span>
                        <ChevronDown
                          className="size-3.5 text-muted-foreground"
                          aria-hidden="true"
                        />
                      </button>
                    </Popover.Trigger>
                    <Popover.Portal>
                      <Popover.Content
                        align="end"
                        sideOffset={8}
                        className="siga-glass-surface font-hero z-50 w-72 rounded-2xl border p-4 text-xs text-foreground shadow-xl outline-none"
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative flex size-10 shrink-0 items-center justify-center rounded-full border border-white/75 bg-gradient-to-br from-[#1c47c4] to-[#0b1d59] text-xs font-semibold text-white shadow-xs">
                            {initials || "AB"}
                            <span
                              aria-hidden="true"
                              className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full bg-emerald-400 ring-2 ring-white dark:ring-[#07122e]"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm leading-snug font-semibold text-foreground">
                              {profile.firstName} {profile.lastName}
                            </p>
                            <span className="mt-1 inline-flex rounded-full bg-primary/14 px-2 py-0.5 text-[10.5px] font-semibold text-primary dark:text-[#7dd3fc]">
                              {ROLE_LABELS[profile.primaryRole]}
                            </span>
                          </div>
                        </div>

                        <div className="mt-3.5 space-y-1.5 border-t border-border/60 pt-3 text-[11.5px]">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-muted-foreground">Cédula</span>
                            <span className="font-medium tabular-nums text-foreground">
                              {formatVenezuelanCedulaDisplay(profile.cedula)}
                            </span>
                          </div>
                          {profile.institutionalEmail ? (
                            <div className="flex items-center justify-between gap-2">
                              <span className="shrink-0 text-muted-foreground">
                                Correo
                              </span>
                              <span className="truncate font-medium text-foreground">
                                {profile.institutionalEmail}
                              </span>
                            </div>
                          ) : null}
                        </div>

                        <button
                          type="button"
                          onClick={handleSignOut}
                          disabled={signingOut}
                          className="siga-glass-inner mt-3.5 flex h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border text-xs font-medium text-foreground transition-colors hover:bg-rose-500/12 hover:text-rose-600 dark:hover:text-rose-300 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none disabled:opacity-60"
                        >
                          {signingOut ? (
                            <Loader2
                              className="size-3.5 animate-spin"
                              aria-hidden="true"
                            />
                          ) : (
                            <LogOut className="size-3.5" aria-hidden="true" />
                          )}
                          <span>Cerrar sesión</span>
                        </button>
                      </Popover.Content>
                    </Popover.Portal>
                  </Popover.Root>
                </div>
              </header>

              <main id="main" className="min-w-0 flex-1">
                {children}
              </main>
            </div>
          </div>
        </div>
      </GlassThemeProvider>
    </MotionConfig>
  );
}

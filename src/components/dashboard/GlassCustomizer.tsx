"use client";

import * as React from "react";
import { Popover } from "radix-ui";
import { RotateCcw, SlidersHorizontal, Sparkles } from "lucide-react";
import { cn } from "cn";
import { GLASS_PRESETS, useGlassTheme } from "./GlassThemeContext";

export interface GlassCustomizerProps {
  /** Disparador personalizado opcional (por defecto renderiza la píldora de la barra). */
  trigger?: React.ReactNode;
  align?: "start" | "center" | "end";
  side?: "top" | "right" | "bottom" | "left";
}

/**
 * Control interactivo para personalizar en vivo el nivel de transparencia (opacidad)
 * y desenfoque Glassmorphism de todas las superficies del panel.
 */
export function GlassCustomizer({
  trigger,
  align = "end",
  side = "bottom",
}: GlassCustomizerProps = {}) {
  const { settings, applyPreset, setOpacityPct, setBlurPx, resetDefaults } =
    useGlassTheme();

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        {trigger ?? (
          <button
            type="button"
            aria-label="Personalizar efecto cristal y transparencia"
            className="siga-glass-pill font-hero inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border px-3.5 text-xs font-medium text-foreground transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none"
          >
            <SlidersHorizontal className="size-3.5 text-primary" aria-hidden="true" />
            <span className="hidden sm:inline">Cristal</span>
            <span className="rounded-full bg-primary/14 px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums text-primary dark:text-[#7dd3fc]">
              {settings.opacityPct}%
            </span>
          </button>
        )}
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align={align}
          side={side}
          sideOffset={10}
          className="siga-glass-surface font-hero z-50 w-72 rounded-2xl border p-4 text-foreground shadow-xl outline-none"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
              <span className="font-display text-xs font-semibold tracking-tight">
                Efecto Glassmorphism
              </span>
            </div>
            <button
              type="button"
              onClick={resetDefaults}
              className="inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
            >
              <RotateCcw className="size-3" aria-hidden="true" />
              <span>Restablecer</span>
            </button>
          </div>

          {/* 3 Presets rápidos */}
          <div className="mt-3 grid grid-cols-3 gap-1.5 rounded-xl bg-muted/60 p-1">
            {(["solido", "glass", "cristal"] as const).map((presetKey) => {
              const active = settings.preset === presetKey;
              return (
                <button
                  key={presetKey}
                  type="button"
                  onClick={() => applyPreset(presetKey)}
                  aria-pressed={active}
                  className={cn(
                    "cursor-pointer rounded-lg py-1.5 text-[11.5px] font-medium transition-all focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none",
                    active
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {GLASS_PRESETS[presetKey].label}
                </button>
              );
            })}
          </div>

          {/* Deslizador fino de opacidad de tarjetas */}
          <div className="mt-4 space-y-3">
            <div>
              <div className="mb-1 flex items-center justify-between text-[11.5px]">
                <label htmlFor="siga-glass-opacity" className="font-medium">
                  Opacidad de cartas
                </label>
                <span className="tabular-nums text-muted-foreground">
                  {settings.opacityPct}%
                </span>
              </div>
              <input
                id="siga-glass-opacity"
                type="range"
                min={16}
                max={92}
                step={2}
                value={settings.opacityPct}
                onChange={(e) => setOpacityPct(Number(e.target.value))}
                className="h-1.5 w-full cursor-pointer accent-primary"
              />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-[11.5px]">
                <label htmlFor="siga-glass-blur" className="font-medium">
                  Desenfoque de fondo
                </label>
                <span className="tabular-nums text-muted-foreground">
                  {settings.blurPx}px
                </span>
              </div>
              <input
                id="siga-glass-blur"
                type="range"
                min={0}
                max={28}
                step={1}
                value={settings.blurPx}
                onChange={(e) => setBlurPx(Number(e.target.value))}
                className="h-1.5 w-full cursor-pointer accent-primary"
              />
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

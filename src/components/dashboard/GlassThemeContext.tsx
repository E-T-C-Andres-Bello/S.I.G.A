"use client";

import * as React from "react";

export type GlassPresetId = "solido" | "glass" | "cristal" | "custom";

export interface GlassSettings {
  preset: GlassPresetId;
  /** Porcentaje de opacidad de las cartas (16–92). */
  opacityPct: number;
  /** Radio de desenfoque backdrop-filter en px (0–28). */
  blurPx: number;
}

export const GLASS_PRESETS: Record<
  Exclude<GlassPresetId, "custom">,
  { label: string; opacityPct: number; blurPx: number }
> = {
  solido: { label: "Sólido", opacityPct: 88, blurPx: 8 },
  glass: { label: "Glass", opacityPct: 54, blurPx: 18 },
  cristal: { label: "Cristal", opacityPct: 24, blurPx: 24 },
};

const STORAGE_KEY = "siga-glass-settings-v1";
const DEFAULT_SETTINGS: GlassSettings = {
  preset: "glass",
  opacityPct: GLASS_PRESETS.glass.opacityPct,
  blurPx: GLASS_PRESETS.glass.blurPx,
};

interface GlassContextValue {
  settings: GlassSettings;
  applyPreset: (preset: Exclude<GlassPresetId, "custom">) => void;
  setOpacityPct: (opacityPct: number) => void;
  setBlurPx: (blurPx: number) => void;
  resetDefaults: () => void;
}

const GlassThemeContext = React.createContext<GlassContextValue | null>(null);

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function readStoredSettings(): GlassSettings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<GlassSettings>;
    if (
      typeof parsed.opacityPct === "number" &&
      typeof parsed.blurPx === "number"
    ) {
      return {
        preset:
          parsed.preset === "solido" ||
          parsed.preset === "glass" ||
          parsed.preset === "cristal"
            ? parsed.preset
            : "custom",
        opacityPct: clamp(parsed.opacityPct, 16, 92),
        blurPx: clamp(parsed.blurPx, 0, 28),
      };
    }
  } catch {
    // Fallback seguro si localStorage está bloqueado.
  }
  return DEFAULT_SETTINGS;
}

export function GlassThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [settings, setSettings] = React.useState<GlassSettings>(DEFAULT_SETTINGS);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    setSettings(readStoredSettings());
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Ignorar fallo de cuota en navegación privada.
    }
  }, [hydrated, settings]);

  const applyPreset = React.useCallback(
    (preset: Exclude<GlassPresetId, "custom">) => {
      const cfg = GLASS_PRESETS[preset];
      setSettings({
        preset,
        opacityPct: cfg.opacityPct,
        blurPx: cfg.blurPx,
      });
    },
    []
  );

  const setOpacityPct = React.useCallback((opacityPct: number) => {
    const next = clamp(opacityPct, 16, 92);
    setSettings((prev) => ({
      ...prev,
      preset: "custom",
      opacityPct: next,
    }));
  }, []);

  const setBlurPx = React.useCallback((blurPx: number) => {
    const next = clamp(blurPx, 0, 28);
    setSettings((prev) => ({
      ...prev,
      preset: "custom",
      blurPx: next,
    }));
  }, []);

  const resetDefaults = React.useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  const cssVars = React.useMemo(() => {
    const alpha = (settings.opacityPct / 100).toFixed(2);
    const borderAlpha = Math.max(0.14, Math.min(0.82, 0.18 + settings.opacityPct / 160)).toFixed(2);
    return {
      "--siga-glass-alpha": alpha,
      "--siga-glass-blur": `${settings.blurPx}px`,
      "--siga-glass-border-alpha": borderAlpha,
    } as React.CSSProperties;
  }, [settings.blurPx, settings.opacityPct]);

  const value = React.useMemo<GlassContextValue>(
    () => ({
      settings,
      applyPreset,
      setOpacityPct,
      setBlurPx,
      resetDefaults,
    }),
    [applyPreset, resetDefaults, setBlurPx, setOpacityPct, settings]
  );

  return (
    <GlassThemeContext value={value}>
      <div style={cssVars} className="contents">
        {children}
      </div>
    </GlassThemeContext>
  );
}

export function useGlassTheme(): GlassContextValue {
  const ctx = React.use(GlassThemeContext);
  if (!ctx) {
    throw new Error("useGlassTheme debe usarse dentro de GlassThemeProvider.");
  }
  return ctx;
}

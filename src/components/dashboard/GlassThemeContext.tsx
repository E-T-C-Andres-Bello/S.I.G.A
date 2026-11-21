"use client";

import * as React from "react";

export type GlassPresetId = "solido" | "glass" | "cristal" | "custom";

export type ColorPaletteId =
  | "cobalto"
  | "orinoco"
  | "nebula"
  | "aurum"
  | "carmesi"
  | "grafito";

export interface ColorPaletteMeta {
  id: ColorPaletteId;
  label: string;
  tagline: string;
  swatches: [string, string, string];
  previewGradient: string;
}

export const COLOR_PALETTES: readonly ColorPaletteMeta[] = [
  {
    id: "cobalto",
    label: "Cobalto Andrés Bello",
    tagline: "Azul institucional clásico con reflejos celestes.",
    swatches: ["#0b1f66", "#1c47c4", "#38bdf8"],
    previewGradient:
      "linear-gradient(135deg, #0b1f66 0%, #1c47c4 56%, #38bdf8 100%)",
  },
  {
    id: "orinoco",
    label: "Esmeralda Orinoco",
    tagline: "Verde profundo de Guayana y cristal ártico.",
    swatches: ["#064e3b", "#0f766e", "#34d399"],
    previewGradient:
      "linear-gradient(135deg, #064e3b 0%, #0f766e 56%, #34d399 100%)",
  },
  {
    id: "nebula",
    label: "Índigo Nebulosa",
    tagline: "Violeta espacial y energía tecnológica moderna.",
    swatches: ["#2e1065", "#4f46e5", "#a78bfa"],
    previewGradient:
      "linear-gradient(135deg, #2e1065 0%, #4f46e5 56%, #a78bfa 100%)",
  },
  {
    id: "aurum",
    label: "Ámbar Guayana",
    tagline: "Dorado cálido inspirado en el escudo escolar.",
    swatches: ["#451a03", "#b45309", "#fbbf24"],
    previewGradient:
      "linear-gradient(135deg, #451a03 0%, #b45309 56%, #fbbf24 100%)",
  },
  {
    id: "carmesi",
    label: "Rubí Escarlata",
    tagline: "Carmesí vibrante con destellos de cuarzo rosa.",
    swatches: ["#4c0519", "#be123c", "#fb7185"],
    previewGradient:
      "linear-gradient(135deg, #4c0519 0%, #be123c 56%, #fb7185 100%)",
  },
  {
    id: "grafito",
    label: "Obsidiana Titanio",
    tagline: "Monocromo arquitectónico de plata y vidrio puro.",
    swatches: ["#0f172a", "#334155", "#94a3b8"],
    previewGradient:
      "linear-gradient(135deg, #0f172a 0%, #334155 56%, #94a3b8 100%)",
  },
] as const;

const VALID_PALETTES = new Set<ColorPaletteId>(
  COLOR_PALETTES.map((p) => p.id)
);

export interface GlassSettings {
  preset: GlassPresetId;
  /** Porcentaje de opacidad de las cartas (16–92). */
  opacityPct: number;
  /** Radio de desenfoque backdrop-filter en px (0–28). */
  blurPx: number;
  /** Paleta cromática institucional activa. */
  palette: ColorPaletteId;
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
const PALETTE_STORAGE_KEY = "siga-color-palette-v1";

const DEFAULT_SETTINGS: GlassSettings = {
  preset: "glass",
  opacityPct: GLASS_PRESETS.glass.opacityPct,
  blurPx: GLASS_PRESETS.glass.blurPx,
  palette: "cobalto",
};

interface GlassContextValue {
  settings: GlassSettings;
  applyPreset: (preset: Exclude<GlassPresetId, "custom">) => void;
  setOpacityPct: (opacityPct: number) => void;
  setBlurPx: (blurPx: number) => void;
  setPalette: (palette: ColorPaletteId) => void;
  resetDefaults: () => void;
}

const GlassThemeContext = React.createContext<GlassContextValue | null>(null);

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function isColorPaletteId(value: unknown): value is ColorPaletteId {
  return typeof value === "string" && VALID_PALETTES.has(value as ColorPaletteId);
}

function readStoredSettings(): GlassSettings {
  let storedPalette: ColorPaletteId = DEFAULT_SETTINGS.palette;
  try {
    const rawPalette = window.localStorage.getItem(PALETTE_STORAGE_KEY);
    if (isColorPaletteId(rawPalette)) {
      storedPalette = rawPalette;
    }
  } catch {
    // Fallback seguro si localStorage está bloqueado.
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_SETTINGS, palette: storedPalette };
    }
    const parsed = JSON.parse(raw) as Partial<GlassSettings>;
    const resolvedPalette = isColorPaletteId(parsed.palette)
      ? parsed.palette
      : storedPalette;

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
        palette: resolvedPalette,
      };
    }

    return { ...DEFAULT_SETTINGS, palette: resolvedPalette };
  } catch {
    // Fallback seguro si localStorage está bloqueado.
  }
  return { ...DEFAULT_SETTINGS, palette: storedPalette };
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
    if (settings.palette === "cobalto") {
      document.documentElement.removeAttribute("data-siga-palette");
    } else {
      document.documentElement.setAttribute(
        "data-siga-palette",
        settings.palette
      );
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      window.localStorage.setItem(PALETTE_STORAGE_KEY, settings.palette);
    } catch {
      // Ignorar fallo de cuota en navegación privada.
    }
  }, [hydrated, settings]);

  const applyPreset = React.useCallback(
    (preset: Exclude<GlassPresetId, "custom">) => {
      const cfg = GLASS_PRESETS[preset];
      setSettings((prev) => ({
        ...prev,
        preset,
        opacityPct: cfg.opacityPct,
        blurPx: cfg.blurPx,
      }));
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

  const setPalette = React.useCallback((palette: ColorPaletteId) => {
    if (!isColorPaletteId(palette)) return;
    setSettings((prev) => ({
      ...prev,
      palette,
    }));
  }, []);

  const resetDefaults = React.useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  const cssVars = React.useMemo(() => {
    const alpha = (settings.opacityPct / 100).toFixed(2);
    const borderAlpha = Math.max(
      0.14,
      Math.min(0.82, 0.18 + settings.opacityPct / 160)
    ).toFixed(2);
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
      setPalette,
      resetDefaults,
    }),
    [applyPreset, resetDefaults, setBlurPx, setOpacityPct, setPalette, settings]
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

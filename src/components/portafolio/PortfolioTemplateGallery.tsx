"use client";

import * as React from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Palette,
  SlidersHorizontal,
} from "lucide-react";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  PORTFOLIO_ACCENT_SWATCHES,
  PORTFOLIO_SECTION_LABELS,
  PORTFOLIO_TEMPLATES,
  resolvePortfolioDesign,
  type PortfolioDensity,
  type PortfolioDesignConfig,
  type PortfolioFontStyle,
  type PortfolioHeaderStyle,
  type PortfolioLayoutMode,
  type PortfolioSectionKey,
  type PortfolioTemplateId,
} from "@/lib/validators/portfolio";

export interface PortfolioTemplateGalleryProps {
  templateId: PortfolioTemplateId;
  designConfig: PortfolioDesignConfig;
  onSelectTemplate: (
    nextId: PortfolioTemplateId,
    nextDesign: PortfolioDesignConfig
  ) => void;
  onUpdateDesign: (patch: Partial<PortfolioDesignConfig>) => void;
}

function TemplateMiniWireframe({
  design,
}: {
  design: PortfolioDesignConfig;
}) {
  const accent = design.accentColor;
  const isBanner =
    design.headerStyle === "banner" || design.headerStyle === "gradient";

  return (
    <div className="relative h-24 w-full overflow-hidden rounded-lg border border-border/70 bg-white p-1.5 shadow-2xs">
      {/* Cabecera miniatura */}
      <div
        className={cn(
          "mb-1.5 rounded-[4px] px-2 py-1.5",
          design.headerStyle === "centered" && "flex flex-col items-center",
          design.headerStyle === "minimal" && "border-b border-slate-200 px-1 py-1"
        )}
        style={
          isBanner
            ? {
                background:
                  design.headerStyle === "gradient"
                    ? `linear-gradient(135deg, ${accent}, #0b1d59)`
                    : accent,
              }
            : design.headerStyle === "split"
              ? { borderLeft: `3px solid ${accent}`, background: "#f8fafc" }
              : undefined
        }
      >
        <div
          className="h-1.5 w-14 rounded-full"
          style={{ background: isBanner ? "rgba(255,255,255,0.9)" : "#0f172a" }}
        />
        <div
          className="mt-1 h-1 w-9 rounded-full"
          style={{
            background: isBanner ? "rgba(255,255,255,0.55)" : accent,
          }}
        />
      </div>

      {/* Cuerpo miniatura */}
      {design.layout === "single" ? (
        <div className="space-y-1 px-1">
          <div className="h-1 w-full rounded-full bg-slate-200" />
          <div className="h-1 w-4/5 rounded-full bg-slate-200" />
          <div className="mt-1.5 h-1.5 w-8 rounded-full" style={{ background: accent, opacity: 0.7 }} />
          <div className="h-1 w-full rounded-full bg-slate-100" />
          <div className="h-1 w-3/4 rounded-full bg-slate-100" />
        </div>
      ) : (
        <div
          className={cn(
            "grid h-12 gap-1.5 px-0.5",
            design.layout === "sidebar_left" ? "grid-cols-3" : "grid-cols-3"
          )}
        >
          {design.layout === "sidebar_left" ? (
            <>
              <div
                className="rounded-[3px] p-1 space-y-1"
                style={{ background: `${accent}15` }}
              >
                <div className="h-1 w-full rounded-full" style={{ background: accent, opacity: 0.65 }} />
                <div className="h-1 w-4/5 rounded-full bg-slate-300" />
                <div className="h-1 w-3/5 rounded-full bg-slate-300" />
              </div>
              <div className="col-span-2 space-y-1 pt-0.5">
                <div className="h-1.5 w-10 rounded-full bg-slate-700/70" />
                <div className="h-1 w-full rounded-full bg-slate-200" />
                <div className="h-1 w-5/6 rounded-full bg-slate-200" />
                <div className="h-1 w-2/3 rounded-full bg-slate-200" />
              </div>
            </>
          ) : (
            <>
              <div className="col-span-2 space-y-1 pt-0.5">
                <div className="h-1.5 w-10 rounded-full bg-slate-700/70" />
                <div className="h-1 w-full rounded-full bg-slate-200" />
                <div className="h-1 w-5/6 rounded-full bg-slate-200" />
                <div className="h-1 w-2/3 rounded-full bg-slate-200" />
              </div>
              <div
                className="rounded-[3px] p-1 space-y-1"
                style={{ background: `${accent}15` }}
              >
                <div className="h-1 w-full rounded-full" style={{ background: accent, opacity: 0.65 }} />
                <div className="h-1 w-4/5 rounded-full bg-slate-300" />
                <div className="h-1 w-3/5 rounded-full bg-slate-300" />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function PortfolioTemplateGallery({
  templateId,
  designConfig,
  onSelectTemplate,
  onUpdateDesign,
}: PortfolioTemplateGalleryProps) {
  const moveSection = (index: number, delta: -1 | 1) => {
    const nextIdx = index + delta;
    if (nextIdx < 0 || nextIdx >= designConfig.sectionOrder.length) return;
    const nextOrder: PortfolioSectionKey[] = [...designConfig.sectionOrder];
    const [moved] = nextOrder.splice(index, 1);
    nextOrder.splice(nextIdx, 0, moved);
    onUpdateDesign({ sectionOrder: nextOrder });
  };

  return (
    <div className="space-y-6">
      {/* 10 plantillas profesionales + modo propio */}
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              10 Plantillas Profesionales
            </h3>
            <p className="text-xs text-muted-foreground">
              Todas replican fielmente su estructura en el PDF verificable.
            </p>
          </div>
          <Button
            type="button"
            variant={templateId === "custom" ? "default" : "outline"}
            size="sm"
            onClick={() => onSelectTemplate("custom", designConfig)}
            className="h-8 gap-1.5 text-xs"
          >
            <SlidersHorizontal className="size-3.5" aria-hidden="true" />
            Diseña tu propia plantilla
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {PORTFOLIO_TEMPLATES.map((preset) => {
            const active = templateId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() =>
                  onSelectTemplate(
                    preset.id,
                    resolvePortfolioDesign(preset.id)
                  )
                }
                className={cn(
                  "group flex flex-col gap-2 rounded-xl border p-3 text-left transition-all",
                  active
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                    : "border-border/75 bg-card hover:border-primary/40 hover:bg-muted/30"
                )}
              >
                <TemplateMiniWireframe design={preset.design} />
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-xs font-semibold text-foreground">
                        {preset.name}
                      </span>
                      <Badge
                        variant="secondary"
                        className="h-4 px-1.5 text-[10px] font-medium"
                      >
                        {preset.badge}
                      </Badge>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                      {preset.tagline}
                    </p>
                  </div>
                  {active ? (
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="size-3" aria-hidden="true" />
                    </span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Personalizador visual en vivo (aplica sobre cualquier plantilla o modo custom) */}
      <div className="space-y-4 rounded-2xl border border-border/80 bg-muted/20 p-4">
        <div className="flex items-center gap-2">
          <Palette className="size-4 text-primary" aria-hidden="true" />
          <div>
            <h4 className="text-xs font-semibold text-foreground">
              Constructor y Personalización del Diseño
            </h4>
            <p className="text-[11px] text-muted-foreground">
              Ajusta columnas, cabecera, color, tipografía y orden de secciones a tu estilo.
            </p>
          </div>
        </div>

        {/* Estructura de columnas */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-medium text-muted-foreground">
            Estructura de columnas
          </span>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { value: "single", label: "1 Columna" },
                { value: "sidebar_left", label: "Barra Izq." },
                { value: "sidebar_right", label: "Barra Der." },
              ] as Array<{ value: PortfolioLayoutMode; label: string }>
            ).map((opt) => (
              <Button
                key={opt.value}
                type="button"
                variant={designConfig.layout === opt.value ? "default" : "outline"}
                size="sm"
                className="h-8 text-xs"
                onClick={() => onUpdateDesign({ layout: opt.value })}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Estilo de cabecera */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-medium text-muted-foreground">
            Estilo de cabecera
          </span>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { value: "banner", label: "Banner sólido" },
                { value: "gradient", label: "Degradado Bellista" },
                { value: "split", label: "Dividida" },
                { value: "centered", label: "Centrada" },
                { value: "minimal", label: "Minimalista" },
              ] as Array<{ value: PortfolioHeaderStyle; label: string }>
            ).map((opt) => (
              <Button
                key={opt.value}
                type="button"
                variant={
                  designConfig.headerStyle === opt.value ? "default" : "outline"
                }
                size="sm"
                className="h-7 px-2.5 text-[11px]"
                onClick={() => onUpdateDesign({ headerStyle: opt.value })}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Color de acento */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-medium text-muted-foreground">
            Color principal
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {PORTFOLIO_ACCENT_SWATCHES.map((swatch) => {
              const selected =
                designConfig.accentColor.toLowerCase() ===
                swatch.hex.toLowerCase();
              return (
                <button
                  key={swatch.hex}
                  type="button"
                  title={swatch.label}
                  aria-label={swatch.label}
                  onClick={() => onUpdateDesign({ accentColor: swatch.hex })}
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full border-2 transition-transform hover:scale-105",
                    selected
                      ? "border-foreground ring-2 ring-primary/30"
                      : "border-transparent"
                  )}
                  style={{ backgroundColor: swatch.hex }}
                >
                  {selected ? (
                    <Check className="size-3.5 text-white" aria-hidden="true" />
                  ) : null}
                </button>
              );
            })}
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] text-muted-foreground">
              <span>Otro</span>
              <input
                type="color"
                value={designConfig.accentColor}
                onChange={(e) =>
                  onUpdateDesign({ accentColor: e.target.value })
                }
                className="size-4 cursor-pointer border-0 bg-transparent p-0"
              />
            </label>
          </div>
        </div>

        {/* Tipografía y densidad */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <span className="text-[11px] font-medium text-muted-foreground">
              Tipografía
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { value: "modern", label: "Moderna" },
                  { value: "editorial", label: "Clásica" },
                  { value: "technical", label: "Técnica" },
                ] as Array<{ value: PortfolioFontStyle; label: string }>
              ).map((opt) => (
                <Button
                  key={opt.value}
                  type="button"
                  variant={
                    designConfig.fontStyle === opt.value ? "default" : "outline"
                  }
                  size="sm"
                  className="h-7 px-2 text-[11px]"
                  onClick={() => onUpdateDesign({ fontStyle: opt.value })}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-[11px] font-medium text-muted-foreground">
              Densidad
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { value: "compact", label: "Compacta" },
                  { value: "balanced", label: "Equilibrada" },
                  { value: "spacious", label: "Amplia" },
                ] as Array<{ value: PortfolioDensity; label: string }>
              ).map((opt) => (
                <Button
                  key={opt.value}
                  type="button"
                  variant={
                    designConfig.density === opt.value ? "default" : "outline"
                  }
                  size="sm"
                  className="h-7 px-2 text-[11px]"
                  onClick={() => onUpdateDesign({ density: opt.value })}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Interruptores visuales */}
        <div className="flex flex-wrap items-center gap-5 border-t border-border/60 pt-3">
          <label className="flex items-center gap-2 text-xs text-foreground">
            <Switch
              checked={designConfig.showPhoto}
              onCheckedChange={(checked) =>
                onUpdateDesign({ showPhoto: checked })
              }
            />
            <span>Mostrar fotografía</span>
          </label>
          <label className="flex items-center gap-2 text-xs text-foreground">
            <Switch
              checked={designConfig.showQrSeal}
              onCheckedChange={(checked) =>
                onUpdateDesign({ showQrSeal: checked })
              }
            />
            <span>Sello y QR verificable</span>
          </label>
        </div>

        {/* Orden de secciones */}
        <div className="space-y-1.5 border-t border-border/60 pt-3">
          <span className="text-[11px] font-medium text-muted-foreground">
            Orden de bloques en la hoja
          </span>
          <div className="space-y-1">
            {designConfig.sectionOrder.map((key, idx) => (
              <div
                key={key}
                className="flex items-center justify-between rounded-lg border border-border/60 bg-background px-2.5 py-1.5 text-xs"
              >
                <span className="font-medium text-foreground">
                  {PORTFOLIO_SECTION_LABELS[key]}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-6"
                    disabled={idx === 0}
                    onClick={() => moveSection(idx, -1)}
                    aria-label={`Subir ${PORTFOLIO_SECTION_LABELS[key]}`}
                  >
                    <ArrowUp className="size-3" aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-6"
                    disabled={idx === designConfig.sectionOrder.length - 1}
                    onClick={() => moveSection(idx, 1)}
                    aria-label={`Bajar ${PORTFOLIO_SECTION_LABELS[key]}`}
                  >
                    <ArrowDown className="size-3" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

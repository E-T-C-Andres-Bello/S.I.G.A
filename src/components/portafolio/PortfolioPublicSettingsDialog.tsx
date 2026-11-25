"use client";

import * as React from "react";
import { Check, Copy, ExternalLink, Globe, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { PortfolioPrivacySettings } from "@/lib/validators/portfolio";

export interface PortfolioPublicSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isPublic: boolean;
  publicSlug: string;
  privacySettings: PortfolioPrivacySettings;
  suggestedSlug: string;
  onChange: (patch: {
    isPublic?: boolean;
    publicSlug?: string;
    privacySettings?: PortfolioPrivacySettings;
  }) => void;
  onSaveNow: () => Promise<void>;
  saving: boolean;
}

export function PortfolioPublicSettingsDialog({
  open,
  onOpenChange,
  isPublic,
  publicSlug,
  privacySettings,
  suggestedSlug,
  onChange,
  onSaveNow,
  saving,
}: PortfolioPublicSettingsDialogProps) {
  const [copied, setCopied] = React.useState(false);

  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  const effectiveSlug = publicSlug.trim();
  const fullUrl = effectiveSlug ? `${origin}/portafolio/${effectiveSlug}` : "";

  const copyLink = async () => {
    if (!fullUrl) return;
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      toast.success("Enlace público copiado al portapapeles.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("No se pudo copiar automáticamente.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isPublic ? (
              <Globe className="size-5 text-emerald-600" aria-hidden="true" />
            ) : (
              <Lock className="size-5 text-muted-foreground" aria-hidden="true" />
            )}
            Privacidad y Enlace Compartible
          </DialogTitle>
          <DialogDescription>
            Tu portafolio es privado por defecto. Puedes activar un enlace web
            para reclutadores de Ciudad Guayana y decidir exactamente qué datos
            son visibles. Tu cédula y dirección nunca se muestran.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border/80 bg-muted/25 p-3.5">
            <div>
              <p className="text-sm font-semibold text-foreground">
                Activar portafolio web público
              </p>
              <p className="text-xs text-muted-foreground">
                Permite que empresas consulten tu hoja de vida con tu enlace único.
              </p>
            </div>
            <Switch
              checked={isPublic}
              onCheckedChange={(checked) => {
                onChange({
                  isPublic: checked,
                  publicSlug: checked && !publicSlug ? suggestedSlug : publicSlug,
                });
              }}
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="portfolio-slug-input"
              className="text-xs font-semibold text-foreground"
            >
              Nombre de tu enlace personalizado
            </label>
            <div className="flex items-center gap-2">
              <Input
                id="portfolio-slug-input"
                value={publicSlug}
                onChange={(e) =>
                  onChange({
                    publicSlug: e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9-]/g, ""),
                  })
                }
                placeholder={suggestedSlug || "ej-maria-perez-telematica"}
                maxLength={48}
                className="font-mono text-xs"
              />
              {isPublic && fullUrl ? (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => void copyLink()}
                  aria-label="Copiar enlace público"
                >
                  {copied ? (
                    <Check className="size-4 text-emerald-600" aria-hidden="true" />
                  ) : (
                    <Copy className="size-4" aria-hidden="true" />
                  )}
                </Button>
              ) : null}
            </div>
            {fullUrl ? (
              <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <span>Vista previa:</span>
                <a
                  href={fullUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 font-medium text-primary underline"
                >
                  {fullUrl}
                  <ExternalLink className="size-2.5" aria-hidden="true" />
                </a>
              </p>
            ) : null}
          </div>

          <div className="space-y-2.5 rounded-xl border border-border/75 p-3.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
              Control de visibilidad de datos personales
            </div>

            {(
              [
                {
                  key: "show_photo",
                  label: "Mostrar fotografía de perfil",
                  desc: "Usa tu foto oficial cargada en tu perfil estudiantil.",
                },
                {
                  key: "show_email",
                  label: "Mostrar correo institucional",
                  desc: "Oculto por defecto para evitar correo no deseado.",
                },
                {
                  key: "show_phone",
                  label: "Mostrar teléfono de contacto",
                  desc: "Actívalo solo cuando estés postulándote activamente.",
                },
                {
                  key: "show_average",
                  label: "Mostrar promedio verificado",
                  desc: "Muestra tu promedio consolidado real si deseas destacarlo.",
                },
                {
                  key: "show_medals",
                  label: "Mostrar medallas y distinciones verificadas",
                  desc: "Cuadro de Honor e Identidad Institucional verificada.",
                },
              ] as const
            ).map((item) => (
              <label
                key={item.key}
                className="flex items-center justify-between gap-3 py-1"
              >
                <div>
                  <p className="text-xs font-medium text-foreground">
                    {item.label}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {item.desc}
                  </p>
                </div>
                <Switch
                  checked={privacySettings[item.key]}
                  onCheckedChange={(checked) =>
                    onChange({
                      privacySettings: {
                        ...privacySettings,
                        [item.key]: checked,
                      },
                    })
                  }
                />
              </label>
            ))}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cerrar
          </Button>
          <Button
            type="button"
            disabled={saving}
            onClick={async () => {
              await onSaveNow();
              onOpenChange(false);
            }}
          >
            {saving ? "Guardando..." : "Guardar privacidad"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Building2,
  CalendarDays,
  Check,
  CheckCheck,
  MapPin,
  Pencil,
  Pin,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ANNOUNCEMENT_CATEGORY_META,
  formatAnnouncementAudience,
  formatAnnouncementCountdown,
  hexToRgba,
  type SchoolAnnouncementItem,
} from "@/lib/validators/bulletin";
import { BulletinRichText } from "./BulletinRichText";

export interface BulletinDetailDialogProps {
  item: SchoolAnnouncementItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  showFullBulletinLink?: boolean;
  canEdit?: boolean;
  onEdit?: (item: SchoolAnnouncementItem) => void;
  onConfirmRead: (item: SchoolAnnouncementItem) => Promise<void> | void;
}

function formatPublishedDate(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  return new Intl.DateTimeFormat("es-VE", {
    timeZone: "America/Caracas",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(ms));
}

export function BulletinDetailDialog({
  item,
  open,
  onOpenChange,
  showFullBulletinLink = false,
  canEdit = false,
  onEdit,
  onConfirmRead,
}: BulletinDetailDialogProps) {
  const [confirming, setConfirming] = React.useState(false);

  if (!item) return null;

  const meta = ANNOUNCEMENT_CATEGORY_META[item.category];
  const countdown = formatAnnouncementCountdown(item.eventDate);
  const audience = formatAnnouncementAudience(
    item.targetMencionName,
    item.targetGradeYear
  );
  const canEditEffective = canEdit || item.canEdit;

  const handleConfirm = async () => {
    if (confirming) return;
    setConfirming(true);
    try {
      await onConfirmRead(item);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-border/70 p-0 sm:max-w-2xl">
        {/* Cabecera visual teñida con la paleta del evento */}
        <div
          className="relative overflow-hidden px-6 pt-6 pb-5 text-white"
          style={{
            background: item.coverWebpUrl
              ? "#090f1e"
              : `linear-gradient(135deg, ${item.themePalette.primary} 0%, ${item.themePalette.secondary} 62%, #0b1224 100%)`,
          }}
        >
          {item.coverWebpUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.coverWebpUrl}
                alt={item.title}
                className="absolute inset-0 h-full w-full object-cover opacity-55"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
                style={{
                  background: `linear-gradient(180deg, ${hexToRgba(item.themePalette.primary, 0.45)} 0%, rgba(7,11,23,0.92) 100%)`,
                }}
              />
            </>
          ) : null}

          <DialogHeader className="relative z-10 text-left">
            <div className="flex flex-wrap items-center gap-2 pr-8">
              <Badge className="border-white/30 bg-white/18 text-white hover:bg-white/22">
                {meta.label}
              </Badge>
              <Badge className="border-white/25 bg-black/30 text-white hover:bg-black/35">
                <Building2 className="mr-1 size-3" aria-hidden="true" />
                {item.authorDepartment}
              </Badge>
              {item.isPinned ? (
                <Badge className="border-amber-200/45 bg-amber-400/25 text-amber-100 hover:bg-amber-400/30">
                  <Pin className="mr-1 size-3" aria-hidden="true" />
                  Fijado por Dirección
                </Badge>
              ) : null}
              {countdown ? (
                <Badge className="border-white/25 bg-black/35 text-white">
                  <CalendarDays className="mr-1 size-3" aria-hidden="true" />
                  {countdown.label}
                </Badge>
              ) : null}
            </div>

            <DialogTitle className="mt-3 text-xl leading-snug font-semibold text-white sm:text-2xl">
              {item.title}
            </DialogTitle>
            <DialogDescription className="mt-1 text-xs text-white/85">
              Publicado el {formatPublishedDate(item.publishedAt)} por{" "}
              {item.authorName}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Metadatos clave */}
        <div className="space-y-4 px-6 py-5">
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/40 px-3 py-1">
              <Users className="size-3.5 text-primary" aria-hidden="true" />
              {audience}
            </span>
            {countdown ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/40 px-3 py-1">
                <CalendarDays className="size-3.5 text-primary" aria-hidden="true" />
                {countdown.formattedDate}
              </span>
            ) : null}
            {item.locationLabel ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/40 px-3 py-1">
                <MapPin className="size-3.5 text-primary" aria-hidden="true" />
                {item.locationLabel}
              </span>
            ) : null}
          </div>

          {/* Cuerpo enriquecido 100 % seguro contra XSS */}
          <BulletinRichText
            content={item.body}
            accentColor={item.themePalette.primary}
          />
        </div>

        <DialogFooter className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 bg-muted/20 px-6 py-4 sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {showFullBulletinLink ? (
              <Button variant="outline" size="sm" asChild>
                <Link href="/estudiante/cartelera">
                  <span>Ver toda la cartelera</span>
                  <ArrowUpRight className="ml-1 size-3.5" aria-hidden="true" />
                </Link>
              </Button>
            ) : null}
            {canEditEffective ? (
              onEdit ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(item)}
                >
                  <Pencil className="mr-1.5 size-3.5" aria-hidden="true" />
                  Editar anuncio
                </Button>
              ) : (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/cartelera/gestion?edit=${item.id}`}>
                    <Pencil className="mr-1.5 size-3.5" aria-hidden="true" />
                    Editar en Estudio
                  </Link>
                </Button>
              )
            ) : null}
          </div>

          <Button
            type="button"
            size="sm"
            disabled={confirming}
            onClick={handleConfirm}
            style={
              item.hasRead
                ? { background: item.themePalette.primary, color: "#ffffff" }
                : undefined
            }
          >
            {item.hasRead ? (
              <CheckCheck className="mr-1.5 size-4" aria-hidden="true" />
            ) : (
              <Check className="mr-1.5 size-4" aria-hidden="true" />
            )}
            <span>
              {item.hasRead
                ? `Enterado (${item.readCount})`
                : `Confirmar enterado (${item.readCount})`}
            </span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

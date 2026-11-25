"use client";

import * as React from "react";
import { ImagePlus, Palette, Pin, RotateCcw, Trash2 } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { upsertSchoolAnnouncementAction } from "@/features/cartelera/announcements-actions";
import type { BulletinMentionOption } from "@/features/cartelera/announcements-data";
import { compressImageToWebpClient } from "@/lib/storage/media-optimizer";
import { extractImagePaletteClient } from "@/lib/storage/palette-extractor";
import {
  ANNOUNCEMENT_CATEGORIES,
  ANNOUNCEMENT_CATEGORY_META,
  resolveAnnouncementPalette,
  upsertAnnouncementSchema,
  type AnnouncementCategory,
  type AnnouncementThemePalette,
  type SchoolAnnouncementItem,
} from "@/lib/validators/bulletin";

export interface BulletinEditorialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingItem: SchoolAnnouncementItem | null;
  menciones: BulletinMentionOption[];
  restrictedMencionId: string | null;
  restrictedMencionName: string | null;
  onSaved: () => void;
}

function toCaracasDateTimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  // Venezuela es UTC-4 fijo sin horario de verano
  const shifted = new Date(ms - 4 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 16);
}

function fromCaracasDateTimeLocalValue(localValue: string): string | null {
  const clean = localValue.trim();
  if (!clean) return null;
  // Interpretar la hora ingresada en zona America/Caracas (UTC-04:00)
  return `${clean}:00-04:00`;
}

export function BulletinEditorialDialog({
  open,
  onOpenChange,
  editingItem,
  menciones,
  restrictedMencionId,
  restrictedMencionName,
  onSaved,
}: BulletinEditorialDialogProps) {
  const [title, setTitle] = React.useState("");
  const [shortNote, setShortNote] = React.useState("");
  const [body, setBody] = React.useState("");
  const [category, setCategory] = React.useState<AnnouncementCategory>("evento");
  const [targetMencionId, setTargetMencionId] = React.useState<string>("all");
  const [targetGradeYear, setTargetGradeYear] = React.useState<string>("all");
  const [eventDateLocal, setEventDateLocal] = React.useState("");
  const [expiresAtLocal, setExpiresAtLocal] = React.useState("");
  const [locationLabel, setLocationLabel] = React.useState("");
  const [isPinned, setIsPinned] = React.useState(false);
  const [coverWebpUrl, setCoverWebpUrl] = React.useState<string | null>(null);
  const [palette, setPalette] = React.useState<AnnouncementThemePalette>(
    ANNOUNCEMENT_CATEGORY_META.evento.defaultPalette
  );
  const [paletteCustomized, setPaletteCustomized] = React.useState(false);
  const [uploadingCover, setUploadingCover] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const submitLockRef = React.useRef(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    if (editingItem) {
      setTitle(editingItem.title);
      setShortNote(editingItem.shortNote);
      setBody(editingItem.body);
      setCategory(editingItem.category);
      setTargetMencionId(
        restrictedMencionId ?? editingItem.targetMencionId ?? "all"
      );
      setTargetGradeYear(
        editingItem.targetGradeYear ? String(editingItem.targetGradeYear) : "all"
      );
      setEventDateLocal(toCaracasDateTimeLocalValue(editingItem.eventDate));
      setExpiresAtLocal(toCaracasDateTimeLocalValue(editingItem.expiresAt));
      setLocationLabel(editingItem.locationLabel ?? "");
      setIsPinned(editingItem.isPinned);
      setCoverWebpUrl(editingItem.coverWebpUrl);
      setPalette(editingItem.themePalette);
      setPaletteCustomized(true);
    } else {
      const defaultCategory: AnnouncementCategory = restrictedMencionId
        ? "mencion"
        : "evento";
      const mentionCode =
        menciones.find((m) => m.id === restrictedMencionId)?.code ?? null;
      setTitle("");
      setShortNote("");
      setBody("");
      setCategory(defaultCategory);
      setTargetMencionId(restrictedMencionId ?? "all");
      setTargetGradeYear("all");
      setEventDateLocal("");
      setExpiresAtLocal("");
      setLocationLabel("");
      setIsPinned(false);
      setCoverWebpUrl(null);
      setPalette(resolveAnnouncementPalette(null, defaultCategory, mentionCode));
      setPaletteCustomized(false);
    }
  }, [open, editingItem, restrictedMencionId, menciones]);

  const handleCategoryChange = (nextCategory: AnnouncementCategory) => {
    setCategory(nextCategory);
    if (!paletteCustomized && !coverWebpUrl) {
      const selectedMentionCode =
        targetMencionId !== "all"
          ? menciones.find((m) => m.id === targetMencionId)?.code ?? null
          : null;
      setPalette(
        resolveAnnouncementPalette(null, nextCategory, selectedMentionCode)
      );
    }
  };

  const handleResetPalette = () => {
    const selectedMentionCode =
      targetMencionId !== "all"
        ? menciones.find((m) => m.id === targetMencionId)?.code ?? null
        : null;
    setPalette(resolveAnnouncementPalette(null, category, selectedMentionCode));
    setPaletteCustomized(false);
  };

  const handleSelectCoverFile = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploadingCover(true);
    try {
      const [compressed, extractedPalette] = await Promise.all([
        compressImageToWebpClient(file, {
          maxWidth: 1200,
          maxHeight: 1200,
          quality: 0.84,
          maxOutputBytes: 768 * 1024,
        }),
        extractImagePaletteClient(file, category),
      ]);

      setPalette(extractedPalette);
      setPaletteCustomized(true);

      const formData = new FormData();
      formData.append("file", compressed.file);

      const res = await fetch("/api/cartelera/cover", {
        method: "POST",
        body: formData,
      });
      const json = (await res.json()) as {
        ok?: boolean;
        coverWebpUrl?: string;
        message?: string;
      };

      if (!res.ok || !json.ok || !json.coverWebpUrl) {
        toast.warning(
          json.message ??
            "No se pudo subir la imagen al almacenamiento, pero aplicamos sus colores al afiche editorial."
        );
        return;
      }

      setCoverWebpUrl(json.coverWebpUrl);
      toast.success(
        "Portada optimizada y colores dominantes extraídos automáticamente."
      );
    } catch (error) {
      const msg =
        error instanceof Error
          ? error.message
          : "No se pudo procesar la imagen seleccionada.";
      toast.error(msg);
    } finally {
      setUploadingCover(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitLockRef.current || uploadingCover) return;

    const payload = {
      announcementId: editingItem?.id ?? null,
      title,
      shortNote: shortNote.trim() || title.trim().slice(0, 40),
      body,
      category,
      targetMencionId:
        restrictedMencionId ??
        (targetMencionId === "all" ? null : targetMencionId),
      targetGradeYear:
        targetGradeYear === "all" ? null : Number(targetGradeYear),
      eventDate: fromCaracasDateTimeLocalValue(eventDateLocal),
      locationLabel: locationLabel.trim() || null,
      coverWebpUrl,
      themePalette: palette,
      isPinned,
      isPublished: true,
      expiresAt: fromCaracasDateTimeLocalValue(expiresAtLocal),
    };

    const parsed = upsertAnnouncementSchema.safeParse(payload);
    if (!parsed.success) {
      toast.error(
        parsed.error.issues[0]?.message ??
          "Completa los campos requeridos antes de publicar."
      );
      return;
    }

    submitLockRef.current = true;
    setSubmitting(true);
    try {
      const result = await upsertSchoolAnnouncementAction(parsed.data);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success(
        editingItem
          ? "Comunicado actualizado en La Cartelera Bellista."
          : "Comunicado publicado en La Cartelera Bellista."
      );
      onOpenChange(false);
      onSaved();
    } finally {
      setSubmitting(false);
      submitLockRef.current = false;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {editingItem ? "Editar comunicado" : "Publicar en La Cartelera Bellista"}
          </DialogTitle>
          <DialogDescription>
            {restrictedMencionName
              ? `Este comunicado se publicará para los estudiantes de la mención ${restrictedMencionName}.`
              : "Los comunicados aparecen en el abanico del inicio y en la cartelera escolar, incluidos los alumnos de nuevo ingreso."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="bulletin-title">Título del comunicado</Label>
              <Input
                id="bulletin-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej. Feria Socioproductiva y Muestra Gastronómica 2026"
                maxLength={140}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bulletin-short-note">
                Etiqueta manuscrita de la tarjeta
              </Label>
              <Input
                id="bulletin-short-note"
                value={shortNote}
                onChange={(e) => setShortNote(e.target.value)}
                placeholder="Ej. 19 Ene · Aniversario"
                maxLength={48}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bulletin-category">Categoría</Label>
              <Select
                value={category}
                onValueChange={(val) =>
                  handleCategoryChange(val as AnnouncementCategory)
                }
              >
                <SelectTrigger id="bulletin-category">
                  <SelectValue placeholder="Selecciona categoría" />
                </SelectTrigger>
                <SelectContent>
                  {ANNOUNCEMENT_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {ANNOUNCEMENT_CATEGORY_META[cat].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bulletin-mencion">Mención destino</Label>
              <Select
                value={restrictedMencionId ?? targetMencionId}
                onValueChange={setTargetMencionId}
                disabled={Boolean(restrictedMencionId)}
              >
                <SelectTrigger id="bulletin-mencion">
                  <SelectValue placeholder="Todas las menciones" />
                </SelectTrigger>
                <SelectContent>
                  {!restrictedMencionId ? (
                    <SelectItem value="all">Toda la institución</SelectItem>
                  ) : null}
                  {menciones.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bulletin-grade">Año escolar destino</Label>
              <Select value={targetGradeYear} onValueChange={setTargetGradeYear}>
                <SelectTrigger id="bulletin-grade">
                  <SelectValue placeholder="Todos los años" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los años (1.º a 6.º)</SelectItem>
                  {[1, 2, 3, 4, 5, 6].map((year) => (
                    <SelectItem key={year} value={String(year)}>
                      {year}.º año
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bulletin-event-date">
                Fecha y hora del evento (opcional)
              </Label>
              <Input
                id="bulletin-event-date"
                type="datetime-local"
                value={eventDateLocal}
                onChange={(e) => setEventDateLocal(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bulletin-location">Lugar (opcional)</Label>
              <Input
                id="bulletin-location"
                value={locationLabel}
                onChange={(e) => setLocationLabel(e.target.value)}
                placeholder="Ej. Patio Central · Unare II"
                maxLength={120}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bulletin-body">Mensaje completo</Label>
            <Textarea
              id="bulletin-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Redacta las indicaciones, horario, requisitos o punto de encuentro para los estudiantes..."
              rows={4}
              maxLength={4000}
              required
            />
          </div>

          {/* Portada .webp y paleta cromática dinámica */}
          <div className="rounded-2xl border border-border/70 bg-muted/25 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Palette className="size-4 text-primary" aria-hidden="true" />
                <span className="text-xs font-semibold text-foreground">
                  Imagen del evento y colores del aura dinámica
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  className="hidden"
                  onChange={handleSelectCoverFile}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploadingCover}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploadingCover ? (
                    <Spinner className="mr-1.5 size-3.5" />
                  ) : (
                    <ImagePlus className="mr-1.5 size-3.5" aria-hidden="true" />
                  )}
                  <span>
                    {coverWebpUrl ? "Cambiar imagen" : "Subir imagen"}
                  </span>
                </Button>
                {coverWebpUrl ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setCoverWebpUrl(null)}
                  >
                    <Trash2 className="mr-1 size-3.5" aria-hidden="true" />
                    Quitar
                  </Button>
                ) : null}
              </div>
            </div>

            {coverWebpUrl ? (
              <div className="mt-3 overflow-hidden rounded-xl border border-border/60">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={coverWebpUrl}
                  alt="Vista previa de portada"
                  className="h-36 w-full object-cover"
                />
              </div>
            ) : (
              <div
                className="mt-3 flex h-20 items-center justify-between rounded-xl px-4 text-xs text-white"
                style={{
                  background: `linear-gradient(125deg, ${palette.primary}, ${palette.secondary}, ${palette.accent})`,
                }}
              >
                <span className="font-medium">
                  Sin imagen: se generará un afiche editorial con esta paleta.
                </span>
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {(
                  [
                    ["primary", "Primario"],
                    ["secondary", "Secundario"],
                    ["accent", "Acento"],
                    ["glow", "Resplandor"],
                  ] as const
                ).map(([key, label]) => (
                  <label
                    key={key}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border/70 bg-background px-2.5 py-1 text-[11px]"
                  >
                    <input
                      type="color"
                      value={palette[key]}
                      onChange={(e) => {
                        setPalette((prev) => ({
                          ...prev,
                          [key]: e.target.value,
                        }));
                        setPaletteCustomized(true);
                      }}
                      className="size-4 cursor-pointer rounded-full border-0 bg-transparent p-0"
                    />
                    <span className="text-muted-foreground">{label}</span>
                  </label>
                ))}
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleResetPalette}
              >
                <RotateCcw className="mr-1 size-3" aria-hidden="true" />
                Restablecer
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="bulletin-expires-at">
                Vigencia hasta (opcional)
              </Label>
              <Input
                id="bulletin-expires-at"
                type="datetime-local"
                value={expiresAtLocal}
                onChange={(e) => setExpiresAtLocal(e.target.value)}
              />
            </div>

            <label className="mt-2 flex cursor-pointer items-center gap-2.5 rounded-xl border border-border/70 bg-muted/20 px-3.5 py-2.5 sm:mt-5">
              <input
                type="checkbox"
                checked={isPinned}
                onChange={(e) => setIsPinned(e.target.checked)}
                className="size-4 accent-primary"
              />
              <Pin className="size-4 text-amber-500" aria-hidden="true" />
              <span className="text-xs font-medium text-foreground">
                Fijar como anuncio destacado
              </span>
            </label>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting || uploadingCover}>
              {submitting ? <Spinner className="mr-1.5 size-4" /> : null}
              <span>
                {editingItem ? "Guardar cambios" : "Publicar comunicado"}
              </span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

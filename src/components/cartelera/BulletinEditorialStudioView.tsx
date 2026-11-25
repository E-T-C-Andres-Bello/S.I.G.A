"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArrowUpRight,
  Building2,
  CalendarDays,
  CheckCheck,
  Cloud,
  Eraser,
  Eye,
  FileEdit,
  FileText,
  ImagePlus,
  Lock,
  MapPin,
  Megaphone,
  Palette,
  Pencil,
  Pin,
  Plus,
  RotateCcw,
  Save,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  archiveSchoolAnnouncementAction,
  upsertSchoolAnnouncementAction,
} from "@/features/cartelera/announcements-actions";
import type { SchoolBulletinData } from "@/features/cartelera/announcements-data";
import {
  BULLETIN_TEMPLATES,
  type BulletinTemplate,
} from "@/features/cartelera/bulletin-templates";
import type { DashboardUserProfile } from "@/lib/auth/dashboard-session";
import { compressImageToWebpClient } from "@/lib/storage/media-optimizer";
import { extractImagePaletteClient } from "@/lib/storage/palette-extractor";
import {
  ANNOUNCEMENT_CATEGORIES,
  ANNOUNCEMENT_CATEGORY_META,
  BULLETIN_SHORT_NOTE_MAX_LENGTH,
  BULLETIN_TITLE_MAX_LENGTH,
  formatAnnouncementAudience,
  formatAnnouncementCountdown,
  hexToRgba,
  resolveAnnouncementPalette,
  stripRichFormatting,
  upsertAnnouncementSchema,
  type AnnouncementCategory,
  type AnnouncementThemePalette,
  type SchoolAnnouncementItem,
} from "@/lib/validators/bulletin";
import type { BulletinAiSuggestion } from "@/lib/validators/bulletin-ai";
import {
  BulletinAgentsOverlay,
  type BulletinAiStage,
} from "./BulletinAgentsOverlay";
import { BulletinAiAssistantChat } from "./BulletinAiAssistantChat";
import { BulletinRichText } from "./BulletinRichText";
import { BulletinWordEditor } from "./BulletinWordEditor";

export interface BulletinEditorialStudioViewProps {
  profile: DashboardUserProfile;
  initialData: SchoolBulletinData;
  initialEditId?: string | null;
}

function toCaracasDateTimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  const shifted = new Date(ms - 4 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 16);
}

function fromCaracasDateTimeLocalValue(localValue: string): string | null {
  const clean = localValue.trim();
  if (!clean) return null;
  return `${clean}:00-04:00`;
}

function formatDateBadge(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  return new Intl.DateTimeFormat("es-VE", {
    timeZone: "America/Caracas",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(ms));
}

function formatAutosaveTime(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  return new Intl.DateTimeFormat("es-VE", {
    timeZone: "America/Caracas",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(ms));
}

interface LocalStudioAutosave {
  title: string;
  shortNote: string;
  body: string;
  category: AnnouncementCategory;
  targetMencionId: string;
  targetGradeYear: string;
  eventDateLocal: string;
  expiresAtLocal: string;
  locationLabel: string;
  isPinned: boolean;
  coverWebpUrl: string | null;
  palette: AnnouncementThemePalette;
  paletteCustomized: boolean;
  savedAt: string;
}

function getAutosaveStorageKey(userId: string, editingId: string | null): string {
  return `siga:bulletin-studio-autosave:v1:${userId}:${editingId ?? "new"}`;
}

export function BulletinEditorialStudioView({
  profile,
  initialData,
  initialEditId = null,
}: BulletinEditorialStudioViewProps) {
  const router = useRouter();
  const [items, setItems] = React.useState<SchoolAnnouncementItem[]>(
    initialData.items
  );
  const [activeTab, setActiveTab] = React.useState<
    "redactar" | "mis_anuncios" | "institucion"
  >("redactar");
  const [previewMode, setPreviewMode] = React.useState<"tarjeta" | "lectura">(
    "tarjeta"
  );

  // Estado del formulario editorial
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [title, setTitle] = React.useState("");
  const [shortNote, setShortNote] = React.useState("");
  const [body, setBody] = React.useState("");
  const [category, setCategory] = React.useState<AnnouncementCategory>(
    initialData.restrictedMencionId || initialData.allowedGradeYears
      ? "mencion"
      : "evento"
  );
  const [targetMencionId, setTargetMencionId] = React.useState<string>(
    initialData.restrictedMencionId ?? "all"
  );
  const [targetGradeYear, setTargetGradeYear] = React.useState<string>(
    initialData.allowedGradeYears ? "6" : "all"
  );
  const [eventDateLocal, setEventDateLocal] = React.useState("");
  const [expiresAtLocal, setExpiresAtLocal] = React.useState("");
  const [locationLabel, setLocationLabel] = React.useState("");
  const [isPinned, setIsPinned] = React.useState(false);
  const [coverWebpUrl, setCoverWebpUrl] = React.useState<string | null>(null);
  const [palette, setPalette] = React.useState<AnnouncementThemePalette>(() => {
    const defaultCat: AnnouncementCategory =
      initialData.restrictedMencionId || initialData.allowedGradeYears
        ? "mencion"
        : "evento";
    const mentionCode =
      initialData.menciones.find((m) => m.id === initialData.restrictedMencionId)
        ?.code ?? null;
    return resolveAnnouncementPalette(null, defaultCat, mentionCode);
  });
  const [paletteCustomized, setPaletteCustomized] = React.useState(false);

  const [uploadingCover, setUploadingCover] = React.useState(false);
  const [savingAction, setSavingAction] = React.useState<
    null | "draft" | "publish"
  >(null);
  const [archivingId, setArchivingId] = React.useState<string | null>(null);
  const [lastAutosavedAt, setLastAutosavedAt] = React.useState<string | null>(
    null
  );
  const [confirmClearAll, setConfirmClearAll] = React.useState(false);

  // Estado de coreografía de mini-agentes + deshacer instantáneo
  const [aiAnimating, setAiAnimating] = React.useState(false);
  const [aiStage, setAiStage] = React.useState<BulletinAiStage>("title");
  const [aiProgress, setAiProgress] = React.useState(0);
  const [aiPhaseLabel, setAiPhaseLabel] = React.useState(
    "Mini-agentes redactando tu comunicado..."
  );
  const [aiUndoSnapshot, setAiUndoSnapshot] = React.useState<{
    title: string;
    shortNote: string;
    body: string;
    category: AnnouncementCategory;
    locationLabel: string;
  } | null>(null);
  const sheetRef = React.useRef<HTMLElement | null>(null);
  const aiTimersRef = React.useRef<number[]>([]);
  const pendingAiApplyRef = React.useRef<(() => void) | null>(null);

  const clearAiTimers = React.useCallback(() => {
    for (const id of aiTimersRef.current) {
      window.clearTimeout(id);
      window.clearInterval(id);
    }
    aiTimersRef.current = [];
  }, []);

  React.useEffect(() => clearAiTimers, [clearAiTimers]);

  const handleSkipAiAnimation = React.useCallback(() => {
    clearAiTimers();
    pendingAiApplyRef.current?.();
    pendingAiApplyRef.current = null;
    setAiAnimating(false);
    setAiProgress(0);
  }, [clearAiTimers]);

  const handleUndoAiApply = React.useCallback(() => {
    if (!aiUndoSnapshot) return;
    clearAiTimers();
    setAiAnimating(false);
    setAiProgress(0);
    setTitle(aiUndoSnapshot.title);
    setShortNote(aiUndoSnapshot.shortNote);
    setBody(aiUndoSnapshot.body);
    setCategory(aiUndoSnapshot.category);
    setLocationLabel(aiUndoSnapshot.locationLabel);
    setAiUndoSnapshot(null);
    toast.info("Se restauró la versión anterior de tu hoja.");
  }, [aiUndoSnapshot, clearAiTimers]);

  const handleApplyAiSuggestion = React.useCallback(
    (suggestion: BulletinAiSuggestion, scope: "full" | "body") => {
      clearAiTimers();

      // Guardar estado previo para Deshacer en 1 clic (LLM06)
      setAiUndoSnapshot({
        title,
        shortNote,
        body,
        category,
        locationLabel,
      });

      const finalTitle =
        scope === "full" && suggestion.title
          ? suggestion.title.slice(0, BULLETIN_TITLE_MAX_LENGTH)
          : title;
      const finalShortNote =
        scope === "full" && suggestion.shortNote
          ? suggestion.shortNote.slice(0, BULLETIN_SHORT_NOTE_MAX_LENGTH)
          : shortNote;
      const finalCategory =
        scope === "full" && suggestion.category
          ? suggestion.category
          : category;
      const finalLocation =
        scope === "full" && suggestion.locationLabel
          ? suggestion.locationLabel
          : locationLabel;
      const finalBody = suggestion.body ?? body;

      const applyImmediate = () => {
        setTitle(finalTitle);
        setShortNote(finalShortNote);
        setCategory(finalCategory);
        setLocationLabel(finalLocation);
        setBody(finalBody);
        setAiAnimating(false);
        setAiProgress(0);
        pendingAiApplyRef.current = null;
        toast.success(
          "Propuesta aplicada en tu hoja. Puedes revisarla o pulsar Deshacer."
        );
      };

      const prefersReducedMotion =
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

      if (prefersReducedMotion) {
        applyImmediate();
        return;
      }

      pendingAiApplyRef.current = applyImmediate;
      const startsWithBodyOnly = scope === "body" || !suggestion.title;
      setAiAnimating(true);
      setAiProgress(0);
      setAiStage(startsWithBodyOnly ? "body" : "title");
      setAiPhaseLabel(
        startsWithBodyOnly
          ? "Redactor y Corrector escribiendo el cuerpo..."
          : "Redactor componiendo el titular..."
      );

      // Revelado progresivo (~2.1 s) sincronizado con las coordenadas reales de cada campo
      let step = 0;
      const totalSteps = 32;
      const intervalId = window.setInterval(() => {
        step += 1;
        const progress = step / totalSteps;
        setAiProgress(progress);

        if (startsWithBodyOnly) {
          setAiStage("body");
          setAiPhaseLabel("Redactor y Corrector escribiendo el cuerpo...");
          if (suggestion.body) {
            setBody(
              finalBody.slice(
                0,
                Math.max(1, Math.ceil(finalBody.length * progress))
              )
            );
          }
        } else {
          if (progress <= 0.34) {
            setAiStage("title");
            setAiPhaseLabel("Redactor componiendo el titular...");
            if (suggestion.title) {
              const tRatio = Math.min(1, progress / 0.34);
              setTitle(
                finalTitle.slice(
                  0,
                  Math.max(1, Math.ceil(finalTitle.length * tRatio))
                )
              );
            }
          } else if (progress <= 0.56) {
            setTitle(finalTitle);
            setAiStage("meta");
            setAiPhaseLabel("Estilo ajustando etiqueta y categoría...");
            if (suggestion.shortNote) {
              const nRatio = Math.min(1, (progress - 0.34) / 0.16);
              setShortNote(
                finalShortNote.slice(
                  0,
                  Math.max(1, Math.ceil(finalShortNote.length * nRatio))
                )
              );
            }
            if (progress >= 0.48) {
              if (suggestion.category) setCategory(finalCategory);
              if (suggestion.locationLabel) setLocationLabel(finalLocation);
            }
          } else {
            setTitle(finalTitle);
            setShortNote(finalShortNote);
            if (suggestion.category) setCategory(finalCategory);
            if (suggestion.locationLabel) setLocationLabel(finalLocation);
            setAiStage("body");
            setAiPhaseLabel("Redactor y Corrector puliendo el texto...");
            if (suggestion.body) {
              const bRatio = Math.min(1, (progress - 0.56) / 0.44);
              setBody(
                finalBody.slice(
                  0,
                  Math.max(1, Math.ceil(finalBody.length * bRatio))
                )
              );
            }
          }
        }

        if (step >= totalSteps) {
          clearAiTimers();
          applyImmediate();
        }
      }, 65);

      aiTimersRef.current.push(intervalId);
    },
    [body, category, clearAiTimers, locationLabel, shortNote, title]
  );

  const submitLockRef = React.useRef(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const autosaveHydratedRef = React.useRef(false);

  const clearLocalAutosave = React.useCallback(
    (targetEditId: string | null) => {
      if (typeof window === "undefined") return;
      try {
        window.localStorage.removeItem(
          getAutosaveStorageKey(profile.internalUserId, targetEditId)
        );
      } catch {
        // Ignorar si localStorage está restringido
      }
      setLastAutosavedAt(null);
    },
    [profile.internalUserId]
  );

  const applyAutosaveSnapshot = React.useCallback(
    (snap: LocalStudioAutosave) => {
      setTitle(snap.title.slice(0, BULLETIN_TITLE_MAX_LENGTH));
      setShortNote(snap.shortNote.slice(0, BULLETIN_SHORT_NOTE_MAX_LENGTH));
      setBody(snap.body);
      setCategory(snap.category);
      setTargetMencionId(
        initialData.restrictedMencionId ?? snap.targetMencionId
      );
      setTargetGradeYear(
        initialData.allowedGradeYears
          ? snap.targetGradeYear === "5"
            ? "5"
            : "6"
          : snap.targetGradeYear
      );
      setEventDateLocal(snap.eventDateLocal);
      setExpiresAtLocal(snap.expiresAtLocal);
      setLocationLabel(snap.locationLabel);
      setIsPinned(snap.isPinned);
      setCoverWebpUrl(snap.coverWebpUrl);
      setPalette(snap.palette);
      setPaletteCustomized(snap.paletteCustomized);
      setLastAutosavedAt(snap.savedAt);
    },
    [initialData.allowedGradeYears, initialData.restrictedMencionId]
  );

  const readLocalAutosave = React.useCallback(
    (targetEditId: string | null): LocalStudioAutosave | null => {
      if (typeof window === "undefined") return null;
      try {
        const raw = window.localStorage.getItem(
          getAutosaveStorageKey(profile.internalUserId, targetEditId)
        );
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<LocalStudioAutosave>;
        if (
          typeof parsed.title !== "string" ||
          typeof parsed.body !== "string" ||
          typeof parsed.savedAt !== "string"
        ) {
          return null;
        }
        return parsed as LocalStudioAutosave;
      } catch {
        return null;
      }
    },
    [profile.internalUserId]
  );

  React.useEffect(() => {
    setItems(initialData.items);
  }, [initialData.items]);

  const loadItemIntoEditor = React.useCallback(
    (item: SchoolAnnouncementItem) => {
      if (!item.canEdit) {
        toast.info(
          "Solo el autor original o Dirección pueden editar este comunicado."
        );
        return;
      }
      setEditingId(item.id);
      const localDraft = readLocalAutosave(item.id);
      if (
        localDraft &&
        Date.parse(localDraft.savedAt) > Date.parse(item.updatedAt)
      ) {
        applyAutosaveSnapshot(localDraft);
        toast.info(
          "Se recuperaron tus cambios sin guardar de este comunicado."
        );
      } else {
        setTitle(item.title.slice(0, BULLETIN_TITLE_MAX_LENGTH));
        setShortNote(item.shortNote.slice(0, BULLETIN_SHORT_NOTE_MAX_LENGTH));
        setBody(item.body);
        setCategory(item.category);
        setTargetMencionId(
          initialData.restrictedMencionId ?? item.targetMencionId ?? "all"
        );
        setTargetGradeYear(
          item.targetGradeYear
            ? String(item.targetGradeYear)
            : initialData.allowedGradeYears
              ? "6"
              : "all"
        );
        setEventDateLocal(toCaracasDateTimeLocalValue(item.eventDate));
        setExpiresAtLocal(toCaracasDateTimeLocalValue(item.expiresAt));
        setLocationLabel(item.locationLabel ?? "");
        setIsPinned(item.isPinned);
        setCoverWebpUrl(item.coverWebpUrl);
        setPalette(item.themePalette);
        setPaletteCustomized(true);
        setLastAutosavedAt(null);
      }
      setConfirmClearAll(false);
      setActiveTab("redactar");
    },
    [
      applyAutosaveSnapshot,
      initialData.allowedGradeYears,
      initialData.restrictedMencionId,
      readLocalAutosave,
    ]
  );

  // Abrir anuncio en edición (?edit=<uuid>) o restaurar borrador automático local
  const initializedEditRef = React.useRef(false);
  React.useEffect(() => {
    if (initializedEditRef.current) return;
    initializedEditRef.current = true;

    if (initialEditId) {
      const match = initialData.items.find((it) => it.id === initialEditId);
      if (match) {
        loadItemIntoEditor(match);
        autosaveHydratedRef.current = true;
        return;
      }
    }

    const savedNew = readLocalAutosave(null);
    if (
      savedNew &&
      (savedNew.title.trim() ||
        savedNew.body.trim() ||
        savedNew.shortNote.trim() ||
        savedNew.coverWebpUrl)
    ) {
      applyAutosaveSnapshot(savedNew);
      toast.info(
        `Recuperamos tu avance guardado automáticamente (${formatAutosaveTime(savedNew.savedAt)}).`
      );
    }
    autosaveHydratedRef.current = true;
  }, [
    applyAutosaveSnapshot,
    initialData.items,
    initialEditId,
    loadItemIntoEditor,
    readLocalAutosave,
  ]);

  // Autoguardado automático continuo + respaldo inmediato al salir de la pestaña
  const latestDraftRef = React.useRef<Omit<LocalStudioAutosave, "savedAt"> | null>(
    null
  );
  latestDraftRef.current = {
    title,
    shortNote,
    body,
    category,
    targetMencionId,
    targetGradeYear,
    eventDateLocal,
    expiresAtLocal,
    locationLabel,
    isPinned,
    coverWebpUrl,
    palette,
    paletteCustomized,
  };

  const persistAutosaveNow = React.useCallback(() => {
    if (!autosaveHydratedRef.current || typeof window === "undefined") return;
    const current = latestDraftRef.current;
    if (!current) return;

    const hasContent = Boolean(
      current.title.trim() ||
        current.shortNote.trim() ||
        current.body.trim() ||
        current.locationLabel.trim() ||
        current.coverWebpUrl
    );
    const key = getAutosaveStorageKey(profile.internalUserId, editingId);

    try {
      if (!hasContent) {
        window.localStorage.removeItem(key);
        setLastAutosavedAt(null);
        return;
      }
      const savedAt = new Date().toISOString();
      const payload: LocalStudioAutosave = { ...current, savedAt };
      window.localStorage.setItem(key, JSON.stringify(payload));
      setLastAutosavedAt(savedAt);
    } catch {
      // Ignorar si almacenamiento local está lleno o restringido
    }
  }, [editingId, profile.internalUserId]);

  React.useEffect(() => {
    if (!autosaveHydratedRef.current) return;
    const timer = window.setTimeout(persistAutosaveNow, 650);
    return () => window.clearTimeout(timer);
  }, [
    title,
    shortNote,
    body,
    category,
    targetMencionId,
    targetGradeYear,
    eventDateLocal,
    expiresAtLocal,
    locationLabel,
    isPinned,
    coverWebpUrl,
    palette,
    paletteCustomized,
    persistAutosaveNow,
  ]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        persistAutosaveNow();
      }
    };
    window.addEventListener("pagehide", persistAutosaveNow);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("pagehide", persistAutosaveNow);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [persistAutosaveNow]);

  const resetEditorToBlank = React.useCallback(
    (clearAutosave = false) => {
      const prevEditId = editingId;
      const defaultCat: AnnouncementCategory =
        initialData.restrictedMencionId || initialData.allowedGradeYears
          ? "mencion"
          : "evento";
      const mentionCode =
        initialData.menciones.find(
          (m) => m.id === initialData.restrictedMencionId
        )?.code ?? null;
      setEditingId(null);
      setTitle("");
      setShortNote("");
      setBody("");
      setCategory(defaultCat);
      setTargetMencionId(initialData.restrictedMencionId ?? "all");
      setTargetGradeYear(initialData.allowedGradeYears ? "6" : "all");
      setEventDateLocal("");
      setExpiresAtLocal("");
      setLocationLabel("");
      setIsPinned(false);
      setCoverWebpUrl(null);
      setPalette(resolveAnnouncementPalette(null, defaultCat, mentionCode));
      setPaletteCustomized(false);
      setConfirmClearAll(false);
      if (clearAutosave) {
        clearLocalAutosave(prevEditId);
        clearLocalAutosave(null);
      }
    },
    [
      clearLocalAutosave,
      editingId,
      initialData.allowedGradeYears,
      initialData.menciones,
      initialData.restrictedMencionId,
    ]
  );

  const handleClearAllContent = () => {
    const hasContent = Boolean(
      title.trim() ||
        shortNote.trim() ||
        body.trim() ||
        locationLabel.trim() ||
        eventDateLocal ||
        expiresAtLocal ||
        coverWebpUrl
    );
    if (!hasContent) {
      toast.info("La hoja ya está en blanco.");
      return;
    }
    if (!confirmClearAll) {
      setConfirmClearAll(true);
      window.setTimeout(() => setConfirmClearAll(false), 4500);
      return;
    }
    resetEditorToBlank(true);
    toast.success("Se limpió toda la hoja y el borrador automático.");
  };

  const applyTemplate = (tpl: BulletinTemplate) => {
    setTitle(tpl.title);
    setShortNote(tpl.shortNote);
    setBody(tpl.body);
    setCategory(tpl.category);
    setLocationLabel(tpl.locationLabel);
    setIsPinned(tpl.isPinned);
    if (initialData.allowedGradeYears) {
      setTargetGradeYear(
        tpl.suggestedGradeYear &&
          initialData.allowedGradeYears.includes(tpl.suggestedGradeYear)
          ? String(tpl.suggestedGradeYear)
          : "6"
      );
    } else if (tpl.suggestedGradeYear) {
      setTargetGradeYear(String(tpl.suggestedGradeYear));
    }

    if (!coverWebpUrl) {
      const mentionCode =
        targetMencionId !== "all"
          ? initialData.menciones.find((m) => m.id === targetMencionId)?.code ??
            null
          : null;
      setPalette(resolveAnnouncementPalette(null, tpl.category, mentionCode));
      setPaletteCustomized(false);
    }
    toast.success(`Plantilla "${tpl.name}" cargada en tu hoja.`);
  };

  const handleCategoryChange = (nextCategory: AnnouncementCategory) => {
    setCategory(nextCategory);
    if (!paletteCustomized && !coverWebpUrl) {
      const mentionCode =
        targetMencionId !== "all"
          ? initialData.menciones.find((m) => m.id === targetMencionId)?.code ??
            null
          : null;
      setPalette(resolveAnnouncementPalette(null, nextCategory, mentionCode));
    }
  };

  const handleResetPalette = () => {
    const mentionCode =
      targetMencionId !== "all"
        ? initialData.menciones.find((m) => m.id === targetMencionId)?.code ??
          null
        : null;
    setPalette(resolveAnnouncementPalette(null, category, mentionCode));
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
            "Aplicamos los colores extraídos al afiche, aunque el almacenamiento de imágenes no respondió."
        );
        return;
      }

      setCoverWebpUrl(json.coverWebpUrl);
      toast.success(
        "Portada optimizada y aura cromática adaptada a tu imagen."
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo procesar la imagen seleccionada."
      );
    } finally {
      setUploadingCover(false);
    }
  };

  const handleSave = async (publishNow: boolean) => {
    if (submitLockRef.current || uploadingCover) return;

    const finalGradeYear = initialData.allowedGradeYears
      ? Number(targetGradeYear === "5" ? 5 : 6)
      : targetGradeYear === "all"
        ? null
        : Number(targetGradeYear);

    const payload = {
      announcementId: editingId,
      title,
      shortNote:
        shortNote.trim() ||
        title.trim().slice(0, BULLETIN_SHORT_NOTE_MAX_LENGTH),
      body,
      category,
      targetMencionId:
        initialData.restrictedMencionId ??
        (targetMencionId === "all" ? null : targetMencionId),
      targetGradeYear: finalGradeYear,
      eventDate: fromCaracasDateTimeLocalValue(eventDateLocal),
      locationLabel: locationLabel.trim() || null,
      coverWebpUrl,
      themePalette: palette,
      isPinned: publishNow ? isPinned : false,
      isPublished: publishNow,
      expiresAt: fromCaracasDateTimeLocalValue(expiresAtLocal),
    };

    const parsed = upsertAnnouncementSchema.safeParse(payload);
    if (!parsed.success) {
      toast.error(
        parsed.error.issues[0]?.message ??
          "Completa título, etiqueta y contenido antes de guardar."
      );
      return;
    }

    submitLockRef.current = true;
    setSavingAction(publishNow ? "publish" : "draft");

    try {
      const res = await upsertSchoolAnnouncementAction(parsed.data);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }

      toast.success(
        publishNow
          ? editingId
            ? "Comunicado actualizado y publicado en La Cartelera Bellista."
            : "Comunicado publicado en La Cartelera Bellista."
          : "Borrador guardado en tu bandeja editorial."
      );

      clearLocalAutosave(editingId);
      clearLocalAutosave(res.data.id);

      if (publishNow) {
        resetEditorToBlank(true);
        setActiveTab("mis_anuncios");
      } else {
        setEditingId(res.data.id);
      }
      router.refresh();
    } finally {
      setSavingAction(null);
      submitLockRef.current = false;
    }
  };

  const handlePublishDraftQuick = async (item: SchoolAnnouncementItem) => {
    if (!item.canEdit || submitLockRef.current) return;
    submitLockRef.current = true;
    try {
      const res = await upsertSchoolAnnouncementAction({
        announcementId: item.id,
        title: item.title,
        shortNote: item.shortNote,
        body: item.body,
        category: item.category,
        targetMencionId: item.targetMencionId,
        targetGradeYear: item.targetGradeYear,
        eventDate: item.eventDate,
        locationLabel: item.locationLabel,
        coverWebpUrl: item.coverWebpUrl,
        themePalette: item.themePalette,
        isPinned: item.isPinned,
        isPublished: true,
        expiresAt: item.expiresAt,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success("Borrador publicado en La Cartelera Bellista.");
      router.refresh();
    } finally {
      submitLockRef.current = false;
    }
  };

  const handleArchive = async (item: SchoolAnnouncementItem) => {
    if (!item.canEdit || archivingId) return;
    setArchivingId(item.id);
    try {
      const res = await archiveSchoolAnnouncementAction(item.id);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      setItems((prev) => prev.filter((it) => it.id !== item.id));
      if (editingId === item.id) {
        resetEditorToBlank();
      }
      toast.success("Comunicado archivado.");
      router.refresh();
    } finally {
      setArchivingId(null);
    }
  };

  const myItems = React.useMemo(
    () => items.filter((it) => it.createdBy === profile.internalUserId),
    [items, profile.internalUserId]
  );

  const selectedMentionName = React.useMemo(() => {
    const id = initialData.restrictedMencionId ?? targetMencionId;
    if (!id || id === "all") return null;
    return initialData.menciones.find((m) => m.id === id)?.name ?? null;
  }, [initialData.menciones, initialData.restrictedMencionId, targetMencionId]);

  const previewGradeYear = initialData.allowedGradeYears
    ? Number(targetGradeYear === "5" ? 5 : 6)
    : targetGradeYear === "all"
      ? null
      : Number(targetGradeYear);

  const previewAudience = formatAnnouncementAudience(
    selectedMentionName,
    previewGradeYear
  );
  const previewCountdown = formatAnnouncementCountdown(
    fromCaracasDateTimeLocalValue(eventDateLocal)
  );
  const previewExcerpt =
    stripRichFormatting(body) ||
    "Tu resumen aparecerá aquí automáticamente mientras redactas en la hoja.";

  const scopeNotice = initialData.isDireccion
    ? "Supervisión institucional completa: puedes redactar para cualquier grupo y moderar cualquier comunicado del plantel."
    : initialData.restrictedMencionName
      ? `Alcance editorial: comunicados de la mención ${initialData.restrictedMencionName}. Solo puedes editar tus propios comunicados.`
      : initialData.allowedGradeYears
        ? "Alcance editorial: comunicados de Pasantías y Pre-pasantías (5.º y 6.º año). Solo puedes editar tus propios comunicados."
        : "Alcance editorial: comunicados institucionales. Solo puedes editar tus propios comunicados para evitar conflictos entre departamentos.";

  const renderEditorialList = (
    list: SchoolAnnouncementItem[],
    emptyTitle: string
  ) => {
    if (list.length === 0) {
      return (
        <div className="siga-glass-surface flex flex-col items-center justify-center rounded-[24px] border border-dashed px-6 py-14 text-center">
          <FileText className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-foreground">
            {emptyTitle}
          </p>
          <Button
            type="button"
            size="sm"
            className="mt-4 rounded-full"
            onClick={() => {
              resetEditorToBlank();
              setActiveTab("redactar");
            }}
          >
            <Plus className="mr-1.5 size-4" aria-hidden="true" />
            Redactar nuevo comunicado
          </Button>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {list.map((item) => {
          const meta = ANNOUNCEMENT_CATEGORY_META[item.category];
          return (
            <article
              key={item.id}
              className="siga-glass-surface flex flex-col justify-between gap-4 rounded-[22px] border p-4 sm:p-5"
            >
              <div className="flex items-start gap-3.5">
                <div
                  className="size-14 shrink-0 overflow-hidden rounded-2xl border border-white/20"
                  style={{
                    background: `linear-gradient(135deg, ${item.themePalette.primary}, ${item.themePalette.secondary})`,
                  }}
                >
                  {item.coverWebpUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.coverWebpUrl}
                      alt={item.title}
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="grid size-full place-items-center text-white">
                      <Megaphone className="size-5" aria-hidden="true" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge
                      variant={item.isPublished ? "default" : "secondary"}
                      className="rounded-full text-[10.5px]"
                    >
                      {item.isPublished ? "Publicado" : "Borrador"}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={cn(
                        "rounded-full text-[10.5px]",
                        meta.badgeClassName
                      )}
                    >
                      {meta.shortLabel}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="rounded-full text-[10.5px]"
                    >
                      <Building2 className="mr-1 size-3" aria-hidden="true" />
                      {item.authorDepartment}
                    </Badge>
                    {item.isPinned ? (
                      <Badge
                        variant="outline"
                        className="rounded-full border-amber-500/40 bg-amber-500/10 text-[10.5px] text-amber-700 dark:text-amber-300"
                      >
                        <Pin className="mr-1 size-3" aria-hidden="true" />
                        Fijado
                      </Badge>
                    ) : null}
                  </div>

                  <h3 className="mt-2 line-clamp-2 text-sm font-semibold text-foreground">
                    {item.title}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {stripRichFormatting(item.body)}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-1">
                    <Users className="size-3.5" aria-hidden="true" />
                    {formatAnnouncementAudience(
                      item.targetMencionName,
                      item.targetGradeYear
                    )}
                  </span>
                  <span className="inline-flex items-center gap-1 font-medium text-foreground/80">
                    <CheckCheck className="size-3.5 text-primary" aria-hidden="true" />
                    {item.readCount} enterados
                  </span>
                  <span>{formatDateBadge(item.updatedAt)}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  {item.canEdit ? (
                    <>
                      {!item.isPublished ? (
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 rounded-full px-3 text-xs"
                          onClick={() => handlePublishDraftQuick(item)}
                        >
                          <Send className="mr-1 size-3" aria-hidden="true" />
                          Publicar
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-full px-3 text-xs"
                        onClick={() => loadItemIntoEditor(item)}
                      >
                        <Pencil className="mr-1 size-3" aria-hidden="true" />
                        Editar
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 rounded-full text-muted-foreground hover:text-destructive"
                        aria-label={`Archivar ${item.title}`}
                        disabled={archivingId === item.id}
                        onClick={() => handleArchive(item)}
                      >
                        <Archive className="size-3.5" aria-hidden="true" />
                      </Button>
                    </>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-border/70 px-2.5 py-1 text-[10.5px] text-muted-foreground">
                      <Lock className="size-3" aria-hidden="true" />
                      Solo autor o Dirección
                    </span>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-5 pb-10">
      {/* Cabecera del Estudio Editorial */}
      <header className="siga-glass-surface flex flex-col justify-between gap-4 rounded-[28px] border p-5 sm:flex-row sm:items-center sm:p-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="siga-glass-inner inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold text-primary dark:text-[#7dd3fc]">
              <FileEdit className="size-3.5" aria-hidden="true" />
              Estudio Editorial · {initialData.departmentLabel}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
              <ShieldCheck className="size-3.5" aria-hidden="true" />
              Protección anti-conflictos activa
            </span>
          </div>

          <h1 className="mt-2.5 text-2xl font-semibold tracking-[-0.02em] text-foreground sm:text-3xl">
            Gestionar Cartelera Bellista
          </h1>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground sm:text-sm">
            {scopeNotice}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="rounded-full" asChild>
            <Link href="/estudiante/cartelera">
              <span>Ver cartelera</span>
              <ArrowUpRight className="ml-1 size-3.5" aria-hidden="true" />
            </Link>
          </Button>
          {editingId ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="rounded-full"
              onClick={() => resetEditorToBlank(false)}
            >
              <Plus className="mr-1 size-3.5" aria-hidden="true" />
              Nuevo en blanco
            </Button>
          ) : null}
        </div>
      </header>

      <Tabs
        value={activeTab}
        onValueChange={(v) =>
          setActiveTab(v as "redactar" | "mis_anuncios" | "institucion")
        }
        className="flex flex-col gap-5"
      >
        <TabsList className="siga-glass-surface h-auto w-fit flex-wrap justify-start gap-1 rounded-2xl border p-1.5">
          <TabsTrigger value="redactar" className="rounded-xl px-4 py-2 text-xs">
            <FileEdit className="mr-1.5 size-3.5" aria-hidden="true" />
            {editingId ? "Editando comunicado" : "Redactar comunicado"}
          </TabsTrigger>
          <TabsTrigger
            value="mis_anuncios"
            className="rounded-xl px-4 py-2 text-xs"
          >
            <FileText className="mr-1.5 size-3.5" aria-hidden="true" />
            Mis comunicados y borradores ({myItems.length})
          </TabsTrigger>
          {initialData.isDireccion ? (
            <TabsTrigger
              value="institucion"
              className="rounded-xl px-4 py-2 text-xs"
            >
              <Building2 className="mr-1.5 size-3.5" aria-hidden="true" />
              Toda la institución ({items.length})
            </TabsTrigger>
          ) : null}
        </TabsList>

        {/* PESTAÑA 1: ESTUDIO TIPO WORD EN 2 COLUMNAS */}
        <TabsContent value="redactar" className="m-0">
          <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
            {/* COLUMNA IZQUIERDA (7 cols): HOJA TIPO WORD + PORTADA + DESTINATARIOS */}
            <div className="flex flex-col gap-5 xl:col-span-7">
              {/* Plantillas rápidas escolares en 1 clic */}
              <section
                aria-label="Plantillas rápidas escolares"
                className="siga-glass-surface rounded-[24px] border p-4"
              >
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
                  <span>Plantillas rápidas en 1 clic</span>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {BULLETIN_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => applyTemplate(tpl)}
                      className="siga-glass-inner flex cursor-pointer flex-col items-start rounded-xl border px-3 py-2.5 text-left transition-colors hover:border-primary/45 hover:bg-primary/8"
                    >
                      <span className="text-xs font-semibold text-foreground">
                        {tpl.name}
                      </span>
                      <span className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
                        {tpl.description}
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              {/* Hoja del documento */}
              <section
                ref={sheetRef}
                aria-label="Hoja de redacción"
                className="siga-glass-surface relative space-y-4 rounded-[28px] border p-5 sm:p-6"
              >
                <BulletinAgentsOverlay
                  active={aiAnimating}
                  phaseLabel={aiPhaseLabel}
                  stage={aiStage}
                  progress={aiProgress}
                  currentTitle={title}
                  currentShortNote={shortNote}
                  currentBody={body}
                  sheetRef={sheetRef}
                  palette={palette}
                  onSkip={handleSkipAiAnimation}
                />

                {/* Barra superior de estado: Autoguardado + Deshacer IA + Borrar todo */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                    <Cloud
                      className={cn(
                        "size-3.5",
                        lastAutosavedAt
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-muted-foreground/70"
                      )}
                      aria-hidden="true"
                    />
                    {lastAutosavedAt
                      ? `Guardado automáticamente · ${formatAutosaveTime(lastAutosavedAt)}`
                      : "Autoguardado local activo (protegido si sales de la app)"}
                  </span>

                  <div className="flex items-center gap-1.5">
                    {aiUndoSnapshot ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleUndoAiApply}
                        className="h-7 rounded-full px-3 text-[11px]"
                      >
                        <RotateCcw
                          className="mr-1.5 size-3"
                          aria-hidden="true"
                        />
                        <span>Deshacer IA</span>
                      </Button>
                    ) : null}

                    <Button
                      type="button"
                      variant={confirmClearAll ? "destructive" : "ghost"}
                      size="sm"
                      onClick={handleClearAllContent}
                      className="h-7 rounded-full px-3 text-[11px]"
                    >
                      <Eraser className="mr-1.5 size-3.5" aria-hidden="true" />
                      <span>
                        {confirmClearAll
                          ? "Confirmar: borrar todo"
                          : "Borrar todo"}
                      </span>
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label
                      htmlFor="studio-title"
                      className="text-xs text-muted-foreground"
                    >
                      Título del comunicado
                    </Label>
                    <span
                      className={cn(
                        "text-[11px] font-medium tabular-nums",
                        title.length >= BULLETIN_TITLE_MAX_LENGTH - 10
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-muted-foreground"
                      )}
                    >
                      {title.length}/{BULLETIN_TITLE_MAX_LENGTH}
                    </span>
                  </div>
                  <input
                    id="studio-title"
                    data-ai-target="title"
                    value={title}
                    onChange={(e) =>
                      setTitle(
                        e.target.value.slice(0, BULLETIN_TITLE_MAX_LENGTH)
                      )
                    }
                    placeholder="Escribe un título claro y directo..."
                    maxLength={BULLETIN_TITLE_MAX_LENGTH}
                    className="w-full border-b border-border/70 bg-transparent pb-2 text-xl font-semibold tracking-[-0.02em] text-foreground outline-none placeholder:text-muted-foreground/55 focus:border-primary sm:text-2xl"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor="studio-short-note">
                        Etiqueta manuscrita en la tarjeta
                      </Label>
                      <span
                        className={cn(
                          "text-[11px] font-medium tabular-nums",
                          shortNote.length >= BULLETIN_SHORT_NOTE_MAX_LENGTH - 5
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-muted-foreground"
                        )}
                      >
                        {shortNote.length}/{BULLETIN_SHORT_NOTE_MAX_LENGTH}
                      </span>
                    </div>
                    <Input
                      id="studio-short-note"
                      data-ai-target="shortNote"
                      value={shortNote}
                      onChange={(e) =>
                        setShortNote(
                          e.target.value.slice(
                            0,
                            BULLETIN_SHORT_NOTE_MAX_LENGTH
                          )
                        )
                      }
                      placeholder="Ej. 28 Nov · Feria TI"
                      maxLength={BULLETIN_SHORT_NOTE_MAX_LENGTH}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="studio-category">Categoría</Label>
                    <Select
                      value={category}
                      onValueChange={(v) =>
                        handleCategoryChange(v as AnnouncementCategory)
                      }
                    >
                      <SelectTrigger
                        id="studio-category"
                        data-ai-target="category"
                      >
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
                </div>

                {/* Editor tipo Word */}
                <BulletinWordEditor value={body} onChange={setBody} />

                {/* Destinatarios, Fecha y Lugar */}
                <div className="grid grid-cols-1 gap-4 pt-1 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="studio-mencion">Mención destino</Label>
                    <Select
                      value={initialData.restrictedMencionId ?? targetMencionId}
                      onValueChange={setTargetMencionId}
                      disabled={Boolean(initialData.restrictedMencionId)}
                    >
                      <SelectTrigger id="studio-mencion">
                        <SelectValue placeholder="Todas las menciones" />
                      </SelectTrigger>
                      <SelectContent>
                        {!initialData.restrictedMencionId ? (
                          <SelectItem value="all">
                            Toda la institución
                          </SelectItem>
                        ) : null}
                        {initialData.menciones.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="studio-grade">Año escolar destino</Label>
                    <Select
                      value={targetGradeYear}
                      onValueChange={setTargetGradeYear}
                    >
                      <SelectTrigger id="studio-grade">
                        <SelectValue placeholder="Selecciona año" />
                      </SelectTrigger>
                      <SelectContent>
                        {!initialData.allowedGradeYears ? (
                          <SelectItem value="all">
                            Todos los años (1.º a 6.º)
                          </SelectItem>
                        ) : null}
                        {(initialData.allowedGradeYears ?? [1, 2, 3, 4, 5, 6]).map(
                          (year) => (
                            <SelectItem key={year} value={String(year)}>
                              {year}.º año
                              {initialData.allowedGradeYears && year === 6
                                ? " (Pasantes 1440 h)"
                                : initialData.allowedGradeYears && year === 5
                                  ? " (Pre-pasantías)"
                                  : ""}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="studio-event-date">
                      Fecha del evento (opcional)
                    </Label>
                    <Input
                      id="studio-event-date"
                      type="datetime-local"
                      value={eventDateLocal}
                      onChange={(e) => setEventDateLocal(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="studio-location">Lugar (opcional)</Label>
                    <Input
                      id="studio-location"
                      value={locationLabel}
                      onChange={(e) => setLocationLabel(e.target.value)}
                      placeholder="Ej. Patio Central · Unare II"
                      maxLength={120}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="studio-expires">
                      Vigencia hasta (opcional)
                    </Label>
                    <Input
                      id="studio-expires"
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
                      Fijar como destacado en cabecera
                    </span>
                  </label>
                </div>

                {/* Portada y paleta dinámica */}
                <div className="rounded-2xl border border-border/70 bg-muted/25 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Palette className="size-4 text-primary" aria-hidden="true" />
                      <span className="text-xs font-semibold text-foreground">
                        Imagen del evento y aura cromática
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
              </section>
            </div>

            {/* COLUMNA DERECHA (5 cols): VISTA PREVIA EN VIVO + PUBLICAR / BORRADOR */}
            <aside className="flex flex-col gap-4 xl:sticky xl:top-6 xl:col-span-5">
              <div className="siga-glass-surface overflow-hidden rounded-[28px] border">
                <div className="flex items-center justify-between gap-2 border-b border-border/60 px-5 py-3.5">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <Eye className="size-4 text-primary" aria-hidden="true" />
                    Vista previa en vivo
                  </span>

                  <div className="inline-flex rounded-full border border-border/70 bg-muted/40 p-0.5 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setPreviewMode("tarjeta")}
                      className={cn(
                        "cursor-pointer rounded-full px-3 py-1 font-medium transition-colors",
                        previewMode === "tarjeta"
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Tarjeta con Aura
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewMode("lectura")}
                      className={cn(
                        "cursor-pointer rounded-full px-3 py-1 font-medium transition-colors",
                        previewMode === "lectura"
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Vista de Lectura
                    </button>
                  </div>
                </div>

                {previewMode === "tarjeta" ? (
                  <div
                    className="relative flex min-h-[370px] flex-col items-center justify-center overflow-hidden p-6 transition-colors duration-500"
                    style={{
                      background: `radial-gradient(85% 75% at 15% 15%, ${hexToRgba(palette.primary, 0.36)}, transparent 65%), radial-gradient(80% 70% at 85% 25%, ${hexToRgba(palette.secondary, 0.34)}, transparent 65%), radial-gradient(70% 60% at 50% 95%, ${hexToRgba(palette.accent, 0.28)}, transparent 65%)`,
                    }}
                  >
                    <div className="w-[244px] rounded-[26px] border border-white/60 bg-white/95 p-2 shadow-2xl dark:border-white/15 dark:bg-slate-900">
                      <div
                        className="relative flex h-[272px] flex-col justify-between overflow-hidden rounded-[20px] p-4 text-white"
                        style={{
                          background: coverWebpUrl
                            ? "#090f1e"
                            : `radial-gradient(120% 100% at 15% 10%, ${palette.primary} 0%, color-mix(in srgb, ${palette.secondary} 75%, #070b17) 60%, #070b17 100%)`,
                        }}
                      >
                        {coverWebpUrl ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={coverWebpUrl}
                              alt="Vista previa"
                              className="absolute inset-0 size-full object-cover"
                            />
                            <div
                              aria-hidden="true"
                              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/35"
                            />
                          </>
                        ) : null}

                        <div className="relative z-10 flex items-center justify-between gap-2">
                          <span
                            className="inline-flex items-center rounded-full border border-white/25 px-2.5 py-0.5 text-[10px] font-semibold backdrop-blur-md"
                            style={{
                              background: hexToRgba(palette.primary, 0.72),
                            }}
                          >
                            {ANNOUNCEMENT_CATEGORY_META[category].shortLabel}
                          </span>
                          {isPinned ? (
                            <span className="inline-flex size-6 items-center justify-center rounded-full border border-amber-200/45 bg-amber-400/30 text-amber-100">
                              <Pin className="size-3" aria-hidden="true" />
                            </span>
                          ) : null}
                        </div>

                        <div className="relative z-10 my-auto py-2">
                          <p className="line-clamp-3 break-words text-[16px] leading-snug font-semibold text-white">
                            {title.trim() || "Título de tu comunicado"}
                          </p>
                          {!coverWebpUrl ? (
                            <p className="mt-1.5 line-clamp-2 break-words text-[11px] leading-relaxed text-white/80">
                              {previewExcerpt}
                            </p>
                          ) : null}
                        </div>

                        <div className="relative z-10 flex items-center justify-between gap-2 border-t border-white/15 pt-2 text-[10px] text-white/85">
                          <span className="truncate">{previewAudience}</span>
                          {previewCountdown ? (
                            <span className="shrink-0 rounded-full bg-white/18 px-2 py-0.5 font-semibold">
                              {previewCountdown.label}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <p
                      className="mt-4 text-center text-2xl font-semibold text-foreground"
                      style={{
                        fontFamily:
                          'var(--font-handwritten, "Caveat", cursive)',
                      }}
                    >
                      {shortNote.trim() || "Etiqueta manuscrita"}
                    </p>
                  </div>
                ) : (
                  <div className="max-h-[440px] overflow-y-auto p-5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge
                        variant="outline"
                        className={cn(
                          "rounded-full text-[11px]",
                          ANNOUNCEMENT_CATEGORY_META[category].badgeClassName
                        )}
                      >
                        {ANNOUNCEMENT_CATEGORY_META[category].label}
                      </Badge>
                      <Badge variant="outline" className="rounded-full text-[11px]">
                        <Building2 className="mr-1 size-3" aria-hidden="true" />
                        {initialData.departmentLabel}
                      </Badge>
                    </div>

                    <h2 className="mt-3 text-lg leading-snug font-semibold text-foreground">
                      {title.trim() || "Título de tu comunicado"}
                    </h2>

                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Users className="size-3" aria-hidden="true" />
                        {previewAudience}
                      </span>
                      {previewCountdown ? (
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="size-3" aria-hidden="true" />
                          {previewCountdown.formattedDate}
                        </span>
                      ) : null}
                      {locationLabel.trim() ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="size-3" aria-hidden="true" />
                          {locationLabel.trim()}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-4 border-t border-border/60 pt-4">
                      {body.trim() ? (
                        <BulletinRichText
                          content={body}
                          accentColor={palette.primary}
                        />
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Aquí verás en tiempo real los subtítulos, negritas,
                          listas y citas destacadas conforme escribes.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Botones de publicación / borrador */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 bg-muted/20 px-5 py-4">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={savingAction !== null || uploadingCover}
                    onClick={() => handleSave(false)}
                    className="rounded-full"
                  >
                    {savingAction === "draft" ? (
                      <Spinner className="mr-1.5 size-4" />
                    ) : (
                      <Save className="mr-1.5 size-4" aria-hidden="true" />
                    )}
                    <span>Guardar borrador</span>
                  </Button>

                  <Button
                    type="button"
                    disabled={savingAction !== null || uploadingCover}
                    onClick={() => handleSave(true)}
                    className="rounded-full px-5"
                    style={{
                      background: palette.primary,
                      color: "#ffffff",
                    }}
                  >
                    {savingAction === "publish" ? (
                      <Spinner className="mr-1.5 size-4" />
                    ) : (
                      <Send className="mr-1.5 size-4" aria-hidden="true" />
                    )}
                    <span>
                      {editingId ? "Guardar y publicar" : "Publicar ahora"}
                    </span>
                  </Button>
                </div>
              </div>

              {/* Chat Asistente IA debajo de la Vista Previa (Neon -> n8n) */}
              <BulletinAiAssistantChat
                storageKey={`siga:bulletin-ai-chat:v1:${profile.internalUserId}:${editingId ?? "new"}`}
                draft={{
                  title,
                  shortNote,
                  category,
                  locationLabel,
                  audienceLabel: previewAudience,
                  body,
                }}
                palette={palette}
                departmentLabel={initialData.departmentLabel}
                isApplyingSuggestion={aiAnimating}
                onApplySuggestion={handleApplyAiSuggestion}
              />
            </aside>
          </div>
        </TabsContent>

        {/* PESTAÑA 2: MIS COMUNICADOS Y BORRADORES */}
        <TabsContent value="mis_anuncios" className="m-0">
          {renderEditorialList(
            myItems,
            "Todavía no has redactado comunicados ni borradores."
          )}
        </TabsContent>

        {/* PESTAÑA 3: SUPERVISIÓN INSTITUCIONAL (SOLO DIRECCIÓN) */}
        {initialData.isDireccion ? (
          <TabsContent value="institucion" className="m-0">
            {renderEditorialList(
              items,
              "No hay comunicados registrados en la institución."
            )}
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}

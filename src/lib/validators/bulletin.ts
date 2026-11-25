import { z } from "zod";

export const ANNOUNCEMENT_CATEGORIES = [
  "urgente",
  "evento",
  "academico",
  "mencion",
  "cultura_deporte",
] as const;

export type AnnouncementCategory = (typeof ANNOUNCEMENT_CATEGORIES)[number];

const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

export const announcementThemePaletteSchema = z.object({
  primary: z.string().regex(HEX_COLOR_REGEX, "Color primario inválido."),
  secondary: z.string().regex(HEX_COLOR_REGEX, "Color secundario inválido."),
  accent: z.string().regex(HEX_COLOR_REGEX, "Color de acento inválido."),
  glow: z.string().regex(HEX_COLOR_REGEX, "Color de resplandor inválido."),
});

export type AnnouncementThemePalette = z.infer<
  typeof announcementThemePaletteSchema
>;

export interface SchoolAnnouncementItem {
  id: string;
  title: string;
  shortNote: string;
  body: string;
  category: AnnouncementCategory;
  targetMencionId: string | null;
  targetMencionCode: string | null;
  targetMencionName: string | null;
  targetGradeYear: number | null;
  eventDate: string | null;
  locationLabel: string | null;
  coverWebpUrl: string | null;
  themePalette: AnnouncementThemePalette;
  isPinned: boolean;
  isPublished: boolean;
  publishedAt: string;
  expiresAt: string | null;
  createdBy: string;
  authorName: string;
  authorDepartment: string;
  canEdit: boolean;
  readCount: number;
  hasRead: boolean;
  readAt: string | null;
  updatedAt: string;
}

export interface CategoryMeta {
  code: AnnouncementCategory;
  label: string;
  shortLabel: string;
  description: string;
  badgeClassName: string;
  defaultPalette: AnnouncementThemePalette;
}

export const ANNOUNCEMENT_CATEGORY_META: Record<
  AnnouncementCategory,
  CategoryMeta
> = {
  urgente: {
    code: "urgente",
    label: "Urgente / Contingencia",
    shortLabel: "Urgente",
    description:
      "Cambios de horario, avisos de servicio eléctrico o agua y comunicados inmediatos.",
    badgeClassName:
      "bg-rose-500/15 text-rose-700 border-rose-500/30 dark:bg-rose-500/20 dark:text-rose-200 dark:border-rose-400/30",
    defaultPalette: {
      primary: "#e11d48",
      secondary: "#f97316",
      accent: "#fb7185",
      glow: "#f43f5e",
    },
  },
  evento: {
    code: "evento",
    label: "Eventos y Vida Estudiantil",
    shortLabel: "Eventos",
    description:
      "Lunes cívicos, semana aniversario, ferias socioproductivas y actos institucionales.",
    badgeClassName:
      "bg-blue-600/15 text-blue-800 border-blue-600/30 dark:bg-sky-500/20 dark:text-sky-200 dark:border-sky-400/30",
    defaultPalette: {
      primary: "#1c47c4",
      secondary: "#6366f1",
      accent: "#38bdf8",
      glow: "#3b82f6",
    },
  },
  academico: {
    code: "academico",
    label: "Académico y Lapsos",
    shortLabel: "Académico",
    description:
      "Cierres de momento pedagógico, entregas de boletines, horarios y trámites escolares.",
    badgeClassName:
      "bg-indigo-600/15 text-indigo-800 border-indigo-600/30 dark:bg-indigo-500/20 dark:text-indigo-200 dark:border-indigo-400/30",
    defaultPalette: {
      primary: "#4338ca",
      secondary: "#0284c7",
      accent: "#818cf8",
      glow: "#6366f1",
    },
  },
  mencion: {
    code: "mencion",
    label: "Menciones Técnicas",
    shortLabel: "Menciones",
    description:
      "Actividades de laboratorio, prácticas y avisos para Telemática, Aduanas y Turismo.",
    badgeClassName:
      "bg-violet-600/15 text-violet-800 border-violet-600/30 dark:bg-violet-500/20 dark:text-violet-200 dark:border-violet-400/30",
    defaultPalette: {
      primary: "#7c3aed",
      secondary: "#0ea5e9",
      accent: "#a78bfa",
      glow: "#8b5cf6",
    },
  },
  cultura_deporte: {
    code: "cultura_deporte",
    label: "Cultura y Deporte",
    shortLabel: "Cultura y Deporte",
    description:
      "Convocatorias del patio central, equipos deportivos, gaitas, teatro y ferias gastronómicas.",
    badgeClassName:
      "bg-emerald-600/15 text-emerald-800 border-emerald-600/30 dark:bg-emerald-500/20 dark:text-emerald-200 dark:border-emerald-400/30",
    defaultPalette: {
      primary: "#2e8b3d",
      secondary: "#c9a24b",
      accent: "#34d399",
      glow: "#10b981",
    },
  },
};

export const MENTION_DEFAULT_PALETTES: Record<string, AnnouncementThemePalette> =
  {
    telematica: {
      primary: "#0284c7",
      secondary: "#7c3aed",
      accent: "#38bdf8",
      glow: "#6366f1",
    },
    aduanas: {
      primary: "#0f766e",
      secondary: "#c9a24b",
      accent: "#2dd4bf",
      glow: "#14b8a6",
    },
    aduana: {
      primary: "#0f766e",
      secondary: "#c9a24b",
      accent: "#2dd4bf",
      glow: "#14b8a6",
    },
    turismo: {
      primary: "#d97706",
      secondary: "#0d9488",
      accent: "#fbbf24",
      glow: "#f59e0b",
    },
  };

export function resolveAnnouncementPalette(
  rawPalette: unknown,
  category: AnnouncementCategory,
  mentionCode?: string | null
): AnnouncementThemePalette {
  const parsed = announcementThemePaletteSchema.safeParse(rawPalette);
  if (parsed.success) {
    return parsed.data;
  }

  const normalizedMention = mentionCode?.trim().toLowerCase();
  if (normalizedMention && normalizedMention in MENTION_DEFAULT_PALETTES) {
    return MENTION_DEFAULT_PALETTES[normalizedMention];
  }

  return ANNOUNCEMENT_CATEGORY_META[category].defaultPalette;
}

export function hexToRgba(hex: string, alpha: number): string {
  const clean = HEX_COLOR_REGEX.test(hex) ? hex.slice(1) : "1c47c4";
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const safeAlpha = Math.max(0, Math.min(1, alpha));
  return `rgba(${r}, ${g}, ${b}, ${safeAlpha.toFixed(3)})`;
}

export interface EventCountdownInfo {
  label: string;
  isPast: boolean;
  isSoon: boolean;
  formattedDate: string;
}

export function formatAnnouncementCountdown(
  eventDateIso: string | null,
  nowMs: number = Date.now()
): EventCountdownInfo | null {
  if (!eventDateIso) return null;
  const eventMs = Date.parse(eventDateIso);
  if (!Number.isFinite(eventMs)) return null;

  const dateFormatter = new Intl.DateTimeFormat("es-VE", {
    timeZone: "America/Caracas",
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const dayKeyFmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Caracas",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const formattedDate = dateFormatter.format(new Date(eventMs));
  const todayKey = dayKeyFmt.format(new Date(nowMs));
  const eventKey = dayKeyFmt.format(new Date(eventMs));

  const [ty, tm, td] = todayKey.split("-").map(Number);
  const [ey, em, ed] = eventKey.split("-").map(Number);
  const todayUtc = Date.UTC(ty ?? 2026, (tm ?? 1) - 1, td ?? 1);
  const eventUtc = Date.UTC(ey ?? 2026, (em ?? 1) - 1, ed ?? 1);
  const diffDays = Math.round((eventUtc - todayUtc) / (24 * 60 * 60 * 1000));

  if (diffDays < 0) {
    return {
      label: "Realizado",
      isPast: true,
      isSoon: false,
      formattedDate,
    };
  }
  if (diffDays === 0) {
    return {
      label: "Hoy",
      isPast: false,
      isSoon: true,
      formattedDate,
    };
  }
  if (diffDays === 1) {
    return {
      label: "Mañana",
      isPast: false,
      isSoon: true,
      formattedDate,
    };
  }
  if (diffDays <= 6) {
    return {
      label: `En ${diffDays} días`,
      isPast: false,
      isSoon: true,
      formattedDate,
    };
  }
  if (diffDays <= 28) {
    const weeks = Math.round(diffDays / 7);
    return {
      label: weeks === 1 ? "En 1 semana" : `En ${weeks} semanas`,
      isPast: false,
      isSoon: false,
      formattedDate,
    };
  }
  return {
    label: `En ${diffDays} días`,
    isPast: false,
    isSoon: false,
    formattedDate,
  };
}

export function formatAnnouncementAudience(
  mentionName: string | null,
  gradeYear: number | null
): string {
  const yearLabel = gradeYear ? `${gradeYear}.º año` : null;
  if (mentionName && yearLabel) {
    return `${mentionName} · ${yearLabel}`;
  }
  if (mentionName) {
    return `Mención ${mentionName}`;
  }
  if (yearLabel) {
    return `Estudiantes de ${yearLabel}`;
  }
  return "Toda la comunidad bellista";
}

/**
 * Elimina marcadores de formato estructurado (`##`, `**`, `__`, `==`, enlaces)
 * para mostrar extractos limpios en tarjetas, búsquedas y accesibilidad.
 */
export function stripRichFormatting(raw: string): string {
  return raw
    .replace(/^#{1,3}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^[-*]\s+/gm, "• ")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/^---$/gm, "")
    .replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/==([^=]+)==/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export const BULLETIN_TITLE_MAX_LENGTH = 80;
export const BULLETIN_SHORT_NOTE_MAX_LENGTH = 32;

export const upsertAnnouncementSchema = z.object({
  announcementId: z.string().uuid().nullable().optional(),
  title: z
    .string()
    .trim()
    .min(4, "El título debe tener al menos 4 caracteres.")
    .max(
      BULLETIN_TITLE_MAX_LENGTH,
      `El título no puede superar los ${BULLETIN_TITLE_MAX_LENGTH} caracteres para encajar bien en las tarjetas.`
    ),
  shortNote: z
    .string()
    .trim()
    .min(2, "Agrega una etiqueta corta para la tarjeta (ej. 19 Ene · Aniversario).")
    .max(
      BULLETIN_SHORT_NOTE_MAX_LENGTH,
      `La etiqueta corta no puede superar los ${BULLETIN_SHORT_NOTE_MAX_LENGTH} caracteres.`
    ),
  body: z
    .string()
    .trim()
    .min(10, "Redacta el comunicado con al menos 10 caracteres.")
    .max(4000, "El comunicado no puede superar los 4000 caracteres."),
  category: z.enum(ANNOUNCEMENT_CATEGORIES),
  targetMencionId: z.string().uuid().nullable().optional(),
  targetGradeYear: z.number().int().min(1).max(6).nullable().optional(),
  eventDate: z
    .string()
    .datetime({ offset: true })
    .nullable()
    .optional(),
  locationLabel: z
    .string()
    .trim()
    .max(120, "La ubicación no puede superar los 120 caracteres.")
    .nullable()
    .optional(),
  coverWebpUrl: z
    .string()
    .trim()
    .url("La URL de portada no es válida.")
    .refine((u) => u.startsWith("https://"), {
      message: "La imagen de portada debe usar una conexión segura HTTPS.",
    })
    .nullable()
    .optional(),
  themePalette: announcementThemePaletteSchema.nullable().optional(),
  isPinned: z.boolean().default(false),
  isPublished: z.boolean().default(true),
  expiresAt: z
    .string()
    .datetime({ offset: true })
    .nullable()
    .optional(),
});

export type UpsertAnnouncementInput = z.infer<typeof upsertAnnouncementSchema>;

export const confirmAnnouncementReadSchema = z.object({
  announcementId: z.string().uuid("Comunicado inválido."),
});

export const archiveAnnouncementSchema = z.object({
  announcementId: z.string().uuid("Comunicado inválido."),
});

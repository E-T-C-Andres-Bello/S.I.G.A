import { z } from "zod";
import {
  ANNOUNCEMENT_CATEGORIES,
  BULLETIN_SHORT_NOTE_MAX_LENGTH,
  BULLETIN_TITLE_MAX_LENGTH,
  type AnnouncementCategory,
} from "./bulletin";

export const BULLETIN_AI_MODES = [
  "chat",
  "draft",
  "improve",
  "summarize",
] as const;

export type BulletinAiRequestMode = (typeof BULLETIN_AI_MODES)[number];

export const bulletinAiHistoryItemSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(1600),
});

export const bulletinAiDraftContextSchema = z.object({
  title: z.string().max(120).optional().default(""),
  shortNote: z.string().max(60).optional().default(""),
  category: z.enum(ANNOUNCEMENT_CATEGORIES).optional().default("evento"),
  locationLabel: z.string().max(140).optional().default(""),
  body: z.string().max(4000).optional().default(""),
  audienceLabel: z.string().max(120).optional().default(""),
});

export const bulletinAiChatRequestSchema = z.object({
  message: z
    .string()
    .trim()
    .min(2, "Escribe una instrucción o idea para el asistente.")
    .max(1200, "El mensaje no puede superar los 1200 caracteres."),
  mode: z.enum(BULLETIN_AI_MODES).default("chat"),
  history: z.array(bulletinAiHistoryItemSchema).max(6).default([]),
  draft: bulletinAiDraftContextSchema.default({
    title: "",
    shortNote: "",
    category: "evento",
    locationLabel: "",
    body: "",
    audienceLabel: "",
  }),
});

export type BulletinAiChatRequest = z.infer<typeof bulletinAiChatRequestSchema>;

export const bulletinAiSuggestionSchema = z.object({
  title: z.string().trim().min(4).max(BULLETIN_TITLE_MAX_LENGTH).optional(),
  shortNote: z
    .string()
    .trim()
    .min(2)
    .max(BULLETIN_SHORT_NOTE_MAX_LENGTH)
    .optional(),
  category: z.enum(ANNOUNCEMENT_CATEGORIES).optional(),
  locationLabel: z.string().trim().max(120).optional(),
  body: z.string().trim().min(10).max(4000).optional(),
});

export type BulletinAiSuggestion = z.infer<typeof bulletinAiSuggestionSchema>;

export const bulletinAiResponseSchema = z.object({
  reply: z.string().trim().min(1).max(2000),
  suggestion: bulletinAiSuggestionSchema.nullable().optional(),
});

export type BulletinAiResponsePayload = z.infer<typeof bulletinAiResponseSchema>;

/**
 * Redacta potenciales datos personales (cédulas venezolanas, correos o teléfonos)
 * antes de enviar cualquier texto hacia n8n/LLM (OWASP LLM02).
 */
export function scrubPotentialPiiForLlm(raw: string): string {
  return raw
    .replace(/\b[VvEeJj]-?\d{6,9}\b/g, "[CEDULA_PROTEGIDA]")
    .replace(
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
      "[CORREO_PROTEGIDO]"
    )
    .replace(
      /(?:\+?58[\s-]?)?0?(?:412|414|416|424|426|286)[\s-]?\d{3}[\s-]?\d{4}\b/g,
      "[TELEFONO_PROTEGIDO]"
    );
}

/**
 * Elimina cualquier etiqueta HTML/script y bloquea enlaces con esquemas peligrosos
 * (`javascript:`, `data:`, `vbscript:`) en salidas provenientes del LLM (OWASP LLM05).
 */
export function sanitizeAiMarkdownText(raw: string, maxLen: number): string {
  const withoutScripts = raw
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<\/?[a-z][^>]*>/gi, "");

  // Bloquear enlaces Markdown cuyo destino no sea https://
  const safeLinks = withoutScripts.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_full, label: string, url: string) => {
      const cleanUrl = url.trim();
      if (/^https:\/\/[^\s)]+$/i.test(cleanUrl)) {
        return `[${label.trim()}](${cleanUrl})`;
      }
      return label.trim();
    }
  );

  return safeLinks
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .trim()
    .slice(0, maxLen);
}

function clampSingleLine(raw: unknown, maxLen: number): string | undefined {
  if (typeof raw !== "string") return undefined;
  const cleaned = sanitizeAiMarkdownText(raw, maxLen)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
  return cleaned.length > 0 ? cleaned : undefined;
}

const VALID_CAT_SET = new Set<string>(ANNOUNCEMENT_CATEGORIES);

/**
 * Normaliza, recorta y sanitiza una sugerencia devuelta por n8n/LLM antes de
 * aceptarla en el editor (OWASP LLM05).
 */
export function sanitizeBulletinAiSuggestion(
  raw: unknown
): BulletinAiSuggestion | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;

  const title = clampSingleLine(record.title, BULLETIN_TITLE_MAX_LENGTH);
  const shortNote = clampSingleLine(
    record.shortNote ?? record.short_note,
    BULLETIN_SHORT_NOTE_MAX_LENGTH
  );
  const locationLabel = clampSingleLine(
    record.locationLabel ?? record.location_label,
    120
  );
  const rawCategory =
    typeof record.category === "string"
      ? record.category.trim().toLowerCase()
      : undefined;
  const category =
    rawCategory && VALID_CAT_SET.has(rawCategory)
      ? (rawCategory as AnnouncementCategory)
      : undefined;

  const rawBody =
    typeof record.body === "string"
      ? sanitizeAiMarkdownText(record.body, 4000)
      : undefined;
  const body = rawBody && rawBody.length >= 10 ? rawBody : undefined;

  const candidate: BulletinAiSuggestion = {};
  if (title && title.length >= 4) candidate.title = title;
  if (shortNote && shortNote.length >= 2) candidate.shortNote = shortNote;
  if (category) candidate.category = category;
  if (locationLabel) candidate.locationLabel = locationLabel;
  if (body) candidate.body = body;

  if (Object.keys(candidate).length === 0) return null;

  const parsed = bulletinAiSuggestionSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

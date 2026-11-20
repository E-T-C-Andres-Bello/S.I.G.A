export const NOTIFICATION_CATEGORIES = [
  "academic_grade",
  "lms_task",
  "library_due",
  "pasantias",
  "request_status",
  "teacher_absence",
  "sla_alert",
  "early_risk",
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export interface NotificationItem {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  actionUrl: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationCategoryMeta {
  id: NotificationCategory;
  label: string;
  badgeTone: string;
  iconBgTone: string;
}

export const NOTIFICATION_CATEGORY_META: Record<
  NotificationCategory,
  NotificationCategoryMeta
> = {
  academic_grade: {
    id: "academic_grade",
    label: "Calificaciones",
    badgeTone:
      "border-emerald-500/35 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
    iconBgTone:
      "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-400/18 dark:text-emerald-300",
  },
  lms_task: {
    id: "lms_task",
    label: "Aula Virtual",
    badgeTone:
      "border-sky-500/35 bg-sky-500/12 text-sky-700 dark:text-sky-300",
    iconBgTone:
      "bg-sky-500/15 text-sky-700 dark:bg-sky-400/18 dark:text-sky-300",
  },
  request_status: {
    id: "request_status",
    label: "Trámites",
    badgeTone:
      "border-primary/35 bg-primary/12 text-primary",
    iconBgTone:
      "bg-primary/14 text-primary",
  },
  library_due: {
    id: "library_due",
    label: "Biblioteca",
    badgeTone:
      "border-amber-500/35 bg-amber-500/12 text-amber-700 dark:text-amber-300",
    iconBgTone:
      "bg-amber-500/15 text-amber-700 dark:bg-amber-400/18 dark:text-amber-300",
  },
  pasantias: {
    id: "pasantias",
    label: "Pasantías",
    badgeTone:
      "border-violet-500/35 bg-violet-500/12 text-violet-700 dark:text-violet-300",
    iconBgTone:
      "bg-violet-500/15 text-violet-700 dark:bg-violet-400/18 dark:text-violet-300",
  },
  teacher_absence: {
    id: "teacher_absence",
    label: "Asistencia docente",
    badgeTone:
      "border-orange-500/35 bg-orange-500/12 text-orange-700 dark:text-orange-300",
    iconBgTone:
      "bg-orange-500/15 text-orange-700 dark:bg-orange-400/18 dark:text-orange-300",
  },
  sla_alert: {
    id: "sla_alert",
    label: "Gestión escolar",
    badgeTone:
      "border-rose-500/35 bg-rose-500/12 text-rose-700 dark:text-rose-300",
    iconBgTone:
      "bg-rose-500/15 text-rose-700 dark:bg-rose-400/18 dark:text-rose-300",
  },
  early_risk: {
    id: "early_risk",
    label: "Acompañamiento",
    badgeTone:
      "border-rose-500/35 bg-rose-500/12 text-rose-700 dark:text-rose-300",
    iconBgTone:
      "bg-rose-500/15 text-rose-700 dark:bg-rose-400/18 dark:text-rose-300",
  },
};

export function normalizeNotificationCategory(
  raw: string
): NotificationCategory {
  if ((NOTIFICATION_CATEGORIES as readonly string[]).includes(raw)) {
    return raw as NotificationCategory;
  }
  return "request_status";
}

/**
 * Permite únicamente rutas internas seguras del portal (`/...`), evitando open redirects
 * o esquemas peligrosos (`javascript:`, `//externo.com`, `https://...`).
 */
export function sanitizeNotificationActionUrl(
  raw: string | null | undefined
): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return null;
  }
  // Normaliza rutas heredadas de trámites hacia la sección dedicada
  if (trimmed === "/estudiante?tab=tramites") {
    return "/estudiante/tramites";
  }
  return trimmed;
}

export function formatRelativeNotificationTime(
  iso: string,
  nowMs: number = Date.now()
): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return "";

  const diffSec = Math.max(0, Math.floor((nowMs - ts) / 1000));
  if (diffSec < 60) return "Ahora mismo";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `Hace ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) {
    return diffHours === 1 ? "Hace 1 hora" : `Hace ${diffHours} horas`;
  }
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Ayer";
  if (diffDays < 7) return `Hace ${diffDays} días`;

  try {
    return new Intl.DateTimeFormat("es-VE", {
      timeZone: "America/Caracas",
      day: "numeric",
      month: "short",
    }).format(new Date(ts));
  } catch {
    return "";
  }
}

export function formatFullNotificationDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("es-VE", {
      timeZone: "America/Caracas",
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

export type NotificationDateBucket = "Hoy" | "Ayer" | "Esta semana" | "Anteriores";

function getCaracasDateKey(ms: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Caracas",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

export function resolveNotificationDateBucket(
  iso: string,
  nowMs: number = Date.now()
): NotificationDateBucket {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return "Anteriores";

  const todayKey = getCaracasDateKey(nowMs);
  const itemKey = getCaracasDateKey(ts);
  if (itemKey === todayKey) return "Hoy";

  const yesterdayKey = getCaracasDateKey(nowMs - 86_400_000);
  if (itemKey === yesterdayKey) return "Ayer";

  if (nowMs - ts <= 7 * 86_400_000) return "Esta semana";
  return "Anteriores";
}

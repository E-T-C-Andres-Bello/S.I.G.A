import type { StudentScheduleBlock } from "./dashboard-data";

export const SCHEDULE_WEEKDAYS = [
  { day: 1, short: "Lu", label: "Lunes" },
  { day: 2, short: "Ma", label: "Martes" },
  { day: 3, short: "Mi", label: "Miércoles" },
  { day: 4, short: "Ju", label: "Jueves" },
  { day: 5, short: "Vi", label: "Viernes" },
] as const;

export interface ScheduleTimeRowMeta {
  index: number;
  startMinutes: number;
  endMinutes: number;
  startLabel: string;
  endLabel: string;
  blockCode: string;
}

export interface ScheduleDayCell {
  key: string;
  rowSpan: number;
  block: StudentScheduleBlock | null;
}

export interface ScheduleRecessBand {
  kind: "recess";
  key: string;
  label: string;
  startLabel: string;
  endLabel: string;
}

export interface ScheduleSlotsBand {
  kind: "slots";
  key: string;
  rows: ScheduleTimeRowMeta[];
  /** Mapa por día (1=Lu .. 5=Vi) con celdas ya fusionadas verticalmente. */
  columnsByDay: Record<number, ScheduleDayCell[]>;
}

export type ScheduleGridBand = ScheduleSlotsBand | ScheduleRecessBand;

export interface BuiltScheduleGrid {
  bands: ScheduleGridBand[];
  totalSlotRows: number;
  totalRecessRows: number;
  primaryRoomLabel: string | null;
}

/**
 * Convierte `"HH:MM"` o `"HH:MM:SS"` a minutos desde medianoche.
 */
export function parseTimeToMinutes(raw: string): number {
  const parts = raw.trim().split(":");
  const h = Number(parts[0] ?? 0);
  const m = Number(parts[1] ?? 0);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return Math.max(0, Math.min(24 * 60, h * 60 + m));
}

/**
 * Formatea minutos desde medianoche en formato 12 h compacto (estilo aSc Horarios):
 * `7:00`, `11:10`, `12:35`, `1:15`, `3:20`, `6:00`.
 */
export function formatCompact12hTime(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(24 * 60, Math.round(totalMinutes)));
  const hours24 = Math.floor(clamped / 60);
  const mins = clamped % 60;
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${String(mins).padStart(2, "0")}`;
}

/**
 * Genera el título grande centrado del horario institucional (ej. `4TO AÑO TLM A`, `1ER AÑO ADU B`).
 */
export function formatScheduleBannerTitle(params: {
  gradeYear?: number | null;
  mencionName?: string | null;
  sectionLetter?: string | null;
  fallbackLabel?: string;
}): string {
  const { gradeYear, mencionName, sectionLetter, fallbackLabel } = params;

  if (gradeYear && gradeYear >= 1 && gradeYear <= 6) {
    const ordinalMap: Record<number, string> = {
      1: "1ER",
      2: "2DO",
      3: "3ER",
      4: "4TO",
      5: "5TO",
      6: "6TO",
    };
    const yearToken = `${ordinalMap[gradeYear] ?? `${gradeYear}TO`} AÑO`;
    const mencionShort = abbreviateMencion(mencionName);
    const sectionToken = sectionLetter
      ? sectionLetter.trim().toUpperCase()
      : "";
    return [yearToken, mencionShort, sectionToken].filter(Boolean).join(" ");
  }

  return (fallbackLabel ?? "HORARIO ESCOLAR").trim().toUpperCase();
}

function abbreviateMencion(raw: string | null | undefined): string {
  if (!raw) return "";
  const normalized = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
  if (!normalized) return "";
  if (normalized.includes("TELEMAT")) return "TLM";
  if (normalized.includes("ADUAN")) return "ADU";
  if (normalized.includes("TURIS")) return "TUR";
  return normalized.replace(/[^A-Z0-9]/g, "").slice(0, 4);
}

/**
 * Limpia el nombre del docente para impresión institucional en mayúsculas
 * sin prefijos repetitivos (ej. `Prof. Ana Morales` → `ANA MORALES`).
 */
export function formatCompactTeacherLabel(raw: string): string {
  const cleaned = raw
    .replace(/^(prof\.?|profa\.?|lic\.?|ing\.?|msc\.?)\s+/i, "")
    .trim();
  return (cleaned || raw.trim()).toUpperCase();
}

/**
 * Extrae una etiqueta compacta de bloque (ej. `"Bloque 1-2"` → `"1-2"`, `"Bloque 7"` → `"7"`).
 */
function extractCompactBlockCode(
  labels: string[],
  fallbackIndex: number
): string {
  const unique = Array.from(
    new Set(labels.map((l) => l.trim()).filter(Boolean))
  );
  if (unique.length === 1) {
    const label = unique[0]!;
    const numericMatch = label.match(/\d+(?:\s*[-–]\s*\d+)?/);
    if (numericMatch) {
      return numericMatch[0].replace(/\s+/g, "");
    }
    if (label.length <= 6) {
      return label.toUpperCase();
    }
  }
  return String(fallbackIndex);
}

function isSameClassBlock(
  a: StudentScheduleBlock | null,
  b: StudentScheduleBlock | null
): boolean {
  if (!a || !b) return false;
  return (
    a.subjectCode.trim().toUpperCase() === b.subjectCode.trim().toUpperCase() &&
    a.teacherName.trim().toUpperCase() === b.teacherName.trim().toUpperCase() &&
    a.roomLabel.trim().toUpperCase() === b.roomLabel.trim().toUpperCase()
  );
}

function resolvePrimaryRoomLabel(
  blocks: StudentScheduleBlock[]
): string | null {
  if (blocks.length === 0) return null;
  const counts = new Map<string, number>();
  for (const b of blocks) {
    const room = b.roomLabel.trim();
    if (!room) continue;
    counts.set(room, (counts.get(room) ?? 0) + 1);
  }
  if (counts.size === 0) return null;

  // Preferir aula base (no laboratorio) si aparece varias veces; si no, la más frecuente
  const entries = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const nonLab = entries.find(([name]) => !/^lab\b/i.test(name));
  return (nonLab ?? entries[0])?.[0] ?? null;
}

/**
 * Construye una matriz dinámica estilo aSc Horarios a partir de los bloques reales:
 * - Detecta intervalos horarios atómicos de Lunes a Viernes.
 * - Inserta automáticamente franjas de `RECESO` cuando hay pausas (5 a 60 min) entre clases.
 * - Fusiona verticalmente (`rowSpan > 1`) bloques consecutivos de la misma materia, docente y aula.
 */
export function buildScheduleMatrix(
  scheduleBlocks: StudentScheduleBlock[]
): BuiltScheduleGrid {
  const normalized = scheduleBlocks
    .filter((b) => b.dayOfWeek >= 1 && b.dayOfWeek <= 5)
    .map((b) => ({
      block: b,
      start: parseTimeToMinutes(b.startTime),
      end: parseTimeToMinutes(b.endTime),
    }))
    .filter((entry) => entry.end > entry.start);

  if (normalized.length === 0) {
    return {
      bands: [],
      totalSlotRows: 0,
      totalRecessRows: 0,
      primaryRoomLabel: null,
    };
  }

  // 1. Reunir todos los límites horarios únicos y ordenados
  const boundarySet = new Set<number>();
  for (const entry of normalized) {
    boundarySet.add(entry.start);
    boundarySet.add(entry.end);
  }
  const boundaries = Array.from(boundarySet).sort((a, b) => a - b);

  // 2. Clasificar cada intervalo atómico [t_i, t_{i+1}] como ocupado o pausa (RECESO)
  type AtomicInterval =
    | {
        kind: "slot";
        start: number;
        end: number;
        byDay: Record<number, StudentScheduleBlock | null>;
        labels: string[];
      }
    | {
        kind: "recess";
        start: number;
        end: number;
      };

  const intervals: AtomicInterval[] = [];

  for (let i = 0; i < boundaries.length - 1; i += 1) {
    const start = boundaries[i]!;
    const end = boundaries[i + 1]!;
    const duration = end - start;
    if (duration <= 0) continue;

    const byDay: Record<number, StudentScheduleBlock | null> = {
      1: null,
      2: null,
      3: null,
      4: null,
      5: null,
    };
    const labels: string[] = [];
    let hasAnyClass = false;

    for (const dayObj of SCHEDULE_WEEKDAYS) {
      const match = normalized.find(
        (e) =>
          e.block.dayOfWeek === dayObj.day &&
          e.start <= start &&
          e.end >= end
      );
      if (match) {
        byDay[dayObj.day] = match.block;
        if (match.block.blockLabel) labels.push(match.block.blockLabel);
        hasAnyClass = true;
      }
    }

    if (hasAnyClass) {
      intervals.push({ kind: "slot", start, end, byDay, labels });
    } else if (duration >= 5 && duration <= 60) {
      // Pausa entre bloques: insertar fila horizontal de RECESO
      intervals.push({ kind: "recess", start, end });
    }
  }

  // 3. Agrupar intervalos contiguos en bandas de clases separadas por franjas de RECESO
  const bands: ScheduleGridBand[] = [];
  let runningSlotIndex = 0;
  let totalSlotRows = 0;
  let totalRecessRows = 0;

  let pendingSlots: Array<Extract<AtomicInterval, { kind: "slot" }>> = [];

  const flushSlotsBand = () => {
    if (pendingSlots.length === 0) return;

    const rows: ScheduleTimeRowMeta[] = pendingSlots.map((slot) => {
      runningSlotIndex += 1;
      totalSlotRows += 1;
      return {
        index: runningSlotIndex,
        startMinutes: slot.start,
        endMinutes: slot.end,
        startLabel: formatCompact12hTime(slot.start),
        endLabel: formatCompact12hTime(slot.end),
        blockCode: extractCompactBlockCode(slot.labels, runningSlotIndex),
      };
    });

    const columnsByDay: Record<number, ScheduleDayCell[]> = {
      1: [],
      2: [],
      3: [],
      4: [],
      5: [],
    };

    for (const dayObj of SCHEDULE_WEEKDAYS) {
      const cells: ScheduleDayCell[] = [];
      let r = 0;
      while (r < pendingSlots.length) {
        const currentBlock = pendingSlots[r]!.byDay[dayObj.day] ?? null;
        let span = 1;

        if (currentBlock) {
          while (
            r + span < pendingSlots.length &&
            isSameClassBlock(
              currentBlock,
              pendingSlots[r + span]!.byDay[dayObj.day] ?? null
            )
          ) {
            span += 1;
          }
        }

        cells.push({
          key: `d${dayObj.day}-r${rows[r]!.index}`,
          rowSpan: span,
          block: currentBlock,
        });
        r += span;
      }
      columnsByDay[dayObj.day] = cells;
    }

    bands.push({
      kind: "slots",
      key: `band-${rows[0]!.index}-${rows[rows.length - 1]!.index}`,
      rows,
      columnsByDay,
    });

    pendingSlots = [];
  };

  for (const interval of intervals) {
    if (interval.kind === "slot") {
      pendingSlots.push(interval);
    } else {
      flushSlotsBand();
      totalRecessRows += 1;
      bands.push({
        kind: "recess",
        key: `recess-${interval.start}-${interval.end}`,
        label: "RECESO",
        startLabel: formatCompact12hTime(interval.start),
        endLabel: formatCompact12hTime(interval.end),
      });
    }
  }
  flushSlotsBand();

  return {
    bands,
    totalSlotRows,
    totalRecessRows,
    primaryRoomLabel: resolvePrimaryRoomLabel(scheduleBlocks),
  };
}

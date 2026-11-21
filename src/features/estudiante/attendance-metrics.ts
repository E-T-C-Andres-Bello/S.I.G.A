import type { StudentScheduleBlock } from "./dashboard-data";
import { formatCompact12hTime, parseTimeToMinutes } from "./schedule-grid";

export type AttendanceRecordStatus = "present" | "late" | "justified" | "absent";

export type AttendanceHealthLevel = "green" | "amber" | "red" | "neutral";

export type TeacherAbsenceStatus = "reported" | "acknowledged" | "reorganized";

export interface StudentTeacherAbsenceAlert {
  id: string;
  /** Fecha ISO (`YYYY-MM-DD`, zona America/Caracas). */
  absenceDate: string;
  teacherName: string;
  subjectCodes: string[];
  subjectNames: string[];
  affectedBlocks: string[];
  status: TeacherAbsenceStatus;
}

export interface StudentAttendanceSessionItem {
  recordId: string;
  sessionDate: string;
  blockLabel: string;
  momentNumber: number;
  momentName: string;
  subjectCode: string;
  subjectName: string;
  teacherName: string | null;
  status: AttendanceRecordStatus;
  note: string | null;
}

export interface AttendanceHealthMetrics {
  totalSessions: number;
  attendedCount: number;
  presentCount: number;
  lateCount: number;
  justifiedCount: number;
  absentCount: number;
  attendancePercent: number | null;
  healthLevel: AttendanceHealthLevel;
  /** Faltas adicionales que tolera sin bajar del 75 % MPPE (cuando está >= 75 %). */
  allowedAdditionalAbsences: number;
  /** Asistencias consecutivas necesarias para recuperar el 75 % MPPE (cuando está < 75 %). */
  sessionsNeededToRecover: number;
  /** Texto humano accionable para mostrar al estudiante. */
  marginSummary: string;
}

export interface StudentSubjectAttendanceItem extends AttendanceHealthMetrics {
  curriculumSubjectId: string;
  subjectCode: string;
  subjectName: string;
  weeklyHours: number;
  isTechnicalCore: boolean;
  teacherName: string | null;
}

export type SchoolDayPhase =
  | "in_class"
  | "between_blocks"
  | "before_classes"
  | "after_classes"
  | "weekend"
  | "no_schedule";

export interface TodayTimelineBlock extends StudentScheduleBlock {
  startMinutes: number;
  endMinutes: number;
  timeRangeCompact: string;
  state: "completed" | "current" | "upcoming";
  hasTeacherAbsence: boolean;
  absenceAlert: StudentTeacherAbsenceAlert | null;
}

export interface LiveSchoolDayPulse {
  phase: SchoolDayPhase;
  todayBlocks: TodayTimelineBlock[];
  currentBlock: TodayTimelineBlock | null;
  currentBlockProgressPercent: number;
  currentBlockRemainingMinutes: number;
  nextBlock: TodayTimelineBlock | null;
  nextBlockStartsInMinutes: number | null;
  nextSchoolDayLabel: string | null;
  nextSchoolDayFirstBlock: StudentScheduleBlock | null;
  todayAbsenceAlerts: StudentTeacherAbsenceAlert[];
  upcomingAbsenceAlerts: StudentTeacherAbsenceAlert[];
}

export interface AttendanceCalendarDayCell {
  dateIso: string;
  dayNumber: number;
  inCurrentMonth: boolean;
  isToday: boolean;
  sessions: StudentAttendanceSessionItem[];
  dominantStatus: AttendanceRecordStatus | null;
}

export interface AttendanceCalendarMonthGrid {
  year: number;
  monthIndex0: number;
  monthLabel: string;
  days: AttendanceCalendarDayCell[];
  totalSessionsInMonth: number;
  absentInMonth: number;
}

const WEEKDAY_NAMES_ES: Record<number, string> = {
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
  6: "Sábado",
  7: "Domingo",
};

const MONTH_NAMES_ES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
] as const;

export function getAttendanceStatusLabel(status: AttendanceRecordStatus): string {
  switch (status) {
    case "present":
      return "Asistió";
    case "late":
      return "Retardo";
    case "justified":
      return "Justificada";
    case "absent":
      return "Inasistencia";
  }
}

export function getHealthLevelLabel(level: AttendanceHealthLevel): string {
  switch (level) {
    case "green":
      return "Óptima";
    case "amber":
      return "En observación";
    case "red":
      return "En riesgo MPPE";
    default:
      return "Sin registros";
  }
}

export function getTeacherAbsenceStatusLabel(
  status: TeacherAbsenceStatus
): string {
  switch (status) {
    case "reorganized":
      return "Actividad reorganizada por Coordinación";
    case "acknowledged":
      return "Confirmada por Coordinación";
    default:
      return "Aviso docente reportado";
  }
}

export function normalizeAffectedBlocksJson(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        const candidate =
          record.block_label ?? record.label ?? record.block ?? record.name;
        if (typeof candidate === "string") return candidate.trim();
      }
      return "";
    })
    .filter((v) => v.length > 0);
}

/**
 * Calcula el semáforo reglamentario MPPE (umbral 75 %) usando exclusivamente
 * sesiones reales registradas: `present + late + justified` cuentan como cumplidas.
 */
export function computeAttendanceHealth(input: {
  presentCount: number;
  lateCount: number;
  justifiedCount: number;
  absentCount: number;
}): AttendanceHealthMetrics {
  const presentCount = Math.max(0, Math.trunc(input.presentCount));
  const lateCount = Math.max(0, Math.trunc(input.lateCount));
  const justifiedCount = Math.max(0, Math.trunc(input.justifiedCount));
  const absentCount = Math.max(0, Math.trunc(input.absentCount));

  const attendedCount = presentCount + lateCount + justifiedCount;
  const totalSessions = attendedCount + absentCount;

  if (totalSessions === 0) {
    return {
      totalSessions: 0,
      attendedCount: 0,
      presentCount: 0,
      lateCount: 0,
      justifiedCount: 0,
      absentCount: 0,
      attendancePercent: null,
      healthLevel: "neutral",
      allowedAdditionalAbsences: 0,
      sessionsNeededToRecover: 0,
      marginSummary: "Aún sin pases de asistencia registrados.",
    };
  }

  const attendancePercent = Math.round((attendedCount / totalSessions) * 100);
  const meetsThreshold = 4 * attendedCount >= 3 * totalSessions;

  let healthLevel: AttendanceHealthLevel;
  if (!meetsThreshold) {
    healthLevel = "red";
  } else if (attendancePercent >= 85) {
    healthLevel = "green";
  } else {
    healthLevel = "amber";
  }

  // Máximo entero x >= 0 tal que attended / (total + x) >= 3/4  <=>  3x <= 4*attended - 3*total
  const allowedAdditionalAbsences = meetsThreshold
    ? Math.max(0, Math.floor((4 * attendedCount - 3 * totalSessions) / 3))
    : 0;

  // Mínimo entero y >= 0 tal que (attended + y) / (total + y) >= 3/4  <=>  y >= 3*absent - attended
  const sessionsNeededToRecover = meetsThreshold
    ? 0
    : Math.max(1, 3 * absentCount - attendedCount);

  let marginSummary: string;
  if (!meetsThreshold) {
    marginSummary =
      sessionsNeededToRecover === 1
        ? "Necesitas 1 asistencia seguida para volver al 75 %."
        : `Necesitas ${sessionsNeededToRecover} asistencias seguidas para volver al 75 %.`;
  } else if (allowedAdditionalAbsences === 0) {
    marginSummary = "Al límite del 75 %: evita faltar a la próxima sesión.";
  } else if (allowedAdditionalAbsences === 1) {
    marginSummary = "Toleras 1 inasistencia más sin bajar del 75 %.";
  } else {
    marginSummary = `Toleras hasta ${allowedAdditionalAbsences} inasistencias más sin bajar del 75 %.`;
  }

  return {
    totalSessions,
    attendedCount,
    presentCount,
    lateCount,
    justifiedCount,
    absentCount,
    attendancePercent,
    healthLevel,
    allowedAdditionalAbsences,
    sessionsNeededToRecover,
    marginSummary,
  };
}

/**
 * Extrae la fecha y hora actuales de Venezuela (`America/Caracas`) de forma determinista.
 */
export function getCaracasClockSnapshot(now: Date = new Date()): {
  dateIso: string;
  weekday: number; // 1=Lun .. 7=Dom
  currentMinutes: number;
  clockLabel12h: string;
  dateLabelEs: string;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Caracas",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(now);

  const year = parts.find((p) => p.type === "year")?.value ?? "2026";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  const rawHour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const hour24 = rawHour === 24 ? 0 : rawHour;
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const wdShort = parts.find((p) => p.type === "weekday")?.value ?? "Mon";

  const weekdayMap: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };
  const weekday = weekdayMap[wdShort] ?? 1;
  const currentMinutes = hour24 * 60 + minute;

  const period = hour24 >= 12 ? "p. m." : "a. m.";
  const clockLabel12h = `${formatCompact12hTime(currentMinutes)} ${period}`;

  const monthIdx = Math.max(0, Math.min(11, Number(month) - 1));
  const dateLabelEs = `${WEEKDAY_NAMES_ES[weekday] ?? "Hoy"}, ${Number(day)} de ${MONTH_NAMES_ES[monthIdx]!.toLowerCase()}`;

  return {
    dateIso: `${year}-${month}-${day}`,
    weekday,
    currentMinutes,
    clockLabel12h,
    dateLabelEs,
  };
}

function doesAlertMatchBlock(
  alert: StudentTeacherAbsenceAlert,
  block: StudentScheduleBlock
): boolean {
  const codeMatch = alert.subjectCodes.some(
    (c) => c.trim().toUpperCase() === block.subjectCode.trim().toUpperCase()
  );
  if (!codeMatch) return false;
  if (alert.affectedBlocks.length === 0) return true;

  const blockLabelNorm = block.blockLabel.trim().toLowerCase();
  return alert.affectedBlocks.some((ab) => {
    const abNorm = ab.trim().toLowerCase();
    return (
      abNorm === blockLabelNorm ||
      blockLabelNorm.includes(abNorm) ||
      abNorm.includes(blockLabelNorm)
    );
  });
}

function findNextSchoolDayFirstBlock(
  scheduleBlocks: StudentScheduleBlock[],
  currentWeekday: number
): { label: string; block: StudentScheduleBlock } | null {
  if (scheduleBlocks.length === 0) return null;

  for (let offset = 1; offset <= 7; offset += 1) {
    const candidateDay = ((currentWeekday - 1 + offset) % 7) + 1;
    if (candidateDay > 5) continue;
    const dayBlocks = scheduleBlocks
      .filter((b) => b.dayOfWeek === candidateDay)
      .sort(
        (a, b) =>
          parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime)
      );
    if (dayBlocks.length > 0) {
      const label =
        offset === 1 ? "Mañana" : (WEEKDAY_NAMES_ES[candidateDay] ?? "Próximo día");
      return { label, block: dayBlocks[0]! };
    }
  }
  return null;
}

/**
 * Resuelve el estado en vivo del día escolar (clase en curso, próxima clase,
 * receso/descanso, fin de jornada y alertas verificadas de ausencia docente).
 */
export function resolveLiveSchoolDayPulse(params: {
  scheduleBlocks: StudentScheduleBlock[];
  teacherAbsences: StudentTeacherAbsenceAlert[];
  todayIso: string;
  weekday: number;
  currentMinutes: number;
}): LiveSchoolDayPulse {
  const { scheduleBlocks, teacherAbsences, todayIso, weekday, currentMinutes } =
    params;

  const todayAbsenceAlerts = teacherAbsences.filter(
    (a) => a.absenceDate === todayIso
  );
  const upcomingAbsenceAlerts = teacherAbsences.filter(
    (a) => a.absenceDate > todayIso
  );

  if (scheduleBlocks.length === 0) {
    return {
      phase: "no_schedule",
      todayBlocks: [],
      currentBlock: null,
      currentBlockProgressPercent: 0,
      currentBlockRemainingMinutes: 0,
      nextBlock: null,
      nextBlockStartsInMinutes: null,
      nextSchoolDayLabel: null,
      nextSchoolDayFirstBlock: null,
      todayAbsenceAlerts,
      upcomingAbsenceAlerts,
    };
  }

  if (weekday > 5) {
    const nextDay = findNextSchoolDayFirstBlock(scheduleBlocks, weekday);
    return {
      phase: "weekend",
      todayBlocks: [],
      currentBlock: null,
      currentBlockProgressPercent: 0,
      currentBlockRemainingMinutes: 0,
      nextBlock: null,
      nextBlockStartsInMinutes: null,
      nextSchoolDayLabel: nextDay?.label ?? null,
      nextSchoolDayFirstBlock: nextDay?.block ?? null,
      todayAbsenceAlerts,
      upcomingAbsenceAlerts,
    };
  }

  const rawTodayBlocks = scheduleBlocks
    .filter((b) => b.dayOfWeek === weekday)
    .sort(
      (a, b) =>
        parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime)
    );

  const todayBlocks: TodayTimelineBlock[] = rawTodayBlocks.map((b) => {
    const startMinutes = parseTimeToMinutes(b.startTime);
    const endMinutes = parseTimeToMinutes(b.endTime);
    const state: TodayTimelineBlock["state"] =
      currentMinutes >= endMinutes
        ? "completed"
        : currentMinutes >= startMinutes
          ? "current"
          : "upcoming";
    const matchedAlert =
      todayAbsenceAlerts.find((alert) => doesAlertMatchBlock(alert, b)) ?? null;

    return {
      ...b,
      startMinutes,
      endMinutes,
      timeRangeCompact: `${formatCompact12hTime(startMinutes)} – ${formatCompact12hTime(endMinutes)}`,
      state,
      hasTeacherAbsence: matchedAlert !== null,
      absenceAlert: matchedAlert,
    };
  });

  if (todayBlocks.length === 0) {
    const nextDay = findNextSchoolDayFirstBlock(scheduleBlocks, weekday);
    return {
      phase: "after_classes",
      todayBlocks: [],
      currentBlock: null,
      currentBlockProgressPercent: 0,
      currentBlockRemainingMinutes: 0,
      nextBlock: null,
      nextBlockStartsInMinutes: null,
      nextSchoolDayLabel: nextDay?.label ?? null,
      nextSchoolDayFirstBlock: nextDay?.block ?? null,
      todayAbsenceAlerts,
      upcomingAbsenceAlerts,
    };
  }

  const currentBlock =
    todayBlocks.find((b) => b.state === "current") ?? null;
  const nextBlock =
    todayBlocks.find((b) => b.state === "upcoming") ?? null;

  let phase: SchoolDayPhase;
  if (currentBlock) {
    phase = "in_class";
  } else if (nextBlock && todayBlocks.every((b) => b.state === "upcoming")) {
    phase = "before_classes";
  } else if (nextBlock) {
    phase = "between_blocks";
  } else {
    phase = "after_classes";
  }

  let currentBlockProgressPercent = 0;
  let currentBlockRemainingMinutes = 0;
  if (currentBlock) {
    const duration = Math.max(
      1,
      currentBlock.endMinutes - currentBlock.startMinutes
    );
    const elapsed = Math.max(0, currentMinutes - currentBlock.startMinutes);
    currentBlockProgressPercent = Math.min(
      100,
      Math.max(0, Math.round((elapsed / duration) * 100))
    );
    currentBlockRemainingMinutes = Math.max(
      0,
      currentBlock.endMinutes - currentMinutes
    );
  }

  const nextBlockStartsInMinutes = nextBlock
    ? Math.max(0, nextBlock.startMinutes - currentMinutes)
    : null;

  const nextDay =
    phase === "after_classes"
      ? findNextSchoolDayFirstBlock(scheduleBlocks, weekday)
      : null;

  return {
    phase,
    todayBlocks,
    currentBlock,
    currentBlockProgressPercent,
    currentBlockRemainingMinutes,
    nextBlock,
    nextBlockStartsInMinutes,
    nextSchoolDayLabel: nextDay?.label ?? null,
    nextSchoolDayFirstBlock: nextDay?.block ?? null,
    todayAbsenceAlerts,
    upcomingAbsenceAlerts,
  };
}

function resolveDominantDayStatus(
  sessions: StudentAttendanceSessionItem[]
): AttendanceRecordStatus | null {
  if (sessions.length === 0) return null;
  if (sessions.some((s) => s.status === "absent")) return "absent";
  if (sessions.some((s) => s.status === "late")) return "late";
  if (sessions.some((s) => s.status === "justified")) return "justified";
  return "present";
}

function toIsoDateParts(year: number, monthIndex0: number, day: number): string {
  const dt = new Date(Date.UTC(year, monthIndex0, day));
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Construye una cuadrícula mensual (Lunes a Domingo) para visualizar
 * el calendario real de pases de asistencia del estudiante.
 */
export function buildAttendanceCalendarMonth(params: {
  year: number;
  monthIndex0: number;
  sessions: StudentAttendanceSessionItem[];
  todayIso: string;
}): AttendanceCalendarMonthGrid {
  const { year, monthIndex0, sessions, todayIso } = params;

  const sessionsByDate = new Map<string, StudentAttendanceSessionItem[]>();
  for (const s of sessions) {
    const bucket = sessionsByDate.get(s.sessionDate) ?? [];
    bucket.push(s);
    sessionsByDate.set(s.sessionDate, bucket);
  }

  const firstOfMonth = new Date(Date.UTC(year, monthIndex0, 1));
  const daysInMonth = new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate();
  // Lunes=0 .. Domingo=6
  const startOffset = (firstOfMonth.getUTCDay() + 6) % 7;
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;

  const days: AttendanceCalendarDayCell[] = [];
  let totalSessionsInMonth = 0;
  let absentInMonth = 0;

  for (let i = 0; i < totalCells; i += 1) {
    const dayOffset = i - startOffset + 1;
    const cellDate = new Date(Date.UTC(year, monthIndex0, dayOffset));
    const dateIso = toIsoDateParts(
      cellDate.getUTCFullYear(),
      cellDate.getUTCMonth(),
      cellDate.getUTCDate()
    );
    const inCurrentMonth = cellDate.getUTCMonth() === monthIndex0;
    const daySessions = sessionsByDate.get(dateIso) ?? [];

    if (inCurrentMonth && daySessions.length > 0) {
      totalSessionsInMonth += daySessions.length;
      absentInMonth += daySessions.filter((s) => s.status === "absent").length;
    }

    days.push({
      dateIso,
      dayNumber: cellDate.getUTCDate(),
      inCurrentMonth,
      isToday: dateIso === todayIso,
      sessions: daySessions,
      dominantStatus: resolveDominantDayStatus(daySessions),
    });
  }

  const safeMonthIdx = ((monthIndex0 % 12) + 12) % 12;

  return {
    year,
    monthIndex0: safeMonthIdx,
    monthLabel: `${MONTH_NAMES_ES[safeMonthIdx]} ${year}`,
    days,
    totalSessionsInMonth,
    absentInMonth,
  };
}

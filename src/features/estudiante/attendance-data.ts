import type { DashboardUserProfile } from "@/lib/auth/dashboard-session";
import {
  callNeonRpcScalar,
  isNeonDatabaseConfigured,
  withUserDb,
} from "@/lib/db/neon";
import type { StudentScheduleBlock } from "./dashboard-data";
import {
  computeAttendanceHealth,
  getCaracasClockSnapshot,
  normalizeAffectedBlocksJson,
  type AttendanceHealthMetrics,
  type AttendanceRecordStatus,
  type StudentAttendanceSessionItem,
  type StudentSubjectAttendanceItem,
  type StudentTeacherAbsenceAlert,
  type TeacherAbsenceStatus,
} from "./attendance-metrics";

export interface StudentAttendanceOverviewData {
  hasEnrollment: boolean;
  todayIso: string;
  schoolYearName: string | null;
  mencionName: string | null;
  gradeYear: number | null;
  sectionLetter: string | null;
  overallHealth: AttendanceHealthMetrics;
  atRiskSubjectsCount: number;
  observationSubjectsCount: number;
  optimalSubjectsCount: number;
  subjects: StudentSubjectAttendanceItem[];
  sessions: StudentAttendanceSessionItem[];
  teacherAbsences: StudentTeacherAbsenceAlert[];
  scheduleBlocks: StudentScheduleBlock[];
}

interface RawAttendanceSubject {
  curriculum_subject_id: string;
  subject_code: string;
  subject_name: string;
  weekly_hours: number;
  is_technical_core: boolean;
  teacher_name: string | null;
  total_sessions: number;
  present_count: number;
  late_count: number;
  justified_count: number;
  absent_count: number;
}

interface RawAttendanceSession {
  record_id: string;
  session_date: string;
  block_label: string;
  moment_number: number;
  moment_name: string;
  subject_code: string;
  subject_name: string;
  teacher_name: string | null;
  status: string;
  note: string | null;
}

interface RawTeacherAbsence {
  absence_id: string;
  absence_date: string;
  teacher_name: string;
  subject_codes: string[] | null;
  subject_names: string[] | null;
  affected_blocks: unknown;
  status: string;
}

interface RawScheduleBlock {
  id: string;
  day_of_week: number;
  block_label: string;
  start_time: string;
  end_time: string;
  room_label: string;
  subject_code: string;
  subject_name: string;
  teacher_name: string;
}

interface RawAttendanceOverviewPayload {
  has_enrollment?: boolean;
  today_iso?: string;
  school_year_name?: string | null;
  mencion_name?: string | null;
  grade_year?: number | null;
  section_letter?: string | null;
  subjects?: RawAttendanceSubject[];
  sessions?: RawAttendanceSession[];
  teacher_absences?: RawTeacherAbsence[];
  schedule_blocks?: RawScheduleBlock[];
}

function normalizeAttendanceStatus(raw: string): AttendanceRecordStatus {
  if (
    raw === "present" ||
    raw === "late" ||
    raw === "justified" ||
    raw === "absent"
  ) {
    return raw;
  }
  return "present";
}

function normalizeAbsenceStatus(raw: string): TeacherAbsenceStatus {
  if (raw === "reorganized" || raw === "acknowledged" || raw === "reported") {
    return raw;
  }
  return "reported";
}

/**
 * Carga atómicamente todo el Módulo 1.7 (`/estudiante/asistencia`) mediante el RPC
 * protegido `siga_get_student_attendance_overview()`, garantizando aislamiento por
 * sección y privacidad laboral docente.
 */
export async function getStudentAttendanceOverviewData(
  profile: DashboardUserProfile
): Promise<StudentAttendanceOverviewData> {
  const fallbackToday = getCaracasClockSnapshot().dateIso;
  const emptyHealth = computeAttendanceHealth({
    presentCount: 0,
    lateCount: 0,
    justifiedCount: 0,
    absentCount: 0,
  });

  if (profile.accessTier !== "verified_workspace") {
    return {
      hasEnrollment: false,
      todayIso: fallbackToday,
      schoolYearName: null,
      mencionName: null,
      gradeYear: null,
      sectionLetter: null,
      overallHealth: emptyHealth,
      atRiskSubjectsCount: 0,
      observationSubjectsCount: 0,
      optimalSubjectsCount: 0,
      subjects: [],
      sessions: [],
      teacherAbsences: [],
      scheduleBlocks: [],
    };
  }

  if (!isNeonDatabaseConfigured()) {
    return {
      hasEnrollment: false,
      todayIso: fallbackToday,
      schoolYearName: null,
      mencionName: null,
      gradeYear: null,
      sectionLetter: null,
      overallHealth: emptyHealth,
      atRiskSubjectsCount: 0,
      observationSubjectsCount: 0,
      optimalSubjectsCount: 0,
      subjects: [],
      sessions: [],
      teacherAbsences: [],
      scheduleBlocks: [],
    };
  }

  let rpcRaw: unknown = null;
  try {
    rpcRaw = await withUserDb(
      { authUserId: profile.authUserId, email: profile.authEmail },
      (client) => callNeonRpcScalar(client, "siga_get_student_attendance_overview")
    );
  } catch {
    rpcRaw = null;
  }

  if (!rpcRaw || typeof rpcRaw !== "object" || Array.isArray(rpcRaw)) {
    return {
      hasEnrollment: false,
      todayIso: fallbackToday,
      schoolYearName: null,
      mencionName: null,
      gradeYear: null,
      sectionLetter: null,
      overallHealth: emptyHealth,
      atRiskSubjectsCount: 0,
      observationSubjectsCount: 0,
      optimalSubjectsCount: 0,
      subjects: [],
      sessions: [],
      teacherAbsences: [],
      scheduleBlocks: [],
    };
  }

  const payload = rpcRaw as unknown as RawAttendanceOverviewPayload;

  const rawSubjects = Array.isArray(payload.subjects) ? payload.subjects : [];
  const subjects: StudentSubjectAttendanceItem[] = rawSubjects.map((s) => {
    const health = computeAttendanceHealth({
      presentCount: Number(s.present_count ?? 0),
      lateCount: Number(s.late_count ?? 0),
      justifiedCount: Number(s.justified_count ?? 0),
      absentCount: Number(s.absent_count ?? 0),
    });
    return {
      curriculumSubjectId: s.curriculum_subject_id,
      subjectCode: s.subject_code,
      subjectName: s.subject_name,
      weeklyHours: Number(s.weekly_hours ?? 0),
      isTechnicalCore: Boolean(s.is_technical_core),
      teacherName: s.teacher_name ?? null,
      ...health,
    };
  });

  const overallTotals = subjects.reduce(
    (acc, s) => ({
      presentCount: acc.presentCount + s.presentCount,
      lateCount: acc.lateCount + s.lateCount,
      justifiedCount: acc.justifiedCount + s.justifiedCount,
      absentCount: acc.absentCount + s.absentCount,
    }),
    { presentCount: 0, lateCount: 0, justifiedCount: 0, absentCount: 0 }
  );
  const overallHealth = computeAttendanceHealth(overallTotals);

  const atRiskSubjectsCount = subjects.filter(
    (s) => s.healthLevel === "red"
  ).length;
  const observationSubjectsCount = subjects.filter(
    (s) => s.healthLevel === "amber"
  ).length;
  const optimalSubjectsCount = subjects.filter(
    (s) => s.healthLevel === "green"
  ).length;

  const rawSessions = Array.isArray(payload.sessions) ? payload.sessions : [];
  const sessions: StudentAttendanceSessionItem[] = rawSessions.map((sess) => ({
    recordId: sess.record_id,
    sessionDate: sess.session_date,
    blockLabel: sess.block_label,
    momentNumber: Number(sess.moment_number ?? 1),
    momentName: sess.moment_name,
    subjectCode: sess.subject_code,
    subjectName: sess.subject_name,
    teacherName: sess.teacher_name ?? null,
    status: normalizeAttendanceStatus(sess.status),
    note: sess.note ?? null,
  }));

  const rawAbsences = Array.isArray(payload.teacher_absences)
    ? payload.teacher_absences
    : [];
  const teacherAbsences: StudentTeacherAbsenceAlert[] = rawAbsences.map((a) => ({
    id: a.absence_id,
    absenceDate: a.absence_date,
    teacherName: a.teacher_name?.trim() || "Docente de la sección",
    subjectCodes: Array.isArray(a.subject_codes) ? a.subject_codes : [],
    subjectNames: Array.isArray(a.subject_names) ? a.subject_names : [],
    affectedBlocks: normalizeAffectedBlocksJson(a.affected_blocks),
    status: normalizeAbsenceStatus(a.status),
  }));

  const rawSchedule = Array.isArray(payload.schedule_blocks)
    ? payload.schedule_blocks
    : [];
  const scheduleBlocks: StudentScheduleBlock[] = rawSchedule.map((b) => ({
    id: b.id,
    dayOfWeek: Number(b.day_of_week),
    blockLabel: b.block_label,
    startTime: String(b.start_time).slice(0, 5),
    endTime: String(b.end_time).slice(0, 5),
    roomLabel: b.room_label,
    subjectCode: b.subject_code,
    subjectName: b.subject_name,
    teacherName: b.teacher_name,
  }));

  return {
    hasEnrollment: Boolean(payload.has_enrollment),
    todayIso: payload.today_iso ?? fallbackToday,
    schoolYearName: payload.school_year_name ?? null,
    mencionName: payload.mencion_name ?? null,
    gradeYear:
      payload.grade_year !== null && payload.grade_year !== undefined
        ? Number(payload.grade_year)
        : null,
    sectionLetter: payload.section_letter ?? null,
    overallHealth,
    atRiskSubjectsCount,
    observationSubjectsCount,
    optimalSubjectsCount,
    subjects,
    sessions,
    teacherAbsences,
    scheduleBlocks,
  };
}

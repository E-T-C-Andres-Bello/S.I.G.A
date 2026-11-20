import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { DashboardUserProfile } from "@/lib/supabase/dashboard-session";
import {
  analyzeSubjectSimulation,
  type SimulatorEvaluationItem,
  type SimulatorOutcomeStatus,
  type SubjectSimulatorInput,
} from "./grade-simulator";
import {
  classifyCurriculumAxis,
  getSubjectProgressionContext,
  resolveCurriculumNodeStatus,
  type CurriculumAxisMeta,
  type CurriculumNodeStatus,
  type SubjectProgressionContext,
} from "./curriculum-tracks";
import type {
  PendingSubjectAttemptSummary,
  StudentDashboardData,
  StudentSubjectSummary,
} from "./dashboard-data";
import {
  buildStudentAcademicHistory,
  type StudentAcademicHistorySummary,
} from "./academic-history";

export interface CurriculumMatrixSubjectItem {
  curriculumSubjectId: string;
  subjectCode: string;
  subjectName: string;
  weeklyHours: number;
  annualHours: number | null;
  displayOrder: number;
  gradingScale: "NUMERIC_1_20" | "LITERAL_A_E";
  passingThreshold: number;
  isTechnicalCore: boolean;
  axis: CurriculumAxisMeta;
  status: CurriculumNodeStatus;
  finalNumeric: number | null;
  finalLiteral: string | null;
}

export interface CurriculumYearMatrix {
  gradeYear: number;
  totalWeeklyHours: number;
  totalAnnualHours: number;
  subjectsCount: number;
  subjects: CurriculumMatrixSubjectItem[];
}

export interface CurriculumMencionCatalog {
  id: string;
  code: string;
  name: string;
  specialty: string | null;
  description: string | null;
  years: CurriculumYearMatrix[];
}

export interface SubjectScheduleSlot {
  id: string;
  dayOfWeek: number;
  blockLabel: string;
  startTime: string;
  endTime: string;
  roomLabel: string;
}

export interface SubjectAttendanceTelemetry {
  totalSessions: number;
  presentCount: number;
  lateCount: number;
  justifiedCount: number;
  absentCount: number;
  attendancePercent: number | null;
}

export interface SubjectEvaluationItemDetail {
  id: string;
  title: string;
  evaluationType: string;
  weightPercent: number;
  maxPoints: number;
  scheduledDate: string | null;
  numericScore: number | null;
  literalGrade: string | null;
  weightedContribution: number | null;
  source: string | null;
  itemStatus: "graded" | "pending" | "overdue";
}

export interface SubjectMomentDetail {
  momentoId: string;
  momentNumber: number;
  momentName: string;
  momentStatus: string;
  planTitle: string | null;
  planStatus: "draft" | "published" | "locked" | null;
  finalGrade: {
    rawWeightedAvg: number | null;
    finalNumeric: number | null;
    finalLiteral: string | null;
    qualitativeObservation: string | null;
    isLocked: boolean;
  } | null;
  evaluatedWeight: number;
  totalWeight: number;
  items: SubjectEvaluationItemDetail[];
  simulatorInput: SubjectSimulatorInput;
}

export interface EnrolledSubjectCardData {
  curriculumSubjectId: string;
  subjectCode: string;
  subjectName: string;
  weeklyHours: number;
  annualHours: number | null;
  displayOrder: number;
  gradingScale: "NUMERIC_1_20" | "LITERAL_A_E";
  passingThreshold: number;
  isTechnicalCore: boolean;
  axis: CurriculumAxisMeta;
  teacherName: string | null;
  scheduleBlocks: SubjectScheduleSlot[];
  attendance: SubjectAttendanceTelemetry | null;
  activeMomentNumber: number | null;
  activeMomentName: string | null;
  activeMomentGradeNumeric: number | null;
  activeMomentGradeLiteral: string | null;
  evaluatedItemsCount: number;
  totalItemsCount: number;
  evaluationProgressPercent: number;
  simulationStatus: SimulatorOutcomeStatus;
  requiredUniformScore: number | null;
  isPendingRecovery: boolean;
  moments: SubjectMomentDetail[];
  pendingAttempts: PendingSubjectAttemptSummary[];
  progression: SubjectProgressionContext | null;
}

export interface StudentCurriculumOverviewData {
  hasEnrollment: boolean;
  accessTier: DashboardUserProfile["accessTier"];
  schoolYearName: string | null;
  mencionId: string | null;
  mencionCode: string | null;
  mencionName: string | null;
  gradeYear: number | null;
  sectionLetter: string | null;
  activeMomentNumber: number | null;
  activeMomentName: string | null;
  studentFullName: string;
  cedulaDisplay: string;
  enrolledSubjects: EnrolledSubjectCardData[];
  menciones: CurriculumMencionCatalog[];
  summaryMetrics: {
    totalCurriculumSubjects: number;
    completedOrPassedCount: number;
    enrolledCount: number;
    weeklyHoursCurrentYear: number;
    overallProgressPercent: number;
  };
  academicHistory: StudentAcademicHistorySummary;
  bentoSnapshot: StudentDashboardData;
}

export interface StudentSubjectDetailData {
  accessTier: DashboardUserProfile["accessTier"];
  hasEnrollment: boolean;
  isCurrentlyEnrolledSubject: boolean;
  schoolYearName: string | null;
  enrolledGradeYear: number | null;
  enrolledMencionCode: string | null;
  enrolledMencionName: string | null;
  sectionLetter: string | null;
  activeMomentNumber: number | null;
  subject: {
    curriculumSubjectId: string | null;
    subjectCode: string;
    subjectName: string;
    gradeYearsInMencion: number[];
    weeklyHours: number | null;
    annualHours: number | null;
    gradingScale: "NUMERIC_1_20" | "LITERAL_A_E";
    passingThreshold: number;
    isTechnicalCore: boolean;
    axis: CurriculumAxisMeta;
    curriculumStatus: CurriculumNodeStatus;
  };
  teacherName: string | null;
  scheduleBlocks: SubjectScheduleSlot[];
  attendance: SubjectAttendanceTelemetry | null;
  moments: SubjectMomentDetail[];
  pendingAttempts: PendingSubjectAttemptSummary[];
  enrolledPeers: Array<{
    subjectCode: string;
    subjectName: string;
    isTechnicalCore: boolean;
  }>;
  progression: SubjectProgressionContext | null;
}

interface MencionRow {
  id: string;
  code: string;
  name: string;
  specialty: string | null;
  description: string | null;
}

interface SubjectCatalogRow {
  id: string;
  code: string;
  name: string;
  grading_scale: "NUMERIC_1_20" | "LITERAL_A_E";
  passing_threshold: number;
  is_technical_core: boolean;
}

interface CurriculumMatrixRow {
  id: string;
  mencion_id: string;
  grade_year: number;
  weekly_hours: number;
  annual_hours: number | null;
  curriculum_component: string | null;
  display_order: number | null;
  subjects: SubjectCatalogRow | SubjectCatalogRow[] | null;
}

interface EnrollmentDetailRow {
  id: string;
  section_id: string;
  grade_year: number;
  mencion_id: string;
  school_year_id: string;
  enrollment_status: string;
  sections: { section_letter: string } | Array<{ section_letter: string }> | null;
  menciones:
    | { code: string; name: string; specialty: string | null }
    | Array<{ code: string; name: string; specialty: string | null }>
    | null;
  school_years:
    | {
        code: string;
        name: string;
        is_current: boolean;
        status: string;
        start_date: string | null;
      }
    | Array<{
        code: string;
        name: string;
        is_current: boolean;
        status: string;
        start_date: string | null;
      }>
    | null;
}

interface MomentRow {
  id: string;
  school_year_id: string;
  moment_number: number;
  name: string;
  status: string;
}

interface TeacherAssignmentRow {
  id: string;
  curriculum_subject_id: string;
}

interface EvalPlanRow {
  id: string;
  teacher_assignment_id: string;
  momento_id: string;
  title: string;
  status: "draft" | "published" | "locked";
}

interface EvalItemRow {
  id: string;
  evaluation_plan_id: string;
  title: string;
  evaluation_type: string;
  weight_percent: number;
  max_points: number;
  scheduled_date: string | null;
}

interface StudentScoreDetailRow {
  evaluation_item_id: string;
  numeric_score: number | null;
  literal_grade: string | null;
  source: string | null;
}

interface MomentFinalGradeDetailRow {
  enrollment_id: string;
  momento_id: string;
  curriculum_subject_id: string;
  raw_weighted_avg: number | null;
  final_numeric: number | null;
  final_literal: string | null;
  qualitative_observation: string | null;
  is_locked: boolean;
}

interface PendingAttemptRow {
  id: string;
  curriculum_subject_id: string;
  attempt_number: number;
  exam_date: string;
  final_numeric: number;
  passed: boolean;
  curriculum_subjects:
    | { subjects: { code: string; name: string } | Array<{ code: string; name: string }> | null }
    | Array<{ subjects: { code: string; name: string } | Array<{ code: string; name: string }> | null }>
    | null;
}

interface ScheduleRpcRow {
  id: string;
  day_of_week: number;
  block_label: string;
  start_time: string;
  end_time: string;
  room_label: string;
  subject_code: string;
  teacher_name: string;
}

interface TelemetryRpcRow {
  curriculum_subject_id: string;
  subject_code: string;
  teacher_name: string | null;
  total_sessions: number;
  present_count: number;
  late_count: number;
  justified_count: number;
  absent_count: number;
}

function unwrapSingle<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function formatCedulaDisplay(raw: string): string {
  const cleaned = raw.trim().toUpperCase();
  if (/^[VEJ][0-9]{6,9}$/.test(cleaned)) {
    return `${cleaned.charAt(0)}-${cleaned.slice(1)}`;
  }
  return cleaned;
}

function getTodayCaracasIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Caracas",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function buildAttendanceSummary(
  telemetry: TelemetryRpcRow | undefined
): SubjectAttendanceTelemetry | null {
  if (!telemetry) return null;
  const attendedCount =
    telemetry.present_count + telemetry.late_count + telemetry.justified_count;
  return {
    totalSessions: telemetry.total_sessions,
    presentCount: telemetry.present_count,
    lateCount: telemetry.late_count,
    justifiedCount: telemetry.justified_count,
    absentCount: telemetry.absent_count,
    attendancePercent:
      telemetry.total_sessions > 0
        ? Math.round((attendedCount / telemetry.total_sessions) * 100)
        : null,
  };
}

function buildCatalogLookup(
  curriculumRows: CurriculumMatrixRow[],
  targetMencionId: string | null
): Map<string, { name: string; gradeYears: number[] }> {
  const catalogByCode = new Map<
    string,
    { name: string; gradeYears: number[] }
  >();
  for (const row of curriculumRows) {
    if (targetMencionId && row.mencion_id !== targetMencionId) continue;
    const s = unwrapSingle(row.subjects);
    if (!s) continue;
    const existing = catalogByCode.get(s.code);
    if (existing) {
      if (!existing.gradeYears.includes(row.grade_year)) {
        existing.gradeYears.push(row.grade_year);
      }
    } else {
      catalogByCode.set(s.code, {
        name: s.name,
        gradeYears: [row.grade_year],
      });
    }
  }
  return catalogByCode;
}

function buildMomentsDetailForSubject(params: {
  curriculumSubjectId: string;
  subjectCode: string;
  subjectName: string;
  gradingScale: "NUMERIC_1_20" | "LITERAL_A_E";
  passingThreshold: number;
  enrollmentId: string;
  assignmentId: string | undefined;
  momentos: MomentRow[];
  plansByAssignmentMoment: Map<string, EvalPlanRow>;
  itemsByPlanId: Map<string, EvalItemRow[]>;
  scoreByItemId: Map<string, StudentScoreDetailRow>;
  finalGradesMap: Map<string, MomentFinalGradeDetailRow>;
  todayIso: string;
}): SubjectMomentDetail[] {
  return params.momentos.map((mom) => {
    const plan = params.assignmentId
      ? params.plansByAssignmentMoment.get(`${params.assignmentId}:${mom.id}`)
      : undefined;
    const rawItems = plan ? params.itemsByPlanId.get(plan.id) ?? [] : [];

    let evaluatedWeight = 0;
    let totalWeight = 0;

    const detailedItems: SubjectEvaluationItemDetail[] = rawItems.map((item) => {
      const weight = Number(item.weight_percent);
      totalWeight += weight;

      const scoreRow = params.scoreByItemId.get(item.id);
      const numericScore =
        scoreRow?.numeric_score !== null && scoreRow?.numeric_score !== undefined
          ? Number(scoreRow.numeric_score)
          : null;
      const literalGrade = scoreRow?.literal_grade ?? null;
      const isGraded = numericScore !== null || literalGrade !== null;

      if (isGraded) {
        evaluatedWeight += weight;
      }

      const weightedContribution =
        numericScore !== null
          ? Math.round((numericScore * (weight / 100) + Number.EPSILON) * 100) /
            100
          : null;

      const isOverdue =
        !isGraded &&
        item.scheduled_date !== null &&
        item.scheduled_date < params.todayIso;

      return {
        id: item.id,
        title: item.title,
        evaluationType: item.evaluation_type,
        weightPercent: weight,
        maxPoints: Number(item.max_points ?? 20),
        scheduledDate: item.scheduled_date,
        numericScore,
        literalGrade,
        weightedContribution,
        source: scoreRow?.source ?? null,
        itemStatus: isGraded ? "graded" : isOverdue ? "overdue" : "pending",
      };
    });

    const fgRow = params.finalGradesMap.get(
      `${params.enrollmentId}:${params.curriculumSubjectId}:${mom.id}`
    );

    const simulatorItems: SimulatorEvaluationItem[] = detailedItems.map((it) => ({
      id: it.id,
      title: it.title,
      evaluationType: it.evaluationType,
      weightPercent: it.weightPercent,
      maxPoints: it.maxPoints,
      scheduledDate: it.scheduledDate,
      recordedScore: it.numericScore,
    }));

    const simulatorInput: SubjectSimulatorInput = {
      curriculumSubjectId: params.curriculumSubjectId,
      subjectCode: params.subjectCode,
      subjectName: params.subjectName,
      gradingScale: params.gradingScale,
      passingThreshold: params.passingThreshold,
      planTitle: plan?.title ?? null,
      planStatus: plan?.status ?? null,
      items: simulatorItems,
    };

    return {
      momentoId: mom.id,
      momentNumber: mom.moment_number,
      momentName: mom.name,
      momentStatus: mom.status,
      planTitle: plan?.title ?? null,
      planStatus: plan?.status ?? null,
      finalGrade: fgRow
        ? {
            rawWeightedAvg:
              fgRow.raw_weighted_avg !== null
                ? Number(fgRow.raw_weighted_avg)
                : null,
            finalNumeric: fgRow.final_numeric,
            finalLiteral: fgRow.final_literal,
            qualitativeObservation: fgRow.qualitative_observation,
            isLocked: Boolean(fgRow.is_locked),
          }
        : null,
      evaluatedWeight: Math.round(evaluatedWeight * 100) / 100,
      totalWeight: Math.round(totalWeight * 100) / 100,
      items: detailedItems,
      simulatorInput,
    };
  });
}

async function fetchAcademicFoundation(internalUserId: string) {
  const dbClient = await createServerSupabaseClient();
  if (!dbClient) {
    return null;
  }

  const [mencionesRes, curriculumRes, enrollmentsRes, pendingRes] =
    await Promise.all([
      dbClient
        .from("menciones")
        .select("id, code, name, specialty, description")
        .eq("is_active", true)
        .order("name", { ascending: true })
        .returns<MencionRow[]>(),
      dbClient
        .from("curriculum_subjects")
        .select(
          "id, mencion_id, grade_year, weekly_hours, annual_hours, curriculum_component, display_order, subjects!inner(id, code, name, grading_scale, passing_threshold, is_technical_core)"
        )
        .eq("is_active", true)
        .order("display_order", { ascending: true })
        .returns<CurriculumMatrixRow[]>(),
      dbClient
        .from("enrollments")
        .select(
          "id, section_id, grade_year, mencion_id, school_year_id, enrollment_status, sections(section_letter), menciones(code, name, specialty), school_years!inner(code, name, is_current, status, start_date)"
        )
        .eq("student_user_id", internalUserId)
        .is("deleted_at", null)
        .order("grade_year", { ascending: false })
        .returns<EnrollmentDetailRow[]>(),
      dbClient
        .from("pending_subject_attempts")
        .select(
          "id, curriculum_subject_id, attempt_number, exam_date, final_numeric, passed, curriculum_subjects(subjects(code, name))"
        )
        .eq("student_user_id", internalUserId)
        .order("exam_date", { ascending: false })
        .returns<PendingAttemptRow[]>(),
    ]);

  const enrollments = enrollmentsRes.data ?? [];
  const currentEnrollment =
    enrollments.find((e) => unwrapSingle(e.school_years)?.is_current) ??
    enrollments[0] ??
    null;

  return {
    dbClient,
    menciones: mencionesRes.data ?? [],
    curriculumRows: curriculumRes.data ?? [],
    enrollments,
    currentEnrollment,
    pendingAttempts: pendingRes.data ?? [],
  };
}

/**
 * Ejecuta todas las consultas del período activo en un único `Promise.all`
 * (sin cascadas secuenciales entre planes e ítems de evaluación).
 */
async function fetchActiveEnrollmentDetails(
  dbClient: NonNullable<Awaited<ReturnType<typeof createServerSupabaseClient>>>,
  enrollment: EnrollmentDetailRow,
  allEnrollmentIds: string[],
  allSchoolYearIds: string[],
  accessTier: DashboardUserProfile["accessTier"]
) {
  const isVerified = accessTier === "verified_workspace";
  const targetSchoolYearIds =
    allSchoolYearIds.length > 0 ? allSchoolYearIds : [enrollment.school_year_id];

  const [
    momentosRes,
    teacherAssignmentsRes,
    evalPlansRes,
    evalItemsRes,
    scoresRes,
    finalGradesRes,
    scheduleRpcRes,
    telemetryRpcRes,
  ] = await Promise.all([
    dbClient
      .from("momentos")
      .select("id, school_year_id, moment_number, name, status")
      .in("school_year_id", targetSchoolYearIds)
      .order("moment_number", { ascending: true })
      .returns<MomentRow[]>(),
    dbClient
      .from("teacher_assignments")
      .select("id, curriculum_subject_id")
      .eq("school_year_id", enrollment.school_year_id)
      .eq("section_id", enrollment.section_id)
      .eq("is_active", true)
      .returns<TeacherAssignmentRow[]>(),
    isVerified
      ? dbClient
          .from("evaluation_plans")
          .select(
            "id, teacher_assignment_id, momento_id, title, status, teacher_assignments!inner(school_year_id, section_id)"
          )
          .eq("teacher_assignments.school_year_id", enrollment.school_year_id)
          .eq("teacher_assignments.section_id", enrollment.section_id)
          .in("status", ["published", "locked"])
          .returns<EvalPlanRow[]>()
      : Promise.resolve({ data: [] as EvalPlanRow[] }),
    isVerified
      ? dbClient
          .from("evaluation_items")
          .select(
            "id, evaluation_plan_id, title, evaluation_type, weight_percent, max_points, scheduled_date, evaluation_plans!inner(status, teacher_assignments!inner(school_year_id, section_id))"
          )
          .eq(
            "evaluation_plans.teacher_assignments.school_year_id",
            enrollment.school_year_id
          )
          .eq(
            "evaluation_plans.teacher_assignments.section_id",
            enrollment.section_id
          )
          .in("evaluation_plans.status", ["published", "locked"])
          .order("scheduled_date", { ascending: true, nullsFirst: false })
          .returns<EvalItemRow[]>()
      : Promise.resolve({ data: [] as EvalItemRow[] }),
    isVerified
      ? dbClient
          .from("student_scores")
          .select("evaluation_item_id, numeric_score, literal_grade, source")
          .eq("enrollment_id", enrollment.id)
          .is("deleted_at", null)
          .returns<StudentScoreDetailRow[]>()
      : Promise.resolve({ data: [] as StudentScoreDetailRow[] }),
    allEnrollmentIds.length > 0
      ? dbClient
          .from("moment_final_grades")
          .select(
            "enrollment_id, momento_id, curriculum_subject_id, raw_weighted_avg, final_numeric, final_literal, qualitative_observation, is_locked"
          )
          .in("enrollment_id", allEnrollmentIds)
          .returns<MomentFinalGradeDetailRow[]>()
      : Promise.resolve({ data: [] as MomentFinalGradeDetailRow[] }),
    isVerified
      ? dbClient.rpc("siga_get_student_section_schedule")
      : Promise.resolve({ data: null }),
    isVerified
      ? dbClient.rpc("siga_get_student_subject_telemetry")
      : Promise.resolve({ data: null, error: null }),
  ]);

  const allMomentos = momentosRes.data ?? [];

  return {
    allMomentos,
    momentos: allMomentos.filter(
      (m) => m.school_year_id === enrollment.school_year_id
    ),
    teacherAssignments: teacherAssignmentsRes.data ?? [],
    evalPlans: evalPlansRes.data ?? [],
    evalItems: evalItemsRes.data ?? [],
    scores: scoresRes.data ?? [],
    finalGrades: finalGradesRes.data ?? [],
    scheduleRows: Array.isArray(scheduleRpcRes.data)
      ? (scheduleRpcRes.data as ScheduleRpcRow[])
      : [],
    telemetryRows:
      !telemetryRpcRes.error && Array.isArray(telemetryRpcRes.data)
        ? (telemetryRpcRes.data as TelemetryRpcRow[])
        : [],
  };
}

function indexEnrollmentDetails(
  details: Awaited<ReturnType<typeof fetchActiveEnrollmentDetails>> | null,
  curriculumRows: CurriculumMatrixRow[],
  currentEnrollmentId: string | null
) {
  const assignmentBySubjectId = new Map(
    (details?.teacherAssignments ?? []).map((ta) => [
      ta.curriculum_subject_id,
      ta.id,
    ])
  );
  const plansByAssignmentMoment = new Map<string, EvalPlanRow>();
  for (const plan of details?.evalPlans ?? []) {
    plansByAssignmentMoment.set(
      `${plan.teacher_assignment_id}:${plan.momento_id}`,
      plan
    );
  }
  const itemsByPlanId = new Map<string, EvalItemRow[]>();
  for (const item of details?.evalItems ?? []) {
    const list = itemsByPlanId.get(item.evaluation_plan_id) ?? [];
    list.push(item);
    itemsByPlanId.set(item.evaluation_plan_id, list);
  }
  const scoreByItemId = new Map(
    (details?.scores ?? []).map((s) => [s.evaluation_item_id, s])
  );

  const finalGradesMap = new Map<string, MomentFinalGradeDetailRow>();
  const historicalPassedSubjectCodes = new Set<string>();
  const subjectCodeByCurriculumId = new Map<string, string>();

  for (const row of curriculumRows) {
    const sub = unwrapSingle(row.subjects);
    if (sub) subjectCodeByCurriculumId.set(row.id, sub.code);
  }

  for (const fg of details?.finalGrades ?? []) {
    finalGradesMap.set(
      `${fg.enrollment_id}:${fg.curriculum_subject_id}:${fg.momento_id}`,
      fg
    );
    if (
      currentEnrollmentId &&
      fg.enrollment_id !== currentEnrollmentId &&
      ((fg.final_numeric !== null && fg.final_numeric >= 10) ||
        (fg.final_literal !== null &&
          ["A", "B", "C", "D"].includes(fg.final_literal)))
    ) {
      const code = subjectCodeByCurriculumId.get(fg.curriculum_subject_id);
      if (code) historicalPassedSubjectCodes.add(code);
    }
  }

  const scheduleSlotsByCode = new Map<string, SubjectScheduleSlot[]>();
  const teacherFromScheduleByCode = new Map<string, string>();
  for (const row of details?.scheduleRows ?? []) {
    const key = row.subject_code.toUpperCase();
    const list = scheduleSlotsByCode.get(key) ?? [];
    list.push({
      id: row.id,
      dayOfWeek: Number(row.day_of_week),
      blockLabel: row.block_label,
      startTime: String(row.start_time).slice(0, 5),
      endTime: String(row.end_time).slice(0, 5),
      roomLabel: row.room_label,
    });
    scheduleSlotsByCode.set(key, list);
    if (row.teacher_name) {
      teacherFromScheduleByCode.set(key, row.teacher_name);
    }
  }

  const telemetryBySubjectId = new Map(
    (details?.telemetryRows ?? []).map((t) => [t.curriculum_subject_id, t])
  );

  return {
    assignmentBySubjectId,
    plansByAssignmentMoment,
    itemsByPlanId,
    scoreByItemId,
    finalGradesMap,
    historicalPassedSubjectCodes,
    scheduleSlotsByCode,
    teacherFromScheduleByCode,
    telemetryBySubjectId,
  };
}

function mapPendingAttemptsForSubject(
  pendingAttempts: PendingAttemptRow[],
  subjectCode: string
): PendingSubjectAttemptSummary[] {
  const target = subjectCode.toUpperCase();
  return pendingAttempts
    .filter((att) => {
      const cs = unwrapSingle(att.curriculum_subjects);
      const s = unwrapSingle(cs?.subjects);
      return s?.code.toUpperCase() === target;
    })
    .map((att) => {
      const cs = unwrapSingle(att.curriculum_subjects);
      const s = unwrapSingle(cs?.subjects);
      return {
        id: att.id,
        subjectCode: s?.code ?? subjectCode,
        subjectName: s?.name ?? "Asignatura pendiente",
        attemptNumber: Number(att.attempt_number),
        examDate: att.exam_date,
        finalNumeric: Number(att.final_numeric),
        passed: Boolean(att.passed),
      };
    });
}

/**
 * Carga todo el módulo "Asignaturas y Pensum" (`/estudiante/asignaturas`),
 * incluyendo el detalle de los 3 Momentos Pedagógicos por asignatura inscrita
 * para que desplegar cualquier materia en la interfaz sea instantáneo (0 ms).
 */
export async function getStudentCurriculumOverviewData(
  profile: DashboardUserProfile
): Promise<StudentCurriculumOverviewData> {
  const fullName = `${profile.firstName} ${profile.lastName}`.trim();
  const cedulaDisplay = formatCedulaDisplay(profile.cedula);

  const foundation = await fetchAcademicFoundation(profile.internalUserId);
  if (!foundation) {
    return {
      hasEnrollment: false,
      accessTier: profile.accessTier,
      schoolYearName: null,
      mencionId: null,
      mencionCode: null,
      mencionName: null,
      gradeYear: null,
      sectionLetter: null,
      activeMomentNumber: null,
      activeMomentName: null,
      studentFullName: fullName,
      cedulaDisplay,
      enrolledSubjects: [],
      menciones: [],
      summaryMetrics: {
        totalCurriculumSubjects: 0,
        completedOrPassedCount: 0,
        enrolledCount: 0,
        weeklyHoursCurrentYear: 0,
        overallProgressPercent: 0,
      },
      academicHistory: {
        overallCumulativeAverage: null,
        overallEvaluatedNumericCount: 0,
        currentYearAverage: null,
        currentYearLabel: null,
        totalApprovedSubjectsCount: 0,
        totalTrackedSubjectsCount: 0,
        pendingRecoveryCount: 0,
        periods: [],
        pendingAttempts: [],
      },
      bentoSnapshot: {
        hasEnrollment: false,
        schoolYearName: null,
        mencionName: null,
        gradeYear: null,
        sectionLetter: null,
        activeMomentName: null,
        activeMomentNumber: null,
        averageGrade: null,
        attendancePercent: null,
        attendanceSessionsCount: 0,
        enrolledSubjectsCount: 0,
        activeLoansAndRequestsCount: 0,
        completionPercent: 0,
        subjectsSummary: [],
        momentos: [],
        momentGradesByNumber: {},
        upcomingEvaluations: [],
        calendarEvents: [],
        scheduleBlocks: [],
        teacherAbsenceAlerts: [],
        simulatorSubjects: [],
        pendingSubjects: [],
        medals: [],
      },
    };
  }

  const {
    dbClient,
    menciones,
    curriculumRows,
    enrollments,
    currentEnrollment,
    pendingAttempts,
  } = foundation;

  const allSchoolYearIds = Array.from(
    new Set(enrollments.map((e) => e.school_year_id))
  );

  const details = currentEnrollment
    ? await fetchActiveEnrollmentDetails(
        dbClient,
        currentEnrollment,
        enrollments.map((e) => e.id),
        allSchoolYearIds,
        profile.accessTier
      )
    : null;

  const indexed = indexEnrollmentDetails(
    details,
    curriculumRows,
    currentEnrollment?.id ?? null
  );

  const momentos = details?.momentos ?? [];
  const activeMoment =
    momentos.find((m) => m.status === "open") ??
    [...momentos].reverse().find((m) => m.status !== "scheduled") ??
    momentos[0] ??
    null;

  const pendingRecoverySubjectIds = new Set<string>();
  const passedPendingIds = new Set(
    pendingAttempts
      .filter((a) => a.passed)
      .map((a) => a.curriculum_subject_id)
  );
  for (const att of pendingAttempts) {
    if (!att.passed && !passedPendingIds.has(att.curriculum_subject_id)) {
      pendingRecoverySubjectIds.add(att.curriculum_subject_id);
    }
  }

  const todayIso = getTodayCaracasIso();
  const activeMencionMeta = currentEnrollment
    ? unwrapSingle(currentEnrollment.menciones)
    : null;
  const enrolledCatalogLookup = buildCatalogLookup(
    curriculumRows,
    currentEnrollment?.mencion_id ?? null
  );

  const enrolledSubjects: EnrolledSubjectCardData[] = [];

  if (currentEnrollment) {
    const currentRows = curriculumRows.filter(
      (r) =>
        r.mencion_id === currentEnrollment.mencion_id &&
        r.grade_year === currentEnrollment.grade_year
    );

    for (const cs of currentRows) {
      const subj = unwrapSingle(cs.subjects);
      if (!subj) continue;

      const assignmentId = indexed.assignmentBySubjectId.get(cs.id);
      const momentsDetail = buildMomentsDetailForSubject({
        curriculumSubjectId: cs.id,
        subjectCode: subj.code,
        subjectName: subj.name,
        gradingScale: subj.grading_scale,
        passingThreshold: Number(subj.passing_threshold || 10),
        enrollmentId: currentEnrollment.id,
        assignmentId,
        momentos,
        plansByAssignmentMoment: indexed.plansByAssignmentMoment,
        itemsByPlanId: indexed.itemsByPlanId,
        scoreByItemId: indexed.scoreByItemId,
        finalGradesMap: indexed.finalGradesMap,
        todayIso,
      });

      const activeMomDetail =
        (activeMoment
          ? momentsDetail.find((m) => m.momentNumber === activeMoment.moment_number)
          : undefined) ??
        momentsDetail[0] ??
        null;

      const simAnalysis = activeMomDetail
        ? analyzeSubjectSimulation(activeMomDetail.simulatorInput)
        : analyzeSubjectSimulation({
            curriculumSubjectId: cs.id,
            subjectCode: subj.code,
            subjectName: subj.name,
            gradingScale: subj.grading_scale,
            passingThreshold: Number(subj.passing_threshold || 10),
            planTitle: null,
            planStatus: null,
            items: [],
          });

      const evaluatedItemsCount = activeMomDetail
        ? activeMomDetail.items.filter((i) => i.itemStatus === "graded").length
        : 0;
      const totalItemsCount = activeMomDetail ? activeMomDetail.items.length : 0;

      const telemetry = indexed.telemetryBySubjectId.get(cs.id);
      const upperCode = subj.code.toUpperCase();

      enrolledSubjects.push({
        curriculumSubjectId: cs.id,
        subjectCode: subj.code,
        subjectName: subj.name,
        weeklyHours: Number(cs.weekly_hours),
        annualHours:
          cs.annual_hours !== null && cs.annual_hours !== undefined
            ? Number(cs.annual_hours)
            : null,
        displayOrder: Number(cs.display_order ?? 10),
        gradingScale: subj.grading_scale,
        passingThreshold: Number(subj.passing_threshold || 10),
        isTechnicalCore: Boolean(subj.is_technical_core),
        axis: classifyCurriculumAxis(
          subj.code,
          Boolean(subj.is_technical_core),
          cs.curriculum_component
        ),
        teacherName:
          telemetry?.teacher_name ??
          indexed.teacherFromScheduleByCode.get(upperCode) ??
          null,
        scheduleBlocks: indexed.scheduleSlotsByCode.get(upperCode) ?? [],
        attendance: buildAttendanceSummary(telemetry),
        activeMomentNumber: activeMoment?.moment_number ?? null,
        activeMomentName: activeMoment?.name ?? null,
        activeMomentGradeNumeric:
          activeMomDetail?.finalGrade?.finalNumeric ??
          simAnalysis.currentMppeNumeric ??
          null,
        activeMomentGradeLiteral:
          activeMomDetail?.finalGrade?.finalLiteral ?? null,
        evaluatedItemsCount,
        totalItemsCount,
        evaluationProgressPercent: Math.round(simAnalysis.evaluatedWeight),
        simulationStatus: simAnalysis.status,
        requiredUniformScore: simAnalysis.requiredUniformScore,
        isPendingRecovery: pendingRecoverySubjectIds.has(cs.id),
        moments: momentsDetail,
        pendingAttempts: mapPendingAttemptsForSubject(pendingAttempts, subj.code),
        progression: getSubjectProgressionContext(
          activeMencionMeta?.code ?? null,
          subj.code,
          enrolledCatalogLookup
        ),
      });
    }

    enrolledSubjects.sort((a, b) => {
      if (a.displayOrder !== b.displayOrder) {
        return a.displayOrder - b.displayOrder;
      }
      return a.subjectName.localeCompare(b.subjectName, "es");
    });
  }

  const enrolledByCode = new Map(
    enrolledSubjects.map((s) => [s.subjectCode, s])
  );

  const mencionesCatalog: CurriculumMencionCatalog[] = menciones.map((m) => {
    const isSameMencion = currentEnrollment?.mencion_id === m.id;
    const yearMap = new Map<number, CurriculumMatrixSubjectItem[]>();

    for (let yr = 1; yr <= 6; yr += 1) {
      yearMap.set(yr, []);
    }

    const rowsForMencion = curriculumRows.filter((r) => r.mencion_id === m.id);
    for (const row of rowsForMencion) {
      const subj = unwrapSingle(row.subjects);
      if (!subj) continue;

      const enrolledMatch = isSameMencion
        ? enrolledByCode.get(subj.code)
        : undefined;
      const isCurrentYear =
        isSameMencion && currentEnrollment?.grade_year === row.grade_year;

      const status = resolveCurriculumNodeStatus({
        gradeYear: row.grade_year,
        enrolledGradeYear: currentEnrollment?.grade_year ?? null,
        isSameMencion,
        isPendingRecovery: pendingRecoverySubjectIds.has(row.id),
        historicalPassed: indexed.historicalPassedSubjectCodes.has(subj.code),
        currentFinalNumeric: enrolledMatch?.activeMomentGradeNumeric ?? null,
        currentFinalLiteral: enrolledMatch?.activeMomentGradeLiteral ?? null,
        passingThreshold: Number(subj.passing_threshold || 10),
      });

      const list = yearMap.get(row.grade_year) ?? [];
      list.push({
        curriculumSubjectId: row.id,
        subjectCode: subj.code,
        subjectName: subj.name,
        weeklyHours: Number(row.weekly_hours),
        annualHours:
          row.annual_hours !== null && row.annual_hours !== undefined
            ? Number(row.annual_hours)
            : null,
        displayOrder: Number(row.display_order ?? 10),
        gradingScale: subj.grading_scale,
        passingThreshold: Number(subj.passing_threshold || 10),
        isTechnicalCore: Boolean(subj.is_technical_core),
        axis: classifyCurriculumAxis(
          subj.code,
          Boolean(subj.is_technical_core),
          row.curriculum_component
        ),
        status,
        finalNumeric: isCurrentYear
          ? enrolledMatch?.activeMomentGradeNumeric ?? null
          : null,
        finalLiteral: isCurrentYear
          ? enrolledMatch?.activeMomentGradeLiteral ?? null
          : null,
      });
      yearMap.set(row.grade_year, list);
    }

    const years: CurriculumYearMatrix[] = [];
    for (let yr = 1; yr <= 6; yr += 1) {
      const subs = (yearMap.get(yr) ?? []).sort((a, b) => {
        if (a.displayOrder !== b.displayOrder) {
          return a.displayOrder - b.displayOrder;
        }
        return a.subjectName.localeCompare(b.subjectName, "es");
      });
      years.push({
        gradeYear: yr,
        totalWeeklyHours: subs.reduce((sum, s) => sum + s.weeklyHours, 0),
        totalAnnualHours: subs.reduce(
          (sum, s) => sum + (s.annualHours ?? 0),
          0
        ),
        subjectsCount: subs.length,
        subjects: subs,
      });
    }

    return {
      id: m.id,
      code: m.code,
      name: m.name,
      specialty: m.specialty ?? null,
      description: m.description,
      years,
    };
  });

  const activeMencionCatalog = mencionesCatalog.find(
    (mc) => mc.id === currentEnrollment?.mencion_id
  );
  const allNodesInActiveMencion =
    activeMencionCatalog?.years.flatMap((y) => y.subjects) ?? [];
  const completedOrPriorCount = allNodesInActiveMencion.filter(
    (s) => s.status === "approved" || s.status === "prior_stage"
  ).length;

  const activeNum = activeMoment?.moment_number ?? 1;
  const momentGradesByNumber: Record<number, StudentSubjectSummary[]> = {};
  for (const m of momentos) {
    momentGradesByNumber[m.moment_number] = enrolledSubjects.map((sub) => {
      const momMatch = sub.moments.find(
        (md) => md.momentNumber === m.moment_number
      );
      return {
        curriculumSubjectId: sub.curriculumSubjectId,
        subjectCode: sub.subjectCode,
        subjectName: sub.subjectName,
        gradingScale: sub.gradingScale,
        finalNumeric: momMatch?.finalGrade?.finalNumeric ?? null,
        finalLiteral: momMatch?.finalGrade?.finalLiteral ?? null,
      };
    });
  }

  const subjectsSummary = momentGradesByNumber[activeNum] ?? [];
  const activeNumerics = subjectsSummary
    .map((s) => s.finalNumeric)
    .filter((n): n is number => typeof n === "number");
  const averageGrade =
    activeNumerics.length > 0
      ? Number(
          (
            activeNumerics.reduce((sum, val) => sum + val, 0) /
            activeNumerics.length
          ).toFixed(1)
        )
      : null;

  const gradedActiveCount = subjectsSummary.filter(
    (s) => s.finalNumeric !== null || s.finalLiteral !== null
  ).length;
  const completionPercent =
    subjectsSummary.length > 0
      ? Math.round((gradedActiveCount / subjectsSummary.length) * 100)
      : 0;

  let totalAttSessions = 0;
  let totalAttPresent = 0;
  for (const t of details?.telemetryRows ?? []) {
    totalAttSessions += t.total_sessions;
    totalAttPresent += t.present_count + t.late_count + t.justified_count;
  }

  const bentoSnapshot: StudentDashboardData = {
    hasEnrollment: Boolean(currentEnrollment),
    schoolYearName: currentEnrollment
      ? unwrapSingle(currentEnrollment.school_years)?.name ?? null
      : null,
    mencionName: activeMencionMeta?.name ?? null,
    gradeYear: currentEnrollment?.grade_year ?? null,
    sectionLetter: currentEnrollment
      ? unwrapSingle(currentEnrollment.sections)?.section_letter ?? null
      : null,
    activeMomentName: activeMoment?.name ?? null,
    activeMomentNumber: activeMoment?.moment_number ?? null,
    averageGrade,
    attendancePercent:
      totalAttSessions > 0
        ? Math.round((totalAttPresent / totalAttSessions) * 100)
        : null,
    attendanceSessionsCount: totalAttSessions,
    enrolledSubjectsCount: enrolledSubjects.length,
    activeLoansAndRequestsCount: 0,
    completionPercent,
    subjectsSummary,
    momentos: momentos.map((m) => ({
      id: m.id,
      momentNumber: m.moment_number,
      name: m.name,
      status: m.status,
    })),
    momentGradesByNumber,
    upcomingEvaluations: [],
    calendarEvents: [],
    scheduleBlocks: [],
    teacherAbsenceAlerts: [],
    simulatorSubjects: [],
    pendingSubjects: [],
    medals: [],
  };

  const momentoNumberById = new Map<string, number>(
    (details?.allMomentos ?? []).map((m) => [m.id, m.moment_number])
  );

  const academicHistory = buildStudentAcademicHistory({
    enrollments: enrollments.map((e) => {
      const sy = unwrapSingle(e.school_years);
      const menc = unwrapSingle(e.menciones);
      const sec = unwrapSingle(e.sections);
      return {
        enrollmentId: e.id,
        schoolYearId: e.school_year_id,
        schoolYearCode: sy?.code ?? sy?.name ?? "PERIODO",
        schoolYearName: sy?.name ?? "Período escolar",
        startDate: sy?.start_date ?? null,
        isCurrent: Boolean(sy?.is_current),
        gradeYear: Number(e.grade_year),
        sectionLetter: sec?.section_letter ?? null,
        mencionId: e.mencion_id,
        mencionCode: menc?.code ?? null,
        mencionName: menc?.name ?? null,
        mencionSpecialty: menc?.specialty ?? null,
        enrollmentStatus: e.enrollment_status,
      };
    }),
    curriculumSubjects: curriculumRows
      .map((row) => {
        const sub = unwrapSingle(row.subjects);
        if (!sub) return null;
        return {
          curriculumSubjectId: row.id,
          mencionId: row.mencion_id,
          gradeYear: Number(row.grade_year),
          subjectCode: sub.code,
          subjectName: sub.name,
          weeklyHours: Number(row.weekly_hours),
          annualHours:
            row.annual_hours !== null && row.annual_hours !== undefined
              ? Number(row.annual_hours)
              : null,
          displayOrder: Number(row.display_order ?? 10),
          gradingScale: sub.grading_scale,
          passingThreshold: Number(sub.passing_threshold || 10),
          isTechnicalCore: Boolean(sub.is_technical_core),
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null),
    momentGrades: (details?.finalGrades ?? [])
      .map((fg) => {
        const momentNumber = momentoNumberById.get(fg.momento_id);
        if (momentNumber === undefined) return null;
        return {
          enrollmentId: fg.enrollment_id,
          curriculumSubjectId: fg.curriculum_subject_id,
          momentNumber,
          finalNumeric: fg.final_numeric,
          finalLiteral: fg.final_literal,
          isLocked: Boolean(fg.is_locked),
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null),
    pendingAttempts: pendingAttempts.map((att) => {
      const cs = unwrapSingle(att.curriculum_subjects);
      const sub = unwrapSingle(cs?.subjects);
      return {
        id: att.id,
        curriculumSubjectId: att.curriculum_subject_id,
        subjectCode: sub?.code ?? "PEND",
        subjectName: sub?.name ?? "Asignatura pendiente",
        attemptNumber: Number(att.attempt_number),
        examDate: att.exam_date,
        finalNumeric: Number(att.final_numeric),
        passed: Boolean(att.passed),
      };
    }),
  });

  return {
    hasEnrollment: Boolean(currentEnrollment),
    accessTier: profile.accessTier,
    schoolYearName: bentoSnapshot.schoolYearName,
    mencionId: currentEnrollment?.mencion_id ?? null,
    mencionCode: activeMencionMeta?.code ?? null,
    mencionName: bentoSnapshot.mencionName,
    gradeYear: bentoSnapshot.gradeYear,
    sectionLetter: bentoSnapshot.sectionLetter,
    activeMomentNumber: bentoSnapshot.activeMomentNumber,
    activeMomentName: bentoSnapshot.activeMomentName,
    studentFullName: fullName,
    cedulaDisplay,
    enrolledSubjects,
    menciones: mencionesCatalog,
    summaryMetrics: {
      totalCurriculumSubjects: allNodesInActiveMencion.length,
      completedOrPassedCount: completedOrPriorCount,
      enrolledCount: enrolledSubjects.length,
      weeklyHoursCurrentYear: enrolledSubjects.reduce(
        (sum, s) => sum + s.weeklyHours,
        0
      ),
      overallProgressPercent:
        allNodesInActiveMencion.length > 0
          ? Math.round(
              (completedOrPriorCount / allNodesInActiveMencion.length) * 100
            )
          : 0,
    },
    academicHistory,
    bentoSnapshot,
  };
}

/**
 * Carga el expediente independiente de una asignatura (`/estudiante/asignaturas/[codigo]`)
 * reutilizando exactamente el mismo motor de evaluación y telemetría.
 */
export async function getStudentSubjectDetailData(
  profile: DashboardUserProfile,
  rawSubjectCode: string
): Promise<StudentSubjectDetailData | null> {
  const normalizedCode = decodeURIComponent(rawSubjectCode).trim().toUpperCase();
  if (!normalizedCode) return null;

  const foundation = await fetchAcademicFoundation(profile.internalUserId);
  if (!foundation) return null;

  const {
    dbClient,
    curriculumRows,
    enrollments,
    currentEnrollment,
    pendingAttempts,
  } = foundation;

  const matchingRows = curriculumRows.filter(
    (r) => unwrapSingle(r.subjects)?.code.toUpperCase() === normalizedCode
  );
  if (matchingRows.length === 0) {
    return null;
  }

  const enrolledCurriculumRow = currentEnrollment
    ? matchingRows.find(
        (r) =>
          r.mencion_id === currentEnrollment.mencion_id &&
          r.grade_year === currentEnrollment.grade_year
      ) ?? null
    : null;

  const targetMencionId =
    currentEnrollment?.mencion_id ?? matchingRows[0]!.mencion_id;
  const rowsInTargetMencion = matchingRows.filter(
    (r) => r.mencion_id === targetMencionId
  );
  const chosenRow =
    enrolledCurriculumRow ?? rowsInTargetMencion[0] ?? matchingRows[0]!;
  const subj = unwrapSingle(chosenRow.subjects);
  if (!subj) return null;

  const allSchoolYearIds = Array.from(
    new Set(enrollments.map((e) => e.school_year_id))
  );

  const details = currentEnrollment
    ? await fetchActiveEnrollmentDetails(
        dbClient,
        currentEnrollment,
        enrollments.map((e) => e.id),
        allSchoolYearIds,
        profile.accessTier
      )
    : null;

  const indexed = indexEnrollmentDetails(
    details,
    curriculumRows,
    currentEnrollment?.id ?? null
  );

  const momentos = details?.momentos ?? [];
  const activeMoment =
    momentos.find((m) => m.status === "open") ??
    [...momentos].reverse().find((m) => m.status !== "scheduled") ??
    momentos[0] ??
    null;

  const enrolledMencionMeta = currentEnrollment
    ? unwrapSingle(currentEnrollment.menciones)
    : null;

  const catalogByCode = buildCatalogLookup(curriculumRows, targetMencionId);
  const gradeYearsInMencion = [
    ...(catalogByCode.get(subj.code)?.gradeYears ?? [chosenRow.grade_year]),
  ].sort((a, b) => a - b);

  const enrolledPeers = currentEnrollment
    ? curriculumRows
        .filter(
          (r) =>
            r.mencion_id === currentEnrollment.mencion_id &&
            r.grade_year === currentEnrollment.grade_year
        )
        .map((r) => {
          const s = unwrapSingle(r.subjects);
          return s
            ? {
                subjectCode: s.code,
                subjectName: s.name,
                isTechnicalCore: Boolean(s.is_technical_core),
              }
            : null;
        })
        .filter(
          (
            item
          ): item is {
            subjectCode: string;
            subjectName: string;
            isTechnicalCore: boolean;
          } => item !== null
        )
        .sort((a, b) => a.subjectName.localeCompare(b.subjectName, "es"))
    : [];

  const todayIso = getTodayCaracasIso();
  const assignmentId = enrolledCurriculumRow
    ? indexed.assignmentBySubjectId.get(enrolledCurriculumRow.id)
    : undefined;

  const momentsDetail =
    enrolledCurriculumRow && currentEnrollment
      ? buildMomentsDetailForSubject({
          curriculumSubjectId: enrolledCurriculumRow.id,
          subjectCode: subj.code,
          subjectName: subj.name,
          gradingScale: subj.grading_scale,
          passingThreshold: Number(subj.passing_threshold || 10),
          enrollmentId: currentEnrollment.id,
          assignmentId,
          momentos,
          plansByAssignmentMoment: indexed.plansByAssignmentMoment,
          itemsByPlanId: indexed.itemsByPlanId,
          scoreByItemId: indexed.scoreByItemId,
          finalGradesMap: indexed.finalGradesMap,
          todayIso,
        })
      : [];

  const upperCode = subj.code.toUpperCase();
  const telemetry = enrolledCurriculumRow
    ? indexed.telemetryBySubjectId.get(enrolledCurriculumRow.id)
    : undefined;

  const subjectPendingAttempts = mapPendingAttemptsForSubject(
    pendingAttempts,
    subj.code
  );
  const isPendingRecovery =
    subjectPendingAttempts.length > 0 &&
    !subjectPendingAttempts.some((a) => a.passed);

  const activeMomentDetail = activeMoment
    ? momentsDetail.find((m) => m.momentNumber === activeMoment.moment_number)
    : undefined;

  const curriculumStatus = resolveCurriculumNodeStatus({
    gradeYear: enrolledCurriculumRow?.grade_year ?? chosenRow.grade_year,
    enrolledGradeYear: currentEnrollment?.grade_year ?? null,
    isSameMencion: Boolean(
      currentEnrollment && chosenRow.mencion_id === currentEnrollment.mencion_id
    ),
    isPendingRecovery,
    historicalPassed: indexed.historicalPassedSubjectCodes.has(subj.code),
    currentFinalNumeric: activeMomentDetail?.finalGrade?.finalNumeric ?? null,
    currentFinalLiteral: activeMomentDetail?.finalGrade?.finalLiteral ?? null,
    passingThreshold: Number(subj.passing_threshold || 10),
  });

  return {
    accessTier: profile.accessTier,
    hasEnrollment: Boolean(currentEnrollment),
    isCurrentlyEnrolledSubject: Boolean(enrolledCurriculumRow),
    schoolYearName: currentEnrollment
      ? unwrapSingle(currentEnrollment.school_years)?.name ?? null
      : null,
    enrolledGradeYear: currentEnrollment?.grade_year ?? null,
    enrolledMencionCode: enrolledMencionMeta?.code ?? null,
    enrolledMencionName: enrolledMencionMeta?.name ?? null,
    sectionLetter: currentEnrollment
      ? unwrapSingle(currentEnrollment.sections)?.section_letter ?? null
      : null,
    activeMomentNumber: activeMoment?.moment_number ?? null,
    subject: {
      curriculumSubjectId: enrolledCurriculumRow?.id ?? chosenRow.id,
      subjectCode: subj.code,
      subjectName: subj.name,
      gradeYearsInMencion,
      weeklyHours: Number(chosenRow.weekly_hours),
      annualHours:
        chosenRow.annual_hours !== null && chosenRow.annual_hours !== undefined
          ? Number(chosenRow.annual_hours)
          : null,
      gradingScale: subj.grading_scale,
      passingThreshold: Number(subj.passing_threshold || 10),
      isTechnicalCore: Boolean(subj.is_technical_core),
      axis: classifyCurriculumAxis(
        subj.code,
        Boolean(subj.is_technical_core),
        chosenRow.curriculum_component
      ),
      curriculumStatus,
    },
    teacherName:
      telemetry?.teacher_name ??
      indexed.teacherFromScheduleByCode.get(upperCode) ??
      null,
    scheduleBlocks: indexed.scheduleSlotsByCode.get(upperCode) ?? [],
    attendance: buildAttendanceSummary(telemetry),
    moments: momentsDetail,
    pendingAttempts: subjectPendingAttempts,
    enrolledPeers,
    progression: getSubjectProgressionContext(
      enrolledMencionMeta?.code ?? null,
      subj.code,
      catalogByCode
    ),
  };
}

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { SubjectSimulatorInput } from "./grade-simulator";
import { computeStudentMedals, type StudentMedal } from "./medals";

export interface StudentSubjectSummary {
  curriculumSubjectId: string;
  subjectCode: string;
  subjectName: string;
  gradingScale: "NUMERIC_1_20" | "LITERAL_A_E";
  finalNumeric: number | null;
  finalLiteral: string | null;
}

export interface UpcomingEvaluationItem {
  id: string;
  title: string;
  evaluationType: string;
  weightPercent: number;
  scheduledDate: string;
  subjectName: string;
}

export interface StudentMomentSummary {
  id: string;
  momentNumber: number;
  name: string;
  status: string;
}

export interface StudentScheduleBlock {
  id: string;
  dayOfWeek: number;
  blockLabel: string;
  startTime: string;
  endTime: string;
  roomLabel: string;
  subjectCode: string;
  subjectName: string;
  teacherName: string;
}

export interface PendingSubjectAttemptSummary {
  id: string;
  subjectCode: string;
  subjectName: string;
  attemptNumber: number;
  examDate: string;
  finalNumeric: number;
  passed: boolean;
}

export interface StudentDashboardData {
  hasEnrollment: boolean;
  schoolYearName: string | null;
  mencionName: string | null;
  gradeYear: number | null;
  sectionLetter: string | null;
  activeMomentName: string | null;
  activeMomentNumber: number | null;
  averageGrade: number | null;
  attendancePercent: number | null;
  attendanceSessionsCount: number;
  enrolledSubjectsCount: number;
  activeLoansAndRequestsCount: number;
  completionPercent: number;
  subjectsSummary: StudentSubjectSummary[];
  momentos: StudentMomentSummary[];
  momentGradesByNumber: Record<number, StudentSubjectSummary[]>;
  upcomingEvaluations: UpcomingEvaluationItem[];
  scheduleBlocks: StudentScheduleBlock[];
  simulatorSubjects: SubjectSimulatorInput[];
  pendingSubjects: PendingSubjectAttemptSummary[];
  medals: StudentMedal[];
}

interface EnrollmentRow {
  id: string;
  section_id: string;
  grade_year: number;
  mencion_id: string;
  school_year_id: string;
  sections: { section_letter: string } | Array<{ section_letter: string }> | null;
  menciones: { name: string } | Array<{ name: string }> | null;
  school_years: { name: string } | Array<{ name: string }> | null;
}

interface MomentRow {
  id: string;
  moment_number: number;
  name: string;
  status: string;
}

interface CurriculumRow {
  id: string;
  subjects:
    | {
        code: string;
        name: string;
        grading_scale: "NUMERIC_1_20" | "LITERAL_A_E";
        passing_threshold: number;
      }
    | Array<{
        code: string;
        name: string;
        grading_scale: "NUMERIC_1_20" | "LITERAL_A_E";
        passing_threshold: number;
      }>
    | null;
}

interface MomentFinalGradeRow {
  momento_id: string;
  curriculum_subject_id: string;
  final_numeric: number | null;
  final_literal: string | null;
}

interface AttendanceRow {
  status: "present" | "absent" | "late" | "justified";
}

interface EvalItemJoinRow {
  id: string;
  evaluation_plan_id: string;
  title: string;
  evaluation_type: string;
  weight_percent: number;
  max_points: number;
  scheduled_date: string | null;
  evaluation_plans:
    | {
        status: string;
        momento_id: string;
        teacher_assignments:
          | {
              curriculum_subjects:
                | { subjects: { name: string } | Array<{ name: string }> | null }
                | Array<{ subjects: { name: string } | Array<{ name: string }> | null }>
                | null;
            }
          | Array<{
              curriculum_subjects:
                | { subjects: { name: string } | Array<{ name: string }> | null }
                | Array<{ subjects: { name: string } | Array<{ name: string }> | null }>
                | null;
            }>
          | null;
      }
    | Array<{
        status: string;
        momento_id: string;
        teacher_assignments: unknown;
      }>
    | null;
}

interface TeacherAssignmentRow {
  id: string;
  curriculum_subject_id: string;
}

interface EvalPlanRow {
  id: string;
  teacher_assignment_id: string;
  title: string;
  status: "draft" | "published" | "locked";
}

interface StudentScoreRow {
  evaluation_item_id: string;
  numeric_score: number | null;
}

interface PendingAttemptJoinRow {
  id: string;
  attempt_number: number;
  exam_date: string;
  final_numeric: number;
  passed: boolean;
  curriculum_subjects:
    | {
        subjects:
          | { code: string; name: string }
          | Array<{ code: string; name: string }>
          | null;
      }
    | Array<{
        subjects:
          | { code: string; name: string }
          | Array<{ code: string; name: string }>
          | null;
      }>
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
  subject_name: string;
  teacher_name: string;
}

function unwrapSingle<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

const EMPTY_STUDENT_DASHBOARD: StudentDashboardData = {
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
  scheduleBlocks: [],
  simulatorSubjects: [],
  pendingSubjects: [],
  medals: computeStudentMedals({
    accessTier: "verified_workspace",
    averageGrade: null,
    attendancePercent: null,
    attendanceSessionsCount: 0,
    enrolledSubjectsCount: 0,
    completionPercent: 0,
    subjects: [],
  }),
};

/**
 * Carga exclusivamente datos reales de matrícula, rendimiento, horario fijo,
 * simulador y medallas para el estudiante verificado bajo RLS.
 * Si no existen registros aún en Supabase, retorna estados vacíos sin simular datos.
 */
export async function getStudentDashboardData(
  internalUserId: string,
  accessTier: "provisional_cedula" | "verified_workspace" | "suspended" = "verified_workspace"
): Promise<StudentDashboardData> {
  const dbClient = await createServerSupabaseClient();
  if (!dbClient) {
    return EMPTY_STUDENT_DASHBOARD;
  }

  const { data: enrollment } = await dbClient
    .from("enrollments")
    .select(
      "id, section_id, grade_year, mencion_id, school_year_id, sections(section_letter), menciones(name), school_years!inner(name, is_current)"
    )
    .eq("student_user_id", internalUserId)
    .eq("school_years.is_current", true)
    .is("deleted_at", null)
    .maybeSingle<EnrollmentRow>();

  if (!enrollment) {
    const [loansCount, requestsCount, pendingAttemptsResult] = await Promise.all([
      dbClient
        .from("library_loans")
        .select("id", { count: "exact", head: true })
        .eq("borrower_user_id", internalUserId)
        .in("status", ["active", "overdue"])
        .is("deleted_at", null),
      dbClient
        .from("student_requests")
        .select("id", { count: "exact", head: true })
        .eq("student_user_id", internalUserId)
        .in("status", ["pending", "in_review"]),
      dbClient
        .from("pending_subject_attempts")
        .select(
          "id, attempt_number, exam_date, final_numeric, passed, curriculum_subjects(subjects(code, name))"
        )
        .eq("student_user_id", internalUserId)
        .order("exam_date", { ascending: false })
        .returns<PendingAttemptJoinRow[]>(),
    ]);

    const pendingSubjects = mapPendingAttempts(pendingAttemptsResult.data ?? []);

    return {
      ...EMPTY_STUDENT_DASHBOARD,
      activeLoansAndRequestsCount:
        (loansCount.count ?? 0) + (requestsCount.count ?? 0),
      pendingSubjects,
      medals: computeStudentMedals({
        accessTier,
        averageGrade: null,
        attendancePercent: null,
        attendanceSessionsCount: 0,
        enrolledSubjectsCount: 0,
        completionPercent: 0,
        subjects: [],
      }),
    };
  }

  const [
    momentosResult,
    curriculumResult,
    attendanceResult,
    loansResult,
    requestsResult,
    teacherAssignmentsResult,
    scheduleRpcResult,
    pendingAttemptsResult,
    allMomentGradesResult,
  ] = await Promise.all([
    dbClient
      .from("momentos")
      .select("id, moment_number, name, status")
      .eq("school_year_id", enrollment.school_year_id)
      .order("moment_number", { ascending: true })
      .returns<MomentRow[]>(),
    dbClient
      .from("curriculum_subjects")
      .select("id, subjects!inner(code, name, grading_scale, passing_threshold)")
      .eq("mencion_id", enrollment.mencion_id)
      .eq("grade_year", enrollment.grade_year)
      .eq("is_active", true)
      .returns<CurriculumRow[]>(),
    dbClient
      .from("attendance_records")
      .select("status")
      .eq("enrollment_id", enrollment.id)
      .returns<AttendanceRow[]>(),
    dbClient
      .from("library_loans")
      .select("id", { count: "exact", head: true })
      .eq("borrower_user_id", internalUserId)
      .in("status", ["active", "overdue"])
      .is("deleted_at", null),
    dbClient
      .from("student_requests")
      .select("id", { count: "exact", head: true })
      .eq("student_user_id", internalUserId)
      .in("status", ["pending", "in_review"]),
    dbClient
      .from("teacher_assignments")
      .select("id, curriculum_subject_id")
      .eq("school_year_id", enrollment.school_year_id)
      .eq("section_id", enrollment.section_id)
      .eq("is_active", true)
      .returns<TeacherAssignmentRow[]>(),
    dbClient.rpc("siga_get_student_section_schedule"),
    dbClient
      .from("pending_subject_attempts")
      .select(
        "id, attempt_number, exam_date, final_numeric, passed, curriculum_subjects(subjects(code, name))"
      )
      .eq("student_user_id", internalUserId)
      .eq("school_year_id", enrollment.school_year_id)
      .order("exam_date", { ascending: false })
      .returns<PendingAttemptJoinRow[]>(),
    dbClient
      .from("moment_final_grades")
      .select("momento_id, curriculum_subject_id, final_numeric, final_literal")
      .eq("enrollment_id", enrollment.id)
      .returns<MomentFinalGradeRow[]>(),
  ]);

  const momentos = momentosResult.data ?? [];
  const activeMoment =
    momentos.find((m) => m.status === "open") ??
    [...momentos].reverse().find((m) => m.status !== "scheduled") ??
    momentos[0] ??
    null;

  const curriculumList = curriculumResult.data ?? [];
  const teacherAssignments = teacherAssignmentsResult.data ?? [];
  const assignmentBySubjectId = new Map(
    teacherAssignments.map((ta) => [ta.curriculum_subject_id, ta.id])
  );

  let upcomingEvaluations: UpcomingEvaluationItem[] = [];
  let publishedPlans: EvalPlanRow[] = [];
  let evalItemsForMoment: EvalItemJoinRow[] = [];
  let scoresForEnrollment: StudentScoreRow[] = [];

  if (activeMoment) {
    const todayIso = new Date().toISOString().slice(0, 10);
    const assignmentIds = teacherAssignments.map((ta) => ta.id);

    const [upcomingResult, plansResult, planItemsResult, scoresResult] =
      await Promise.all([
        dbClient
          .from("evaluation_items")
          .select(
            "id, evaluation_plan_id, title, evaluation_type, weight_percent, max_points, scheduled_date, evaluation_plans!inner(status, momento_id, teacher_assignments!inner(section_id, curriculum_subjects!inner(subjects!inner(name))))"
          )
          .eq("evaluation_plans.momento_id", activeMoment.id)
          .eq(
            "evaluation_plans.teacher_assignments.section_id",
            enrollment.section_id
          )
          .in("evaluation_plans.status", ["published", "locked"])
          .gte("scheduled_date", todayIso)
          .order("scheduled_date", { ascending: true })
          .limit(5)
          .returns<EvalItemJoinRow[]>(),
        assignmentIds.length > 0
          ? dbClient
              .from("evaluation_plans")
              .select("id, teacher_assignment_id, title, status")
              .eq("momento_id", activeMoment.id)
              .in("teacher_assignment_id", assignmentIds)
              .in("status", ["published", "locked"])
              .returns<EvalPlanRow[]>()
          : Promise.resolve({ data: [] as EvalPlanRow[] }),
        assignmentIds.length > 0
          ? dbClient
              .from("evaluation_items")
              .select(
                "id, evaluation_plan_id, title, evaluation_type, weight_percent, max_points, scheduled_date, evaluation_plans!inner(status, momento_id, teacher_assignments!inner(section_id))"
              )
              .eq("evaluation_plans.momento_id", activeMoment.id)
              .eq(
                "evaluation_plans.teacher_assignments.section_id",
                enrollment.section_id
              )
              .in("evaluation_plans.status", ["published", "locked"])
              .order("scheduled_date", { ascending: true, nullsFirst: false })
              .returns<EvalItemJoinRow[]>()
          : Promise.resolve({ data: [] as EvalItemJoinRow[] }),
        dbClient
          .from("student_scores")
          .select("evaluation_item_id, numeric_score")
          .eq("enrollment_id", enrollment.id)
          .is("deleted_at", null)
          .returns<StudentScoreRow[]>(),
      ]);

    publishedPlans = plansResult.data ?? [];
    evalItemsForMoment = planItemsResult.data ?? [];
    scoresForEnrollment = scoresResult.data ?? [];

    upcomingEvaluations = (upcomingResult.data ?? [])
      .filter((row): row is EvalItemJoinRow & { scheduled_date: string } =>
        Boolean(row.scheduled_date)
      )
      .map((row) => {
        const plan = unwrapSingle(row.evaluation_plans) as {
          teacher_assignments?: {
            curriculum_subjects?: {
              subjects?: { name: string } | Array<{ name: string }> | null;
            } | null;
          } | null;
        } | null;
        const ta = unwrapSingle(plan?.teacher_assignments);
        const cs = unwrapSingle(ta?.curriculum_subjects);
        const subj = unwrapSingle(cs?.subjects);

        return {
          id: row.id,
          title: row.title,
          evaluationType: row.evaluation_type,
          weightPercent: Number(row.weight_percent),
          scheduledDate: row.scheduled_date,
          subjectName: subj?.name ?? "Asignatura",
        };
      });
  }

  const allMomentGrades = allMomentGradesResult.data ?? [];
  const momentIdToNumber = new Map(
    momentos.map((m) => [m.id, m.moment_number])
  );

  const buildSubjectsSummaryForMoment = (
    momentId: string | null
  ): StudentSubjectSummary[] => {
    const gradeMap = new Map(
      allMomentGrades
        .filter((g) => momentId !== null && g.momento_id === momentId)
        .map((g) => [g.curriculum_subject_id, g])
    );

    return curriculumList
      .map((item) => {
        const subj = unwrapSingle(item.subjects);
        if (!subj) return null;
        const recorded = gradeMap.get(item.id);
        return {
          curriculumSubjectId: item.id,
          subjectCode: subj.code,
          subjectName: subj.name,
          gradingScale: subj.grading_scale,
          finalNumeric: recorded?.final_numeric ?? null,
          finalLiteral: recorded?.final_literal ?? null,
        };
      })
      .filter((item): item is StudentSubjectSummary => item !== null)
      .sort((a, b) => a.subjectName.localeCompare(b.subjectName, "es"));
  };

  const momentGradesByNumber: Record<number, StudentSubjectSummary[]> = {};
  for (const m of momentos) {
    momentGradesByNumber[m.moment_number] = buildSubjectsSummaryForMoment(m.id);
  }

  const subjectsSummary = buildSubjectsSummaryForMoment(
    activeMoment?.id ?? null
  );

  const activeGrades = allMomentGrades.filter(
    (g) => activeMoment !== null && g.momento_id === activeMoment.id
  );
  const numericGrades = activeGrades
    .map((g) => g.final_numeric)
    .filter((n): n is number => typeof n === "number");

  const averageGrade =
    numericGrades.length > 0
      ? Number(
          (
            numericGrades.reduce((sum, val) => sum + val, 0) /
            numericGrades.length
          ).toFixed(1)
        )
      : null;

  const attendanceRows = attendanceResult.data ?? [];
  const attendanceSessionsCount = attendanceRows.length;
  const attendedCount = attendanceRows.filter(
    (r) => r.status === "present" || r.status === "late" || r.status === "justified"
  ).length;
  const attendancePercent =
    attendanceSessionsCount > 0
      ? Math.round((attendedCount / attendanceSessionsCount) * 100)
      : null;

  const gradedSubjectsCount = subjectsSummary.filter(
    (s) => s.finalNumeric !== null || s.finalLiteral !== null
  ).length;
  const completionPercent =
    subjectsSummary.length > 0
      ? Math.round((gradedSubjectsCount / subjectsSummary.length) * 100)
      : 0;

  const planByAssignmentId = new Map(
    publishedPlans.map((p) => [p.teacher_assignment_id, p])
  );
  const scoreByItemId = new Map(
    scoresForEnrollment.map((s) => [
      s.evaluation_item_id,
      s.numeric_score !== null ? Number(s.numeric_score) : null,
    ])
  );
  const itemsByPlanId = new Map<string, EvalItemJoinRow[]>();
  for (const item of evalItemsForMoment) {
    const bucket = itemsByPlanId.get(item.evaluation_plan_id) ?? [];
    bucket.push(item);
    itemsByPlanId.set(item.evaluation_plan_id, bucket);
  }

  const simulatorSubjects: SubjectSimulatorInput[] = curriculumList
    .map((item) => {
      const subj = unwrapSingle(item.subjects);
      if (!subj) return null;
      const assignmentId = assignmentBySubjectId.get(item.id);
      const plan = assignmentId ? planByAssignmentId.get(assignmentId) : undefined;
      const items = plan ? itemsByPlanId.get(plan.id) ?? [] : [];

      return {
        curriculumSubjectId: item.id,
        subjectCode: subj.code,
        subjectName: subj.name,
        gradingScale: subj.grading_scale,
        passingThreshold: Number(subj.passing_threshold || 10),
        planTitle: plan?.title ?? null,
        planStatus: plan?.status ?? null,
        items: items.map((ei) => ({
          id: ei.id,
          title: ei.title,
          evaluationType: ei.evaluation_type,
          weightPercent: Number(ei.weight_percent),
          maxPoints: Number(ei.max_points ?? 20),
          scheduledDate: ei.scheduled_date,
          recordedScore: scoreByItemId.get(ei.id) ?? null,
        })),
      };
    })
    .filter((s): s is SubjectSimulatorInput => s !== null)
    .sort((a, b) => a.subjectName.localeCompare(b.subjectName, "es"));

  const scheduleRows = Array.isArray(scheduleRpcResult.data)
    ? (scheduleRpcResult.data as ScheduleRpcRow[])
    : [];

  const scheduleBlocks: StudentScheduleBlock[] = scheduleRows.map((row) => ({
    id: row.id,
    dayOfWeek: Number(row.day_of_week),
    blockLabel: row.block_label,
    startTime: String(row.start_time).slice(0, 5),
    endTime: String(row.end_time).slice(0, 5),
    roomLabel: row.room_label,
    subjectCode: row.subject_code,
    subjectName: row.subject_name,
    teacherName: row.teacher_name,
  }));

  const pendingSubjects = mapPendingAttempts(pendingAttemptsResult.data ?? []);

  const medals = computeStudentMedals({
    accessTier,
    averageGrade,
    attendancePercent,
    attendanceSessionsCount,
    enrolledSubjectsCount: subjectsSummary.length,
    completionPercent,
    subjects: subjectsSummary,
  });

  // Asegurar que unused map key lookup warnings no ocurran
  void momentIdToNumber;

  return {
    hasEnrollment: true,
    schoolYearName: unwrapSingle(enrollment.school_years)?.name ?? null,
    mencionName: unwrapSingle(enrollment.menciones)?.name ?? null,
    gradeYear: enrollment.grade_year,
    sectionLetter: unwrapSingle(enrollment.sections)?.section_letter ?? null,
    activeMomentName: activeMoment?.name ?? null,
    activeMomentNumber: activeMoment?.moment_number ?? null,
    averageGrade,
    attendancePercent,
    attendanceSessionsCount,
    enrolledSubjectsCount: subjectsSummary.length,
    activeLoansAndRequestsCount:
      (loansResult.count ?? 0) + (requestsResult.count ?? 0),
    completionPercent,
    subjectsSummary,
    momentos: momentos.map((m) => ({
      id: m.id,
      momentNumber: m.moment_number,
      name: m.name,
      status: m.status,
    })),
    momentGradesByNumber,
    upcomingEvaluations,
    scheduleBlocks,
    simulatorSubjects,
    pendingSubjects,
    medals,
  };
}

function mapPendingAttempts(
  rows: PendingAttemptJoinRow[]
): PendingSubjectAttemptSummary[] {
  return rows.map((row) => {
    const cs = unwrapSingle(row.curriculum_subjects);
    const subj = unwrapSingle(cs?.subjects);
    return {
      id: row.id,
      subjectCode: subj?.code ?? "MAT",
      subjectName: subj?.name ?? "Asignatura pendiente",
      attemptNumber: Number(row.attempt_number),
      examDate: row.exam_date,
      finalNumeric: Number(row.final_numeric),
      passed: Boolean(row.passed),
    };
  });
}

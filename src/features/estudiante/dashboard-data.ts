import { createServerSupabaseClient } from "@/lib/supabase/server";
import { EVALUATION_TYPE_LABELS } from "./curriculum-tracks";
import type { SubjectSimulatorInput } from "./grade-simulator";
import { computeStudentMedals, type StudentMedal } from "./medals";
import {
  normalizeAffectedBlocksJson,
  type StudentTeacherAbsenceAlert,
  type TeacherAbsenceStatus,
} from "./attendance-metrics";

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

export type StudentCalendarEventSource =
  | "evaluation"
  | "assignment"
  | "pending_exam";

export interface StudentCalendarEventItem {
  id: string;
  /** Fecha en zona America/Caracas (`YYYY-MM-DD`). */
  dateIso: string;
  /** Hora límite opcional (ej. `23:59`) para entregas del Aula Virtual. */
  timeLabel: string | null;
  title: string;
  subjectCode: string;
  subjectName: string;
  source: StudentCalendarEventSource;
  typeLabel: string;
  momentNumber: number | null;
  weightPercent: number | null;
  isCompleted: boolean;
  statusLabel: string;
  href: string;
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
  calendarEvents: StudentCalendarEventItem[];
  scheduleBlocks: StudentScheduleBlock[];
  teacherAbsenceAlerts: StudentTeacherAbsenceAlert[];
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

interface StudentScoreRow {
  evaluation_item_id: string;
  numeric_score: number | null;
  literal_grade: string | null;
}

interface LmsAssignmentJoinRow {
  id: string;
  title: string;
  due_at: string | null;
  course_modules:
    | {
        virtual_courses:
          | { teacher_assignment_id: string }
          | Array<{ teacher_assignment_id: string }>
          | null;
      }
    | Array<{
        virtual_courses:
          | { teacher_assignment_id: string }
          | Array<{ teacher_assignment_id: string }>
          | null;
      }>
    | null;
}

interface LmsSubmissionRow {
  assignment_id: string;
  is_late: boolean;
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
  calendarEvents: [],
  scheduleBlocks: [],
  teacherAbsenceAlerts: [],
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
      calendarEvents: buildPendingExamCalendarEvents(pendingSubjects),
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
    absenceAlertsRpcResult,
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
    dbClient.rpc("siga_get_student_section_absence_alerts"),
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
  const subjectByAssignmentId = new Map<
    string,
    { code: string; name: string }
  >();
  for (const cs of curriculumList) {
    const subj = unwrapSingle(cs.subjects);
    const taId = assignmentBySubjectId.get(cs.id);
    if (subj && taId) {
      subjectByAssignmentId.set(taId, { code: subj.code, name: subj.name });
    }
  }

  const assignmentIds = teacherAssignments.map((ta) => ta.id);
  const todayCaracasIso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Caracas",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const [
    allPlansResult,
    scoresResult,
    lmsAssignmentsResult,
    lmsSubmissionsResult,
  ] = await Promise.all([
    assignmentIds.length > 0
      ? dbClient
          .from("evaluation_plans")
          .select("id, teacher_assignment_id, momento_id, title, status")
          .in("teacher_assignment_id", assignmentIds)
          .in("status", ["published", "locked"])
          .returns<EvalPlanRow[]>()
      : Promise.resolve({ data: [] as EvalPlanRow[] }),
    dbClient
      .from("student_scores")
      .select("evaluation_item_id, numeric_score, literal_grade")
      .eq("enrollment_id", enrollment.id)
      .is("deleted_at", null)
      .returns<StudentScoreRow[]>(),
    assignmentIds.length > 0
      ? dbClient
          .from("assignments")
          .select(
            "id, title, due_at, course_modules!inner(virtual_courses!inner(teacher_assignment_id))"
          )
          .in(
            "course_modules.virtual_courses.teacher_assignment_id",
            assignmentIds
          )
          .not("due_at", "is", null)
          .order("due_at", { ascending: true })
          .returns<LmsAssignmentJoinRow[]>()
      : Promise.resolve({ data: [] as LmsAssignmentJoinRow[] }),
    dbClient
      .from("assignment_submissions")
      .select("assignment_id, is_late")
      .eq("enrollment_id", enrollment.id)
      .returns<LmsSubmissionRow[]>(),
  ]);

  const allPublishedPlans = allPlansResult.data ?? [];
  const allPlanIds = allPublishedPlans.map((p) => p.id);
  const scoresForEnrollment = scoresResult.data ?? [];
  const lmsAssignments = lmsAssignmentsResult.data ?? [];
  const lmsSubmissionsByAssignmentId = new Map(
    (lmsSubmissionsResult.data ?? []).map((sub) => [sub.assignment_id, sub])
  );

  const allEvalItemsResult =
    allPlanIds.length > 0
      ? await dbClient
          .from("evaluation_items")
          .select(
            "id, evaluation_plan_id, title, evaluation_type, weight_percent, max_points, scheduled_date"
          )
          .in("evaluation_plan_id", allPlanIds)
          .order("scheduled_date", { ascending: true, nullsFirst: false })
          .returns<
            Array<{
              id: string;
              evaluation_plan_id: string;
              title: string;
              evaluation_type: string;
              weight_percent: number;
              max_points: number;
              scheduled_date: string | null;
            }>
          >()
      : { data: [] };

  const allEvalItems = allEvalItemsResult.data ?? [];
  const planById = new Map(allPublishedPlans.map((p) => [p.id, p]));
  const publishedPlans = activeMoment
    ? allPublishedPlans.filter((p) => p.momento_id === activeMoment.id)
    : [];
  const activePlanIdSet = new Set(publishedPlans.map((p) => p.id));
  const evalItemsForMoment = allEvalItems.filter((item) =>
    activePlanIdSet.has(item.evaluation_plan_id)
  );

  const upcomingEvaluations: UpcomingEvaluationItem[] = evalItemsForMoment
    .filter(
      (item): item is typeof item & { scheduled_date: string } =>
        Boolean(item.scheduled_date) && item.scheduled_date! >= todayCaracasIso
    )
    .slice(0, 5)
    .map((item) => {
      const plan = planById.get(item.evaluation_plan_id);
      const subj = plan
        ? subjectByAssignmentId.get(plan.teacher_assignment_id)
        : undefined;
      return {
        id: item.id,
        title: item.title,
        evaluationType: item.evaluation_type,
        weightPercent: Number(item.weight_percent),
        scheduledDate: item.scheduled_date,
        subjectName: subj?.name ?? "Asignatura",
      };
    });

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
  const scoreRowByItemId = new Map(
    scoresForEnrollment.map((s) => [s.evaluation_item_id, s])
  );
  const itemsByPlanId = new Map<string, typeof evalItemsForMoment>();
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
        items: items.map((ei) => {
          const sc = scoreRowByItemId.get(ei.id);
          return {
            id: ei.id,
            title: ei.title,
            evaluationType: ei.evaluation_type,
            weightPercent: Number(ei.weight_percent),
            maxPoints: Number(ei.max_points ?? 20),
            scheduledDate: ei.scheduled_date,
            recordedScore:
              sc?.numeric_score !== null && sc?.numeric_score !== undefined
                ? Number(sc.numeric_score)
                : null,
          };
        }),
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

  const evaluationCalendarEvents: StudentCalendarEventItem[] = allEvalItems
    .filter((item): item is typeof item & { scheduled_date: string } =>
      Boolean(item.scheduled_date)
    )
    .map((item) => {
      const plan = planById.get(item.evaluation_plan_id);
      const subj = plan
        ? subjectByAssignmentId.get(plan.teacher_assignment_id)
        : undefined;
      const subjectCode = subj?.code ?? "MAT";
      const subjectName = subj?.name ?? "Asignatura";
      const sc = scoreRowByItemId.get(item.id);
      const hasNumeric =
        sc?.numeric_score !== null && sc?.numeric_score !== undefined;
      const hasLiteral = Boolean(sc?.literal_grade);
      const isCompleted = hasNumeric || hasLiteral;
      const statusLabel = hasNumeric
        ? `Evaluada · ${Number(sc!.numeric_score).toFixed(1)}/${item.max_points ?? 20}`
        : hasLiteral
          ? `Evaluada · Literal ${sc!.literal_grade}`
          : "Programada";

      return {
        id: `eval-${item.id}`,
        dateIso: item.scheduled_date,
        timeLabel: null,
        title: item.title,
        subjectCode,
        subjectName,
        source: "evaluation",
        typeLabel:
          EVALUATION_TYPE_LABELS[item.evaluation_type] ?? "Evaluación",
        momentNumber: plan ? (momentIdToNumber.get(plan.momento_id) ?? null) : null,
        weightPercent: Number(item.weight_percent),
        isCompleted,
        statusLabel,
        href: `/estudiante/asignaturas/${encodeURIComponent(subjectCode)}`,
      };
    });

  const lmsCalendarEvents: StudentCalendarEventItem[] = lmsAssignments
    .map((assignment): StudentCalendarEventItem | null => {
      if (!assignment.due_at) return null;
      const parsedDue = formatCaracasDateTimeParts(assignment.due_at);
      if (!parsedDue) return null;

      const mod = unwrapSingle(assignment.course_modules);
      const vc = unwrapSingle(mod?.virtual_courses);
      const subj = vc?.teacher_assignment_id
        ? subjectByAssignmentId.get(vc.teacher_assignment_id)
        : undefined;
      const subjectCode = subj?.code ?? "LMS";
      const subjectName = subj?.name ?? "Aula Virtual";
      const submission = lmsSubmissionsByAssignmentId.get(assignment.id);

      return {
        id: `lms-${assignment.id}`,
        dateIso: parsedDue.dateIso,
        timeLabel: parsedDue.timeLabel,
        title: assignment.title,
        subjectCode,
        subjectName,
        source: "assignment",
        typeLabel: "Entrega en Aula Virtual",
        momentNumber: null,
        weightPercent: null,
        isCompleted: Boolean(submission),
        statusLabel: submission
          ? submission.is_late
            ? "Entregada (tardía)"
            : "Entregada"
          : "Pendiente de entrega",
        href: `/aula-virtual/${encodeURIComponent(subjectCode)}`,
      };
    })
    .filter((ev): ev is StudentCalendarEventItem => ev !== null);

  const calendarEvents: StudentCalendarEventItem[] = [
    ...evaluationCalendarEvents,
    ...lmsCalendarEvents,
    ...buildPendingExamCalendarEvents(pendingSubjects),
  ].sort((a, b) => {
    const dateDiff = a.dateIso.localeCompare(b.dateIso);
    if (dateDiff !== 0) return dateDiff;
    return (a.timeLabel ?? "99:99").localeCompare(b.timeLabel ?? "99:99");
  });

  const medals = computeStudentMedals({
    accessTier,
    averageGrade,
    attendancePercent,
    attendanceSessionsCount,
    enrolledSubjectsCount: subjectsSummary.length,
    completionPercent,
    subjects: subjectsSummary,
  });

  const teacherAbsenceAlerts: StudentTeacherAbsenceAlert[] = Array.isArray(
    absenceAlertsRpcResult.data
  )
    ? absenceAlertsRpcResult.data.map((row) => {
        const status: TeacherAbsenceStatus =
          row.status === "reorganized" ||
          row.status === "acknowledged" ||
          row.status === "reported"
            ? row.status
            : "reported";
        return {
          id: row.absence_id,
          absenceDate: row.absence_date,
          teacherName: row.teacher_name?.trim() || "Docente de la sección",
          subjectCodes: Array.isArray(row.subject_codes)
            ? row.subject_codes
            : [],
          subjectNames: Array.isArray(row.subject_names)
            ? row.subject_names
            : [],
          affectedBlocks: normalizeAffectedBlocksJson(row.affected_blocks),
          status,
        };
      })
    : [];

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
    calendarEvents,
    scheduleBlocks,
    teacherAbsenceAlerts,
    simulatorSubjects,
    pendingSubjects,
    medals,
  };
}

function formatCaracasDateTimeParts(
  isoTimestamp: string
): { dateIso: string; timeLabel: string } | null {
  const dt = new Date(isoTimestamp);
  if (Number.isNaN(dt.getTime())) return null;
  const dateIso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Caracas",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(dt);
  const timeLabel = new Intl.DateTimeFormat("es-VE", {
    timeZone: "America/Caracas",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(dt);
  return { dateIso, timeLabel };
}

function buildPendingExamCalendarEvents(
  attempts: PendingSubjectAttemptSummary[]
): StudentCalendarEventItem[] {
  return attempts
    .filter((attempt) => Boolean(attempt.examDate))
    .map((attempt) => ({
      id: `pending-${attempt.id}`,
      dateIso: attempt.examDate,
      timeLabel: null,
      title: `Materia pendiente · Momento ${attempt.attemptNumber}/4`,
      subjectCode: attempt.subjectCode,
      subjectName: attempt.subjectName,
      source: "pending_exam",
      typeLabel: "Examen de Materia Pendiente",
      momentNumber: attempt.attemptNumber,
      weightPercent: null,
      isCompleted: true,
      statusLabel: `${attempt.finalNumeric}/20 · ${attempt.passed ? "Aprobada" : "Pendiente"}`,
      href: `/estudiante/asignaturas/${encodeURIComponent(attempt.subjectCode)}`,
    }));
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

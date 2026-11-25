import { getServerAuthSession } from "@/lib/auth/server";
import { getCachedAcademicCatalog } from "@/lib/db/catalog-cache";
import {
  isNeonDatabaseConfigured,
  querySingleRow,
  withUserDb,
  type NeonAuthSessionContext,
} from "@/lib/db/neon";
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
 * simulador y medallas para el estudiante verificado bajo RLS en Neon.
 */
export async function getStudentDashboardData(
  internalUserId: string,
  accessTier: "provisional_cedula" | "verified_workspace" | "suspended" = "verified_workspace",
  sessionOverride?: NeonAuthSessionContext
): Promise<StudentDashboardData> {
  if (!isNeonDatabaseConfigured()) {
    return EMPTY_STUDENT_DASHBOARD;
  }

  const session = sessionOverride ?? (await getServerAuthSession());
  if (!session) {
    return EMPTY_STUDENT_DASHBOARD;
  }

  type DashboardEvalItemRow = {
    id: string;
    evaluation_plan_id: string;
    title: string;
    evaluation_type: string;
    weight_percent: number;
    max_points: number;
    scheduled_date: string | null;
  };

  type AbsenceAlertRpcRow = {
    absence_id: string;
    absence_date: string;
    teacher_name: string | null;
    subject_codes: string[] | null;
    subject_names: string[] | null;
    affected_blocks: unknown;
    status: string;
  };

  const [catalog, dbBundle] = await Promise.all([
    getCachedAcademicCatalog(),
    withUserDb(
      { authUserId: session.authUserId, email: session.email },
      async (client) => {
        const snapshot = await querySingleRow<{
          enrollment_json: EnrollmentRow | null;
          loans_count: number;
          requests_count: number;
          pending_attempts_json: PendingAttemptJoinRow[] | null;
          momentos_json: MomentRow[] | null;
          attendance_total: number;
          attendance_attended: number;
          teacher_assignments_json: TeacherAssignmentRow[] | null;
          moment_grades_json: MomentFinalGradeRow[] | null;
          eval_plans_json: EvalPlanRow[] | null;
          eval_items_json: DashboardEvalItemRow[] | null;
          scores_json: StudentScoreRow[] | null;
          lms_assignments_json: LmsAssignmentJoinRow[] | null;
          lms_submissions_json: LmsSubmissionRow[] | null;
        }>(
          client,
          `WITH cur_enr AS (
             SELECT e.id,
                    e.section_id,
                    e.grade_year,
                    e.mencion_id,
                    e.school_year_id,
                    CASE WHEN s.id IS NOT NULL THEN json_build_object('section_letter', s.section_letter) ELSE NULL END AS sections,
                    CASE WHEN m.id IS NOT NULL THEN json_build_object('name', m.name) ELSE NULL END AS menciones,
                    json_build_object('name', sy.name, 'is_current', sy.is_current) AS school_years
               FROM public.enrollments e
               JOIN public.school_years sy ON sy.id = e.school_year_id AND sy.is_current = true
               LEFT JOIN public.sections s ON s.id = e.section_id
               LEFT JOIN public.menciones m ON m.id = e.mencion_id
              WHERE e.student_user_id = $1::uuid
                AND e.deleted_at IS NULL
              LIMIT 1
           ),
           ta_list AS (
             SELECT ta.id, ta.curriculum_subject_id
               FROM public.teacher_assignments ta
               JOIN cur_enr ce ON ce.school_year_id = ta.school_year_id AND ce.section_id = ta.section_id
              WHERE ta.is_active = true
           ),
           plan_list AS (
             SELECT ep.id, ep.teacher_assignment_id, ep.momento_id, ep.title, ep.status
               FROM public.evaluation_plans ep
               JOIN ta_list ta ON ta.id = ep.teacher_assignment_id
              WHERE ep.status = ANY(ARRAY['published', 'locked'])
           ),
           att_agg AS (
             SELECT count(*)::int AS total_cnt,
                    count(*) FILTER (WHERE ar.status IN ('present', 'late', 'justified'))::int AS attended_cnt
               FROM public.attendance_records ar
               JOIN cur_enr ce ON ce.id = ar.enrollment_id
           )
           SELECT
             (SELECT row_to_json(ce) FROM cur_enr ce) AS enrollment_json,
             (
               SELECT count(*)::int
                 FROM public.library_loans
                WHERE borrower_user_id = $1::uuid
                  AND status = ANY(ARRAY['active', 'overdue'])
                  AND deleted_at IS NULL
             ) AS loans_count,
             (
               SELECT count(*)::int
                 FROM public.student_requests
                WHERE student_user_id = $1::uuid
                  AND status = ANY(ARRAY['pending', 'in_review'])
             ) AS requests_count,
             COALESCE((
               SELECT json_agg(pa_row ORDER BY pa_row.exam_date DESC)
                 FROM (
                   SELECT psa.id,
                          psa.attempt_number,
                          psa.exam_date,
                          psa.final_numeric,
                          psa.passed,
                          CASE WHEN cs.id IS NOT NULL THEN json_build_object('subjects', json_build_object('code', subj.code, 'name', subj.name)) ELSE NULL END AS curriculum_subjects
                     FROM public.pending_subject_attempts psa
                     LEFT JOIN public.curriculum_subjects cs ON cs.id = psa.curriculum_subject_id
                     LEFT JOIN public.subjects subj ON subj.id = cs.subject_id
                     LEFT JOIN cur_enr ce ON true
                    WHERE psa.student_user_id = $1::uuid
                      AND (ce.school_year_id IS NULL OR psa.school_year_id = ce.school_year_id)
                 ) pa_row
             ), '[]'::json) AS pending_attempts_json,
             COALESCE((
               SELECT json_agg(m_row ORDER BY m_row.moment_number ASC)
                 FROM (
                   SELECT mo.id, mo.moment_number, mo.name, mo.status
                     FROM public.momentos mo
                     JOIN cur_enr ce ON ce.school_year_id = mo.school_year_id
                 ) m_row
             ), '[]'::json) AS momentos_json,
             COALESCE((SELECT total_cnt FROM att_agg), 0) AS attendance_total,
             COALESCE((SELECT attended_cnt FROM att_agg), 0) AS attendance_attended,
             COALESCE((SELECT json_agg(ta) FROM ta_list ta), '[]'::json) AS teacher_assignments_json,
             COALESCE((
               SELECT json_agg(fg_row)
                 FROM (
                   SELECT mfg.momento_id, mfg.curriculum_subject_id, mfg.final_numeric, mfg.final_literal
                     FROM public.moment_final_grades mfg
                     JOIN cur_enr ce ON ce.id = mfg.enrollment_id
                 ) fg_row
             ), '[]'::json) AS moment_grades_json,
             COALESCE((SELECT json_agg(pl) FROM plan_list pl), '[]'::json) AS eval_plans_json,
             COALESCE((
               SELECT json_agg(ei_row ORDER BY ei_row.scheduled_date ASC NULLS LAST)
                 FROM (
                   SELECT ei.id, ei.evaluation_plan_id, ei.title, ei.evaluation_type, ei.weight_percent, ei.max_points, ei.scheduled_date
                     FROM public.evaluation_items ei
                     JOIN plan_list pl ON pl.id = ei.evaluation_plan_id
                 ) ei_row
             ), '[]'::json) AS eval_items_json,
             COALESCE((
               SELECT json_agg(sc_row)
                 FROM (
                   SELECT ss.evaluation_item_id, ss.numeric_score, ss.literal_grade
                     FROM public.student_scores ss
                     JOIN cur_enr ce ON ce.id = ss.enrollment_id
                    WHERE ss.deleted_at IS NULL
                 ) sc_row
             ), '[]'::json) AS scores_json,
             COALESCE((
               SELECT json_agg(la_row ORDER BY la_row.due_at ASC)
                 FROM (
                   SELECT a.id,
                          a.title,
                          a.due_at,
                          json_build_object(
                            'virtual_courses',
                            json_build_object('teacher_assignment_id', vc.teacher_assignment_id)
                          ) AS course_modules
                     FROM public.assignments a
                     JOIN public.course_modules cm ON cm.id = a.course_module_id
                     JOIN public.virtual_courses vc ON vc.id = cm.virtual_course_id
                     JOIN ta_list ta ON ta.id = vc.teacher_assignment_id
                    WHERE a.due_at IS NOT NULL
                 ) la_row
             ), '[]'::json) AS lms_assignments_json,
             COALESCE((
               SELECT json_agg(sub_row)
                 FROM (
                   SELECT asub.assignment_id, asub.is_late
                     FROM public.assignment_submissions asub
                     JOIN cur_enr ce ON ce.id = asub.enrollment_id
                 ) sub_row
             ), '[]'::json) AS lms_submissions_json`,
          [internalUserId]
        );

        let scheduleRpcRows: ScheduleRpcRow[] = [];
        let absenceAlertRows: AbsenceAlertRpcRow[] = [];

        if (snapshot?.enrollment_json) {
          await client.query("SAVEPOINT siga_dash_rpcs");
          try {
            const rpcCombo = await querySingleRow<{
              schedule_json: ScheduleRpcRow[] | null;
              absences_json: AbsenceAlertRpcRow[] | null;
            }>(
              client,
              `SELECT
                 COALESCE((SELECT json_agg(s) FROM public.siga_get_student_section_schedule() s), '[]'::json) AS schedule_json,
                 COALESCE((SELECT json_agg(a) FROM public.siga_get_student_section_absence_alerts() a), '[]'::json) AS absences_json`
            );
            await client.query("RELEASE SAVEPOINT siga_dash_rpcs");
            scheduleRpcRows = rpcCombo?.schedule_json ?? [];
            absenceAlertRows = rpcCombo?.absences_json ?? [];
          } catch {
            await client.query("ROLLBACK TO SAVEPOINT siga_dash_rpcs");
            await client.query("RELEASE SAVEPOINT siga_dash_rpcs");
          }
        }

        return { snapshot, scheduleRpcRows, absenceAlertRows };
      }
    ),
  ]);

  const { snapshot, scheduleRpcRows, absenceAlertRows } = dbBundle;
  const enrollment = snapshot?.enrollment_json ?? null;
  const loansCount = Number(snapshot?.loans_count ?? 0);
  const requestsCount = Number(snapshot?.requests_count ?? 0);
  const pendingAttemptRows = snapshot?.pending_attempts_json ?? [];

  if (!enrollment) {
    const pendingSubjects = mapPendingAttempts(pendingAttemptRows);

    return {
      ...EMPTY_STUDENT_DASHBOARD,
      activeLoansAndRequestsCount: loansCount + requestsCount,
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

  const loansResult = { count: loansCount };
  const requestsResult = { count: requestsCount };
  const scheduleRpcResult = { data: scheduleRpcRows };
  const absenceAlertsRpcResult = { data: absenceAlertRows };
  const pendingAttemptsResult = { data: pendingAttemptRows };
  const allMomentGradesResult = { data: snapshot?.moment_grades_json ?? [] };
  const attendanceSessionsCount = Number(snapshot?.attendance_total ?? 0);
  const attendedCount = Number(snapshot?.attendance_attended ?? 0);

  const momentos = snapshot?.momentos_json ?? [];
  const activeMoment =
    momentos.find((m) => m.status === "open") ??
    [...momentos].reverse().find((m) => m.status !== "scheduled") ??
    momentos[0] ??
    null;

  const curriculumList: CurriculumRow[] = catalog.curriculumRows
    .filter(
      (cs) =>
        cs.mencion_id === enrollment.mencion_id &&
        cs.grade_year === enrollment.grade_year
    )
    .map((cs) => ({
      id: cs.id,
      subjects: {
        code: cs.subjects.code,
        name: cs.subjects.name,
        grading_scale: cs.subjects.grading_scale,
        passing_threshold: cs.subjects.passing_threshold,
      },
    }));

  const teacherAssignments = snapshot?.teacher_assignments_json ?? [];
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

  const todayCaracasIso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Caracas",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const allPublishedPlans = snapshot?.eval_plans_json ?? [];
  const scoresForEnrollment = snapshot?.scores_json ?? [];
  const lmsAssignments = snapshot?.lms_assignments_json ?? [];
  const lmsSubmissionsByAssignmentId = new Map(
    (snapshot?.lms_submissions_json ?? []).map((sub) => [
      sub.assignment_id,
      sub,
    ])
  );

  const allEvalItems = snapshot?.eval_items_json ?? [];
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

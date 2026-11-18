import {
  createAdminSupabaseClient,
  createServerSupabaseClient,
} from "@/lib/supabase/server";

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
  upcomingEvaluations: UpcomingEvaluationItem[];
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
    | { code: string; name: string; grading_scale: "NUMERIC_1_20" | "LITERAL_A_E" }
    | Array<{ code: string; name: string; grading_scale: "NUMERIC_1_20" | "LITERAL_A_E" }>
    | null;
}

interface MomentFinalGradeRow {
  curriculum_subject_id: string;
  final_numeric: number | null;
  final_literal: string | null;
}

interface AttendanceRow {
  status: "present" | "absent" | "late" | "justified";
}

interface EvalItemJoinRow {
  id: string;
  title: string;
  evaluation_type: string;
  weight_percent: number;
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
  upcomingEvaluations: [],
};

/**
 * Carga exclusivamente datos reales de matrícula, rendimiento y agenda para el estudiante.
 * Si no existen registros aún en Supabase, retorna estados vacíos sin simular datos.
 */
export async function getStudentDashboardData(
  internalUserId: string
): Promise<StudentDashboardData> {
  const dbClient =
    (await createServerSupabaseClient()) ?? createAdminSupabaseClient();
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
    const [loansCount, requestsCount] = await Promise.all([
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
    ]);

    return {
      ...EMPTY_STUDENT_DASHBOARD,
      activeLoansAndRequestsCount:
        (loansCount.count ?? 0) + (requestsCount.count ?? 0),
    };
  }

  const [
    momentosResult,
    curriculumResult,
    attendanceResult,
    loansResult,
    requestsResult,
  ] = await Promise.all([
    dbClient
      .from("momentos")
      .select("id, moment_number, name, status")
      .eq("school_year_id", enrollment.school_year_id)
      .order("moment_number", { ascending: true })
      .returns<MomentRow[]>(),
    dbClient
      .from("curriculum_subjects")
      .select("id, subjects!inner(code, name, grading_scale)")
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
  ]);

  const momentos = momentosResult.data ?? [];
  const activeMoment =
    momentos.find((m) => m.status === "open") ??
    [...momentos].reverse().find((m) => m.status !== "scheduled") ??
    momentos[0] ??
    null;

  let grades: MomentFinalGradeRow[] = [];
  let upcomingEvaluations: UpcomingEvaluationItem[] = [];

  if (activeMoment) {
    const todayIso = new Date().toISOString().slice(0, 10);
    const [gradesResult, evalItemsResult] = await Promise.all([
      dbClient
        .from("moment_final_grades")
        .select("curriculum_subject_id, final_numeric, final_literal")
        .eq("enrollment_id", enrollment.id)
        .eq("momento_id", activeMoment.id)
        .returns<MomentFinalGradeRow[]>(),
      dbClient
        .from("evaluation_items")
        .select(
          "id, title, evaluation_type, weight_percent, scheduled_date, evaluation_plans!inner(status, momento_id, teacher_assignments!inner(section_id, curriculum_subjects!inner(subjects!inner(name))))"
        )
        .eq("evaluation_plans.momento_id", activeMoment.id)
        .eq("evaluation_plans.teacher_assignments.section_id", enrollment.section_id)
        .in("evaluation_plans.status", ["published", "locked"])
        .gte("scheduled_date", todayIso)
        .order("scheduled_date", { ascending: true })
        .limit(5)
        .returns<EvalItemJoinRow[]>(),
    ]);

    grades = gradesResult.data ?? [];
    upcomingEvaluations = (evalItemsResult.data ?? [])
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

  const curriculumList = curriculumResult.data ?? [];
  const gradeMap = new Map(grades.map((g) => [g.curriculum_subject_id, g]));

  const subjectsSummary: StudentSubjectSummary[] = curriculumList
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

  const numericGrades = grades
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
    upcomingEvaluations,
  };
}

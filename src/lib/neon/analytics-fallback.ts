import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AnalyticsBiOverview,
  CdceMatrixRow,
  FilterSubjectItem,
  SectionSaturationItem,
  StudentRiskAlertItem,
  TeacherSlaItem,
} from "@/features/analitica/schemas";

interface SchoolYearRow {
  id: string;
  code: string;
  name: string;
  status: string;
  is_current: boolean;
  start_date: string;
}

interface MomentoRow {
  id: string;
  moment_number: 1 | 2 | 3;
  name: string;
  status: string;
  start_date: string;
  end_date: string;
  grade_entry_close_at: string | null;
}

interface MencionRow {
  id: string;
  code: string;
  name: string;
}

interface SectionRow {
  id: string;
  mencion_id: string;
  grade_year: number;
  section_letter: string;
  capacity: number;
}

interface EnrollmentRow {
  id: string;
  student_user_id: string;
  section_id: string;
  mencion_id: string;
  grade_year: number;
  enrollment_status: string;
  users:
    | { first_name: string; last_name: string; cedula: string }
    | { first_name: string; last_name: string; cedula: string }[]
    | null;
}

interface TeacherAssignmentRow {
  id: string;
  section_id: string;
  curriculum_subject_id: string;
  users:
    | { first_name: string; last_name: string }
    | { first_name: string; last_name: string }[]
    | null;
  curriculum_subjects:
    | {
        id: string;
        grade_year: number;
        subjects:
          | { code: string; name: string; passing_threshold: number }
          | { code: string; name: string; passing_threshold: number }[]
          | null;
      }
    | {
        id: string;
        grade_year: number;
        subjects:
          | { code: string; name: string; passing_threshold: number }
          | { code: string; name: string; passing_threshold: number }[]
          | null;
      }[]
    | null;
}

interface EvaluationPlanRow {
  teacher_assignment_id: string;
  status: string;
}

interface MomentFinalGradeRow {
  enrollment_id: string;
  curriculum_subject_id: string;
  final_numeric: number | null;
  final_literal: string | null;
}

interface AttendanceRecordRow {
  enrollment_id: string;
  status: string;
}

interface StudentRequestRow {
  id: string;
  status: string;
  sla_entered_at: string;
  resolved_at: string | null;
}

interface CurriculumSubjectRow {
  id: string;
  mencion_id: string;
  grade_year: number;
  subjects:
    | { code: string; name: string; passing_threshold: number }
    | { code: string; name: string; passing_threshold: number }[]
    | null;
}

function unwrapOne<T>(val: T | T[] | null | undefined): T | null {
  if (!val) return null;
  return Array.isArray(val) ? (val[0] ?? null) : val;
}

/**
 * Respaldo seguro bajo RLS cuando el RPC `siga_get_analytics_bi_overview`
 * aún no ha sido desplegado en la instancia de Supabase.
 * Todas las consultas usan columnas explícitas y el JWT del usuario autenticado.
 */
export async function queryAnalyticsViaRlsFallback(
  supabase: SupabaseClient,
  schoolYearId: string | null,
  momentoNumber: 1 | 2 | 3 | null
): Promise<AnalyticsBiOverview> {
  const [schoolYearsRes, mencionesRes] = await Promise.all([
    supabase
      .from("school_years")
      .select("id, code, name, status, is_current, start_date")
      .order("is_current", { ascending: false })
      .order("start_date", { ascending: false }),
    supabase
      .from("menciones")
      .select("id, code, name")
      .eq("is_active", true)
      .order("name", { ascending: true }),
  ]);

  const schoolYears = (schoolYearsRes.data ?? []) as SchoolYearRow[];
  const menciones = (mencionesRes.data ?? []) as MencionRow[];
  const mencionesMap = new Map(menciones.map((m) => [m.id, m]));

  const activeSchoolYear =
    (schoolYearId ? schoolYears.find((y) => y.id === schoolYearId) : null) ??
    schoolYears.find((y) => y.is_current) ??
    schoolYears.find((y) => y.status === "active") ??
    schoolYears[0] ??
    null;

  if (!activeSchoolYear) {
    return {
      source: "supabase_oltp",
      scopedMencionId: null,
      schoolYears: schoolYears.map((y) => ({
        id: y.id,
        code: y.code,
        name: y.name,
        status: y.status,
        isCurrent: y.is_current,
      })),
      menciones,
      activeSchoolYear: null,
      activeMomento: null,
      summary: {
        activeStudents: 0,
        totalSections: 0,
        totalAssignments: 0,
        attendanceRatePct: null,
        passingRatePct: null,
        pendingRequests: 0,
      },
      teacherSla: [],
      secretariatSla: {
        totalRequests: 0,
        pendingCount: 0,
        inReviewCount: 0,
        approvedCount: 0,
        deliveredCount: 0,
        rejectedCount: 0,
        avgResolutionHours: null,
        oldestPendingHours: null,
        officialDocumentsIssued: 0,
      },
      sectionSaturation: [],
      filterSubjects: [],
      riskAlerts: [],
      cdceMatrix: [],
      generatedAt: new Date().toISOString(),
    };
  }

  const momentosRes = await supabase
    .from("momentos")
    .select(
      "id, moment_number, name, status, start_date, end_date, grade_entry_close_at"
    )
    .eq("school_year_id", activeSchoolYear.id)
    .order("moment_number", { ascending: true });

  const momentos = (momentosRes.data ?? []) as MomentoRow[];
  const activeMomento =
    (momentoNumber
      ? momentos.find((m) => m.moment_number === momentoNumber)
      : null) ??
    momentos.find((m) => m.status === "open") ??
    momentos[momentos.length - 1] ??
    null;

  const [
    sectionsRes,
    enrollmentsRes,
    assignmentsRes,
    requestsRes,
    docsCountRes,
    curriculumRes,
  ] = await Promise.all([
    supabase
      .from("sections")
      .select("id, mencion_id, grade_year, section_letter, capacity")
      .eq("school_year_id", activeSchoolYear.id)
      .is("deleted_at", null),
    supabase
      .from("enrollments")
      .select(
        "id, student_user_id, section_id, mencion_id, grade_year, enrollment_status, users(first_name, last_name, cedula)"
      )
      .eq("school_year_id", activeSchoolYear.id)
      .is("deleted_at", null),
    supabase
      .from("teacher_assignments")
      .select(
        "id, section_id, curriculum_subject_id, users(first_name, last_name), curriculum_subjects(id, grade_year, subjects(code, name, passing_threshold))"
      )
      .eq("school_year_id", activeSchoolYear.id)
      .eq("is_active", true),
    supabase
      .from("student_requests")
      .select("id, status, sla_entered_at, resolved_at"),
    supabase
      .from("official_documents")
      .select("id", { count: "exact", head: true })
      .eq("status", "valid")
      .gte("issued_at", activeSchoolYear.start_date),
    supabase
      .from("curriculum_subjects")
      .select("id, mencion_id, grade_year, subjects(code, name, passing_threshold)")
      .eq("is_active", true),
  ]);

  const sections = (sectionsRes.data ?? []) as SectionRow[];
  const sectionsMap = new Map(sections.map((s) => [s.id, s]));
  const enrollments = (enrollmentsRes.data ?? []) as EnrollmentRow[];
  const activeEnrollments = enrollments.filter(
    (e) => e.enrollment_status === "active"
  );
  const enrollmentIds = enrollments.map((e) => e.id);
  const assignments = (assignmentsRes.data ?? []) as TeacherAssignmentRow[];
  const requests = (requestsRes.data ?? []) as StudentRequestRow[];
  const curriculumSubjects = (curriculumRes.data ?? []) as CurriculumSubjectRow[];
  const curriculumMap = new Map(curriculumSubjects.map((c) => [c.id, c]));

  let evalPlans: EvaluationPlanRow[] = [];
  let grades: MomentFinalGradeRow[] = [];
  let attendance: AttendanceRecordRow[] = [];

  if (activeMomento && assignments.length > 0) {
    const plansRes = await supabase
      .from("evaluation_plans")
      .select("teacher_assignment_id, status")
      .eq("momento_id", activeMomento.id);
    evalPlans = (plansRes.data ?? []) as EvaluationPlanRow[];
  }

  if (enrollmentIds.length > 0) {
    const [gradesRes, attRes] = await Promise.all([
      activeMomento
        ? supabase
            .from("moment_final_grades")
            .select(
              "enrollment_id, curriculum_subject_id, final_numeric, final_literal"
            )
            .eq("momento_id", activeMomento.id)
            .in("enrollment_id", enrollmentIds.slice(0, 500))
        : Promise.resolve({ data: [] }),
      supabase
        .from("attendance_records")
        .select("enrollment_id, status")
        .in("enrollment_id", enrollmentIds.slice(0, 500)),
    ]);

    grades = (gradesRes.data ?? []) as MomentFinalGradeRow[];
    attendance = (attRes.data ?? []) as AttendanceRecordRow[];
  }

  const evalPlanMap = new Map(
    evalPlans.map((p) => [p.teacher_assignment_id, p.status])
  );

  // Resumen ejecutivo
  const attendedMarks = attendance.filter((a) =>
    ["present", "late", "justified"].includes(a.status)
  ).length;
  const attendanceRatePct =
    attendance.length > 0
      ? Math.round((attendedMarks / attendance.length) * 1000) / 10
      : null;

  let passedGrades = 0;
  for (const g of grades) {
    const cs = curriculumMap.get(g.curriculum_subject_id);
    const sub = unwrapOne(cs?.subjects);
    const threshold = sub?.passing_threshold ?? 10;
    if (
      (g.final_numeric !== null && g.final_numeric >= threshold) ||
      (g.final_literal !== null && ["A", "B", "C"].includes(g.final_literal))
    ) {
      passedGrades++;
    }
  }
  const passingRatePct =
    grades.length > 0
      ? Math.round((passedGrades / grades.length) * 1000) / 10
      : null;

  const pendingRequests = requests.filter((r) =>
    ["pending", "in_review"].includes(r.status)
  ).length;

  // Saturación por sección
  const sectionSaturation: SectionSaturationItem[] = sections.map((sec) => {
    const enrolledCount = activeEnrollments.filter(
      (e) => e.section_id === sec.id
    ).length;
    const preEnrolledCount = enrollments.filter(
      (e) => e.section_id === sec.id && e.enrollment_status === "pre_enrolled"
    ).length;
    const occupancyPct =
      Math.round((enrolledCount / Math.max(sec.capacity, 1)) * 1000) / 10;
    const saturationStatus =
      occupancyPct >= 95 ? "saturated" : occupancyPct >= 80 ? "high" : "normal";

    return {
      sectionId: sec.id,
      mencionId: sec.mencion_id,
      mencionName: mencionesMap.get(sec.mencion_id)?.name ?? "Mención",
      gradeYear: sec.grade_year,
      sectionLetter: sec.section_letter,
      capacity: sec.capacity,
      enrolledCount,
      preEnrolledCount,
      occupancyPct,
      saturationStatus,
    };
  });

  // Semáforo docente
  const activeBySection = new Map<string, Set<string>>();
  for (const e of activeEnrollments) {
    if (!activeBySection.has(e.section_id)) {
      activeBySection.set(e.section_id, new Set());
    }
    activeBySection.get(e.section_id)!.add(e.id);
  }

  const teacherSla: TeacherSlaItem[] = assignments.map((ta) => {
    const sec = sectionsMap.get(ta.section_id);
    const teacher = unwrapOne(ta.users);
    const cs = unwrapOne(ta.curriculum_subjects);
    const sub = unwrapOne(cs?.subjects);
    const secEnrollIds = activeBySection.get(ta.section_id) ?? new Set();
    const enrolledCount = secEnrollIds.size;
    const gradedCount = grades.filter(
      (g) =>
        secEnrollIds.has(g.enrollment_id) &&
        g.curriculum_subject_id === ta.curriculum_subject_id &&
        (g.final_numeric !== null || g.final_literal !== null)
    ).length;
    const planStatus = evalPlanMap.get(ta.id) ?? "missing";
    const completionPct =
      enrolledCount > 0
        ? Math.min(100, Math.round((gradedCount / enrolledCount) * 1000) / 10)
        : 0;

    const slaStatus: TeacherSlaItem["slaStatus"] =
      enrolledCount === 0
        ? "on_track"
        : completionPct >= 80 &&
            (planStatus === "published" || planStatus === "locked")
          ? "on_track"
          : completionPct >= 40
            ? "warning"
            : "critical";

    return {
      assignmentId: ta.id,
      teacherName: teacher
        ? `${teacher.first_name} ${teacher.last_name}`
        : "Docente asignado",
      subjectName: sub?.name ?? "Asignatura",
      subjectCode: sub?.code ?? "—",
      mencionId: sec?.mencion_id ?? "",
      mencionName: sec
        ? (mencionesMap.get(sec.mencion_id)?.name ?? "Mención")
        : "Mención",
      gradeYear: sec?.grade_year ?? cs?.grade_year ?? 1,
      sectionLetter: sec?.section_letter ?? "A",
      enrolledCount,
      gradedCount,
      planStatus,
      completionPct,
      slaStatus,
    };
  });

  // Tiempos de secretaría
  const nowMs = Date.now();
  const resolvedDurations = requests
    .filter((r) => r.resolved_at)
    .map(
      (r) =>
        (new Date(r.resolved_at!).getTime() -
          new Date(r.sla_entered_at).getTime()) /
        3600000
    )
    .filter((h) => Number.isFinite(h) && h >= 0);

  const pendingAges = requests
    .filter((r) => ["pending", "in_review"].includes(r.status))
    .map((r) => (nowMs - new Date(r.sla_entered_at).getTime()) / 3600000)
    .filter((h) => Number.isFinite(h) && h >= 0);

  const secretariatSla = {
    totalRequests: requests.length,
    pendingCount: requests.filter((r) => r.status === "pending").length,
    inReviewCount: requests.filter((r) => r.status === "in_review").length,
    approvedCount: requests.filter((r) => r.status === "approved").length,
    deliveredCount: requests.filter((r) => r.status === "delivered").length,
    rejectedCount: requests.filter((r) => r.status === "rejected").length,
    avgResolutionHours:
      resolvedDurations.length > 0
        ? Math.round(
            (resolvedDurations.reduce((a, b) => a + b, 0) /
              resolvedDurations.length) *
              10
          ) / 10
        : null,
    oldestPendingHours:
      pendingAges.length > 0
        ? Math.round(Math.max(...pendingAges) * 10) / 10
        : null,
    officialDocumentsIssued: docsCountRes.count ?? 0,
  };

  // Materias filtro
  const gradesByCs = new Map<string, MomentFinalGradeRow[]>();
  for (const g of grades) {
    if (!gradesByCs.has(g.curriculum_subject_id)) {
      gradesByCs.set(g.curriculum_subject_id, []);
    }
    gradesByCs.get(g.curriculum_subject_id)!.push(g);
  }

  const filterSubjects: FilterSubjectItem[] = [];
  for (const [csId, csGrades] of gradesByCs.entries()) {
    const cs = curriculumMap.get(csId);
    const sub = unwrapOne(cs?.subjects);
    if (!cs || !sub) continue;
    const threshold = sub.passing_threshold ?? 10;
    const failedCount = csGrades.filter(
      (g) =>
        (g.final_numeric !== null && g.final_numeric < threshold) ||
        (g.final_literal !== null && ["D", "E"].includes(g.final_literal))
    ).length;
    const numericVals = csGrades
      .map((g) => g.final_numeric)
      .filter((n): n is number => n !== null);
    const avgNumeric =
      numericVals.length > 0
        ? Math.round(
            (numericVals.reduce((a, b) => a + b, 0) / numericVals.length) * 100
          ) / 100
        : null;

    filterSubjects.push({
      curriculumSubjectId: csId,
      subjectCode: sub.code,
      subjectName: sub.name,
      mencionId: cs.mencion_id,
      mencionName: mencionesMap.get(cs.mencion_id)?.name ?? "Mención",
      gradeYear: cs.grade_year,
      totalGraded: csGrades.length,
      failedCount,
      failureRatePct:
        csGrades.length > 0
          ? Math.round((failedCount / csGrades.length) * 1000) / 10
          : 0,
      avgNumeric,
      pendingStudents: 0,
    });
  }
  filterSubjects.sort((a, b) => b.failureRatePct - a.failureRatePct);

  // Alerta temprana
  const riskAlerts: StudentRiskAlertItem[] = [];
  for (const enr of activeEnrollments) {
    const u = unwrapOne(enr.users);
    const sec = sectionsMap.get(enr.section_id);
    if (!u || !sec) continue;
    const stAtt = attendance.filter((a) => a.enrollment_id === enr.id);
    const absent = stAtt.filter((a) => a.status === "absent").length;
    const absenceRatePct =
      stAtt.length > 0 ? Math.round((absent / stAtt.length) * 1000) / 10 : 0;

    const stGrades = grades.filter((g) => g.enrollment_id === enr.id);
    const failedSubjects = stGrades.filter((g) => {
      const cs = curriculumMap.get(g.curriculum_subject_id);
      const sub = unwrapOne(cs?.subjects);
      const threshold = sub?.passing_threshold ?? 10;
      return (
        (g.final_numeric !== null && g.final_numeric < threshold) ||
        (g.final_literal !== null && ["D", "E"].includes(g.final_literal))
      );
    }).length;
    const numGrades = stGrades
      .map((g) => g.final_numeric)
      .filter((n): n is number => n !== null);
    const avgGrade =
      numGrades.length > 0
        ? Math.round(
            (numGrades.reduce((a, b) => a + b, 0) / numGrades.length) * 10
          ) / 10
        : null;

    if (
      absenceRatePct >= 15 ||
      failedSubjects >= 2 ||
      (avgGrade !== null && avgGrade < 10)
    ) {
      const riskScore = Math.min(
        100,
        Math.round(
          (absenceRatePct >= 10 ? Math.min(50, absenceRatePct * 1.4) : 0) +
            failedSubjects * 16 +
            (avgGrade !== null && avgGrade < 10 ? 15 : 0)
        )
      );
      riskAlerts.push({
        studentUserId: enr.student_user_id,
        fullName: `${u.first_name} ${u.last_name}`,
        cedulaLast4: u.cedula.slice(-4),
        mencionId: enr.mencion_id,
        mencionName: mencionesMap.get(enr.mencion_id)?.name ?? "Mención",
        gradeYear: sec.grade_year,
        sectionLetter: sec.section_letter,
        absenceRatePct,
        failedSubjects,
        pendingCount: 0,
        avgGrade,
        riskScore,
        riskLevel:
          riskScore >= 60 || absenceRatePct >= 25 || failedSubjects >= 3
            ? "high"
            : "medium",
      });
    }
  }
  riskAlerts.sort((a, b) => b.riskScore - a.riskScore);

  // Matriz CDCE
  const cdceGroups = new Map<string, SectionRow[]>();
  for (const sec of sections) {
    const key = `${sec.mencion_id}:${sec.grade_year}`;
    if (!cdceGroups.has(key)) cdceGroups.set(key, []);
    cdceGroups.get(key)!.push(sec);
  }

  const cdceMatrix: CdceMatrixRow[] = [];
  for (const [key, grpSections] of cdceGroups.entries()) {
    const [mencionId, yearStr] = key.split(":");
    const gradeYear = Number(yearStr);
    const mencion = mencionesMap.get(mencionId);
    const secIds = new Set(grpSections.map((s) => s.id));
    const grpEnr = enrollments.filter((e) => secIds.has(e.section_id));
    const grpEnrIds = new Set(grpEnr.map((e) => e.id));
    const grpGrades = grades
      .filter((g) => grpEnrIds.has(g.enrollment_id) && g.final_numeric !== null)
      .map((g) => g.final_numeric!);
    const grpAtt = attendance.filter((a) => grpEnrIds.has(a.enrollment_id));
    const grpAttOk = grpAtt.filter((a) =>
      ["present", "late", "justified"].includes(a.status)
    ).length;

    cdceMatrix.push({
      mencionId,
      mencionCode: mencion?.code ?? "—",
      mencionName: mencion?.name ?? "Mención",
      gradeYear,
      totalSections: grpSections.length,
      activeStudents: grpEnr.filter((e) => e.enrollment_status === "active")
        .length,
      preEnrolledStudents: grpEnr.filter(
        (e) => e.enrollment_status === "pre_enrolled"
      ).length,
      withdrawnStudents: grpEnr.filter(
        (e) => e.enrollment_status === "withdrawn"
      ).length,
      promotedStudents: grpEnr.filter((e) =>
        ["promoted", "graduated"].includes(e.enrollment_status)
      ).length,
      avgGrade:
        grpGrades.length > 0
          ? Math.round(
              (grpGrades.reduce((a, b) => a + b, 0) / grpGrades.length) * 100
            ) / 100
          : null,
      attendancePct:
        grpAtt.length > 0
          ? Math.round((grpAttOk / grpAtt.length) * 1000) / 10
          : null,
    });
  }
  cdceMatrix.sort(
    (a, b) =>
      a.mencionName.localeCompare(b.mencionName) || a.gradeYear - b.gradeYear
  );

  return {
    source: "supabase_oltp",
    scopedMencionId: null,
    schoolYears: schoolYears.map((y) => ({
      id: y.id,
      code: y.code,
      name: y.name,
      status: y.status,
      isCurrent: y.is_current,
    })),
    menciones,
    activeSchoolYear: {
      id: activeSchoolYear.id,
      code: activeSchoolYear.code,
      name: activeSchoolYear.name,
      status: activeSchoolYear.status,
      isCurrent: activeSchoolYear.is_current,
    },
    activeMomento: activeMomento
      ? {
          id: activeMomento.id,
          momentNumber: activeMomento.moment_number,
          name: activeMomento.name,
          status: activeMomento.status,
          startDate: activeMomento.start_date,
          endDate: activeMomento.end_date,
          gradeEntryCloseAt: activeMomento.grade_entry_close_at,
        }
      : null,
    summary: {
      activeStudents: activeEnrollments.length,
      totalSections: sections.length,
      totalAssignments: assignments.length,
      attendanceRatePct,
      passingRatePct,
      pendingRequests,
    },
    teacherSla,
    secretariatSla,
    sectionSaturation,
    filterSubjects,
    riskAlerts: riskAlerts.slice(0, 50),
    cdceMatrix,
    generatedAt: new Date().toISOString(),
  };
}


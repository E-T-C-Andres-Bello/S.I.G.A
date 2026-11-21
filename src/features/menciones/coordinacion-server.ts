import type { DashboardUserProfile } from "@/lib/supabase/dashboard-session";
import { assertAuthorizedRole } from "@/lib/supabase/rbac";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  LabToolType,
  MencionAssignmentOverview,
  MencionCoordinationData,
  MencionDiaryIncidentItem,
  MencionInfo,
  MencionLabScenarioItem,
  MencionSectionOverview,
  MencionTeacherAbsenceItem,
} from "./coordinacion-schemas";

function unwrapOne<T>(val: T | T[] | null | undefined): T | null {
  if (!val) return null;
  return Array.isArray(val) ? (val[0] ?? null) : val;
}

/**
 * Resuelve la mención autorizada para el actor actual.
 * Un `coordinador_mencion` queda estrictamente acotado a su `user_roles.mencion_id`;
 * `direccion` puede consultar cualquier mención activa.
 */
export async function resolveAuthorizedMencionScope(
  profile: DashboardUserProfile,
  requestedMencionId?: string | null
): Promise<
  | {
      ok: true;
      isScopedToSingleMencion: boolean;
      allowedMenciones: MencionInfo[];
      selectedMencion: MencionInfo | null;
    }
  | { ok: false; message: string }
> {
  const authCheck = assertAuthorizedRole(
    profile,
    ["coordinador_mencion", "direccion", "control_estudios"],
    { requireVerifiedWorkspace: true }
  );

  if (!authCheck.ok) {
    return authCheck;
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return {
      ok: false,
      message: "El servicio de datos institucionales no está disponible.",
    };
  }

  const isFullScope =
    profile.primaryRole === "direccion" ||
    profile.primaryRole === "control_estudios";

  const { data: mencionesData, error: mencionesError } = await supabase
    .from("menciones")
    .select("id, code, name, description")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (mencionesError) {
    return {
      ok: false,
      message: "No fue posible consultar el catálogo de menciones técnicas.",
    };
  }

  const allMenciones = (mencionesData ?? []) as MencionInfo[];

  if (!isFullScope) {
    const { data: coordRole } = await supabase
      .from("user_roles")
      .select("mencion_id, roles!inner(code)")
      .eq("user_id", profile.internalUserId)
      .eq("is_active", true)
      .eq("roles.code", "coordinador_mencion")
      .not("mencion_id", "is", null)
      .limit(1)
      .maybeSingle<{ mencion_id: string | null }>();

    const assignedId = coordRole?.mencion_id ?? null;
    const assignedMencion =
      allMenciones.find((m) => m.id === assignedId) ?? null;

    if (!assignedMencion) {
      return {
        ok: false,
        message:
          "Tu perfil de coordinación no tiene una mención técnica asignada actualmente.",
      };
    }

    return {
      ok: true,
      isScopedToSingleMencion: true,
      allowedMenciones: [assignedMencion],
      selectedMencion: assignedMencion,
    };
  }

  const selectedMencion =
    (requestedMencionId
      ? allMenciones.find((m) => m.id === requestedMencionId)
      : null) ??
    allMenciones[0] ??
    null;

  return {
    ok: true,
    isScopedToSingleMencion: false,
    allowedMenciones: allMenciones,
    selectedMencion,
  };
}

export async function getMencionCoordinationData(
  profile: DashboardUserProfile,
  requestedMencionId?: string | null
): Promise<
  | { ok: true; data: MencionCoordinationData }
  | { ok: false; message: string }
> {
  const scope = await resolveAuthorizedMencionScope(
    profile,
    requestedMencionId
  );
  if (!scope.ok) {
    return scope;
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return {
      ok: false,
      message: "El servicio de datos institucionales no está disponible.",
    };
  }

  const selectedMencion = scope.selectedMencion;
  if (!selectedMencion) {
    return {
      ok: true,
      data: {
        activeSchoolYearName: null,
        activeMomentoName: null,
        isScopedToSingleMencion: scope.isScopedToSingleMencion,
        allowedMenciones: scope.allowedMenciones,
        selectedMencion: null,
        summary: {
          totalSections: 0,
          enrolledStudents: 0,
          activeAssignments: 0,
          baseScenariosCount: 0,
          openAbsencesCount: 0,
          incidentsCount: 0,
        },
        sections: [],
        assignments: [],
        scenarios: [],
        teacherAbsences: [],
        diaryIncidents: [],
      },
    };
  }

  const { data: schoolYear } = await supabase
    .from("school_years")
    .select("id, name, is_current, status")
    .order("is_current", { ascending: false })
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string; name: string }>();

  let activeMomento: { id: string; name: string } | null = null;
  if (schoolYear) {
    const { data: mom } = await supabase
      .from("momentos")
      .select("id, name, status, moment_number")
      .eq("school_year_id", schoolYear.id)
      .order("moment_number", { ascending: true });
    const momList = (mom ?? []) as {
      id: string;
      name: string;
      status: string;
    }[];
    activeMomento =
      momList.find((m) => m.status === "open") ??
      momList[momList.length - 1] ??
      null;
  }

  const [sectionsRes, scenariosRes] = await Promise.all([
    schoolYear
      ? supabase
          .from("sections")
          .select("id, grade_year, section_letter, capacity")
          .eq("school_year_id", schoolYear.id)
          .eq("mencion_id", selectedMencion.id)
          .is("deleted_at", null)
          .order("grade_year", { ascending: true })
          .order("section_letter", { ascending: true })
      : Promise.resolve({ data: [] }),
    supabase
      .from("mention_lab_scenarios")
      .select(
        "id, mencion_id, grade_year, tool_type, title, instructions, is_base_catalog, created_at"
      )
      .eq("mencion_id", selectedMencion.id)
      .order("grade_year", { ascending: true })
      .order("created_at", { ascending: false }),
  ]);

  const rawSections = (sectionsRes.data ?? []) as {
    id: string;
    grade_year: number;
    section_letter: string;
    capacity: number;
  }[];
  const sectionIds = rawSections.map((s) => s.id);
  const sectionMap = new Map(rawSections.map((s) => [s.id, s]));

  let enrollments: { id: string; section_id: string }[] = [];
  let assignmentsRaw: {
    id: string;
    section_id: string;
    curriculum_subject_id: string;
    teacher_user_id: string;
    users:
      | { first_name: string; last_name: string }
      | { first_name: string; last_name: string }[]
      | null;
    curriculum_subjects:
      | { subjects: { name: string } | { name: string }[] | null }
      | { subjects: { name: string } | { name: string }[] | null }[]
      | null;
  }[] = [];

  if (schoolYear && sectionIds.length > 0) {
    const [enrRes, assignRes] = await Promise.all([
      supabase
        .from("enrollments")
        .select("id, section_id")
        .eq("school_year_id", schoolYear.id)
        .eq("enrollment_status", "active")
        .in("section_id", sectionIds)
        .is("deleted_at", null),
      supabase
        .from("teacher_assignments")
        .select(
          "id, section_id, curriculum_subject_id, teacher_user_id, users(first_name, last_name), curriculum_subjects(subjects(name))"
        )
        .eq("school_year_id", schoolYear.id)
        .eq("is_active", true)
        .in("section_id", sectionIds),
    ]);

    enrollments = (enrRes.data ?? []) as { id: string; section_id: string }[];
    assignmentsRaw = (assignRes.data ?? []) as typeof assignmentsRaw;
  }

  const assignmentIds = assignmentsRaw.map((a) => a.id);
  const teacherIds = Array.from(
    new Set(assignmentsRaw.map((a) => a.teacher_user_id))
  );
  const enrollmentIds = enrollments.map((e) => e.id);

  let evalPlans: { teacher_assignment_id: string; status: string }[] = [];
  let grades: { enrollment_id: string; curriculum_subject_id: string }[] = [];
  let absencesRaw: {
    id: string;
    teacher_user_id: string;
    absence_date: string;
    reason_category: "medical" | "personal" | "institutional";
    observation: string | null;
    status: "reported" | "acknowledged" | "reorganized";
    created_at: string;
    users:
      | { first_name: string; last_name: string }
      | { first_name: string; last_name: string }[]
      | null;
  }[] = [];
  let diaryRaw: {
    id: string;
    teacher_assignment_id: string;
    entry_date: string;
    topic_covered: string;
    classroom_incidents: string | null;
    derive_to_orientation: boolean;
    users:
      | { first_name: string; last_name: string }
      | { first_name: string; last_name: string }[]
      | null;
  }[] = [];

  const [plansRes, gradesRes, absencesRes, diaryRes] = await Promise.all([
    activeMomento && assignmentIds.length > 0
      ? supabase
          .from("evaluation_plans")
          .select("teacher_assignment_id, status")
          .eq("momento_id", activeMomento.id)
          .in("teacher_assignment_id", assignmentIds)
      : Promise.resolve({ data: [] }),
    activeMomento && enrollmentIds.length > 0
      ? supabase
          .from("moment_final_grades")
          .select("enrollment_id, curriculum_subject_id")
          .eq("momento_id", activeMomento.id)
          .in("enrollment_id", enrollmentIds.slice(0, 500))
      : Promise.resolve({ data: [] }),
    teacherIds.length > 0
      ? supabase
          .from("teacher_absences")
          .select(
            "id, teacher_user_id, absence_date, reason_category, observation, status, created_at, users!teacher_absences_teacher_user_id_fkey(first_name, last_name)"
          )
          .in("teacher_user_id", teacherIds)
          .order("absence_date", { ascending: false })
          .limit(30)
      : Promise.resolve({ data: [] }),
    assignmentIds.length > 0
      ? supabase
          .from("class_diary_entries")
          .select(
            "id, teacher_assignment_id, entry_date, topic_covered, classroom_incidents, derive_to_orientation, users!class_diary_entries_author_user_id_fkey(first_name, last_name)"
          )
          .in("teacher_assignment_id", assignmentIds)
          .order("entry_date", { ascending: false })
          .limit(30)
      : Promise.resolve({ data: [] }),
  ]);

  evalPlans = (plansRes.data ?? []) as typeof evalPlans;
  grades = (gradesRes.data ?? []) as typeof grades;
  absencesRaw = (absencesRes.data ?? []) as typeof absencesRaw;
  diaryRaw = (diaryRes.data ?? []) as typeof diaryRaw;

  const evalPlanMap = new Map(
    evalPlans.map((p) => [p.teacher_assignment_id, p.status])
  );

  const enrollmentsBySection = new Map<string, Set<string>>();
  for (const e of enrollments) {
    if (!enrollmentsBySection.has(e.section_id)) {
      enrollmentsBySection.set(e.section_id, new Set());
    }
    enrollmentsBySection.get(e.section_id)!.add(e.id);
  }

  const sections: MencionSectionOverview[] = rawSections.map((s) => ({
    sectionId: s.id,
    gradeYear: s.grade_year,
    sectionLetter: s.section_letter,
    capacity: s.capacity,
    enrolledCount: enrollmentsBySection.get(s.id)?.size ?? 0,
  }));

  const assignmentsMap = new Map<string, MencionAssignmentOverview>();
  const assignments: MencionAssignmentOverview[] = assignmentsRaw.map((ta) => {
    const sec = sectionMap.get(ta.section_id);
    const teacher = unwrapOne(ta.users);
    const cs = unwrapOne(ta.curriculum_subjects);
    const sub = unwrapOne(cs?.subjects);
    const secEnrollIds = enrollmentsBySection.get(ta.section_id) ?? new Set();
    const gradedCount = grades.filter(
      (g) =>
        secEnrollIds.has(g.enrollment_id) &&
        g.curriculum_subject_id === ta.curriculum_subject_id
    ).length;

    const item: MencionAssignmentOverview = {
      assignmentId: ta.id,
      teacherName: teacher
        ? `${teacher.first_name} ${teacher.last_name}`
        : "Docente asignado",
      subjectName: sub?.name ?? "Asignatura",
      gradeYear: sec?.grade_year ?? 1,
      sectionLetter: sec?.section_letter ?? "A",
      planStatus: evalPlanMap.get(ta.id) ?? "missing",
      enrolledCount: secEnrollIds.size,
      gradedCount,
    };
    assignmentsMap.set(ta.id, item);
    return item;
  });

  const scenarios: MencionLabScenarioItem[] = (
    (scenariosRes.data ?? []) as {
      id: string;
      mencion_id: string;
      grade_year: number;
      tool_type: LabToolType;
      title: string;
      instructions: string;
      is_base_catalog: boolean;
      created_at: string;
    }[]
  ).map((sc) => ({
    id: sc.id,
    mencionId: sc.mencion_id,
    gradeYear: sc.grade_year,
    toolType: sc.tool_type,
    title: sc.title,
    instructions: sc.instructions,
    isBaseCatalog: sc.is_base_catalog,
    createdAt: sc.created_at,
  }));

  const teacherAbsences: MencionTeacherAbsenceItem[] = absencesRaw.map((ab) => {
    const teacher = unwrapOne(ab.users);
    return {
      id: ab.id,
      teacherUserId: ab.teacher_user_id,
      teacherName: teacher
        ? `${teacher.first_name} ${teacher.last_name}`
        : "Docente",
      absenceDate: ab.absence_date,
      reasonCategory: ab.reason_category,
      observation: ab.observation,
      status: ab.status,
      createdAt: ab.created_at,
    };
  });

  const diaryIncidents: MencionDiaryIncidentItem[] = diaryRaw
    .filter(
      (d) =>
        (d.classroom_incidents && d.classroom_incidents.trim().length > 0) ||
        d.derive_to_orientation
    )
    .map((d) => {
      const author = unwrapOne(d.users);
      const assign = assignmentsMap.get(d.teacher_assignment_id);
      return {
        id: d.id,
        entryDate: d.entry_date,
        teacherName: author
          ? `${author.first_name} ${author.last_name}`
          : (assign?.teacherName ?? "Docente"),
        subjectName: assign?.subjectName ?? "Asignatura",
        gradeYear: assign?.gradeYear ?? 1,
        sectionLetter: assign?.sectionLetter ?? "A",
        topicCovered: d.topic_covered,
        classroomIncidents: d.classroom_incidents,
        deriveToOrientation: d.derive_to_orientation,
      };
    });

  return {
    ok: true,
    data: {
      activeSchoolYearName: schoolYear?.name ?? null,
      activeMomentoName: activeMomento?.name ?? null,
      isScopedToSingleMencion: scope.isScopedToSingleMencion,
      allowedMenciones: scope.allowedMenciones,
      selectedMencion,
      summary: {
        totalSections: sections.length,
        enrolledStudents: enrollments.length,
        activeAssignments: assignments.length,
        baseScenariosCount: scenarios.filter((s) => s.isBaseCatalog).length,
        openAbsencesCount: teacherAbsences.filter(
          (a) => a.status === "reported"
        ).length,
        incidentsCount: diaryIncidents.length,
      },
      sections,
      assignments,
      scenarios,
      teacherAbsences,
      diaryIncidents,
    },
  };
}


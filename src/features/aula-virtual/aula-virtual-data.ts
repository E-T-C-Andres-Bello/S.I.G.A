import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { DashboardUserProfile } from "@/lib/supabase/dashboard-session";

export interface AulaVirtualCourseUnitItem {
  id: string;
  unitNumber: number;
  title: string;
  statusLabel: string;
  evaluatedWeight: number;
  activities: Array<{
    id: string;
    title: string;
    typeLabel: string;
    weightPercent: number;
    scheduledDate: string | null;
    scoreLabel: string | null;
    isCompleted: boolean;
  }>;
}

export interface AulaVirtualCourseCardItem {
  curriculumSubjectId: string;
  virtualCourseId: string | null;
  subjectCode: string;
  subjectName: string;
  weeklyHours: number;
  isTechnicalCore: boolean;
  categoryLabel: string;
  gradingScale: "NUMERIC_1_20" | "LITERAL_A_E";
  teacherName: string | null;
  sectionLabel: string | null;
  scheduleSummary: string;
  welcomeMessage: string | null;
  aiTutorEnabled: boolean;
  isPublished: boolean;
  progressPercent: number;
  currentGradeLabel: string | null;
  completedActivitiesCount: number;
  totalActivitiesCount: number;
  units: AulaVirtualCourseUnitItem[];
}

export interface AulaVirtualTimelineItem {
  id: string;
  subjectCode: string;
  subjectName: string;
  title: string;
  typeLabel: string;
  weightPercent: number;
  scheduledDate: string;
  isCompleted: boolean;
  scoreLabel: string | null;
}

export interface MentionLabShortcut {
  mencionCode: string;
  mencionName: string;
  href: string;
  title: string;
  description: string;
  tools: string[];
}

export interface AulaVirtualCampusData {
  roleMode: "student" | "staff";
  hasEnrollmentOrAssignment: boolean;
  schoolYearName: string | null;
  activeMomentName: string | null;
  gradeYear: number | null;
  sectionLetter: string | null;
  mencionCode: string | null;
  mencionName: string | null;
  courses: AulaVirtualCourseCardItem[];
  timeline: AulaVirtualTimelineItem[];
  labShortcut: MentionLabShortcut | null;
}

interface EnrollmentRow {
  id: string;
  section_id: string;
  grade_year: number;
  mencion_id: string;
  school_year_id: string;
  sections: { section_letter: string } | Array<{ section_letter: string }> | null;
  menciones: { code: string; name: string } | Array<{ code: string; name: string }> | null;
  school_years:
    | { name: string; is_current: boolean }
    | Array<{ name: string; is_current: boolean }>
    | null;
}

interface MomentRow {
  id: string;
  moment_number: number;
  name: string;
  status: string;
}

interface CurriculumSubjectRow {
  id: string;
  weekly_hours: number;
  annual_hours?: number | null;
  display_order?: number | null;
  subjects:
    | {
        code: string;
        name: string;
        grading_scale: "NUMERIC_1_20" | "LITERAL_A_E";
        is_technical_core: boolean;
      }
    | Array<{
        code: string;
        name: string;
        grading_scale: "NUMERIC_1_20" | "LITERAL_A_E";
        is_technical_core: boolean;
      }>
    | null;
}

interface TeacherAssignmentRow {
  id: string;
  curriculum_subject_id: string;
  users:
    | { first_name: string; last_name: string }
    | Array<{ first_name: string; last_name: string }>
    | null;
  sections?:
    | {
        grade_year: number;
        section_letter: string;
        menciones:
          | { code: string; name: string }
          | Array<{ code: string; name: string }>
          | null;
      }
    | Array<{
        grade_year: number;
        section_letter: string;
        menciones:
          | { code: string; name: string }
          | Array<{ code: string; name: string }>
          | null;
      }>
    | null;
  curriculum_subjects?: CurriculumSubjectRow | CurriculumSubjectRow[] | null;
}

interface VirtualCourseRow {
  id: string;
  teacher_assignment_id: string;
  welcome_message: string | null;
  ai_tutor_enabled: boolean;
  is_published: boolean;
}

interface EvalPlanRow {
  id: string;
  teacher_assignment_id: string;
  momento_id: string;
  title: string;
  status: string;
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

interface StudentScoreRow {
  evaluation_item_id: string;
  numeric_score: number | null;
  literal_grade: string | null;
}

interface MomentFinalGradeRow {
  curriculum_subject_id: string;
  momento_id: string;
  final_numeric: number | null;
  final_literal: string | null;
}

interface ScheduleRpcRow {
  day_of_week: number;
  start_time: string;
  end_time: string;
  room_label: string;
  subject_code: string;
}

const WEEKDAY_SHORT: Record<number, string> = {
  1: "Lun",
  2: "Mar",
  3: "Mié",
  4: "Jue",
  5: "Vie",
};

const EVAL_TYPE_LABELS: Record<string, string> = {
  written_exam: "Prueba Escrita",
  practical_lab: "Laboratorio Práctico",
  lab_mention: "Práctica de Mención",
  project: "Proyecto Aplicado",
  workshop: "Taller / Guía",
  online_exam: "Cuestionario Online",
  exam_online: "Cuestionario Online",
  assignment: "Entrega de Tarea",
  classroom_activity: "Actividad en Aula",
};

function unwrapSingle<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function resolveMentionLabShortcut(
  mencionCode: string | null,
  mencionName: string | null
): MentionLabShortcut | null {
  const code = (mencionCode ?? "").trim().toUpperCase();
  if (code.includes("TELEM")) {
    return {
      mencionCode: "TELEMATICA",
      mencionName: mencionName ?? "Telemática",
      href: "/estudiante/asignaturas",
      title: "Laboratorio Práctico de Telemática",
      description:
        "Entorno SQL interactivo sobre Neon Serverless, subredes IPv4, cableado T568A/B y bitácora de soporte TI.",
      tools: [
        "Consola SQL PostgreSQL (Ramas aisladas)",
        "Calculadora de Subredes IPv4 y CIDR",
        "Bitácora de Ensamblaje y Diagnóstico TI",
      ],
    };
  }
  if (code.includes("ADUAN")) {
    return {
      mencionCode: "ADUANAS",
      mencionName: mencionName ?? "Aduana",
      href: "/estudiante/asignaturas",
      title: "Simulador Técnico de Aduana y Comercio Exterior",
      description:
        "Clasificación arancelaria Nandina, liquidación aduanera CIF/FOB y validación de Declaración Única (DUA / B/L).",
      tools: [
        "Buscador de Código Arancelario y Alícuotas",
        "Calculadora de Valoración CIF / FOB e Impuestos",
        "Validador de Expediente de Importación (B/L y Factura)",
      ],
    };
  }
  if (code.includes("TURIS")) {
    return {
      mencionCode: "TURISMO",
      mencionName: mencionName ?? "Turismo",
      href: "/estudiante/asignaturas",
      title: "Laboratorio de Rutas Turísticas y Hospitalidad",
      description:
        "Diseño de circuitos en Ciudad Guayana (La Llovizna, Cachamay, Orinoco), protocolo de eventos y recepción hotelera.",
      tools: [
        "Planificador de Circuitos e Itinerarios Guayana",
        "Simulador de Check-In y Recepción Hotelera",
        "Matriz de Costos y Logística de Eventos",
      ],
    };
  }
  return null;
}

/**
 * Carga bajo Supabase RLS todos los datos del campus LMS estilo Moodle:
 * cursos inscritos o asignados, unidades por Momento Pedagógico, progreso real y línea de tiempo.
 */
export async function getAulaVirtualCampusData(
  profile: DashboardUserProfile
): Promise<AulaVirtualCampusData> {
  const isStudent = profile.primaryRole === "estudiante";
  const supabase = await createServerSupabaseClient();

  if (!supabase) {
    return {
      roleMode: isStudent ? "student" : "staff",
      hasEnrollmentOrAssignment: false,
      schoolYearName: null,
      activeMomentName: null,
      gradeYear: null,
      sectionLetter: null,
      mencionCode: null,
      mencionName: null,
      courses: [],
      timeline: [],
      labShortcut: null,
    };
  }

  if (isStudent) {
    const { data: enrollment } = await supabase
      .from("enrollments")
      .select(
        "id, section_id, grade_year, mencion_id, school_year_id, sections(section_letter), menciones(code, name), school_years!inner(name, is_current)"
      )
      .eq("student_user_id", profile.internalUserId)
      .eq("school_years.is_current", true)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<EnrollmentRow>();

    if (!enrollment) {
      return {
        roleMode: "student",
        hasEnrollmentOrAssignment: false,
        schoolYearName: null,
        activeMomentName: null,
        gradeYear: null,
        sectionLetter: null,
        mencionCode: null,
        mencionName: null,
        courses: [],
        timeline: [],
        labShortcut: null,
      };
    }

    const sectionObj = unwrapSingle(enrollment.sections);
    const mencionObj = unwrapSingle(enrollment.menciones);
    const schoolYearObj = unwrapSingle(enrollment.school_years);

    const [
      momentsRes,
      currSubjectsRes,
      assignmentsRes,
      finalGradesRes,
      scheduleRes,
    ] = await Promise.all([
      supabase
        .from("momentos")
        .select("id, moment_number, name, status")
        .eq("school_year_id", enrollment.school_year_id)
        .order("moment_number", { ascending: true })
        .returns<MomentRow[]>(),
      supabase
        .from("curriculum_subjects")
        .select(
          "id, weekly_hours, annual_hours, display_order, subjects(code, name, grading_scale, is_technical_core)"
        )
        .eq("mencion_id", enrollment.mencion_id)
        .eq("grade_year", enrollment.grade_year)
        .eq("is_active", true)
        .order("display_order", { ascending: true })
        .returns<CurriculumSubjectRow[]>(),
      supabase
        .from("teacher_assignments")
        .select("id, curriculum_subject_id, users(first_name, last_name)")
        .eq("school_year_id", enrollment.school_year_id)
        .eq("section_id", enrollment.section_id)
        .is("deleted_at", null)
        .returns<TeacherAssignmentRow[]>(),
      supabase
        .from("moment_final_grades")
        .select("curriculum_subject_id, momento_id, final_numeric, final_literal")
        .eq("enrollment_id", enrollment.id)
        .returns<MomentFinalGradeRow[]>(),
      supabase.rpc("siga_get_student_section_schedule"),
    ]);

    const momentos = momentsRes.data ?? [];
    const activeMoment =
      momentos.find((m) => m.status === "open") ?? momentos[0] ?? null;

    const assignments = assignmentsRes.data ?? [];
    const assignmentIds = assignments.map((a) => a.id);

    const virtualCoursesMap = new Map<string, VirtualCourseRow>();
    const plansByAssignmentId = new Map<string, EvalPlanRow[]>();
    const itemsByPlanId = new Map<string, EvalItemRow[]>();
    const scoresByItemId = new Map<string, StudentScoreRow>();

    if (assignmentIds.length > 0) {
      const [vcRes, plansRes] = await Promise.all([
        supabase
          .from("virtual_courses")
          .select(
            "id, teacher_assignment_id, welcome_message, ai_tutor_enabled, is_published"
          )
          .in("teacher_assignment_id", assignmentIds)
          .returns<VirtualCourseRow[]>(),
        supabase
          .from("evaluation_plans")
          .select("id, teacher_assignment_id, momento_id, title, status")
          .in("teacher_assignment_id", assignmentIds)
          .returns<EvalPlanRow[]>(),
      ]);

      for (const vc of vcRes.data ?? []) {
        virtualCoursesMap.set(vc.teacher_assignment_id, vc);
      }

      const plans = plansRes.data ?? [];
      const planIds: string[] = [];
      for (const p of plans) {
        planIds.push(p.id);
        const list = plansByAssignmentId.get(p.teacher_assignment_id) ?? [];
        list.push(p);
        plansByAssignmentId.set(p.teacher_assignment_id, list);
      }

      if (planIds.length > 0) {
        const { data: evalItems } = await supabase
          .from("evaluation_items")
          .select(
            "id, evaluation_plan_id, title, evaluation_type, weight_percent, max_points, scheduled_date"
          )
          .in("evaluation_plan_id", planIds)
          .order("scheduled_date", { ascending: true })
          .returns<EvalItemRow[]>();

        const itemIds: string[] = [];
        for (const item of evalItems ?? []) {
          itemIds.push(item.id);
          const list = itemsByPlanId.get(item.evaluation_plan_id) ?? [];
          list.push(item);
          itemsByPlanId.set(item.evaluation_plan_id, list);
        }

        if (itemIds.length > 0) {
          const { data: scoreRows } = await supabase
            .from("student_scores")
            .select("evaluation_item_id, numeric_score, literal_grade")
            .eq("enrollment_id", enrollment.id)
            .in("evaluation_item_id", itemIds)
            .is("deleted_at", null)
            .returns<StudentScoreRow[]>();

          for (const sc of scoreRows ?? []) {
            scoresByItemId.set(sc.evaluation_item_id, sc);
          }
        }
      }
    }

    const scheduleRows = Array.isArray(scheduleRes.data)
      ? (scheduleRes.data as ScheduleRpcRow[])
      : [];
    const scheduleByCode = new Map<string, ScheduleRpcRow[]>();
    for (const slot of scheduleRows) {
      const list = scheduleByCode.get(slot.subject_code) ?? [];
      list.push(slot);
      scheduleByCode.set(slot.subject_code, list);
    }

    const finalGradesMap = new Map<string, MomentFinalGradeRow>();
    for (const fg of finalGradesRes.data ?? []) {
      if (!activeMoment || fg.momento_id === activeMoment.id) {
        finalGradesMap.set(fg.curriculum_subject_id, fg);
      }
    }

    const assignmentBySubjectId = new Map<string, TeacherAssignmentRow>();
    for (const a of assignments) {
      assignmentBySubjectId.set(a.curriculum_subject_id, a);
    }

    const timeline: AulaVirtualTimelineItem[] = [];

    const courses: AulaVirtualCourseCardItem[] = (currSubjectsRes.data ?? [])
      .map((cs): AulaVirtualCourseCardItem | null => {
        const subj = unwrapSingle(cs.subjects);
        if (!subj) return null;

        const assign = assignmentBySubjectId.get(cs.id);
        const teacherUser = unwrapSingle(assign?.users);
        const teacherName = teacherUser
          ? `${teacherUser.first_name} ${teacherUser.last_name}`.trim()
          : null;
        const vc = assign ? virtualCoursesMap.get(assign.id) : undefined;
        const subjectPlans = assign
          ? (plansByAssignmentId.get(assign.id) ?? [])
          : [];

        const slots = scheduleByCode.get(subj.code) ?? [];
        const firstSlot = slots[0];
        const scheduleSummary = firstSlot
          ? `${WEEKDAY_SHORT[firstSlot.day_of_week] ?? "Clase"} ${firstSlot.start_time.slice(0, 5)}–${firstSlot.end_time.slice(0, 5)} · ${firstSlot.room_label}`
          : cs.annual_hours && cs.weekly_hours <= 0
            ? `${cs.annual_hours} h/año escolar`
            : `${cs.weekly_hours} h/semana`;

        let completedActivitiesCount = 0;
        let totalActivitiesCount = 0;
        let activeEvaluatedWeight = 0;

        const units: AulaVirtualCourseUnitItem[] = (
          momentos.length > 0
            ? momentos
            : [
                {
                  id: "m1",
                  moment_number: 1,
                  name: "I Momento Pedagógico",
                  status: "open",
                },
                {
                  id: "m2",
                  moment_number: 2,
                  name: "II Momento Pedagógico",
                  status: "scheduled",
                },
                {
                  id: "m3",
                  moment_number: 3,
                  name: "III Momento Pedagógico",
                  status: "scheduled",
                },
              ]
        ).map((mom) => {
          const plan = subjectPlans.find((p) => p.momento_id === mom.id);
          const rawItems = plan ? (itemsByPlanId.get(plan.id) ?? []) : [];
          let unitEvaluatedWeight = 0;

          const activities = rawItems.map((it) => {
            const sc = scoresByItemId.get(it.id);
            const hasScore =
              sc !== undefined &&
              (sc.numeric_score !== null || sc.literal_grade !== null);
            const scoreLabel =
              sc?.numeric_score !== null && sc?.numeric_score !== undefined
                ? `${sc.numeric_score.toFixed(1)} / ${it.max_points}`
                : sc?.literal_grade
                  ? `Literal ${sc.literal_grade}`
                  : null;

            if (hasScore) {
              unitEvaluatedWeight += Number(it.weight_percent);
            }
            if (!activeMoment || mom.id === activeMoment.id) {
              totalActivitiesCount += 1;
              if (hasScore) {
                completedActivitiesCount += 1;
                activeEvaluatedWeight += Number(it.weight_percent);
              }
            }

            if (it.scheduled_date) {
              timeline.push({
                id: it.id,
                subjectCode: subj.code,
                subjectName: subj.name,
                title: it.title,
                typeLabel:
                  EVAL_TYPE_LABELS[it.evaluation_type] ?? "Actividad Evaluativa",
                weightPercent: Number(it.weight_percent),
                scheduledDate: it.scheduled_date,
                isCompleted: hasScore,
                scoreLabel,
              });
            }

            return {
              id: it.id,
              title: it.title,
              typeLabel:
                EVAL_TYPE_LABELS[it.evaluation_type] ?? "Actividad Evaluativa",
              weightPercent: Number(it.weight_percent),
              scheduledDate: it.scheduled_date,
              scoreLabel,
              isCompleted: hasScore,
            };
          });

          return {
            id: mom.id,
            unitNumber: mom.moment_number,
            title: plan?.title
              ? `Unidad ${mom.moment_number}: ${plan.title}`
              : `Unidad ${mom.moment_number} · ${mom.name}`,
            statusLabel:
              mom.status === "open"
                ? "En curso"
                : mom.status === "closed" || mom.status === "locked"
                  ? "Cerrado"
                  : "Programado",
            evaluatedWeight: Math.min(100, Math.round(unitEvaluatedWeight)),
            activities,
          };
        });

        const fg = finalGradesMap.get(cs.id);
        const currentGradeLabel =
          fg?.final_numeric !== null && fg?.final_numeric !== undefined
            ? `${fg.final_numeric} / 20 pts`
            : fg?.final_literal
              ? `Literal ${fg.final_literal}`
              : null;

        const progressPercent =
          totalActivitiesCount > 0
            ? Math.min(100, Math.round(activeEvaluatedWeight))
            : currentGradeLabel
              ? 100
              : 0;

        return {
          curriculumSubjectId: cs.id,
          virtualCourseId: vc?.id ?? null,
          subjectCode: subj.code,
          subjectName: subj.name,
          weeklyHours: cs.weekly_hours,
          isTechnicalCore: subj.is_technical_core,
          categoryLabel: subj.is_technical_core
            ? `Especialidad ${mencionObj?.name ?? "Técnica"}`
            : "Formación General",
          gradingScale: subj.grading_scale,
          teacherName,
          sectionLabel: `${enrollment.grade_year}.º Año · Sec. ${sectionObj?.section_letter ?? "A"}`,
          scheduleSummary,
          welcomeMessage: vc?.welcome_message ?? null,
          aiTutorEnabled: vc?.ai_tutor_enabled ?? true,
          isPublished: Boolean(vc?.is_published || totalActivitiesCount > 0),
          progressPercent,
          currentGradeLabel,
          completedActivitiesCount,
          totalActivitiesCount,
          units,
        };
      })
      .filter((item): item is AulaVirtualCourseCardItem => item !== null)
      .sort((a, b) => {
        if (a.isTechnicalCore !== b.isTechnicalCore) {
          return a.isTechnicalCore ? -1 : 1;
        }
        return a.subjectName.localeCompare(b.subjectName, "es");
      });

    timeline.sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));

    return {
      roleMode: "student",
      hasEnrollmentOrAssignment: true,
      schoolYearName: schoolYearObj?.name ?? null,
      activeMomentName: activeMoment?.name ?? "I Momento Pedagógico",
      gradeYear: enrollment.grade_year,
      sectionLetter: sectionObj?.section_letter ?? null,
      mencionCode: mencionObj?.code ?? null,
      mencionName: mencionObj?.name ?? null,
      courses,
      timeline,
      labShortcut: resolveMentionLabShortcut(
        mencionObj?.code ?? null,
        mencionObj?.name ?? null
      ),
    };
  }

  // Modo Docente / Coordinación / Dirección
  const { data: teacherAssignments } = await supabase
    .from("teacher_assignments")
    .select(
      "id, curriculum_subject_id, sections(grade_year, section_letter, menciones(code, name)), curriculum_subjects(id, weekly_hours, annual_hours, display_order, subjects(code, name, grading_scale, is_technical_core))"
    )
    .eq("teacher_user_id", profile.internalUserId)
    .is("deleted_at", null)
    .returns<TeacherAssignmentRow[]>();

  const rows = teacherAssignments ?? [];
  const assignmentIds = rows.map((r) => r.id);
  const virtualCoursesMap = new Map<string, VirtualCourseRow>();

  if (assignmentIds.length > 0) {
    const { data: vcRows } = await supabase
      .from("virtual_courses")
      .select(
        "id, teacher_assignment_id, welcome_message, ai_tutor_enabled, is_published"
      )
      .in("teacher_assignment_id", assignmentIds)
      .returns<VirtualCourseRow[]>();

    for (const vc of vcRows ?? []) {
      virtualCoursesMap.set(vc.teacher_assignment_id, vc);
    }
  }

  let firstMencionCode: string | null = null;
  let firstMencionName: string | null = null;

  const courses: AulaVirtualCourseCardItem[] = rows
    .map((ta): AulaVirtualCourseCardItem | null => {
      const cs = unwrapSingle(ta.curriculum_subjects);
      const subj = unwrapSingle(cs?.subjects);
      const sec = unwrapSingle(ta.sections);
      const menc = unwrapSingle(sec?.menciones);
      if (!cs || !subj) return null;

      if (!firstMencionCode && menc?.code) {
        firstMencionCode = menc.code;
        firstMencionName = menc.name;
      }

      const vc = virtualCoursesMap.get(ta.id);
      return {
        curriculumSubjectId: cs.id,
        virtualCourseId: vc?.id ?? null,
        subjectCode: subj.code,
        subjectName: subj.name,
        weeklyHours: cs.weekly_hours,
        isTechnicalCore: subj.is_technical_core,
        categoryLabel: subj.is_technical_core
          ? `Especialidad ${menc?.name ?? "Técnica"}`
          : "Formación General",
        gradingScale: subj.grading_scale,
        teacherName: `${profile.firstName} ${profile.lastName}`,
        sectionLabel: sec
          ? `${sec.grade_year}.º Año · Sec. ${sec.section_letter}${menc ? ` · ${menc.name}` : ""}`
          : null,
        scheduleSummary:
          cs.annual_hours && cs.weekly_hours <= 0
            ? `${cs.annual_hours} h/año escolar`
            : `${cs.weekly_hours} h/semana`,
        welcomeMessage: vc?.welcome_message ?? null,
        aiTutorEnabled: vc?.ai_tutor_enabled ?? true,
        isPublished: vc?.is_published ?? false,
        progressPercent: vc?.is_published ? 100 : 0,
        currentGradeLabel: null,
        completedActivitiesCount: 0,
        totalActivitiesCount: 0,
        units: [],
      };
    })
    .filter((item): item is AulaVirtualCourseCardItem => item !== null);

  return {
    roleMode: "staff",
    hasEnrollmentOrAssignment: courses.length > 0,
    schoolYearName: null,
    activeMomentName: "Momento Activo",
    gradeYear: null,
    sectionLetter: null,
    mencionCode: firstMencionCode,
    mencionName: firstMencionName,
    courses,
    timeline: [],
    labShortcut: resolveMentionLabShortcut(firstMencionCode, firstMencionName),
  };
}

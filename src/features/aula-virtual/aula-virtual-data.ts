import type { DashboardUserProfile } from "@/lib/auth/dashboard-session";
import { getCachedAcademicCatalog } from "@/lib/db/catalog-cache";
import {
  callNeonRpcTableSafe,
  isNeonDatabaseConfigured,
  querySingleRow,
  withUserDb,
} from "@/lib/db/neon";

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
 * Carga bajo Neon PostgreSQL RLS todos los datos del campus LMS estilo Moodle:
 * cursos inscritos o asignados, unidades por Momento Pedagógico, progreso real y línea de tiempo.
 */
export async function getAulaVirtualCampusData(
  profile: DashboardUserProfile
): Promise<AulaVirtualCampusData> {
  const isStudent = profile.primaryRole === "estudiante";

  if (!isNeonDatabaseConfigured()) {
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

  const authSession = {
    authUserId: profile.authUserId,
    email: profile.authEmail,
  };

  if (isStudent) {
    const [catalog, dbBundle] = await Promise.all([
      getCachedAcademicCatalog(),
      withUserDb(authSession, async (client) => {
        const mainRow = await querySingleRow<{
          enrollment_json: EnrollmentRow | null;
          momentos_json: MomentRow[] | null;
          assignments_json: TeacherAssignmentRow[] | null;
          final_grades_json: MomentFinalGradeRow[] | null;
          virtual_courses_json: VirtualCourseRow[] | null;
          plans_json: EvalPlanRow[] | null;
          items_json: EvalItemRow[] | null;
          scores_json: StudentScoreRow[] | null;
        }>(
          client,
          `WITH cur_enr AS (
             SELECT e.id,
                    e.section_id,
                    e.grade_year,
                    e.mencion_id,
                    e.school_year_id,
                    CASE WHEN s.id IS NOT NULL THEN json_build_object('section_letter', s.section_letter) ELSE NULL END AS sections,
                    CASE WHEN m.id IS NOT NULL THEN json_build_object('code', m.code, 'name', m.name) ELSE NULL END AS menciones,
                    json_build_object('name', sy.name, 'is_current', sy.is_current) AS school_years
               FROM public.enrollments e
               JOIN public.school_years sy ON sy.id = e.school_year_id AND sy.is_current = true
               LEFT JOIN public.sections s ON s.id = e.section_id
               LEFT JOIN public.menciones m ON m.id = e.mencion_id
              WHERE e.student_user_id = $1::uuid
                AND e.deleted_at IS NULL
              ORDER BY e.created_at DESC
              LIMIT 1
           ),
           ta_list AS (
             SELECT ta.id,
                    ta.curriculum_subject_id,
                    CASE WHEN u.id IS NOT NULL THEN json_build_object('first_name', u.first_name, 'last_name', u.last_name) ELSE NULL END AS users
               FROM public.teacher_assignments ta
               JOIN cur_enr ce ON ce.school_year_id = ta.school_year_id AND ce.section_id = ta.section_id
               LEFT JOIN public.users u ON u.id = ta.teacher_user_id
              WHERE ta.is_active = true
           ),
           plan_list AS (
             SELECT ep.id, ep.teacher_assignment_id, ep.momento_id, ep.title, ep.status
               FROM public.evaluation_plans ep
               JOIN ta_list ta ON ta.id = ep.teacher_assignment_id
           ),
           item_list AS (
             SELECT ei.id, ei.evaluation_plan_id, ei.title, ei.evaluation_type, ei.weight_percent, ei.max_points, ei.scheduled_date
               FROM public.evaluation_items ei
               JOIN plan_list pl ON pl.id = ei.evaluation_plan_id
           )
           SELECT
             (SELECT row_to_json(ce) FROM cur_enr ce) AS enrollment_json,
             COALESCE((
               SELECT json_agg(m_row ORDER BY m_row.moment_number ASC)
                 FROM (
                   SELECT mo.id, mo.moment_number, mo.name, mo.status
                     FROM public.momentos mo
                     JOIN cur_enr ce ON ce.school_year_id = mo.school_year_id
                 ) m_row
             ), '[]'::json) AS momentos_json,
             COALESCE((SELECT json_agg(ta) FROM ta_list ta), '[]'::json) AS assignments_json,
             COALESCE((
               SELECT json_agg(fg_row)
                 FROM (
                   SELECT mfg.curriculum_subject_id, mfg.momento_id, mfg.final_numeric, mfg.final_literal
                     FROM public.moment_final_grades mfg
                     JOIN cur_enr ce ON ce.id = mfg.enrollment_id
                 ) fg_row
             ), '[]'::json) AS final_grades_json,
             COALESCE((
               SELECT json_agg(vc_row)
                 FROM (
                   SELECT v.id, v.teacher_assignment_id, v.welcome_message, v.ai_tutor_enabled, v.is_published
                     FROM public.virtual_courses v
                     JOIN ta_list ta ON ta.id = v.teacher_assignment_id
                 ) vc_row
             ), '[]'::json) AS virtual_courses_json,
             COALESCE((SELECT json_agg(pl) FROM plan_list pl), '[]'::json) AS plans_json,
             COALESCE((
               SELECT json_agg(il ORDER BY il.scheduled_date ASC NULLS LAST)
                 FROM item_list il
             ), '[]'::json) AS items_json,
             COALESCE((
               SELECT json_agg(sc_row)
                 FROM (
                   SELECT ss.evaluation_item_id, ss.numeric_score, ss.literal_grade
                     FROM public.student_scores ss
                     JOIN cur_enr ce ON ce.id = ss.enrollment_id
                     JOIN item_list il ON il.id = ss.evaluation_item_id
                    WHERE ss.deleted_at IS NULL
                 ) sc_row
             ), '[]'::json) AS scores_json`,
          [profile.internalUserId]
        );

        const enrollmentRow = mainRow?.enrollment_json ?? null;
        if (!enrollmentRow) {
          return {
            enrollment: null,
            momentos: [] as MomentRow[],
            assignments: [] as TeacherAssignmentRow[],
            finalGrades: [] as MomentFinalGradeRow[],
            scheduleRows: [] as ScheduleRpcRow[],
            virtualCoursesMap: new Map<string, VirtualCourseRow>(),
            plansByAssignmentId: new Map<string, EvalPlanRow[]>(),
            itemsByPlanId: new Map<string, EvalItemRow[]>(),
            scoresByItemId: new Map<string, StudentScoreRow>(),
          };
        }

        const schedRows = await callNeonRpcTableSafe<ScheduleRpcRow>(
          client,
          "siga_get_student_section_schedule"
        );

        const vcMap = new Map<string, VirtualCourseRow>();
        for (const vc of mainRow?.virtual_courses_json ?? []) {
          vcMap.set(vc.teacher_assignment_id, vc);
        }

        const plansMap = new Map<string, EvalPlanRow[]>();
        for (const p of mainRow?.plans_json ?? []) {
          const list = plansMap.get(p.teacher_assignment_id) ?? [];
          list.push(p);
          plansMap.set(p.teacher_assignment_id, list);
        }

        const itemsMap = new Map<string, EvalItemRow[]>();
        for (const item of mainRow?.items_json ?? []) {
          const list = itemsMap.get(item.evaluation_plan_id) ?? [];
          list.push(item);
          itemsMap.set(item.evaluation_plan_id, list);
        }

        const scoresMap = new Map<string, StudentScoreRow>();
        for (const sc of mainRow?.scores_json ?? []) {
          scoresMap.set(sc.evaluation_item_id, sc);
        }

        return {
          enrollment: enrollmentRow,
          momentos: mainRow?.momentos_json ?? [],
          assignments: mainRow?.assignments_json ?? [],
          finalGrades: mainRow?.final_grades_json ?? [],
          scheduleRows: schedRows,
          virtualCoursesMap: vcMap,
          plansByAssignmentId: plansMap,
          itemsByPlanId: itemsMap,
          scoresByItemId: scoresMap,
        };
      }),
    ]);

    const {
      enrollment,
      momentos,
      assignments,
      finalGrades,
      scheduleRows,
      virtualCoursesMap,
      plansByAssignmentId,
      itemsByPlanId,
      scoresByItemId,
    } = dbBundle;

    const currSubjects: CurriculumSubjectRow[] = enrollment
      ? catalog.curriculumRows
          .filter(
            (cs) =>
              cs.mencion_id === enrollment.mencion_id &&
              cs.grade_year === enrollment.grade_year
          )
          .map((cs) => ({
            id: cs.id,
            weekly_hours: cs.weekly_hours,
            annual_hours: cs.annual_hours,
            display_order: cs.display_order,
            subjects: cs.subjects,
          }))
      : [];

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

    const activeMoment =
      momentos.find((m) => m.status === "open") ?? momentos[0] ?? null;
    const currSubjectsRes = { data: currSubjects };
    const finalGradesRes = { data: finalGrades };

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

  // Modo Docente / Coordinación / Dirección (1 sola consulta CTE)
  const { rows, virtualCoursesMap } = await withUserDb(authSession, async (client) => {
    const staffRow = await querySingleRow<{
      assignments_json: TeacherAssignmentRow[] | null;
      vc_json: VirtualCourseRow[] | null;
    }>(
      client,
      `WITH ta_rows AS (
         SELECT ta.id,
                ta.curriculum_subject_id,
                CASE WHEN sec.id IS NOT NULL THEN json_build_object(
                  'grade_year', sec.grade_year,
                  'section_letter', sec.section_letter,
                  'menciones', CASE WHEN m.id IS NOT NULL THEN json_build_object('code', m.code, 'name', m.name) ELSE NULL END
                ) ELSE NULL END AS sections,
                CASE WHEN cs.id IS NOT NULL THEN json_build_object(
                  'id', cs.id,
                  'weekly_hours', cs.weekly_hours,
                  'annual_hours', cs.annual_hours,
                  'display_order', cs.display_order,
                  'subjects', json_build_object(
                    'code', subj.code,
                    'name', subj.name,
                    'grading_scale', subj.grading_scale,
                    'is_technical_core', subj.is_technical_core
                  )
                ) ELSE NULL END AS curriculum_subjects
           FROM public.teacher_assignments ta
           LEFT JOIN public.sections sec ON sec.id = ta.section_id
           LEFT JOIN public.menciones m ON m.id = sec.mencion_id
           LEFT JOIN public.curriculum_subjects cs ON cs.id = ta.curriculum_subject_id
           LEFT JOIN public.subjects subj ON subj.id = cs.subject_id
          WHERE ta.teacher_user_id = $1::uuid
            AND ta.is_active = true
       )
       SELECT
         COALESCE((SELECT json_agg(t) FROM ta_rows t), '[]'::json) AS assignments_json,
         COALESCE((
           SELECT json_agg(v_row)
             FROM (
               SELECT vc.id, vc.teacher_assignment_id, vc.welcome_message, vc.ai_tutor_enabled, vc.is_published
                 FROM public.virtual_courses vc
                 JOIN ta_rows t ON t.id = vc.teacher_assignment_id
             ) v_row
         ), '[]'::json) AS vc_json`,
      [profile.internalUserId]
    );

    const vcMap = new Map<string, VirtualCourseRow>();
    for (const vc of staffRow?.vc_json ?? []) {
      vcMap.set(vc.teacher_assignment_id, vc);
    }

    return { rows: staffRow?.assignments_json ?? [], virtualCoursesMap: vcMap };
  });

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

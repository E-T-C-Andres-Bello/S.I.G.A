import type { DashboardUserProfile } from "@/lib/auth/dashboard-session";
import { assertAuthorizedRole } from "@/lib/auth/rbac";
import {
  isNeonDatabaseConfigured,
  querySingleRow,
  withUserDb,
} from "@/lib/db/neon";
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

/**
 * Resuelve la mención autorizada para el actor actual sobre Neon (RLS).
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

  if (!isNeonDatabaseConfigured()) {
    return {
      ok: false,
      message: "El servicio de datos institucionales no está disponible.",
    };
  }

  const isFullScope =
    profile.primaryRole === "direccion" ||
    profile.primaryRole === "control_estudios";

  try {
    return await withUserDb(
      { authUserId: profile.authUserId, email: profile.authEmail },
      async (client) => {
        const mencionesRes = await client.query<MencionInfo>(
          `SELECT id, code, name, description
             FROM public.menciones
            WHERE is_active = true
            ORDER BY name ASC`
        );
        const allMenciones = mencionesRes.rows;

        if (!isFullScope) {
          const coordRole = await querySingleRow<{ mencion_id: string | null }>(
            client,
            `SELECT ur.mencion_id
               FROM public.user_roles ur
               JOIN public.roles r ON r.id = ur.role_id
              WHERE ur.user_id = $1::uuid
                AND ur.is_active = true
                AND r.code = 'coordinador_mencion'
                AND ur.mencion_id IS NOT NULL
              LIMIT 1`,
            [profile.internalUserId]
          );

          const assignedId = coordRole?.mencion_id ?? null;
          const assignedMencion =
            allMenciones.find((m) => m.id === assignedId) ?? null;

          if (!assignedMencion) {
            return {
              ok: false as const,
              message:
                "Tu perfil de coordinación no tiene una mención técnica asignada actualmente.",
            };
          }

          return {
            ok: true as const,
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
          ok: true as const,
          isScopedToSingleMencion: false,
          allowedMenciones: allMenciones,
          selectedMencion,
        };
      }
    );
  } catch {
    return {
      ok: false,
      message: "No fue posible consultar el catálogo de menciones técnicas.",
    };
  }
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

  if (!isNeonDatabaseConfigured()) {
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

  return withUserDb(
    { authUserId: profile.authUserId, email: profile.authEmail },
    async (client) => {
      const schoolYear = await querySingleRow<{ id: string; name: string }>(
        client,
        `SELECT id, name
           FROM public.school_years
          ORDER BY is_current DESC, start_date DESC
          LIMIT 1`
      );

      let activeMomento: { id: string; name: string } | null = null;
      if (schoolYear) {
        const momRes = await client.query<{
          id: string;
          name: string;
          status: string;
        }>(
          `SELECT id, name, status
             FROM public.momentos
            WHERE school_year_id = $1::uuid
            ORDER BY moment_number ASC`,
          [schoolYear.id]
        );
        activeMomento =
          momRes.rows.find((m) => m.status === "open") ??
          momRes.rows[momRes.rows.length - 1] ??
          null;
      }

      const sectionsRes = schoolYear
        ? await client.query<{
            id: string;
            grade_year: number;
            section_letter: string;
            capacity: number;
          }>(
            `SELECT id, grade_year, section_letter, capacity
               FROM public.sections
              WHERE school_year_id = $1::uuid
                AND mencion_id = $2::uuid
                AND deleted_at IS NULL
              ORDER BY grade_year ASC, section_letter ASC`,
            [schoolYear.id, selectedMencion.id]
          )
        : { rows: [] };
      const scenariosRes = await client.query<{
        id: string;
        mencion_id: string;
        grade_year: number;
        tool_type: LabToolType;
        title: string;
        instructions: string;
        is_base_catalog: boolean;
        created_at: string;
      }>(
        `SELECT id, mencion_id, grade_year, tool_type, title, instructions, is_base_catalog, created_at
           FROM public.mention_lab_scenarios
          WHERE mencion_id = $1::uuid
          ORDER BY grade_year ASC, created_at DESC`,
        [selectedMencion.id]
      );

      const rawSections = sectionsRes.rows;
      const sectionIds = rawSections.map((s) => s.id);
      const sectionMap = new Map(rawSections.map((s) => [s.id, s]));

      let enrollments: { id: string; section_id: string }[] = [];
      let assignmentsRaw: {
        id: string;
        section_id: string;
        curriculum_subject_id: string;
        teacher_user_id: string;
        teacher_first_name: string | null;
        teacher_last_name: string | null;
        subject_name: string | null;
      }[] = [];

      if (schoolYear && sectionIds.length > 0) {
        const enrRes = await client.query<{ id: string; section_id: string }>(
          `SELECT id, section_id
             FROM public.enrollments
            WHERE school_year_id = $1::uuid
              AND enrollment_status = 'active'
              AND section_id = ANY($2::uuid[])
              AND deleted_at IS NULL`,
          [schoolYear.id, sectionIds]
        );
        const assignRes = await client.query<{
          id: string;
          section_id: string;
          curriculum_subject_id: string;
          teacher_user_id: string;
          teacher_first_name: string | null;
          teacher_last_name: string | null;
          subject_name: string | null;
        }>(
          `SELECT ta.id,
                  ta.section_id,
                  ta.curriculum_subject_id,
                  ta.teacher_user_id,
                  u.first_name AS teacher_first_name,
                  u.last_name AS teacher_last_name,
                  subj.name AS subject_name
             FROM public.teacher_assignments ta
             LEFT JOIN public.users u ON u.id = ta.teacher_user_id
             LEFT JOIN public.curriculum_subjects cs ON cs.id = ta.curriculum_subject_id
             LEFT JOIN public.subjects subj ON subj.id = cs.subject_id
            WHERE ta.school_year_id = $1::uuid
              AND ta.is_active = true
              AND ta.section_id = ANY($2::uuid[])`,
          [schoolYear.id, sectionIds]
        );

        enrollments = enrRes.rows;
        assignmentsRaw = assignRes.rows;
      }

      const assignmentIds = assignmentsRaw.map((a) => a.id);
      const teacherIds = Array.from(
        new Set(assignmentsRaw.map((a) => a.teacher_user_id))
      );
      const enrollmentIds = enrollments.map((e) => e.id);

      const plansRes =
        activeMomento && assignmentIds.length > 0
          ? await client.query<{ teacher_assignment_id: string; status: string }>(
              `SELECT teacher_assignment_id, status
                 FROM public.evaluation_plans
                WHERE momento_id = $1::uuid
                  AND teacher_assignment_id = ANY($2::uuid[])`,
              [activeMomento.id, assignmentIds]
            )
          : { rows: [] };
      const gradesRes =
        activeMomento && enrollmentIds.length > 0
          ? await client.query<{ enrollment_id: string; curriculum_subject_id: string }>(
              `SELECT enrollment_id, curriculum_subject_id
                 FROM public.moment_final_grades
                WHERE momento_id = $1::uuid
                  AND enrollment_id = ANY($2::uuid[])`,
              [activeMomento.id, enrollmentIds.slice(0, 500)]
            )
          : { rows: [] };
      const absencesRes =
        teacherIds.length > 0
          ? await client.query<{
              id: string;
              teacher_user_id: string;
              absence_date: string;
              reason_category: "medical" | "personal" | "institutional";
              observation: string | null;
              status: "reported" | "acknowledged" | "reorganized";
              created_at: string;
              first_name: string | null;
              last_name: string | null;
            }>(
              `SELECT ab.id,
                      ab.teacher_user_id,
                      ab.absence_date,
                      ab.reason_category,
                      ab.observation,
                      ab.status,
                      ab.created_at,
                      u.first_name,
                      u.last_name
                 FROM public.teacher_absences ab
                 LEFT JOIN public.users u ON u.id = ab.teacher_user_id
                WHERE ab.teacher_user_id = ANY($1::uuid[])
                ORDER BY ab.absence_date DESC
                LIMIT 30`,
              [teacherIds]
            )
          : { rows: [] };
      const diaryRes =
        assignmentIds.length > 0
          ? await client.query<{
              id: string;
              teacher_assignment_id: string;
              entry_date: string;
              topic_covered: string;
              classroom_incidents: string | null;
              derive_to_orientation: boolean;
              first_name: string | null;
              last_name: string | null;
            }>(
              `SELECT d.id,
                      d.teacher_assignment_id,
                      d.entry_date,
                      d.topic_covered,
                      d.classroom_incidents,
                      d.derive_to_orientation,
                      u.first_name,
                      u.last_name
                 FROM public.class_diary_entries d
                 LEFT JOIN public.users u ON u.id = d.author_user_id
                WHERE d.teacher_assignment_id = ANY($1::uuid[])
                ORDER BY d.entry_date DESC
                LIMIT 30`,
              [assignmentIds]
            )
          : { rows: [] };

      const evalPlanMap = new Map(
        plansRes.rows.map((p) => [p.teacher_assignment_id, p.status])
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
        const secEnrollIds = enrollmentsBySection.get(ta.section_id) ?? new Set();
        const gradedCount = gradesRes.rows.filter(
          (g) =>
            secEnrollIds.has(g.enrollment_id) &&
            g.curriculum_subject_id === ta.curriculum_subject_id
        ).length;

        const item: MencionAssignmentOverview = {
          assignmentId: ta.id,
          teacherName:
            ta.teacher_first_name && ta.teacher_last_name
              ? `${ta.teacher_first_name} ${ta.teacher_last_name}`
              : "Docente asignado",
          subjectName: ta.subject_name ?? "Asignatura",
          gradeYear: sec?.grade_year ?? 1,
          sectionLetter: sec?.section_letter ?? "A",
          planStatus: evalPlanMap.get(ta.id) ?? "missing",
          enrolledCount: secEnrollIds.size,
          gradedCount,
        };
        assignmentsMap.set(ta.id, item);
        return item;
      });

      const scenarios: MencionLabScenarioItem[] = scenariosRes.rows.map((sc) => ({
        id: sc.id,
        mencionId: sc.mencion_id,
        gradeYear: sc.grade_year,
        toolType: sc.tool_type,
        title: sc.title,
        instructions: sc.instructions,
        isBaseCatalog: sc.is_base_catalog,
        createdAt: sc.created_at,
      }));

      const teacherAbsences: MencionTeacherAbsenceItem[] = absencesRes.rows.map((ab) => ({
        id: ab.id,
        teacherUserId: ab.teacher_user_id,
        teacherName:
          ab.first_name && ab.last_name
            ? `${ab.first_name} ${ab.last_name}`
            : "Docente",
        absenceDate: ab.absence_date,
        reasonCategory: ab.reason_category,
        observation: ab.observation,
        status: ab.status,
        createdAt: ab.created_at,
      }));

      const diaryIncidents: MencionDiaryIncidentItem[] = diaryRes.rows
        .filter(
          (d) =>
            (d.classroom_incidents && d.classroom_incidents.trim().length > 0) ||
            d.derive_to_orientation
        )
        .map((d) => {
          const assign = assignmentsMap.get(d.teacher_assignment_id);
          return {
            id: d.id,
            entryDate: d.entry_date,
            teacherName:
              d.first_name && d.last_name
                ? `${d.first_name} ${d.last_name}`
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
        ok: true as const,
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
  );
}

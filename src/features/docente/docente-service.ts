import { getAuthenticatedDashboardContext } from "@/lib/auth/dashboard-session";
import { isNeonDatabaseConfigured, withUserDb } from "@/lib/db/neon";
import type {
  ClassDiaryEntryDto,
  MomentoOption,
  SectionStudentItem,
  TeacherAbsenceDto,
  TeacherSectionAssignment,
} from "./types";

interface AssignmentFlatRow {
  id: string;
  school_year_id: string;
  section_id: string;
  grade_year: number;
  section_letter: string;
  mencion_name: string | null;
  mencion_code: string | null;
  subject_id: string;
  subject_code: string;
  subject_name: string;
  grading_scale: string;
  school_year_code: string;
}

/**
 * Consulta todas las asignaturas y secciones activas asignadas al docente autenticado (Neon + RLS).
 */
export async function getTeacherAssignments(): Promise<TeacherSectionAssignment[]> {
  const profile = await getAuthenticatedDashboardContext();
  if (!isNeonDatabaseConfigured()) return [];

  try {
    const rows = await withUserDb(
      { authUserId: profile.authUserId, email: profile.authEmail },
      async (client) => {
        const res = await client.query<AssignmentFlatRow>(
          `SELECT ta.id,
                  ta.school_year_id,
                  ta.section_id,
                  sec.grade_year,
                  sec.section_letter,
                  m.name AS mencion_name,
                  m.code AS mencion_code,
                  subj.id AS subject_id,
                  subj.code AS subject_code,
                  subj.name AS subject_name,
                  subj.grading_scale,
                  sy.code AS school_year_code
             FROM public.teacher_assignments ta
             JOIN public.school_years sy ON sy.id = ta.school_year_id AND sy.is_current = true
             JOIN public.sections sec ON sec.id = ta.section_id
             JOIN public.curriculum_subjects cs ON cs.id = ta.curriculum_subject_id
             JOIN public.subjects subj ON subj.id = cs.subject_id
             LEFT JOIN public.menciones m ON m.id = sec.mencion_id
            WHERE ta.teacher_user_id = $1::uuid
              AND ta.is_active = true`,
          [profile.internalUserId]
        );
        return res.rows;
      }
    );

    return rows.map((row) => {
      const sectionFullName = `${row.grade_year}.º Año "${row.section_letter}"${
        row.mencion_name ? ` · ${row.mencion_name}` : ""
      }`;

      return {
        assignmentId: row.id,
        sectionId: row.section_id,
        sectionFullName,
        gradeYear: row.grade_year,
        sectionLetter: row.section_letter,
        subjectId: row.subject_id,
        subjectName: row.subject_name,
        subjectCode: row.subject_code,
        gradingScale: row.grading_scale,
        mencionName: row.mencion_name,
        mencionCode: row.mencion_code,
        schoolYearId: row.school_year_id,
        schoolYearCode: row.school_year_code,
      };
    });
  } catch (error) {
    console.warn("Aviso al consultar asignaciones del docente:", error);
    return [];
  }
}

/**
 * Consulta los Momentos Pedagógicos del año escolar vigente.
 */
export async function getActiveMomentos(schoolYearId: string): Promise<MomentoOption[]> {
  const profile = await getAuthenticatedDashboardContext();
  if (!isNeonDatabaseConfigured() || !schoolYearId) return [];

  try {
    const rows = await withUserDb(
      { authUserId: profile.authUserId, email: profile.authEmail },
      async (client) => {
        const res = await client.query<{
          id: string;
          moment_number: number;
          name: string;
          status: string;
          start_date: string | null;
          end_date: string | null;
        }>(
          `SELECT id, moment_number, name, status, start_date, end_date
             FROM public.momentos
            WHERE school_year_id = $1::uuid
            ORDER BY moment_number ASC`,
          [schoolYearId]
        );
        return res.rows;
      }
    );

    return rows.map((m) => ({
      id: m.id,
      number: m.moment_number,
      name: m.name,
      status: m.status as MomentoOption["status"],
      startDate: m.start_date,
      endDate: m.end_date,
    }));
  } catch (error) {
    console.warn("Aviso al consultar momentos pedagógicos:", error);
    return [];
  }
}

/**
 * Consulta la nómina de estudiantes matriculados en una sección para el pase de asistencia.
 */
export async function getSectionStudents(sectionId: string): Promise<SectionStudentItem[]> {
  const profile = await getAuthenticatedDashboardContext();
  if (!isNeonDatabaseConfigured() || !sectionId) return [];

  try {
    const rows = await withUserDb(
      { authUserId: profile.authUserId, email: profile.authEmail },
      async (client) => {
        const res = await client.query<{
          id: string;
          student_user_id: string;
          first_name: string;
          last_name: string;
          cedula: string;
          avatar_webp_url: string | null;
        }>(
          `SELECT e.id,
                  e.student_user_id,
                  u.first_name,
                  u.last_name,
                  u.cedula,
                  u.avatar_webp_url
             FROM public.enrollments e
             JOIN public.users u ON u.id = e.student_user_id
            WHERE e.section_id = $1::uuid
              AND e.enrollment_status = 'active'
              AND e.deleted_at IS NULL`,
          [sectionId]
        );
        return res.rows;
      }
    );

    return rows
      .map((r) => ({
        enrollmentId: r.id,
        studentUserId: r.student_user_id,
        firstName: r.first_name,
        lastName: r.last_name,
        cedula: r.cedula,
        avatarWebpUrl: r.avatar_webp_url,
        status: "present" as const,
      }))
      .sort((a, b) => a.lastName.localeCompare(b.lastName, "es"));
  } catch (error) {
    console.warn("Aviso al consultar estudiantes de la sección:", error);
    return [];
  }
}

/**
 * Consulta las últimas anotaciones del diario de clases de la asignatura.
 */
export async function getClassDiaryEntries(teacherAssignmentId: string): Promise<ClassDiaryEntryDto[]> {
  const profile = await getAuthenticatedDashboardContext();
  if (!isNeonDatabaseConfigured() || !teacherAssignmentId) return [];

  try {
    const rows = await withUserDb(
      { authUserId: profile.authUserId, email: profile.authEmail },
      async (client) => {
        const res = await client.query<{
          id: string;
          teacher_assignment_id: string;
          entry_date: string;
          topic_covered: string;
          classroom_incidents: string | null;
          derive_to_orientation: boolean;
          created_at: string;
        }>(
          `SELECT id, teacher_assignment_id, entry_date, topic_covered, classroom_incidents, derive_to_orientation, created_at
             FROM public.class_diary_entries
            WHERE teacher_assignment_id = $1::uuid
            ORDER BY entry_date DESC
            LIMIT 10`,
          [teacherAssignmentId]
        );
        return res.rows;
      }
    );

    return rows.map((d) => ({
      id: d.id,
      teacherAssignmentId: d.teacher_assignment_id,
      entryDate: d.entry_date,
      topicCovered: d.topic_covered,
      classroomIncidents: d.classroom_incidents,
      deriveToOrientation: d.derive_to_orientation,
      createdAt: d.created_at,
    }));
  } catch {
    return [];
  }
}

/**
 * Consulta los avisos de inasistencia docente reportados por el profesor actual.
 */
export async function getTeacherAbsences(): Promise<TeacherAbsenceDto[]> {
  const profile = await getAuthenticatedDashboardContext();
  if (!isNeonDatabaseConfigured()) return [];

  try {
    const rows = await withUserDb(
      { authUserId: profile.authUserId, email: profile.authEmail },
      async (client) => {
        const res = await client.query<{
          id: string;
          absence_date: string;
          reason_category: string;
          observation: string | null;
          affected_blocks: unknown;
          status: string;
          created_at: string;
        }>(
          `SELECT id, absence_date, reason_category, observation, affected_blocks, status, created_at
             FROM public.teacher_absences
            WHERE teacher_user_id = $1::uuid
            ORDER BY absence_date DESC
            LIMIT 15`,
          [profile.internalUserId]
        );
        return res.rows;
      }
    );

    return rows.map((a) => ({
      id: a.id,
      absenceDate: a.absence_date,
      reasonCategory: a.reason_category as TeacherAbsenceDto["reasonCategory"],
      observation: a.observation,
      affectedBlocks: Array.isArray(a.affected_blocks) ? (a.affected_blocks as string[]) : [],
      status: a.status as TeacherAbsenceDto["status"],
      createdAt: a.created_at,
    }));
  } catch {
    return [];
  }
}

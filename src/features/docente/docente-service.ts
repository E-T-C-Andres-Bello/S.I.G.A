import { getAuthenticatedDashboardContext } from "@/lib/supabase/dashboard-session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  ClassDiaryEntryDto,
  MomentoOption,
  SectionStudentItem,
  TeacherAbsenceDto,
  TeacherSectionAssignment,
} from "./types";

interface AssignmentRow {
  id: string;
  school_year_id: string;
  section_id: string;
  curriculum_subject_id: string;
  sections: {
    id: string;
    grade_year: number;
    section_letter: string;
    menciones: {
      name: string;
      code: string;
    } | null;
  } | null;
  curriculum_subjects: {
    id: string;
    subjects: {
      id: string;
      code: string;
      name: string;
      grading_scale: string;
    } | null;
  } | null;
  school_years: {
    id: string;
    code: string;
    is_current: boolean;
  } | null;
}

/**
 * Consulta todas las asignaturas y secciones activas asignadas al docente autenticado.
 */
export async function getTeacherAssignments(): Promise<TeacherSectionAssignment[]> {
  const profile = await getAuthenticatedDashboardContext();
  const supabase = await createServerSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("teacher_assignments")
    .select(`
      id,
      school_year_id,
      section_id,
      curriculum_subject_id,
      sections (
        id,
        grade_year,
        section_letter,
        menciones (
          name,
          code
        )
      ),
      curriculum_subjects (
        id,
        subjects (
          id,
          code,
          name,
          grading_scale
        )
      ),
      school_years (
        id,
        code,
        is_current
      )
    `)
    .eq("teacher_user_id", profile.internalUserId)
    .eq("is_active", true);

  if (error || !data) {
    console.warn("Aviso al consultar asignaciones del docente:", error?.message);
    return [];
  }

  const typedRows = data as unknown as AssignmentRow[];

  return typedRows
    .filter((row) => row.school_years?.is_current && row.sections && row.curriculum_subjects?.subjects)
    .map((row) => {
      const sec = row.sections!;
      const sub = row.curriculum_subjects!.subjects!;
      const mencion = sec.menciones?.name ?? null;
      const sectionFullName = `${sec.grade_year}.º Año "${sec.section_letter}"${
        mencion ? ` · ${mencion}` : ""
      }`;

      return {
        assignmentId: row.id,
        sectionId: row.section_id,
        sectionFullName,
        gradeYear: sec.grade_year,
        sectionLetter: sec.section_letter,
        subjectId: sub.id,
        subjectName: sub.name,
        subjectCode: sub.code,
        gradingScale: sub.grading_scale,
        mencionName: mencion,
        mencionCode: sec.menciones?.code ?? null,
        schoolYearId: row.school_year_id,
        schoolYearCode: row.school_years?.code ?? "",
      };
    });
}

/**
 * Consulta los Momentos Pedagógicos del año escolar vigente.
 */
export async function getActiveMomentos(schoolYearId: string): Promise<MomentoOption[]> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("momentos")
    .select("id, moment_number, name, status, start_date, end_date")
    .eq("school_year_id", schoolYearId)
    .order("moment_number", { ascending: true });

  if (error || !data) {
    console.warn("Aviso al consultar momentos pedagógicos:", error?.message);
    return [];
  }

  return data.map((m) => ({
    id: m.id,
    number: m.moment_number,
    name: m.name,
    status: m.status as MomentoOption["status"],
    startDate: m.start_date,
    endDate: m.end_date,
  }));
}

/**
 * Consulta la nómina de estudiantes matriculados en una sección para el pase de asistencia.
 */
export async function getSectionStudents(sectionId: string): Promise<SectionStudentItem[]> {
  const supabase = await createServerSupabaseClient();
  if (!supabase || !sectionId) return [];

  const { data, error } = await supabase
    .from("enrollments")
    .select(`
      id,
      student_user_id,
      users (
        id,
        first_name,
        last_name,
        cedula,
        avatar_webp_url
      )
    `)
    .eq("section_id", sectionId)
    .eq("enrollment_status", "active")
    .is("deleted_at", null);

  if (error || !data) {
    console.warn("Aviso al consultar estudiantes de la sección:", error?.message);
    return [];
  }

  type EnrollmentRow = {
    id: string;
    student_user_id: string;
    users: {
      id: string;
      first_name: string;
      last_name: string;
      cedula: string;
      avatar_webp_url: string | null;
    } | null;
  };

  const rows = data as unknown as EnrollmentRow[];

  return rows
    .filter((r) => r.users)
    .map((r) => ({
      enrollmentId: r.id,
      studentUserId: r.student_user_id,
      firstName: r.users!.first_name,
      lastName: r.users!.last_name,
      cedula: r.users!.cedula,
      avatarWebpUrl: r.users!.avatar_webp_url,
      status: "present" as const,
    }))
    .sort((a, b) => a.lastName.localeCompare(b.lastName, "es"));
}

/**
 * Consulta las últimas anotaciones del diario de clases de la asignatura.
 */
export async function getClassDiaryEntries(teacherAssignmentId: string): Promise<ClassDiaryEntryDto[]> {
  const supabase = await createServerSupabaseClient();
  if (!supabase || !teacherAssignmentId) return [];

  const { data, error } = await supabase
    .from("class_diary_entries")
    .select("id, teacher_assignment_id, entry_date, topic_covered, classroom_incidents, derive_to_orientation, created_at")
    .eq("teacher_assignment_id", teacherAssignmentId)
    .order("entry_date", { ascending: false })
    .limit(10);

  if (error || !data) {
    return [];
  }

  return data.map((d) => ({
    id: d.id,
    teacherAssignmentId: d.teacher_assignment_id,
    entryDate: d.entry_date,
    topicCovered: d.topic_covered,
    classroomIncidents: d.classroom_incidents,
    deriveToOrientation: d.derive_to_orientation,
    createdAt: d.created_at,
  }));
}

/**
 * Consulta los avisos de inasistencia docente reportados por el profesor actual.
 */
export async function getTeacherAbsences(): Promise<TeacherAbsenceDto[]> {
  const profile = await getAuthenticatedDashboardContext();
  const supabase = await createServerSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("teacher_absences")
    .select("id, absence_date, reason_category, observation, affected_blocks, status, created_at")
    .eq("teacher_user_id", profile.internalUserId)
    .order("absence_date", { ascending: false })
    .limit(15);

  if (error || !data) {
    return [];
  }

  return data.map((a) => ({
    id: a.id,
    absenceDate: a.absence_date,
    reasonCategory: a.reason_category as TeacherAbsenceDto["reasonCategory"],
    observation: a.observation,
    affectedBlocks: Array.isArray(a.affected_blocks) ? (a.affected_blocks as string[]) : [],
    status: a.status as TeacherAbsenceDto["status"],
    createdAt: a.created_at,
  }));
}

export type EvaluationType =
  | "exam_online"
  | "assignment_lms"
  | "lab_mention"
  | "classroom_activity"
  | "project";

export const EVALUATION_TYPE_LABELS: Record<EvaluationType, string> = {
  exam_online: "Examen Online (Aula Virtual)",
  assignment_lms: "Entrega de Tarea / Guía",
  lab_mention: "Práctica de Especialidad (Lab)",
  classroom_activity: "Actividad Presencial en Aula",
  project: "Proyecto / Exposición",
};

export interface TeacherSectionAssignment {
  assignmentId: string;
  sectionId: string;
  sectionFullName: string;
  gradeYear: number;
  sectionLetter: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  gradingScale: string;
  mencionName: string | null;
  mencionCode: string | null;
  schoolYearId: string;
  schoolYearCode: string;
}

export interface MomentoOption {
  id: string;
  number: number;
  name: string;
  status: "scheduled" | "open" | "locked" | "closed";
  startDate: string | null;
  endDate: string | null;
}

export interface EvaluationItemDto {
  id?: string;
  title: string;
  evaluationType: EvaluationType;
  weightPercent: number;
  maxPoints: number;
  scheduledDate: string | null;
}

export interface EvaluationPlanDto {
  id?: string;
  teacherAssignmentId: string;
  momentoId: string;
  title: string;
  planningAiNotes: string | null;
  status: "draft" | "published" | "locked";
  items: EvaluationItemDto[];
  totalWeight: number;
}

export type AttendanceRecordStatus = "present" | "absent" | "late" | "justified";

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceRecordStatus, string> = {
  present: "Presente",
  absent: "Ausente",
  late: "Tardanza",
  justified: "Justificada",
};

export interface SectionStudentItem {
  enrollmentId: string;
  studentUserId: string;
  firstName: string;
  lastName: string;
  cedula: string;
  avatarWebpUrl: string | null;
  status: AttendanceRecordStatus;
  note?: string;
}

export interface ClassDiaryEntryDto {
  id: string;
  teacherAssignmentId: string;
  entryDate: string;
  topicCovered: string;
  classroomIncidents: string | null;
  deriveToOrientation: boolean;
  createdAt: string;
}

export interface TeacherAbsenceDto {
  id: string;
  absenceDate: string;
  reasonCategory: "medical" | "personal" | "institutional";
  observation: string | null;
  status: "reported" | "acknowledged" | "reorganized";
  affectedBlocks: string[];
  createdAt: string;
}

import { z } from "zod";

export const LAB_TOOL_TYPES = [
  "telematica_sql",
  "telematica_network",
  "telematica_support_log",
  "aduanas_tariff",
  "aduanas_cif_fob",
  "aduanas_documentary",
  "turismo_routes",
  "turismo_events",
  "turismo_reception",
] as const;

export type LabToolType = (typeof LAB_TOOL_TYPES)[number];

export const LAB_TOOL_TYPE_LABELS: Record<LabToolType, string> = {
  telematica_sql: "Telemática · Laboratorio SQL",
  telematica_network: "Telemática · Redes e IP",
  telematica_support_log: "Telemática · Bitácora de Soporte TI",
  aduanas_tariff: "Aduanas · Clasificación Arancelaria",
  aduanas_cif_fob: "Aduanas · Cálculo CIF / FOB",
  aduanas_documentary: "Aduanas · Documentación B/L",
  turismo_routes: "Turismo · Rutas Guayana",
  turismo_events: "Turismo · Gestión de Eventos",
  turismo_reception: "Turismo · Recepción Hotelera",
};

export const createScenarioSchema = z.object({
  mencionId: z.string().uuid(),
  gradeYear: z.number().int().min(1).max(6),
  toolType: z.enum(LAB_TOOL_TYPES),
  title: z.string().trim().min(4, "El título debe tener al menos 4 caracteres.").max(140),
  instructions: z
    .string()
    .trim()
    .min(10, "Las instrucciones deben tener al menos 10 caracteres.")
    .max(2000),
  isBaseCatalog: z.boolean().default(true),
});

export type CreateScenarioInput = z.infer<typeof createScenarioSchema>;

export const toggleScenarioCatalogSchema = z.object({
  isBaseCatalog: z.boolean(),
});

export const updateTeacherAbsenceSchema = z.object({
  status: z.enum(["reported", "acknowledged", "reorganized"]),
  observation: z.string().trim().max(500).optional(),
});

export interface MencionInfo {
  id: string;
  code: string;
  name: string;
  description: string | null;
}

export interface MencionSectionOverview {
  sectionId: string;
  gradeYear: number;
  sectionLetter: string;
  capacity: number;
  enrolledCount: number;
}

export interface MencionAssignmentOverview {
  assignmentId: string;
  teacherName: string;
  subjectName: string;
  gradeYear: number;
  sectionLetter: string;
  planStatus: string;
  enrolledCount: number;
  gradedCount: number;
}

export interface MencionLabScenarioItem {
  id: string;
  mencionId: string;
  gradeYear: number;
  toolType: LabToolType;
  title: string;
  instructions: string;
  isBaseCatalog: boolean;
  createdAt: string;
}

export interface MencionTeacherAbsenceItem {
  id: string;
  teacherUserId: string;
  teacherName: string;
  absenceDate: string;
  reasonCategory: "medical" | "personal" | "institutional";
  observation: string | null;
  status: "reported" | "acknowledged" | "reorganized";
  createdAt: string;
}

export interface MencionDiaryIncidentItem {
  id: string;
  entryDate: string;
  teacherName: string;
  subjectName: string;
  gradeYear: number;
  sectionLetter: string;
  topicCovered: string;
  classroomIncidents: string | null;
  deriveToOrientation: boolean;
}

export interface MencionCoordinationData {
  activeSchoolYearName: string | null;
  activeMomentoName: string | null;
  isScopedToSingleMencion: boolean;
  allowedMenciones: MencionInfo[];
  selectedMencion: MencionInfo | null;
  summary: {
    totalSections: number;
    enrolledStudents: number;
    activeAssignments: number;
    baseScenariosCount: number;
    openAbsencesCount: number;
    incidentsCount: number;
  };
  sections: MencionSectionOverview[];
  assignments: MencionAssignmentOverview[];
  scenarios: MencionLabScenarioItem[];
  teacherAbsences: MencionTeacherAbsenceItem[];
  diaryIncidents: MencionDiaryIncidentItem[];
}


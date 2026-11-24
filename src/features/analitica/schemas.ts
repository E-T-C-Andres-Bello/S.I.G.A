import { z } from "zod";

export const analyticsQueryKeySchema = z.enum([
  "overview",
  "sla_metrics",
  "materias_filtro",
  "riesgo_temprano",
  "reporte_cdce",
]);

export type AnalyticsQueryKey = z.infer<typeof analyticsQueryKeySchema>;

export const analyticsFilterSchema = z.object({
  schoolYearId: z.string().uuid().nullable().optional(),
  momentoNumber: z.union([z.literal(1), z.literal(2), z.literal(3)]).nullable().optional(),
});

export type AnalyticsFilterInput = z.infer<typeof analyticsFilterSchema>;

export interface AnalyticsSchoolYearOption {
  id: string;
  code: string;
  name: string;
  status: string;
  isCurrent: boolean;
}

export interface AnalyticsMencionOption {
  id: string;
  code: string;
  name: string;
}

export interface AnalyticsActiveMomento {
  id: string;
  momentNumber: 1 | 2 | 3;
  name: string;
  status: string;
  startDate: string;
  endDate: string;
  gradeEntryCloseAt: string | null;
}

export interface AnalyticsExecutiveSummary {
  activeStudents: number;
  totalSections: number;
  totalAssignments: number;
  attendanceRatePct: number | null;
  passingRatePct: number | null;
  pendingRequests: number;
}

export interface TeacherSlaItem {
  assignmentId: string;
  teacherName: string;
  subjectName: string;
  subjectCode: string;
  mencionId: string;
  mencionName: string;
  gradeYear: number;
  sectionLetter: string;
  enrolledCount: number;
  gradedCount: number;
  planStatus: "draft" | "published" | "locked" | "missing" | string;
  completionPct: number;
  slaStatus: "on_track" | "warning" | "critical";
}

export interface SecretariatSlaMetrics {
  totalRequests: number;
  pendingCount: number;
  inReviewCount: number;
  approvedCount: number;
  deliveredCount: number;
  rejectedCount: number;
  avgResolutionHours: number | null;
  oldestPendingHours: number | null;
  officialDocumentsIssued: number;
}

export interface SectionSaturationItem {
  sectionId: string;
  mencionId: string;
  mencionName: string;
  gradeYear: number;
  sectionLetter: string;
  capacity: number;
  enrolledCount: number;
  preEnrolledCount: number;
  occupancyPct: number;
  saturationStatus: "normal" | "high" | "saturated";
}

export interface FilterSubjectItem {
  curriculumSubjectId: string;
  subjectCode: string;
  subjectName: string;
  mencionId: string;
  mencionName: string;
  gradeYear: number;
  totalGraded: number;
  failedCount: number;
  failureRatePct: number;
  avgNumeric: number | null;
  pendingStudents: number;
}

export interface StudentRiskAlertItem {
  studentUserId: string;
  fullName: string;
  cedulaLast4: string;
  mencionId: string;
  mencionName: string;
  gradeYear: number;
  sectionLetter: string;
  absenceRatePct: number;
  failedSubjects: number;
  pendingCount: number;
  avgGrade: number | null;
  riskScore: number;
  riskLevel: "high" | "medium";
}

export interface CdceMatrixRow {
  mencionId: string;
  mencionCode: string;
  mencionName: string;
  gradeYear: number;
  totalSections: number;
  activeStudents: number;
  preEnrolledStudents: number;
  withdrawnStudents: number;
  promotedStudents: number;
  avgGrade: number | null;
  attendancePct: number | null;
}

export interface AnalyticsBiOverview {
  source: "neon_vault" | "neon_oltp";
  scopedMencionId: string | null;
  schoolYears: AnalyticsSchoolYearOption[];
  menciones: AnalyticsMencionOption[];
  activeSchoolYear: AnalyticsSchoolYearOption | null;
  activeMomento: AnalyticsActiveMomento | null;
  summary: AnalyticsExecutiveSummary;
  teacherSla: TeacherSlaItem[];
  secretariatSla: SecretariatSlaMetrics;
  sectionSaturation: SectionSaturationItem[];
  filterSubjects: FilterSubjectItem[];
  riskAlerts: StudentRiskAlertItem[];
  cdceMatrix: CdceMatrixRow[];
  generatedAt: string;
}


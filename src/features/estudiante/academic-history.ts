import { computeMppeFinalNumeric } from "./grade-simulator";
import type { PendingSubjectAttemptSummary } from "./dashboard-data";

export type AcademicHistorySubjectStatus =
  | "approved"
  | "in_progress"
  | "needs_improvement"
  | "pending_recovery"
  | "ungraded";

export interface AcademicHistoryMomentValue {
  numeric: number | null;
  literal: string | null;
  isLocked: boolean;
}

export interface AcademicHistorySubjectRow {
  curriculumSubjectId: string;
  subjectCode: string;
  subjectName: string;
  weeklyHours: number;
  annualHours: number | null;
  displayOrder: number;
  gradingScale: "NUMERIC_1_20" | "LITERAL_A_E";
  passingThreshold: number;
  isTechnicalCore: boolean;
  moment1: AcademicHistoryMomentValue | null;
  moment2: AcademicHistoryMomentValue | null;
  moment3: AcademicHistoryMomentValue | null;
  gradedMomentsCount: number;
  definitiveNumeric: number | null;
  definitiveLiteral: string | null;
  isDefinitiveFinal: boolean;
  recoveredViaPending: boolean;
  recoveryNumeric: number | null;
  isPassing: boolean;
  status: AcademicHistorySubjectStatus;
}

export interface AcademicHistoryPeriod {
  enrollmentId: string;
  schoolYearId: string;
  schoolYearCode: string;
  schoolYearName: string;
  startDate: string | null;
  isCurrent: boolean;
  gradeYear: number;
  sectionLetter: string | null;
  mencionCode: string | null;
  mencionName: string | null;
  mencionSpecialty: string | null;
  enrollmentStatus: string;
  enrollmentStatusLabel: string;
  periodAverage: number | null;
  gradedNumericSubjectsCount: number;
  passedCount: number;
  totalSubjects: number;
  subjects: AcademicHistorySubjectRow[];
}

export interface StudentAcademicHistorySummary {
  overallCumulativeAverage: number | null;
  overallEvaluatedNumericCount: number;
  currentYearAverage: number | null;
  currentYearLabel: string | null;
  totalApprovedSubjectsCount: number;
  totalTrackedSubjectsCount: number;
  pendingRecoveryCount: number;
  periods: AcademicHistoryPeriod[];
  pendingAttempts: PendingSubjectAttemptSummary[];
}

export interface AcademicHistoryEnrollmentInput {
  enrollmentId: string;
  schoolYearId: string;
  schoolYearCode: string;
  schoolYearName: string;
  startDate: string | null;
  isCurrent: boolean;
  gradeYear: number;
  sectionLetter: string | null;
  mencionId: string;
  mencionCode: string | null;
  mencionName: string | null;
  mencionSpecialty: string | null;
  enrollmentStatus: string;
}

export interface AcademicHistoryCurriculumSubjectInput {
  curriculumSubjectId: string;
  mencionId: string;
  gradeYear: number;
  subjectCode: string;
  subjectName: string;
  weeklyHours: number;
  annualHours: number | null;
  displayOrder: number;
  gradingScale: "NUMERIC_1_20" | "LITERAL_A_E";
  passingThreshold: number;
  isTechnicalCore: boolean;
}

export interface AcademicHistoryMomentGradeInput {
  enrollmentId: string;
  curriculumSubjectId: string;
  momentNumber: number;
  finalNumeric: number | null;
  finalLiteral: string | null;
  isLocked: boolean;
}

export interface AcademicHistoryPendingAttemptInput {
  id: string;
  curriculumSubjectId: string;
  subjectCode: string;
  subjectName: string;
  attemptNumber: number;
  examDate: string;
  finalNumeric: number;
  passed: boolean;
}

const PASSING_LITERALS = new Set(["A", "B", "C", "D"]);

export function formatEnrollmentStatusLabel(
  enrollmentStatus: string,
  isCurrent: boolean
): string {
  if (isCurrent) return "Actual";
  switch (enrollmentStatus) {
    case "promoted":
      return "Promovido";
    case "graduated":
      return "Egresado";
    case "repeating":
      return "Repitiente";
    case "withdrawn":
      return "Retirado";
    case "active":
      return "Cursado";
    default:
      return "Finalizado";
  }
}

export function getHistorySubjectStatusLabel(
  status: AcademicHistorySubjectStatus
): string {
  switch (status) {
    case "approved":
      return "Aprobada";
    case "in_progress":
      return "En curso";
    case "needs_improvement":
      return "Por mejorar";
    case "pending_recovery":
      return "Pendiente";
    default:
      return "Sin notas";
  }
}

export function formatPromedioDisplay(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return value.toFixed(2);
}

function roundAverage(values: number[]): number | null {
  if (values.length === 0) return null;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  return Math.round((mean + Number.EPSILON) * 100) / 100;
}

/**
 * Construye el historial académico real y el promedio general acumulado del estudiante
 * sin inventar notas ni duplicar áreas entre períodos.
 */
export function buildStudentAcademicHistory(params: {
  enrollments: AcademicHistoryEnrollmentInput[];
  curriculumSubjects: AcademicHistoryCurriculumSubjectInput[];
  momentGrades: AcademicHistoryMomentGradeInput[];
  pendingAttempts: AcademicHistoryPendingAttemptInput[];
}): StudentAcademicHistorySummary {
  const curriculumById = new Map<string, AcademicHistoryCurriculumSubjectInput>();
  for (const cs of params.curriculumSubjects) {
    curriculumById.set(cs.curriculumSubjectId, cs);
  }

  // Indexar notas por enrollmentId -> curriculumSubjectId -> momentNumber
  const gradesByEnrollmentSubject = new Map<
    string,
    Map<number, AcademicHistoryMomentValue>
  >();
  const gradedSubjectIdsByEnrollment = new Map<string, Set<string>>();

  for (const g of params.momentGrades) {
    const key = `${g.enrollmentId}:${g.curriculumSubjectId}`;
    let momMap = gradesByEnrollmentSubject.get(key);
    if (!momMap) {
      momMap = new Map<number, AcademicHistoryMomentValue>();
      gradesByEnrollmentSubject.set(key, momMap);
    }
    momMap.set(g.momentNumber, {
      numeric:
        g.finalNumeric !== null && g.finalNumeric !== undefined
          ? Number(g.finalNumeric)
          : null,
      literal: g.finalLiteral ?? null,
      isLocked: Boolean(g.isLocked),
    });

    let subjectSet = gradedSubjectIdsByEnrollment.get(g.enrollmentId);
    if (!subjectSet) {
      subjectSet = new Set<string>();
      gradedSubjectIdsByEnrollment.set(g.enrollmentId, subjectSet);
    }
    subjectSet.add(g.curriculumSubjectId);
  }

  // Indexar intentos de materias pendientes por curriculumSubjectId
  const passedPendingBySubjectId = new Map<string, number>();
  const activePendingSubjectIds = new Set<string>();

  for (const att of params.pendingAttempts) {
    if (att.passed) {
      const existing = passedPendingBySubjectId.get(att.curriculumSubjectId);
      if (existing === undefined || att.finalNumeric > existing) {
        passedPendingBySubjectId.set(att.curriculumSubjectId, att.finalNumeric);
      }
    }
  }
  for (const att of params.pendingAttempts) {
    if (!att.passed && !passedPendingBySubjectId.has(att.curriculumSubjectId)) {
      activePendingSubjectIds.add(att.curriculumSubjectId);
    }
  }

  const sortedEnrollments = [...params.enrollments].sort((a, b) => {
    if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
    if (a.startDate && b.startDate && a.startDate !== b.startDate) {
      return b.startDate.localeCompare(a.startDate);
    }
    if (a.schoolYearCode !== b.schoolYearCode) {
      return b.schoolYearCode.localeCompare(a.schoolYearCode);
    }
    return b.gradeYear - a.gradeYear;
  });

  const allCumulativeNumerics: number[] = [];
  let totalApprovedSubjectsCount = 0;
  let totalTrackedSubjectsCount = 0;

  const periods: AcademicHistoryPeriod[] = sortedEnrollments.map((enrollment) => {
    const periodCurriculum = params.curriculumSubjects.filter(
      (cs) =>
        cs.mencionId === enrollment.mencionId &&
        cs.gradeYear === enrollment.gradeYear
    );

    const includedIds = new Set(
      periodCurriculum.map((cs) => cs.curriculumSubjectId)
    );
    const extraGradedIds = gradedSubjectIdsByEnrollment.get(
      enrollment.enrollmentId
    );
    if (extraGradedIds) {
      for (const extraId of extraGradedIds) {
        if (!includedIds.has(extraId)) {
          const found = curriculumById.get(extraId);
          if (found) {
            periodCurriculum.push(found);
            includedIds.add(extraId);
          }
        }
      }
    }

    periodCurriculum.sort((a, b) => {
      if (a.displayOrder !== b.displayOrder) {
        return a.displayOrder - b.displayOrder;
      }
      return a.subjectName.localeCompare(b.subjectName, "es");
    });

    const periodNumerics: number[] = [];
    let passedCount = 0;

    const subjects: AcademicHistorySubjectRow[] = periodCurriculum.map((cs) => {
      const momMap = gradesByEnrollmentSubject.get(
        `${enrollment.enrollmentId}:${cs.curriculumSubjectId}`
      );
      const moment1 = momMap?.get(1) ?? null;
      const moment2 = momMap?.get(2) ?? null;
      const moment3 = momMap?.get(3) ?? null;
      const moments = [moment1, moment2, moment3];

      const numericValues = moments
        .map((m) => m?.numeric)
        .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
      const literalValues = moments
        .map((m) => m?.literal)
        .filter((v): v is string => typeof v === "string" && v.length > 0);

      const gradedMomentsCount = moments.filter(
        (m) => m !== null && (m.numeric !== null || m.literal !== null)
      ).length;

      let definitiveNumeric: number | null = null;
      let definitiveLiteral: string | null = null;

      if (cs.gradingScale === "LITERAL_A_E") {
        definitiveLiteral =
          literalValues.length > 0
            ? (literalValues[literalValues.length - 1] ?? null)
            : null;
      } else if (numericValues.length > 0) {
        const rawMean =
          numericValues.reduce((sum, v) => sum + v, 0) / numericValues.length;
        definitiveNumeric = computeMppeFinalNumeric(rawMean);
      }

      const recoveryScore = passedPendingBySubjectId.get(
        cs.curriculumSubjectId
      );
      const isPendingActive = activePendingSubjectIds.has(
        cs.curriculumSubjectId
      );

      let recoveredViaPending = false;
      let effectiveNumeric = definitiveNumeric;

      if (
        recoveryScore !== undefined &&
        (definitiveNumeric === null || definitiveNumeric < cs.passingThreshold)
      ) {
        recoveredViaPending = true;
        effectiveNumeric = recoveryScore;
      }

      const isClosedPeriod =
        !enrollment.isCurrent ||
        enrollment.enrollmentStatus === "promoted" ||
        enrollment.enrollmentStatus === "graduated";
      const isDefinitiveFinal =
        isClosedPeriod || gradedMomentsCount >= 3 || recoveredViaPending;

      const isPassing =
        cs.gradingScale === "LITERAL_A_E"
          ? definitiveLiteral !== null &&
            PASSING_LITERALS.has(definitiveLiteral.toUpperCase())
          : effectiveNumeric !== null && effectiveNumeric >= cs.passingThreshold;

      let status: AcademicHistorySubjectStatus;
      if (isPendingActive) {
        status = "pending_recovery";
      } else if (recoveredViaPending) {
        status = "approved";
      } else if (isClosedPeriod) {
        if (gradedMomentsCount === 0) {
          status = "ungraded";
        } else if (isPassing) {
          status = "approved";
        } else {
          status = "needs_improvement";
        }
      } else {
        // Período en curso
        if (gradedMomentsCount === 0) {
          status = "in_progress";
        } else if (gradedMomentsCount >= 3) {
          status = isPassing ? "approved" : "needs_improvement";
        } else {
          status = isPassing ? "in_progress" : "needs_improvement";
        }
      }

      if (effectiveNumeric !== null && cs.gradingScale === "NUMERIC_1_20") {
        periodNumerics.push(effectiveNumeric);
        allCumulativeNumerics.push(effectiveNumeric);
      }

      if (isPassing) {
        passedCount += 1;
        totalApprovedSubjectsCount += 1;
      }
      totalTrackedSubjectsCount += 1;

      return {
        curriculumSubjectId: cs.curriculumSubjectId,
        subjectCode: cs.subjectCode,
        subjectName: cs.subjectName,
        weeklyHours: cs.weeklyHours,
        annualHours: cs.annualHours,
        displayOrder: cs.displayOrder,
        gradingScale: cs.gradingScale,
        passingThreshold: cs.passingThreshold,
        isTechnicalCore: cs.isTechnicalCore,
        moment1,
        moment2,
        moment3,
        gradedMomentsCount,
        definitiveNumeric: effectiveNumeric,
        definitiveLiteral,
        isDefinitiveFinal,
        recoveredViaPending,
        recoveryNumeric: recoveryScore ?? null,
        isPassing,
        status,
      };
    });

    return {
      enrollmentId: enrollment.enrollmentId,
      schoolYearId: enrollment.schoolYearId,
      schoolYearCode: enrollment.schoolYearCode,
      schoolYearName: enrollment.schoolYearName,
      startDate: enrollment.startDate,
      isCurrent: enrollment.isCurrent,
      gradeYear: enrollment.gradeYear,
      sectionLetter: enrollment.sectionLetter,
      mencionCode: enrollment.mencionCode,
      mencionName: enrollment.mencionName,
      mencionSpecialty: enrollment.mencionSpecialty,
      enrollmentStatus: enrollment.enrollmentStatus,
      enrollmentStatusLabel: formatEnrollmentStatusLabel(
        enrollment.enrollmentStatus,
        enrollment.isCurrent
      ),
      periodAverage: roundAverage(periodNumerics),
      gradedNumericSubjectsCount: periodNumerics.length,
      passedCount,
      totalSubjects: subjects.length,
      subjects,
    };
  });

  const currentPeriod = periods.find((p) => p.isCurrent) ?? periods[0] ?? null;

  const pendingAttemptsSummary: PendingSubjectAttemptSummary[] =
    params.pendingAttempts.map((att) => ({
      id: att.id,
      subjectCode: att.subjectCode,
      subjectName: att.subjectName,
      attemptNumber: att.attemptNumber,
      examDate: att.examDate,
      finalNumeric: att.finalNumeric,
      passed: att.passed,
    }));

  return {
    overallCumulativeAverage: roundAverage(allCumulativeNumerics),
    overallEvaluatedNumericCount: allCumulativeNumerics.length,
    currentYearAverage: currentPeriod?.periodAverage ?? null,
    currentYearLabel: currentPeriod
      ? `${currentPeriod.gradeYear}.º Año · ${currentPeriod.schoolYearName}`
      : null,
    totalApprovedSubjectsCount,
    totalTrackedSubjectsCount,
    pendingRecoveryCount: activePendingSubjectIds.size,
    periods,
    pendingAttempts: pendingAttemptsSummary,
  };
}

export interface SimulatorEvaluationItem {
  id: string;
  title: string;
  evaluationType: string;
  weightPercent: number;
  maxPoints: number;
  scheduledDate: string | null;
  recordedScore: number | null;
}

export interface SubjectSimulatorInput {
  curriculumSubjectId: string;
  subjectCode: string;
  subjectName: string;
  gradingScale: "NUMERIC_1_20" | "LITERAL_A_E";
  passingThreshold: number;
  planTitle: string | null;
  planStatus: "draft" | "published" | "locked" | null;
  items: SimulatorEvaluationItem[];
}

export type SimulatorOutcomeStatus =
  | "no_plan"
  | "literal_scale"
  | "secured"
  | "achievable"
  | "unreachable"
  | "completed_passed"
  | "completed_failed";

export interface SubjectSimulatorAnalysis {
  status: SimulatorOutcomeStatus;
  passingThreshold: number;
  totalConfiguredWeight: number;
  evaluatedWeight: number;
  pendingWeight: number;
  earnedWeightedPoints: number;
  maxPossibleWeightedAvg: number;
  requiredUniformScore: number | null;
  currentMppeNumeric: number | null;
}

export interface WhatIfProjection {
  projectedRawAvg: number;
  projectedMppeFinal: number;
  willApprove: boolean;
  deltaFromThreshold: number;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Replica el redondeo oficial MPPE definido en `siga_registrar_nota`:
 * promedio ponderado redondeado al entero más cercano entre 1 y 20.
 */
export function computeMppeFinalNumeric(rawWeightedAvg: number): number {
  const clamped = Math.max(1, Math.min(20, Math.round(rawWeightedAvg)));
  return clamped;
}

/**
 * Calcula matemáticamente cuánto necesita un estudiante en los ítems pendientes
 * para alcanzar la nota mínima aprobatoria (`>= passingThreshold`, por defecto 10 pts).
 */
export function analyzeSubjectSimulation(
  subject: SubjectSimulatorInput
): SubjectSimulatorAnalysis {
  if (subject.gradingScale === "LITERAL_A_E") {
    return {
      status: "literal_scale",
      passingThreshold: subject.passingThreshold,
      totalConfiguredWeight: 0,
      evaluatedWeight: 0,
      pendingWeight: 0,
      earnedWeightedPoints: 0,
      maxPossibleWeightedAvg: 0,
      requiredUniformScore: null,
      currentMppeNumeric: null,
    };
  }

  if (!subject.planStatus || subject.items.length === 0) {
    return {
      status: "no_plan",
      passingThreshold: subject.passingThreshold,
      totalConfiguredWeight: 0,
      evaluatedWeight: 0,
      pendingWeight: 0,
      earnedWeightedPoints: 0,
      maxPossibleWeightedAvg: 0,
      requiredUniformScore: null,
      currentMppeNumeric: null,
    };
  }

  let totalConfiguredWeight = 0;
  let evaluatedWeight = 0;
  let pendingWeight = 0;
  let earnedWeightedPoints = 0;

  for (const item of subject.items) {
    const w = Math.max(0, Number(item.weightPercent));
    totalConfiguredWeight += w;

    if (item.recordedScore !== null && Number.isFinite(item.recordedScore)) {
      const score = Math.max(0, Math.min(20, Number(item.recordedScore)));
      evaluatedWeight += w;
      earnedWeightedPoints += score * (w / 100);
    } else {
      pendingWeight += w;
    }
  }

  const earnedRounded = round2(earnedWeightedPoints);
  const maxPossibleWeightedAvg = round2(
    earnedWeightedPoints + 20 * (pendingWeight / 100)
  );
  const currentMppeNumeric =
    evaluatedWeight > 0 ? computeMppeFinalNumeric(earnedRounded) : null;

  if (pendingWeight <= 0) {
    const finalGrade = computeMppeFinalNumeric(earnedRounded);
    return {
      status:
        finalGrade >= subject.passingThreshold
          ? "completed_passed"
          : "completed_failed",
      passingThreshold: subject.passingThreshold,
      totalConfiguredWeight: round2(totalConfiguredWeight),
      evaluatedWeight: round2(evaluatedWeight),
      pendingWeight: 0,
      earnedWeightedPoints: earnedRounded,
      maxPossibleWeightedAvg: earnedRounded,
      requiredUniformScore: null,
      currentMppeNumeric: finalGrade,
    };
  }

  const targetRaw = Math.max(0, subject.passingThreshold - 0.5);
  const rawNeeded =
    (subject.passingThreshold - earnedWeightedPoints) / (pendingWeight / 100);
  const minForRoundedPass =
    (targetRaw - earnedWeightedPoints) / (pendingWeight / 100);

  if (rawNeeded <= 0) {
    return {
      status: "secured",
      passingThreshold: subject.passingThreshold,
      totalConfiguredWeight: round2(totalConfiguredWeight),
      evaluatedWeight: round2(evaluatedWeight),
      pendingWeight: round2(pendingWeight),
      earnedWeightedPoints: earnedRounded,
      maxPossibleWeightedAvg,
      requiredUniformScore: 0,
      currentMppeNumeric,
    };
  }

  if (minForRoundedPass > 20) {
    return {
      status: "unreachable",
      passingThreshold: subject.passingThreshold,
      totalConfiguredWeight: round2(totalConfiguredWeight),
      evaluatedWeight: round2(evaluatedWeight),
      pendingWeight: round2(pendingWeight),
      earnedWeightedPoints: earnedRounded,
      maxPossibleWeightedAvg,
      requiredUniformScore: round2(rawNeeded),
      currentMppeNumeric,
    };
  }

  return {
    status: "achievable",
    passingThreshold: subject.passingThreshold,
    totalConfiguredWeight: round2(totalConfiguredWeight),
    evaluatedWeight: round2(evaluatedWeight),
    pendingWeight: round2(pendingWeight),
    earnedWeightedPoints: earnedRounded,
    maxPossibleWeightedAvg,
    requiredUniformScore: round2(Math.min(20, Math.max(0, rawNeeded))),
    currentMppeNumeric,
  };
}

/**
 * Calcula la proyección ponderada combinando notas reales cargadas
 * y valores hipotéticos ("¿Qué pasa si...?") para las evaluaciones pendientes.
 */
export function simulateSubjectWhatIf(
  items: SimulatorEvaluationItem[],
  hypotheticalScores: Record<string, number>,
  passingThreshold = 10
): WhatIfProjection {
  let rawWeighted = 0;

  for (const item of items) {
    const score =
      item.recordedScore !== null
        ? Math.max(0, Math.min(20, item.recordedScore))
        : Math.max(0, Math.min(20, hypotheticalScores[item.id] ?? 0));

    rawWeighted += score * (Math.max(0, item.weightPercent) / 100);
  }

  const projectedRawAvg = round2(rawWeighted);
  const projectedMppeFinal = computeMppeFinalNumeric(projectedRawAvg);

  return {
    projectedRawAvg,
    projectedMppeFinal,
    willApprove: projectedMppeFinal >= passingThreshold,
    deltaFromThreshold: round2(projectedRawAvg - passingThreshold),
  };
}

import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeSubjectSimulation,
  computeMppeFinalNumeric,
  simulateSubjectWhatIf,
} from "../grade-simulator";
import {
  classifyCurriculumAxis,
  getSubjectProgressionContext,
  resolveCurriculumNodeStatus,
} from "../curriculum-tracks";
import { computeStudentMedals } from "../medals";
import {
  isQaStudentSandboxProfile,
  recoveryEmailSchema,
  studentRequestCreateSchema,
  verificationCodeSchema,
} from "../../../lib/validators/student-portal";
import {
  evaluationPlanItemsSchema,
  gradeRegistrationSchema,
  studentSocioeconomicSchema,
} from "../../../lib/validators/academic-and-socioeconomic";
import {
  assertAuthorizedRole,
  canRoleAccessDashboardPath,
} from "../../../lib/supabase/rbac";
import {
  computeContentSha256,
  computeTextSimilarityScore,
  detectsDirectHomeworkSolveAttempt,
} from "../../../lib/ai/socratic-tutor-guard";
import { redactSigaPii } from "../../../lib/analytics/sentry-scrub";

test("computeMppeFinalNumeric clamps and rounds according to MPPE scale 1-20", () => {
  assert.equal(computeMppeFinalNumeric(0.2), 1);
  assert.equal(computeMppeFinalNumeric(9.49), 9);
  assert.equal(computeMppeFinalNumeric(9.5), 10);
  assert.equal(computeMppeFinalNumeric(15.6), 16);
  assert.equal(computeMppeFinalNumeric(24), 20);
});

test("analyzeSubjectSimulation calculates achievable target across pending items", () => {
  const analysis = analyzeSubjectSimulation({
    curriculumSubjectId: "cs-1",
    subjectCode: "MAT-5",
    subjectName: "Matemática",
    gradingScale: "NUMERIC_1_20",
    passingThreshold: 10,
    planTitle: "Plan I Momento",
    planStatus: "published",
    items: [
      {
        id: "i1",
        title: "Prueba 1",
        evaluationType: "classroom_activity",
        weightPercent: 50,
        maxPoints: 20,
        scheduledDate: "2026-10-15",
        recordedScore: 8,
      },
      {
        id: "i2",
        title: "Proyecto",
        evaluationType: "project",
        weightPercent: 50,
        maxPoints: 20,
        scheduledDate: "2026-11-20",
        recordedScore: null,
      },
    ],
  });

  assert.equal(analysis.status, "achievable");
  assert.equal(analysis.earnedWeightedPoints, 4);
  assert.equal(analysis.pendingWeight, 50);
  assert.equal(analysis.requiredUniformScore, 12);
});

test("analyzeSubjectSimulation identifies secured and unreachable states accurately", () => {
  const secured = analyzeSubjectSimulation({
    curriculumSubjectId: "cs-2",
    subjectCode: "TEL-5",
    subjectName: "Redes",
    gradingScale: "NUMERIC_1_20",
    passingThreshold: 10,
    planTitle: "Plan",
    planStatus: "published",
    items: [
      {
        id: "a",
        title: "Lab 1",
        evaluationType: "lab_mention",
        weightPercent: 60,
        maxPoints: 20,
        scheduledDate: null,
        recordedScore: 18,
      },
      {
        id: "b",
        title: "Lab 2",
        evaluationType: "lab_mention",
        weightPercent: 40,
        maxPoints: 20,
        scheduledDate: null,
        recordedScore: null,
      },
    ],
  });
  assert.equal(secured.status, "secured");
  assert.equal(secured.requiredUniformScore, 0);

  const unreachable = analyzeSubjectSimulation({
    curriculumSubjectId: "cs-3",
    subjectCode: "FIS-5",
    subjectName: "Física",
    gradingScale: "NUMERIC_1_20",
    passingThreshold: 10,
    planTitle: "Plan",
    planStatus: "published",
    items: [
      {
        id: "c",
        title: "Parcial",
        evaluationType: "classroom_activity",
        weightPercent: 80,
        maxPoints: 20,
        scheduledDate: null,
        recordedScore: 2,
      },
      {
        id: "d",
        title: "Final",
        evaluationType: "exam_online",
        weightPercent: 20,
        maxPoints: 20,
        scheduledDate: null,
        recordedScore: null,
      },
    ],
  });
  assert.equal(unreachable.status, "unreachable");
  assert.equal(unreachable.maxPossibleWeightedAvg, 5.6);
});

test("simulateSubjectWhatIf combines official scores with hypothetical values", () => {
  const result = simulateSubjectWhatIf(
    [
      {
        id: "i1",
        title: "Evaluación 1",
        evaluationType: "classroom_activity",
        weightPercent: 40,
        maxPoints: 20,
        scheduledDate: null,
        recordedScore: 10,
      },
      {
        id: "i2",
        title: "Evaluación 2",
        evaluationType: "project",
        weightPercent: 60,
        maxPoints: 20,
        scheduledDate: null,
        recordedScore: null,
      },
    ],
    { i2: 14 },
    10
  );

  assert.equal(result.projectedRawAvg, 12.4);
  assert.equal(result.projectedMppeFinal, 12);
  assert.equal(result.willApprove, true);
});

test("computeStudentMedals only unlocks achievements backed by real metrics", () => {
  const emptyMedals = computeStudentMedals({
    accessTier: "provisional_cedula",
    averageGrade: null,
    attendancePercent: null,
    attendanceSessionsCount: 0,
    enrolledSubjectsCount: 0,
    completionPercent: 0,
    subjects: [],
  });
  assert.equal(emptyMedals.every((m) => !m.unlocked), true);

  const earnedMedals = computeStudentMedals({
    accessTier: "verified_workspace",
    averageGrade: 17.5,
    attendancePercent: 95,
    attendanceSessionsCount: 8,
    enrolledSubjectsCount: 4,
    completionPercent: 75,
    subjects: [
      { gradingScale: "NUMERIC_1_20", finalNumeric: 18, finalLiteral: null },
      { gradingScale: "NUMERIC_1_20", finalNumeric: 17, finalLiteral: null },
      { gradingScale: "LITERAL_A_E", finalNumeric: null, finalLiteral: "A" },
    ],
  });
  assert.equal(earnedMedals.every((m) => m.unlocked), true);
});

test("Zod student portal validators reject invalid emails, missing revision reasons, and malformed QR codes", () => {
  assert.equal(
    recoveryEmailSchema.safeParse("alumno@etcandresbello.org").success,
    false
  );
  assert.equal(
    recoveryEmailSchema.safeParse("respaldo@gmail.com").success,
    true
  );

  assert.equal(
    studentRequestCreateSchema.safeParse({
      requestType: "revision_notas",
      reason: "corto",
    }).success,
    false
  );
  assert.equal(
    studentRequestCreateSchema.safeParse({
      requestType: "revision_notas",
      reason: "Revisión de nota del segundo parcial de Telemática",
    }).success,
    true
  );

  assert.equal(verificationCodeSchema.safeParse("bad").success, false);
  assert.equal(
    verificationCodeSchema.safeParse("siga-2026-abc123").success,
    true
  );
});

test("isQaStudentSandboxProfile restricts QA toolbar to estudiante@etcandresbello.org outside production", () => {
  assert.equal(
    isQaStudentSandboxProfile(
      {
        primaryRole: "estudiante",
        cedula: "V99999996",
        institutionalEmail: "estudiante@etcandresbello.org",
      },
      "development"
    ),
    true
  );

  assert.equal(
    isQaStudentSandboxProfile(
      {
        primaryRole: "estudiante",
        cedula: "V99999996",
        institutionalEmail: "estudiante@etcandresbello.org",
      },
      "production"
    ),
    false
  );

  assert.equal(
    isQaStudentSandboxProfile(
      {
        primaryRole: "docente",
        cedula: "V99999996",
        institutionalEmail: "estudiante@etcandresbello.org",
      },
      "development"
    ),
    false
  );

  assert.equal(
    isQaStudentSandboxProfile(
      {
        primaryRole: "estudiante",
        cedula: "V12345678",
        institutionalEmail: "otro@etcandresbello.org",
      },
      "development"
    ),
    false
  );
});

test("Isomorphic academic and socioeconomic schemas enforce MPPE 1-20, A-E, and 100% plan sum", () => {
  assert.equal(
    gradeRegistrationSchema.safeParse({
      evaluationItemId: "550e8400-e29b-41d4-a716-446655440000",
      enrollmentId: "550e8400-e29b-41d4-a716-446655440001",
      gradingScale: "NUMERIC_1_20",
      numericScore: 18,
    }).success,
    true
  );

  assert.equal(
    gradeRegistrationSchema.safeParse({
      evaluationItemId: "550e8400-e29b-41d4-a716-446655440000",
      enrollmentId: "550e8400-e29b-41d4-a716-446655440001",
      gradingScale: "NUMERIC_1_20",
      numericScore: 25,
    }).success,
    false
  );

  assert.equal(
    gradeRegistrationSchema.safeParse({
      evaluationItemId: "550e8400-e29b-41d4-a716-446655440000",
      enrollmentId: "550e8400-e29b-41d4-a716-446655440001",
      gradingScale: "LITERAL_A_E",
      literalGrade: "B",
    }).success,
    true
  );

  assert.equal(
    evaluationPlanItemsSchema.safeParse([
      {
        title: "Taller 1",
        evaluationType: "workshop",
        weightPercent: 40,
        scheduledDate: "2026-10-10",
      },
      {
        title: "Proyecto Final",
        evaluationType: "project",
        weightPercent: 60,
        scheduledDate: "2026-11-15",
      },
    ]).success,
    true
  );

  assert.equal(
    studentSocioeconomicSchema.safeParse({
      studentCedula: "V-31456789",
      birthDate: "2010-05-14",
      homeParroquia: "Unare",
      homeAddress: "Urbanización Unare II, Sector 2, Puerto Ordaz",
      householdSize: 4,
      hasInternetAtHome: true,
      deviceAccess: "shared_phone",
      socioeconomicVulnerability: "low",
      bloodType: "O+",
      emergencyContactName: "María Pérez",
      emergencyContactRelationship: "Madre",
      emergencyContactPhone: "0414-8889900",
    }).success,
    true
  );
});

test("RBAC matrix and Socratic Tutor / Anti-Fraud helpers enforce institutional boundaries", async () => {
  assert.equal(
    canRoleAccessDashboardPath("estudiante", "/control-estudios/orientacion"),
    false
  );
  assert.equal(
    canRoleAccessDashboardPath("orientacion", "/control-estudios/orientacion"),
    true
  );
  assert.equal(
    assertAuthorizedRole(
      { primaryRole: "estudiante", accessTier: "provisional_cedula" },
      ["estudiante"],
      { requireVerifiedWorkspace: true }
    ).ok,
    false
  );

  assert.equal(
    detectsDirectHomeworkSolveAttempt("Resuélveme la tarea completa de redes"),
    true
  );
  assert.equal(
    detectsDirectHomeworkSolveAttempt("¿Cómo funciona la máscara de subred /24?"),
    false
  );

  const hashA = await computeContentSha256("Informe de Aduanas E.T.C. Andrés Bello");
  const hashB = await computeContentSha256("Informe de Aduanas   E.T.C. Andrés Bello ");
  assert.equal(hashA, hashB);
  assert.equal(hashA.length, 64);

  const similarity = computeTextSimilarityScore(
    "La clasificación arancelaria permite determinar los impuestos de importación en aduanas",
    "La clasificación arancelaria permite determinar los impuestos de importación en Venezuela"
  );
  assert.equal(similarity > 0.6, true);

  const scrubbed = redactSigaPii(
    "Token SIGAQR1.eyJ1aWQiOiIxIn0.abc_123 y cédula V-12345678"
  );
  assert.equal(scrubbed.includes("[REDACTED_SIGAQR]"), true);
  assert.equal(scrubbed.includes("V-***5678"), true);
});

test("curriculum tracks classify axes, resolve node status honestly, and build progression chains", () => {
  assert.equal(classifyCurriculumAxis("TEL-RED", true).id, "nucleo_tecnico");
  assert.equal(classifyCurriculumAxis("CRP", false).id, "identidad_bienestar");
  assert.equal(classifyCurriculumAxis("MAT", false).id, "formacion_comun");

  assert.equal(
    resolveCurriculumNodeStatus({
      gradeYear: 3,
      enrolledGradeYear: 3,
      isSameMencion: true,
      isPendingRecovery: false,
      historicalPassed: null,
      currentFinalNumeric: 15,
      currentFinalLiteral: null,
      passingThreshold: 10,
    }),
    "enrolled"
  );

  assert.equal(
    resolveCurriculumNodeStatus({
      gradeYear: 2,
      enrolledGradeYear: 3,
      isSameMencion: true,
      isPendingRecovery: true,
      historicalPassed: null,
      currentFinalNumeric: null,
      currentFinalLiteral: null,
      passingThreshold: 10,
    }),
    "pending_recovery"
  );

  assert.equal(
    resolveCurriculumNodeStatus({
      gradeYear: 1,
      enrolledGradeYear: 3,
      isSameMencion: true,
      isPendingRecovery: false,
      historicalPassed: false,
      currentFinalNumeric: null,
      currentFinalLiteral: null,
      passingThreshold: 10,
    }),
    "prior_stage"
  );

  assert.equal(
    resolveCurriculumNodeStatus({
      gradeYear: 5,
      enrolledGradeYear: 3,
      isSameMencion: true,
      isPendingRecovery: false,
      historicalPassed: null,
      currentFinalNumeric: null,
      currentFinalLiteral: null,
      passingThreshold: 10,
    }),
    "upcoming"
  );

  const lookup = new Map([
    ["TEL-OFI", { name: "Ofimática", gradeYears: [1, 2] }],
    ["TEL-ARQ", { name: "Arquitectura Hardware", gradeYears: [3] }],
    ["TEL-RED", { name: "Redes de Datos", gradeYears: [4, 5] }],
    ["TEL-SEG", { name: "Seguridad LAN y Pasantías", gradeYears: [6] }],
  ]);

  const ctx = getSubjectProgressionContext("TELEMATICA", "TEL-ARQ", lookup);
  assert.ok(ctx);
  assert.equal(ctx.currentIndex, 1);
  assert.equal(ctx.nodes.length, 4);
  assert.equal(ctx.nodes[2]?.subjectCode, "TEL-RED");
});

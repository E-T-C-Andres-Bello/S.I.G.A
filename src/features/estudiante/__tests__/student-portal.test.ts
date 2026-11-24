import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeSubjectSimulation,
  computeMppeFinalNumeric,
  simulateSubjectWhatIf,
} from "../grade-simulator";
import {
  classifyCurriculumAxis,
  formatCurriculumWorkload,
  getSubjectProgressionContext,
  resolveCurriculumNodeStatus,
} from "../curriculum-tracks";
import { computeStudentMedals } from "../medals";
import {
  isQaStudentSandboxProfile,
  normalizeEmergencyCedula,
  recoveryEmailSchema,
  studentAvatarUrlSchema,
  studentPasswordChangeSchema,
  studentProfileContactSchema,
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
} from "../../../lib/auth/rbac";
import {
  computeContentSha256,
  computeTextSimilarityScore,
  detectsDirectHomeworkSolveAttempt,
} from "../../../lib/ai/socratic-tutor-guard";
import { redactSigaPii } from "../../../lib/analytics/sentry-scrub";
import {
  formatRelativeNotificationTime,
  normalizeNotificationCategory,
  resolveNotificationDateBucket,
  sanitizeNotificationActionUrl,
} from "../../notificaciones/notification-meta";
import {
  buildStudentAcademicHistory,
  formatPromedioDisplay,
} from "../academic-history";
import {
  buildScheduleMatrix,
  formatCompact12hTime,
  formatCompactTeacherLabel,
  formatScheduleBannerTitle,
  parseTimeToMinutes,
} from "../schedule-grid";
import {
  buildAttendanceCalendarMonth,
  computeAttendanceHealth,
  resolveLiveSchoolDayPulse,
} from "../attendance-metrics";

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
  assert.equal(
    classifyCurriculumAxis("TEL-PDSR", true, "formacion_cientifica_tecnologica").id,
    "formacion_cientifica_tecnologica"
  );
  assert.equal(
    classifyCurriculumAxis("IDI", false, "formacion_cientifica_tecnologica").id,
    "formacion_cientifica_tecnologica"
  );
  assert.equal(
    classifyCurriculumAxis("OVS", false, "practica_vocacional_profesional").id,
    "practica_vocacional_profesional"
  );
  assert.equal(
    classifyCurriculumAxis("MAT", false, "formacion_general").id,
    "formacion_general"
  );
  assert.equal(formatCurriculumWorkload(0, 1440), "1440 h/año");
  assert.equal(formatCurriculumWorkload(42, null), "42 h/sem");

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
    ["PEST", { name: "Proyecto de Economía Socioproductiva y Tecnología", gradeYears: [1, 2, 3, 4, 5] }],
    ["TEL-PDSR", { name: "Programación y Diseño de Software y Redes", gradeYears: [1, 2, 3, 4, 5] }],
    ["OVS", { name: "Orientación y Vinculación Sociolaboral", gradeYears: [1, 2, 3, 4, 5] }],
    ["PPRO", { name: "Práctica Profesional", gradeYears: [6] }],
  ]);

  const ctx = getSubjectProgressionContext("TELEMATICA", "TEL-PDSR", lookup);
  assert.ok(ctx);
  assert.equal(ctx.currentIndex, 1);
  assert.equal(ctx.nodes.length, 4);
  assert.equal(ctx.nodes[3]?.subjectCode, "PPRO");
});

test("student profile schemas validate contact, emergency cedula, avatar URLs, and passwords", () => {
  assert.equal(normalizeEmergencyCedula("12345678"), "V12345678");
  assert.equal(normalizeEmergencyCedula("e-20.111.222"), "E20111222");

  const validProfile = studentProfileContactSchema.safeParse({
    phone: "0414-5556677",
    recoveryEmail: "personal@gmail.com",
    emergencyContactName: "María Pérez",
    emergencyContactCedula: "15222333",
    emergencyContactPhone: "+58 424-1112233",
    emergencyContactRelationship: "Madre",
  });
  assert.equal(validProfile.success, true);
  if (validProfile.success) {
    assert.equal(validProfile.data.emergencyContactCedula, "V15222333");
  }

  assert.equal(
    studentProfileContactSchema.safeParse({
      phone: "0414-5556677",
      recoveryEmail: "alumno@etcandresbello.org",
      emergencyContactName: "",
      emergencyContactCedula: "",
      emergencyContactPhone: "",
      emergencyContactRelationship: "",
    }).success,
    false
  );

  assert.equal(
    studentAvatarUrlSchema.safeParse(
      "https://storage.us-east-2.neon.tech/student-avatars/550e8400-e29b-41d4-a716-446655440000/avatar.webp?v=1795200000000"
    ).success,
    true
  );
  assert.equal(studentAvatarUrlSchema.safeParse(null).success, true);
  assert.equal(
    studentAvatarUrlSchema.safeParse("https://evil.example.com/pixel.png")
      .success,
    false
  );

  assert.equal(
    studentPasswordChangeSchema.safeParse({
      newPassword: "ClaveSegura2026",
      confirmPassword: "ClaveSegura2026",
    }).success,
    true
  );
  assert.equal(
    studentPasswordChangeSchema.safeParse({
      newPassword: "weak",
      confirmPassword: "weak",
    }).success,
    false
  );
  assert.equal(
    studentPasswordChangeSchema.safeParse({
      newPassword: "ClaveSegura2026",
      confirmPassword: "OtraClave2026",
    }).success,
    false
  );
});

test("notification helpers sanitize URLs against open redirects and format relative buckets", () => {
  assert.equal(
    sanitizeNotificationActionUrl("/estudiante?tab=tramites"),
    "/estudiante/tramites"
  );
  assert.equal(
    sanitizeNotificationActionUrl("/aula-virtual"),
    "/aula-virtual"
  );
  assert.equal(
    sanitizeNotificationActionUrl("https://evil.example.com"),
    null
  );
  assert.equal(sanitizeNotificationActionUrl("//evil.example.com"), null);
  assert.equal(sanitizeNotificationActionUrl("javascript:alert(1)"), null);

  assert.equal(normalizeNotificationCategory("academic_grade"), "academic_grade");
  assert.equal(normalizeNotificationCategory("desconocida"), "request_status");

  const fixedNow = Date.parse("2026-11-20T16:00:00-04:00");
  assert.equal(
    formatRelativeNotificationTime("2026-11-20T15:55:00-04:00", fixedNow),
    "Hace 5 min"
  );
  assert.equal(
    resolveNotificationDateBucket("2026-11-20T10:00:00-04:00", fixedNow),
    "Hoy"
  );
  assert.equal(
    resolveNotificationDateBucket("2026-11-19T14:00:00-04:00", fixedNow),
    "Ayer"
  );
});

test("buildStudentAcademicHistory computes real cumulative GPA, multi-year periods, literals, and pending recoveries", () => {
  const empty = buildStudentAcademicHistory({
    enrollments: [],
    curriculumSubjects: [],
    momentGrades: [],
    pendingAttempts: [],
  });
  assert.equal(empty.overallCumulativeAverage, null);
  assert.equal(empty.currentYearAverage, null);
  assert.equal(empty.totalApprovedSubjectsCount, 0);
  assert.equal(empty.pendingRecoveryCount, 0);
  assert.equal(formatPromedioDisplay(null), "—");

  const history = buildStudentAcademicHistory({
    enrollments: [
      {
        enrollmentId: "enr-2025",
        schoolYearId: "sy-2025",
        schoolYearCode: "2025-2026",
        schoolYearName: "2025–2026",
        startDate: "2025-09-15",
        isCurrent: false,
        gradeYear: 4,
        sectionLetter: "A",
        mencionId: "m-tel",
        mencionCode: "TELEMATICA",
        mencionName: "Telemática",
        mencionSpecialty: "Industrial",
        enrollmentStatus: "promoted",
      },
      {
        enrollmentId: "enr-2026",
        schoolYearId: "sy-2026",
        schoolYearCode: "2026-2027",
        schoolYearName: "2026–2027",
        startDate: "2026-09-15",
        isCurrent: true,
        gradeYear: 5,
        sectionLetter: "A",
        mencionId: "m-tel",
        mencionCode: "TELEMATICA",
        mencionName: "Telemática",
        mencionSpecialty: "Industrial",
        enrollmentStatus: "active",
      },
    ],
    curriculumSubjects: [
      {
        curriculumSubjectId: "cs-4-mat",
        mencionId: "m-tel",
        gradeYear: 4,
        subjectCode: "MAT",
        subjectName: "Matemática",
        weeklyHours: 4,
        annualHours: null,
        displayOrder: 1,
        gradingScale: "NUMERIC_1_20",
        passingThreshold: 10,
        isTechnicalCore: false,
      },
      {
        curriculumSubjectId: "cs-4-fis",
        mencionId: "m-tel",
        gradeYear: 4,
        subjectCode: "FIS",
        subjectName: "Física",
        weeklyHours: 4,
        annualHours: null,
        displayOrder: 2,
        gradingScale: "NUMERIC_1_20",
        passingThreshold: 10,
        isTechnicalCore: false,
      },
      {
        curriculumSubjectId: "cs-4-ovs",
        mencionId: "m-tel",
        gradeYear: 4,
        subjectCode: "OVS",
        subjectName: "Orientación y Vinculación Sociolaboral",
        weeklyHours: 2,
        annualHours: null,
        displayOrder: 3,
        gradingScale: "LITERAL_A_E",
        passingThreshold: 10,
        isTechnicalCore: false,
      },
      {
        curriculumSubjectId: "cs-5-mat",
        mencionId: "m-tel",
        gradeYear: 5,
        subjectCode: "MAT",
        subjectName: "Matemática",
        weeklyHours: 4,
        annualHours: null,
        displayOrder: 1,
        gradingScale: "NUMERIC_1_20",
        passingThreshold: 10,
        isTechnicalCore: false,
      },
      {
        curriculumSubjectId: "cs-5-tel",
        mencionId: "m-tel",
        gradeYear: 5,
        subjectCode: "TEL-PDSR",
        subjectName: "Programación y Diseño de Software y Redes",
        weeklyHours: 8,
        annualHours: null,
        displayOrder: 2,
        gradingScale: "NUMERIC_1_20",
        passingThreshold: 10,
        isTechnicalCore: true,
      },
    ],
    momentGrades: [
      // 2025-2026: MAT (14, 15, 16 -> 15), FIS (8, 9, 8 -> 8 -> recuperada con 13), OVS (A, A, A -> A)
      { enrollmentId: "enr-2025", curriculumSubjectId: "cs-4-mat", momentNumber: 1, finalNumeric: 14, finalLiteral: null, isLocked: true },
      { enrollmentId: "enr-2025", curriculumSubjectId: "cs-4-mat", momentNumber: 2, finalNumeric: 15, finalLiteral: null, isLocked: true },
      { enrollmentId: "enr-2025", curriculumSubjectId: "cs-4-mat", momentNumber: 3, finalNumeric: 16, finalLiteral: null, isLocked: true },
      { enrollmentId: "enr-2025", curriculumSubjectId: "cs-4-fis", momentNumber: 1, finalNumeric: 8, finalLiteral: null, isLocked: true },
      { enrollmentId: "enr-2025", curriculumSubjectId: "cs-4-fis", momentNumber: 2, finalNumeric: 9, finalLiteral: null, isLocked: true },
      { enrollmentId: "enr-2025", curriculumSubjectId: "cs-4-fis", momentNumber: 3, finalNumeric: 8, finalLiteral: null, isLocked: true },
      { enrollmentId: "enr-2025", curriculumSubjectId: "cs-4-ovs", momentNumber: 3, finalNumeric: null, finalLiteral: "A", isLocked: true },
      // 2026-2027 (actual): MAT (18 en I Mom -> en curso), TEL-PDSR (sin notas aún)
      { enrollmentId: "enr-2026", curriculumSubjectId: "cs-5-mat", momentNumber: 1, finalNumeric: 18, finalLiteral: null, isLocked: true },
    ],
    pendingAttempts: [
      {
        id: "pa-1",
        curriculumSubjectId: "cs-4-fis",
        subjectCode: "FIS",
        subjectName: "Física",
        attemptNumber: 1,
        examDate: "2026-07-20",
        finalNumeric: 13,
        passed: true,
      },
    ],
  });

  // Orden: período actual primero
  assert.equal(history.periods.length, 2);
  assert.equal(history.periods[0]?.isCurrent, true);
  assert.equal(history.periods[0]?.enrollmentStatusLabel, "Actual");
  assert.equal(history.periods[1]?.enrollmentStatusLabel, "Promovido");

  // Año actual: MAT=18 (en curso), TEL-PDSR=sin notas -> promedio actual 18.00
  assert.equal(history.currentYearAverage, 18);
  assert.equal(history.periods[0]?.subjects[0]?.status, "in_progress");
  assert.equal(history.periods[0]?.subjects[1]?.status, "in_progress");

  // Año 2025-2026: MAT=15, FIS=13 (recuperada), OVS=A (literal aprobada) -> promedio período = (15+13)/2 = 14.00
  const period2025 = history.periods[1]!;
  assert.equal(period2025.periodAverage, 14);
  assert.equal(period2025.passedCount, 3);
  const fisRow = period2025.subjects.find((s) => s.subjectCode === "FIS");
  assert.equal(fisRow?.recoveredViaPending, true);
  assert.equal(fisRow?.definitiveNumeric, 13);
  assert.equal(fisRow?.status, "approved");

  // Promedio general acumulado: (18 + 15 + 13) / 3 = 15.33
  assert.equal(history.overallCumulativeAverage, 15.33);
  assert.equal(formatPromedioDisplay(history.overallCumulativeAverage), "15.33");
  assert.equal(history.totalApprovedSubjectsCount, 4);
  assert.equal(history.pendingRecoveryCount, 0);
});

test("buildScheduleMatrix builds dynamic slots, merges consecutive blocks, detects RECESO, and formats 12h labels", () => {
  assert.equal(formatCompact12hTime(parseTimeToMinutes("07:00")), "7:00");
  assert.equal(formatCompact12hTime(parseTimeToMinutes("12:35")), "12:35");
  assert.equal(formatCompact12hTime(parseTimeToMinutes("13:15")), "1:15");
  assert.equal(formatCompact12hTime(parseTimeToMinutes("18:00")), "6:00");

  assert.equal(
    formatScheduleBannerTitle({
      gradeYear: 4,
      mencionName: "Telemática",
      sectionLetter: "A",
    }),
    "4TO AÑO TLM A"
  );
  assert.equal(
    formatScheduleBannerTitle({
      gradeYear: 1,
      mencionName: "Aduana",
      sectionLetter: "B",
    }),
    "1ER AÑO ADU B"
  );
  assert.equal(formatCompactTeacherLabel("Prof. Keyla Sulbarán"), "KEYLA SULBARÁN");

  const grid = buildScheduleMatrix([
    {
      id: "b1",
      dayOfWeek: 5,
      blockLabel: "Bloque 8",
      startTime: "11:50",
      endTime: "12:30",
      roomLabel: "A-10",
      subjectCode: "IDI",
      subjectName: "Idiomas",
      teacherName: "Prof. Eduardo Brito",
    },
    {
      id: "b2",
      dayOfWeek: 1,
      blockLabel: "Bloque 9",
      startTime: "12:35",
      endTime: "13:15",
      roomLabel: "LAB. TLM 2",
      subjectCode: "TEL-PDSR",
      subjectName: "Programación y Diseño de Software y Redes",
      teacherName: "Profa. Keyla Sulbarán",
    },
    {
      id: "b3",
      dayOfWeek: 1,
      blockLabel: "Bloque 10",
      startTime: "13:15",
      endTime: "13:55",
      roomLabel: "LAB. TLM 2",
      subjectCode: "TEL-PDSR",
      subjectName: "Programación y Diseño de Software y Redes",
      teacherName: "Profa. Keyla Sulbarán",
    },
    {
      id: "b4",
      dayOfWeek: 2,
      blockLabel: "Bloque 9",
      startTime: "12:35",
      endTime: "13:15",
      roomLabel: "A-10",
      subjectCode: "MAT",
      subjectName: "Matemática",
      teacherName: "Prof. José Farías",
    },
  ]);

  // Band 0: slot 11:50-12:30; Band 1: RECESO 12:30-12:35; Band 2: slots 12:35-1:15 y 1:15-1:55
  assert.equal(grid.bands.length, 3);
  assert.equal(grid.totalRecessRows, 1);
  assert.equal(grid.totalSlotRows, 3);
  assert.equal(grid.primaryRoomLabel, "A-10");

  const recess = grid.bands[1];
  assert.equal(recess?.kind, "recess");
  if (recess?.kind === "recess") {
    assert.equal(recess.startLabel, "12:30");
    assert.equal(recess.endLabel, "12:35");
  }

  const afternoonBand = grid.bands[2];
  assert.equal(afternoonBand?.kind, "slots");
  if (afternoonBand?.kind === "slots") {
    // Lunes fusiona bloques 9 y 10 en una sola celda de rowSpan=2
    const mondayCells = afternoonBand.columnsByDay[1] ?? [];
    assert.equal(mondayCells.length, 1);
    assert.equal(mondayCells[0]?.rowSpan, 2);
    assert.equal(mondayCells[0]?.block?.subjectCode, "TEL-PDSR");

    // Martes tiene MAT en bloque 9 (rowSpan=1) y celda vacía en bloque 10 (rowSpan=1)
    const tuesdayCells = afternoonBand.columnsByDay[2] ?? [];
    assert.equal(tuesdayCells.length, 2);
    assert.equal(tuesdayCells[0]?.rowSpan, 1);
    assert.equal(tuesdayCells[1]?.block, null);
  }
});

test("computeAttendanceHealth enforces MPPE 75% traffic light and exact margin/recovery math", () => {
  const empty = computeAttendanceHealth({
    presentCount: 0,
    lateCount: 0,
    justifiedCount: 0,
    absentCount: 0,
  });
  assert.equal(empty.healthLevel, "neutral");
  assert.equal(empty.attendancePercent, null);

  // 10/10 = 100% -> green, tolera 3 faltas (10/13 = 76.9% >= 75%, 10/14 = 71.4% < 75%)
  const optimal = computeAttendanceHealth({
    presentCount: 8,
    lateCount: 1,
    justifiedCount: 1,
    absentCount: 0,
  });
  assert.equal(optimal.healthLevel, "green");
  assert.equal(optimal.attendancePercent, 100);
  assert.equal(optimal.allowedAdditionalAbsences, 3);
  assert.equal(optimal.sessionsNeededToRecover, 0);

  // 3/4 = 75% exacto -> amber, 0 faltas adicionales tolerables
  const edge75 = computeAttendanceHealth({
    presentCount: 3,
    lateCount: 0,
    justifiedCount: 0,
    absentCount: 1,
  });
  assert.equal(edge75.healthLevel, "amber");
  assert.equal(edge75.attendancePercent, 75);
  assert.equal(edge75.allowedAdditionalAbsences, 0);

  // 2/4 = 50% -> red, necesita 4 asistencias seguidas (6/8 = 75%)
  const risk = computeAttendanceHealth({
    presentCount: 2,
    lateCount: 0,
    justifiedCount: 0,
    absentCount: 2,
  });
  assert.equal(risk.healthLevel, "red");
  assert.equal(risk.attendancePercent, 50);
  assert.equal(risk.allowedAdditionalAbsences, 0);
  assert.equal(risk.sessionsNeededToRecover, 4);
});

test("resolveLiveSchoolDayPulse detects active class, teacher absence match, and monthly calendar dominant status", () => {
  const pulse = resolveLiveSchoolDayPulse({
    scheduleBlocks: [
      {
        id: "s1",
        dayOfWeek: 5,
        blockLabel: "Bloque 1-2",
        startTime: "07:00",
        endTime: "08:30",
        roomLabel: "Lab. Informática",
        subjectCode: "TEL-PDSR",
        subjectName: "Programación y Diseño de Software y Redes",
        teacherName: "Prof. Ana Morales",
      },
      {
        id: "s2",
        dayOfWeek: 5,
        blockLabel: "Bloque 3-4",
        startTime: "09:00",
        endTime: "10:30",
        roomLabel: "Aula 5-A",
        subjectCode: "MAT",
        subjectName: "Matemática",
        teacherName: "Prof. José Farías",
      },
    ],
    teacherAbsences: [
      {
        id: "abs-1",
        absenceDate: "2026-11-20",
        teacherName: "Prof. Ana Morales",
        subjectCodes: ["TEL-PDSR"],
        subjectNames: ["Programación y Diseño de Software y Redes"],
        affectedBlocks: ["Bloque 1-2"],
        status: "reorganized",
      },
    ],
    todayIso: "2026-11-20",
    weekday: 5,
    currentMinutes: 7 * 60 + 45, // 7:45 AM -> mitad del Bloque 1-2
  });

  assert.equal(pulse.phase, "in_class");
  assert.equal(pulse.currentBlock?.subjectCode, "TEL-PDSR");
  assert.equal(pulse.currentBlockProgressPercent, 50);
  assert.equal(pulse.currentBlockRemainingMinutes, 45);
  assert.equal(pulse.currentBlock?.hasTeacherAbsence, true);
  assert.equal(pulse.nextBlock?.subjectCode, "MAT");
  assert.equal(pulse.todayAbsenceAlerts.length, 1);

  const cal = buildAttendanceCalendarMonth({
    year: 2026,
    monthIndex0: 10, // Noviembre 2026
    todayIso: "2026-11-20",
    sessions: [
      {
        recordId: "r1",
        sessionDate: "2026-11-18",
        blockLabel: "Bloque 1-2",
        momentNumber: 1,
        momentName: "1.º Momento",
        subjectCode: "MAT",
        subjectName: "Matemática",
        teacherName: "Prof. José Farías",
        status: "present",
        note: null,
      },
      {
        recordId: "r2",
        sessionDate: "2026-11-18",
        blockLabel: "Bloque 3-4",
        momentNumber: 1,
        momentName: "1.º Momento",
        subjectCode: "TEL-PDSR",
        subjectName: "Programación y Diseño de Software y Redes",
        teacherName: "Prof. Ana Morales",
        status: "absent",
        note: null,
      },
    ],
  });

  assert.equal(cal.totalSessionsInMonth, 2);
  assert.equal(cal.absentInMonth, 1);
  const nov18 = cal.days.find((d) => d.dateIso === "2026-11-18");
  assert.equal(nov18?.dominantStatus, "absent");
  assert.equal(nov18?.sessions.length, 2);
});

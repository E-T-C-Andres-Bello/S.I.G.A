export interface StudentMedal {
  id: string;
  title: string;
  description: string;
  category: "puntualidad" | "desempeno" | "identidad" | "progreso";
  unlocked: boolean;
  progressPercent: number;
  progressLabel: string;
}

export interface StudentMedalsInput {
  accessTier: "provisional_cedula" | "verified_workspace" | "suspended";
  averageGrade: number | null;
  attendancePercent: number | null;
  attendanceSessionsCount: number;
  enrolledSubjectsCount: number;
  completionPercent: number;
  subjects: Array<{
    gradingScale: "NUMERIC_1_20" | "LITERAL_A_E";
    finalNumeric: number | null;
    finalLiteral: string | null;
  }>;
}

/**
 * Calcula las medallas estudiantiles exclusivamente a partir de registros reales
 * en Supabase (sin otorgar logros artificiales).
 */
export function computeStudentMedals(input: StudentMedalsInput): StudentMedal[] {
  const gradedSubjects = input.subjects.filter(
    (s) => s.finalNumeric !== null || s.finalLiteral !== null
  );
  const allGradedApproved =
    gradedSubjects.length >= 3 &&
    gradedSubjects.every((s) =>
      s.gradingScale === "LITERAL_A_E"
        ? s.finalLiteral !== null && ["A", "B", "C", "D"].includes(s.finalLiteral)
        : (s.finalNumeric ?? 0) >= 10
    );

  const attendanceUnlocked =
    input.attendanceSessionsCount >= 5 && (input.attendancePercent ?? 0) >= 90;
  const attendanceProgress =
    input.attendanceSessionsCount === 0
      ? 0
      : Math.min(
          100,
          Math.round(
            (Math.min(1, input.attendanceSessionsCount / 5) * 0.4 +
              Math.min(1, (input.attendancePercent ?? 0) / 90) * 0.6) *
              100
          )
        );

  const honorUnlocked =
    input.averageGrade !== null && input.averageGrade >= 16;
  const honorProgress =
    input.averageGrade !== null
      ? Math.min(100, Math.round((input.averageGrade / 16) * 100))
      : 0;

  const invictoProgress = Math.min(
    100,
    Math.round((Math.min(3, gradedSubjects.length) / 3) * (allGradedApproved ? 100 : 65))
  );

  const workspaceUnlocked = input.accessTier === "verified_workspace";

  return [
    {
      id: "asistencia-ejemplar",
      title: "Asistencia Ejemplar",
      description: "≥ 90% de asistencia con al menos 5 pases registrados en aula.",
      category: "puntualidad",
      unlocked: attendanceUnlocked,
      progressPercent: attendanceUnlocked ? 100 : attendanceProgress,
      progressLabel:
        input.attendanceSessionsCount > 0
          ? `${input.attendancePercent ?? 0}% · ${input.attendanceSessionsCount}/5 pases`
          : "0/5 pases",
    },
    {
      id: "cuadro-honor",
      title: "Cuadro de Honor",
      description: "Promedio consolidado igual o superior a 16 pts en escala MPPE.",
      category: "desempeno",
      unlocked: honorUnlocked,
      progressPercent: honorUnlocked ? 100 : honorProgress,
      progressLabel:
        input.averageGrade !== null ? `${input.averageGrade}/16 pts` : "Sin notas",
    },
    {
      id: "invicto-lapso",
      title: "Invicto del Momento",
      description: "Todas las asignaturas evaluadas (mín. 3) por encima del umbral aprobatorio.",
      category: "desempeno",
      unlocked: allGradedApproved,
      progressPercent: allGradedApproved ? 100 : invictoProgress,
      progressLabel: `${gradedSubjects.length}/3 materias eval.`,
    },
    {
      id: "avance-lapso",
      title: "Avance Sostenido",
      description: "Al menos 50% de las asignaturas del momento con calificación consolidada.",
      category: "progreso",
      unlocked: input.enrolledSubjectsCount > 0 && input.completionPercent >= 50,
      progressPercent: Math.min(100, input.completionPercent * 2),
      progressLabel: `${input.completionPercent}% evaluado`,
    },
    {
      id: "workspace-verificado",
      title: "Identidad Institucional",
      description: "Cuenta Google Workspace @etcandresbello.org vinculada y activa.",
      category: "identidad",
      unlocked: workspaceUnlocked,
      progressPercent: workspaceUnlocked ? 100 : 35,
      progressLabel: workspaceUnlocked ? "Verificada" : "Provisional",
    },
  ];
}

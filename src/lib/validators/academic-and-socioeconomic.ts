import { z } from "zod";
import { normalizeVenezuelanCedula } from "./auth";

export const MPPE_LITERAL_GRADES = ["A", "B", "C", "D", "E"] as const;
export type MppeLiteralGrade = (typeof MPPE_LITERAL_GRADES)[number];

export const GRADING_SCALES = ["NUMERIC_1_20", "LITERAL_A_E"] as const;
export type GradingScaleType = (typeof GRADING_SCALES)[number];

export const ORIENTATION_RECORD_CATEGORIES = [
  "acta_compromiso",
  "acuerdo_convivencia",
  "vulnerabilidad_socioeconomica",
  "seguimiento_psicopedagogico",
] as const;

export const BLOOD_TYPES = [
  "O+",
  "O-",
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
] as const;

/**
 * Escala numérica oficial MPPE (1 a 20 puntos).
 */
export const numericGrade1To20Schema = z
  .number({
    error: "Ingresa una calificación numérica válida.",
  })
  .finite("La calificación debe ser un número finito.")
  .min(1, "La calificación mínima en la escala MPPE es 1 punto.")
  .max(20, "La calificación máxima en la escala MPPE es 20 puntos.");

/**
 * Escala literal oficial MPPE (A, B, C, D, E) para CRP y Orientación y Convivencia.
 */
export const literalGradeSchema = z.enum(MPPE_LITERAL_GRADES, {
  error: "Selecciona un literal oficial válido (A, B, C, D o E).",
});

/**
 * Esquema isomórfico (cliente y servidor) para carga y auditoría de calificaciones.
 */
export const gradeRegistrationSchema = z
  .object({
    evaluationItemId: z.string().uuid("Ítem de evaluación inválido."),
    enrollmentId: z.string().uuid("Matrícula estudiantil inválida."),
    gradingScale: z.enum(GRADING_SCALES),
    numericScore: numericGrade1To20Schema.nullable().optional(),
    literalGrade: literalGradeSchema.nullable().optional(),
    reason: z
      .string()
      .trim()
      .max(400, "La observación no puede superar 400 caracteres.")
      .optional(),
    clientMutationId: z.string().uuid().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.gradingScale === "NUMERIC_1_20") {
      if (data.numericScore === null || data.numericScore === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["numericScore"],
          message: "Ingresa una calificación numérica entre 1 y 20.",
        });
      }
    } else if (!data.literalGrade) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["literalGrade"],
        message: "Selecciona un literal entre A y E.",
      });
    }
  });

export type GradeRegistrationInput = z.infer<typeof gradeRegistrationSchema>;

/**
 * Esquema isomórfico para Plan de Evaluación ponderado (suma obligatoria = 100 %).
 */
export const evaluationPlanItemsSchema = z
  .array(
    z.object({
      title: z
        .string()
        .trim()
        .min(3, "El título de la actividad debe tener al menos 3 caracteres.")
        .max(140, "El título es demasiado extenso."),
      evaluationType: z.enum([
        "written_exam",
        "practical_lab",
        "project",
        "workshop",
        "online_exam",
        "assignment",
      ]),
      weightPercent: z
        .number()
        .min(5, "Cada actividad debe ponderar al menos 5 %.")
        .max(100, "Ninguna actividad puede exceder el 100 %."),
      scheduledDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Usa formato de fecha ISO (AAAA-MM-DD)."),
    })
  )
  .min(1, "Agrega al menos una actividad evaluativa.")
  .max(12, "El plan no debe exceder 12 actividades por Momento Pedagógico.")
  .superRefine((items, ctx) => {
    const total = items.reduce((acc, item) => acc + item.weightPercent, 0);
    if (Math.abs(total - 100) > 0.01) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `La suma de ponderaciones del Momento Pedagógico debe ser exactamente 100 % (actual: ${total.toFixed(1)} %).`,
      });
    }
  });

const venezuelanPhoneSchema = z
  .string()
  .trim()
  .regex(
    /^(?:\+?58|0)?(?:412|414|424|416|426|2\d{2})[-.\s]?\d{3}[-.\s]?\d{4}$/,
    "Ingresa un número telefónico venezolano válido (ej. 0414-1234567)."
  );

/**
 * Esquema isomórfico para la Ficha Socioeconómica, Médica y Contacto de Emergencia.
 */
export const studentSocioeconomicSchema = z.object({
  studentCedula: z
    .string()
    .trim()
    .transform((val) => normalizeVenezuelanCedula(val) ?? "")
    .refine(
      (val) => /^[VEJ][0-9]{6,9}$/.test(val),
      "Cédula estudiantil inválida (usa formato V-12345678)."
    ),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha de nacimiento inválida."),
  homeParroquia: z
    .string()
    .trim()
    .min(2, "Indica la parroquia o sector de residencia en Ciudad Guayana.")
    .max(120),
  homeAddress: z
    .string()
    .trim()
    .min(8, "Indica la dirección de habitación.")
    .max(280),
  householdSize: z.number().int().min(1).max(25),
  hasInternetAtHome: z.boolean(),
  deviceAccess: z.enum(["none", "shared_phone", "own_phone", "computer"]),
  socioeconomicVulnerability: z.enum(["none", "low", "moderate", "high"]),
  bloodType: z.enum(BLOOD_TYPES).optional(),
  allergiesAndMedicalNotes: z
    .string()
    .trim()
    .max(500, "Las observaciones médicas no pueden superar 500 caracteres.")
    .optional(),
  shirtSize: z.enum(["SS", "S", "M", "L", "XL", "XXL"]).optional(),
  pantsSize: z.string().trim().max(12).optional(),
  shoeSize: z.number().int().min(28).max(48).optional(),
  emergencyContactName: z
    .string()
    .trim()
    .min(4, "Ingresa el nombre completo del representante o contacto de emergencia.")
    .max(140),
  emergencyContactRelationship: z
    .string()
    .trim()
    .min(2, "Indica el parentesco (ej. Madre, Padre, Abuela).")
    .max(60),
  emergencyContactPhone: venezuelanPhoneSchema,
});

export type StudentSocioeconomicInput = z.infer<typeof studentSocioeconomicSchema>;

/**
 * Esquema isomórfico para expedientes confidenciales de Orientación (cifrados con PGP).
 */
export const orientationConfidentialRecordSchema = z.object({
  studentUserId: z.string().uuid("Estudiante inválido."),
  schoolYearId: z.string().uuid("Año escolar inválido."),
  caseCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^ORI-\d{4}-\d{3,6}$/, "Usa formato de caso ORI-AAAA-0001."),
  recordCategory: z.enum(ORIENTATION_RECORD_CATEGORIES),
  summary: z
    .string()
    .trim()
    .min(10, "Describe un resumen institucional de al menos 10 caracteres.")
    .max(300, "El resumen no debe exceder 300 caracteres."),
  confidentialNotes: z
    .string()
    .trim()
    .min(10, "Ingresa el detalle confidencial que se cifrará en el expediente.")
    .max(8000, "El texto confidencial excede el límite permitido."),
  riskLevel: z.enum(["low", "medium", "high"]).default("low"),
});

export type OrientationConfidentialRecordInput = z.infer<
  typeof orientationConfidentialRecordSchema
>;

/**
 * Esquema para validar entregas académicas con huella SHA-256 anti-duplicados.
 */
export const assignmentSubmissionAntiFraudSchema = z
  .object({
    assignmentId: z.string().uuid("Asignación inválida."),
    enrollmentId: z.string().uuid("Matrícula inválida."),
    textAnswer: z.string().trim().max(25000).optional(),
    filePath: z.string().trim().max(500).optional(),
    contentSha256: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-f0-9]{64}$/, "Huella SHA-256 de contenido inválida."),
  })
  .refine(
    (d) =>
      (d.textAnswer && d.textAnswer.length > 0) ||
      (d.filePath && d.filePath.length > 0),
    {
      message: "Debes adjuntar un archivo o redactar una respuesta para entregar.",
    }
  );

/**
 * Esquema para evaluación externa de pasantías mediante Magic Link empresarial.
 */
export const internshipMagicLinkEvaluationSchema = z.object({
  token: z
    .string()
    .trim()
    .min(24, "Enlace de tutor empresarial inválido.")
    .max(256, "Enlace de tutor empresarial inválido."),
  finalScore: numericGrade1To20Schema,
  rubricScores: z.object({
    punctuality: numericGrade1To20Schema,
    technicalCompetence: numericGrade1To20Schema,
    teamwork: numericGrade1To20Schema,
    initiative: numericGrade1To20Schema,
  }),
  observations: z.string().trim().max(1200).optional(),
});

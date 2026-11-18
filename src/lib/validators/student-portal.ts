import { z } from "zod";
import { isInstitutionalEmail } from "./auth";

export const STUDENT_REQUEST_TYPES = [
  "constancia_estudio",
  "constancia_inscripcion",
  "solvencia",
  "revision_notas",
  "activacion_workspace",
] as const;

export type StudentRequestType = (typeof STUDENT_REQUEST_TYPES)[number];

export const STUDENT_REQUEST_STATUSES = [
  "pending",
  "in_review",
  "approved",
  "rejected",
  "delivered",
] as const;

export type StudentRequestStatus = (typeof STUDENT_REQUEST_STATUSES)[number];

export const STUDENT_REQUEST_LABELS: Record<StudentRequestType, string> = {
  constancia_estudio: "Constancia de Estudio",
  constancia_inscripcion: "Constancia de Inscripción",
  solvencia: "Solvencia Institucional",
  revision_notas: "Revisión Formal de Calificación",
  activacion_workspace: "Activación de Cuenta @etcandresbello.org",
};

export const STUDENT_REQUEST_STATUS_LABELS: Record<StudentRequestStatus, string> = {
  pending: "Pendiente",
  in_review: "En revisión",
  approved: "Aprobada",
  rejected: "Rechazada",
  delivered: "Entregada",
};

export const OFFICIAL_DOCUMENT_TYPE_LABELS: Record<string, string> = {
  boletin_momento: "Boletín de Momento Pedagógico",
  constancia_estudio: "Constancia de Estudio",
  constancia_inscripcion: "Constancia de Inscripción",
  certificacion_notas: "Certificación de Calificaciones",
  carta_postulacion_pasantia: "Carta de Postulación de Pasantías",
  carta_aceptacion_pasantia: "Carta de Aceptación de Pasantías",
  solvencia_biblioteca: "Solvencia Bibliotecaria",
};

export const recoveryEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Ingresa un correo electrónico válido (ej. estudiante@correo.com).")
  .max(160, "El correo es demasiado largo.")
  .refine(
    (email) => !isInstitutionalEmail(email),
    "Usa un correo personal de respaldo distinto a @etcandresbello.org."
  );

export const studentRequestCreateSchema = z
  .object({
    requestType: z.enum(STUDENT_REQUEST_TYPES),
    reason: z
      .string()
      .trim()
      .max(600, "El detalle no puede exceder los 600 caracteres.")
      .optional(),
    clientRequestId: z.string().uuid().optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.requestType === "revision_notas" &&
      (!data.reason || data.reason.trim().length < 10)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reason"],
        message:
          "Indica la asignatura, evaluación y motivo de revisión (mínimo 10 caracteres).",
      });
    }
  });

export const verificationCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(
    /^SIGA-[A-Z0-9-]{6,32}$/,
    "Código inválido. Debe iniciar con SIGA- seguido de al menos 6 caracteres alfanuméricos."
  );

export type StudentRequestCreateInput = z.infer<typeof studentRequestCreateSchema>;

export const QA_STUDENT_EMAIL = "estudiante@etcandresbello.org";
export const QA_STUDENT_CEDULA = "V99999996";

/**
 * Regla de visibilidad de la barra QA estudiantil:
 * solo fuera de producción y únicamente para la cuenta sintética `estudiante@etcandresbello.org`.
 */
export function isQaStudentSandboxProfile(
  params: {
    primaryRole: string;
    cedula: string;
    institutionalEmail: string | null;
    authEmail?: string | null;
  },
  nodeEnv: string | undefined = process.env.NODE_ENV
): boolean {
  if (nodeEnv === "production") {
    return false;
  }

  if (params.primaryRole !== "estudiante") {
    return false;
  }

  if (params.cedula !== QA_STUDENT_CEDULA) {
    return false;
  }

  const instEmail = params.institutionalEmail?.trim().toLowerCase();
  const sessionEmail = params.authEmail?.trim().toLowerCase();

  return instEmail === QA_STUDENT_EMAIL || sessionEmail === QA_STUDENT_EMAIL;
}

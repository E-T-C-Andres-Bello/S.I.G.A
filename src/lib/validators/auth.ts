import { z } from "zod";

export const INSTITUTIONAL_EMAIL_DOMAIN = "etcandresbello.org" as const;

export const CEDULA_CANONICAL_REGEX = /^[VEJ][0-9]{6,9}$/;
export const INSTITUTIONAL_EMAIL_REGEX = /^[^\s@]+@etcandresbello\.org$/i;

export type AuthErrorCode =
  | "domain_not_allowed"
  | "not_enrolled"
  | "role_missing"
  | "account_suspended"
  | "oauth_failed"
  | "auth_not_configured"
  | "schema_not_ready";

export const AUTH_ERROR_MESSAGES: Record<AuthErrorCode, string> = {
  domain_not_allowed:
    "Acceso restringido: solo se permiten correos institucionales @etcandresbello.org. Los correos personales (como @gmail.com) no están autorizados.",
  not_enrolled:
    "Tu usuario aún no figura en el registro de matrícula o personal del plantel. Solicita a tu docente o Control de Estudios completar tu inscripción.",
  role_missing:
    "Tu ficha institucional existe, pero aún no tiene un rol asignado en S.I.G.A. Contacta a Control de Estudios o Dirección.",
  account_suspended:
    "Tu acceso institucional se encuentra suspendido temporalmente. Acude a Control de Estudios.",
  oauth_failed:
    "No se pudo completar la verificación con Google Workspace. Intenta nuevamente.",
  auth_not_configured:
    "El servicio de acceso escolar no está disponible temporalmente en este entorno.",
  schema_not_ready:
    "Acceso bloqueado por seguridad: la verificación de matrícula en base de datos aún no está inicializada.",
};

/**
 * Normaliza una cédula venezolana al formato canónico `V12345678`
 * (sin guiones ni espacios; antepone `V` si solo ingresan dígitos).
 */
export function normalizeVenezuelanCedula(raw: string): string | null {
  const cleaned = raw.trim().toUpperCase().replace(/[^VEJ0-9]/g, "");
  if (!cleaned) return null;
  const canonical = /^[0-9]{6,9}$/.test(cleaned) ? `V${cleaned}` : cleaned;
  return CEDULA_CANONICAL_REGEX.test(canonical) ? canonical : null;
}

/**
 * Formatea una cédula canónica (`V12345678`) para lectura humana (`V-12345678`).
 */
export function formatVenezuelanCedulaDisplay(canonical: string): string {
  const normalized = normalizeVenezuelanCedula(canonical);
  if (!normalized) return canonical;
  return `${normalized[0]}-${normalized.slice(1)}`;
}

/**
 * Valida estrictamente el dominio oficial `@etcandresbello.org`.
 */
export function isInstitutionalEmail(rawEmail: string): boolean {
  const trimmed = rawEmail.trim().toLowerCase();
  if (!trimmed.includes("@")) return false;
  return INSTITUTIONAL_EMAIL_REGEX.test(trimmed);
}

/**
 * Detecta en vivo si el usuario escribió un correo externo (ej. @gmail.com)
 * para mostrar retroalimentación inmediata sin permitir el envío.
 */
export function getForeignEmailWarning(identifier: string): string | null {
  const trimmed = identifier.trim().toLowerCase();
  if (!trimmed.includes("@")) return null;
  const atIndex = trimmed.indexOf("@");
  const typedDomain = trimmed.slice(atIndex + 1);
  if (!typedDomain) return null;
  if (typedDomain === INSTITUTIONAL_EMAIL_DOMAIN) return null;
  if (INSTITUTIONAL_EMAIL_DOMAIN.startsWith(typedDomain)) return null;
  return `Solo se admiten correos @${INSTITUTIONAL_EMAIL_DOMAIN}. Los dominios externos como @${typedDomain} están bloqueados.`;
}

export const parsedIdentifierSchema = z
  .string()
  .trim()
  .min(4, "Ingresa tu cédula o correo @etcandresbello.org.")
  .transform((value, ctx) => {
    if (value.includes("@")) {
      const normalizedEmail = value.toLowerCase();
      const emailCheck = z.string().email().safeParse(normalizedEmail);
      if (!emailCheck.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Ingresa un correo institucional válido (@etcandresbello.org).",
        });
        return z.NEVER;
      }
      if (!isInstitutionalEmail(normalizedEmail)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: AUTH_ERROR_MESSAGES.domain_not_allowed,
        });
        return z.NEVER;
      }
      return { kind: "email" as const, value: normalizedEmail };
    }

    const normalizedCedula = normalizeVenezuelanCedula(value);
    if (!normalizedCedula) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Formato inválido. Usa tu cédula (ej. V-12345678) o tu correo @etcandresbello.org.",
      });
      return z.NEVER;
    }

    return { kind: "cedula" as const, value: normalizedCedula };
  });

export const loginCredentialsSchema = z.object({
  identifier: parsedIdentifierSchema,
  password: z
    .string()
    .min(6, "Ingresa tu contraseña institucional (mínimo 6 caracteres).")
    .max(128, "Contraseña demasiado larga."),
});

export type ParsedIdentifier = z.infer<typeof parsedIdentifierSchema>;
export type LoginCredentialsInput = z.infer<typeof loginCredentialsSchema>;

/**
 * Valida rutas de retorno internas para prevenir redirecciones abiertas (`//evil.com`).
 */
export function sanitizeInternalNextPath(nextPath: string | null | undefined): string | null {
  if (!nextPath) return null;
  const trimmed = nextPath.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return null;
  }
  return trimmed;
}

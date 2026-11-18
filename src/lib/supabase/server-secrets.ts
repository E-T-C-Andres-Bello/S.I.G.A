/**
 * Guardia de aislamiento de credenciales de servidor (Regla Innegociable #1 de S.I.G.A.).
 * Nunca debe importarse desde un Client Component (`"use client"`).
 */
if (typeof window !== "undefined") {
  throw new Error(
    "Violación de seguridad: `server-secrets.ts` no puede ejecutarse en el navegador."
  );
}

export interface GoogleDriveServiceAccountCredentials {
  clientEmail: string;
  privateKey: string;
  projectId?: string;
  targetFolderId?: string;
}

/**
 * Verifica que ninguna llave privada haya sido definida por error con prefijo `NEXT_PUBLIC_`.
 */
export function assertZeroPublicSecretLeak(): void {
  const forbiddenPublicVars = [
    "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY",
    "NEXT_PUBLIC_GEMINI_API_KEY",
    "NEXT_PUBLIC_GROQ_API_KEY",
    "NEXT_PUBLIC_NEON_DATABASE_URL",
    "NEXT_PUBLIC_GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON",
    "NEXT_PUBLIC_ORIENTATION_ENCRYPTION_KEY",
  ];

  for (const envName of forbiddenPublicVars) {
    if (process.env[envName]) {
      throw new Error(
        `Configuración insegura detectada: la variable sensible ${envName} no debe usar prefijo NEXT_PUBLIC_.`
      );
    }
  }
}

export function getGeminiServerApiKey(): string | null {
  assertZeroPublicSecretLeak();
  return process.env.GEMINI_API_KEY?.trim() || null;
}

export function getOrientationEncryptionKey(): string | null {
  assertZeroPublicSecretLeak();
  const key = process.env.ORIENTATION_ENCRYPTION_KEY?.trim() || null;
  if (key && key.length < 16) {
    return null;
  }
  return key;
}

export function getGoogleDriveServiceAccountConfig(): GoogleDriveServiceAccountCredentials | null {
  assertZeroPublicSecretLeak();
  const rawJson = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON?.trim();
  if (!rawJson) return null;

  try {
    const parsed = JSON.parse(rawJson) as {
      client_email?: string;
      private_key?: string;
      project_id?: string;
    };
    if (!parsed.client_email || !parsed.private_key) {
      return null;
    }
    return {
      clientEmail: parsed.client_email,
      privateKey: parsed.private_key.replace(/\\n/g, "\n"),
      projectId: parsed.project_id,
      targetFolderId: process.env.GOOGLE_DRIVE_INTERNSHIPS_FOLDER_ID?.trim(),
    };
  } catch {
    return null;
  }
}

"use client";

import { getBrowserSupabaseClient } from "./client";

export interface PasskeyFactorSummary {
  id: string;
  friendlyName: string;
  status: "verified" | "unverified";
  createdAt: string;
}

/**
 * Comprueba si el navegador actual soporta autenticación biométrica WebAuthn / Passkeys.
 */
export async function isBrowserPasskeySupported(): Promise<boolean> {
  if (
    typeof window === "undefined" ||
    typeof window.PublicKeyCredential === "undefined"
  ) {
    return false;
  }

  try {
    if (
      typeof window.PublicKeyCredential
        .isUserVerifyingPlatformAuthenticatorAvailable === "function"
    ) {
      return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Registra una llave biométrica WebAuthn (Passkey MFA) en la sesión institucional de Supabase Auth.
 */
export async function enrollInstitutionalPasskey(
  friendlyName = "Dispositivo Biométrico S.I.G.A."
): Promise<{ ok: true; factorId: string } | { ok: false; message: string }> {
  const supported = await isBrowserPasskeySupported();
  if (!supported) {
    return {
      ok: false,
      message:
        "Este dispositivo o navegador no dispone de lector biométrico compatible con Passkeys.",
    };
  }

  const supabase = getBrowserSupabaseClient();
  if (!supabase) {
    return {
      ok: false,
      message: "El servicio de autenticación no está disponible en este momento.",
    };
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "webauthn",
    friendlyName,
  });

  if (error || !data?.id) {
    return {
      ok: false,
      message:
        "No se pudo registrar la llave biométrica en este momento. Verifica tu sesión institucional.",
    };
  }

  return { ok: true, factorId: data.id };
}

/**
 * Lista los factores WebAuthn registrados por el usuario autenticado.
 */
export async function listInstitutionalPasskeys(): Promise<PasskeyFactorSummary[]> {
  const supabase = getBrowserSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error || !data?.all) return [];

  return data.all
    .filter(
      (f: { factor_type?: string }) => f.factor_type === "webauthn"
    )
    .map(
      (f: {
        id: string;
        friendly_name?: string;
        status?: string;
        created_at: string;
      }) => ({
        id: f.id,
        friendlyName: f.friendly_name || "Passkey Institucional",
        status: f.status === "verified" ? ("verified" as const) : ("unverified" as const),
        createdAt: f.created_at,
      })
    );
}

/**
 * Elimina una llave biométrica WebAuthn previamente registrada en la cuenta del usuario.
 */
export async function unenrollInstitutionalPasskey(
  factorId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = getBrowserSupabaseClient();
  if (!supabase) {
    return {
      ok: false,
      message: "El servicio de autenticación no está disponible en este momento.",
    };
  }

  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) {
    return {
      ok: false,
      message:
        "No se pudo desvincular la llave biométrica en este momento. Intenta nuevamente.",
    };
  }

  return { ok: true };
}

"use client";

import { authClient } from "./client";

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
 * Registra una llave biométrica WebAuthn (Passkey) en Neon PostgreSQL vía Better Auth.
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

  try {
    const result = await authClient.passkey.addPasskey({
      name: friendlyName.trim() || "Dispositivo Biométrico S.I.G.A.",
    });

    if (result?.error) {
      const rawMsg = (result.error.message ?? "").toLowerCase();
      if (rawMsg.includes("abort") || rawMsg.includes("cancel") || rawMsg.includes("notallowed")) {
        return {
          ok: false,
          message: "Registro biométrico cancelado por el usuario.",
        };
      }
      return {
        ok: false,
        message:
          "No se pudo completar el registro biométrico en este momento. Intenta nuevamente.",
      };
    }

    const factorId = result?.data?.id ?? "passkey";
    return { ok: true, factorId };
  } catch {
    return {
      ok: false,
      message:
        "Tu navegador rechazó o canceló la solicitud biométrica WebAuthn.",
    };
  }
}

/**
 * Lista las llaves biométricas (Passkeys) activas asociadas a la sesión actual.
 */
export async function listInstitutionalPasskeys(): Promise<PasskeyFactorSummary[]> {
  try {
    const result = await authClient.passkey.listUserPasskeys();
    if (result?.error || !Array.isArray(result?.data)) {
      return [];
    }

    return result.data.map((factor) => ({
      id: factor.id,
      friendlyName: factor.name?.trim() || "Llave Biométrica S.I.G.A.",
      status: "verified" as const,
      createdAt:
        factor.createdAt instanceof Date
          ? factor.createdAt.toISOString()
          : String(factor.createdAt ?? ""),
    }));
  } catch {
    return [];
  }
}

/**
 * Revoca una llave biométrica previamente registrada.
 */
export async function removeInstitutionalPasskey(
  factorId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const result = await authClient.passkey.deletePasskey({ id: factorId });
    if (result?.error) {
      return {
        ok: false,
        message: "No se pudo revocar la llave biométrica en este momento.",
      };
    }
    return { ok: true };
  } catch {
    return {
      ok: false,
      message: "No se pudo revocar la llave biométrica en este momento.",
    };
  }
}

export const unenrollInstitutionalPasskey = removeInstitutionalPasskey;

"use client";

import { createAuthClient } from "better-auth/react";
import { passkeyClient } from "@better-auth/passkey/client";
import { sanitizeInternalNextPath } from "@/lib/validators/auth";

function getClientBaseUrl(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
}

export const authClient = createAuthClient({
  baseURL: getClientBaseUrl(),
  basePath: "/api/auth",
  plugins: [passkeyClient()],
});

/**
 * Inicia el flujo OAuth institucional de Google Workspace (`@etcandresbello.org`).
 */
export async function startGoogleWorkspaceOAuth(
  returnPath = "/"
): Promise<{ ok: true } | { ok: false; message: string }> {
  const safeReturn = sanitizeInternalNextPath(returnPath) ?? "/";
  const callbackURL = `/api/auth/callback?return_to=${encodeURIComponent(safeReturn)}`;
  const errorCallbackURL = `${safeReturn}?auth_error=oauth_failed`;

  try {
    const result = await authClient.signIn.social({
      provider: "google",
      callbackURL,
      errorCallbackURL,
    });

    if (result?.error) {
      return {
        ok: false,
        message:
          result.error.message ||
          "No se pudo iniciar la autenticación con Google Workspace. Verifica la configuración OAuth.",
      };
    }

    return { ok: true };
  } catch {
    return {
      ok: false,
      message: "No se pudo conectar con Google Workspace en este momento.",
    };
  }
}

/**
 * Vincula una cuenta Google Workspace (`@etcandresbello.org`) a una sesión
 * provisional de estudiante (`provisional_cedula`) ya iniciada.
 */
export async function linkGoogleWorkspaceIdentity(
  returnPath = "/estudiante"
): Promise<{ ok: true } | { ok: false; message: string }> {
  const safeReturn = sanitizeInternalNextPath(returnPath) ?? "/estudiante";
  const callbackURL = `/api/auth/callback?link_mode=workspace&return_to=${encodeURIComponent(safeReturn)}`;
  const errorCallbackURL = `${safeReturn}?auth_error=oauth_failed`;

  try {
    const result = await authClient.linkSocial({
      provider: "google",
      callbackURL,
      errorCallbackURL,
    });

    if (result?.error) {
      return {
        ok: false,
        message:
          result.error.message ||
          "No se pudo iniciar la vinculación con Google Workspace.",
      };
    }

    return { ok: true };
  } catch {
    return {
      ok: false,
      message: "No se pudo conectar con Google Workspace en este momento.",
    };
  }
}

/**
 * Cierra la sesión institucional activa desde el navegador.
 */
export async function signOutClientSession(): Promise<void> {
  try {
    await authClient.signOut();
  } catch {
    // Continuar redirección aunque la red esté inestable
  }
}

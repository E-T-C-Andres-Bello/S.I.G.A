"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AUTH_ERROR_MESSAGES,
  INSTITUTIONAL_EMAIL_DOMAIN,
} from "@/lib/validators/auth";
import { getSupabasePublicConfig } from "./env";

let browserClient: SupabaseClient | null = null;

/**
 * Crea o reutiliza el cliente Supabase del navegador.
 * Retorna `null` si las variables públicas aún no han sido configuradas.
 */
export function getBrowserSupabaseClient(): SupabaseClient | null {
  if (browserClient) {
    return browserClient;
  }

  const config = getSupabasePublicConfig();
  if (!config) {
    return null;
  }

  browserClient = createBrowserClient(config.url, config.anonKey);
  return browserClient;
}

/**
 * Inicia Google Workspace OAuth forzando el dominio del plantel (`@etcandresbello.org`).
 * Devuelve un mensaje de error si el cliente no está listo o falla la redirección.
 */
export async function startGoogleWorkspaceOAuth(
  callbackReturnPath = "/"
): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = getBrowserSupabaseClient();
  if (!supabase) {
    return {
      ok: false,
      message: AUTH_ERROR_MESSAGES.supabase_not_configured,
    };
  }

  try {
    const callbackUrl = new URL("/api/auth/callback", window.location.origin);
    callbackUrl.searchParams.set("return_to", callbackReturnPath);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl.toString(),
        queryParams: {
          hd: INSTITUTIONAL_EMAIL_DOMAIN,
          prompt: "select_account",
        },
      },
    });

    if (error) {
      return { ok: false, message: AUTH_ERROR_MESSAGES.oauth_failed };
    }

    return { ok: true };
  } catch {
    return { ok: false, message: AUTH_ERROR_MESSAGES.oauth_failed };
  }
}

/**
 * Vincula una identidad Google Workspace (`@etcandresbello.org`) sobre una sesión
 * provisional activa por cédula para elevar el acceso a `verified_workspace`.
 */
export async function linkGoogleWorkspaceIdentity(
  callbackReturnPath = "/estudiante"
): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = getBrowserSupabaseClient();
  if (!supabase) {
    return {
      ok: false,
      message: AUTH_ERROR_MESSAGES.supabase_not_configured,
    };
  }

  try {
    const callbackUrl = new URL("/api/auth/callback", window.location.origin);
    callbackUrl.searchParams.set("return_to", callbackReturnPath);
    callbackUrl.searchParams.set("next", callbackReturnPath);
    callbackUrl.searchParams.set("link_mode", "workspace");

    const { error } = await supabase.auth.linkIdentity({
      provider: "google",
      options: {
        redirectTo: callbackUrl.toString(),
        queryParams: {
          hd: INSTITUTIONAL_EMAIL_DOMAIN,
          prompt: "select_account",
        },
      },
    });

    if (error) {
      return {
        ok: false,
        message:
          "No se pudo iniciar la vinculación directa desde esta sesión. Si ya tienes tu cuenta @etcandresbello.org asignada por Control de Estudios, cierra sesión e ingresa con Google.",
      };
    }

    return { ok: true };
  } catch {
    return { ok: false, message: AUTH_ERROR_MESSAGES.oauth_failed };
  }
}

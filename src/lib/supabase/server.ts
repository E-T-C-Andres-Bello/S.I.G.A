import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getSupabasePublicConfig, getSupabaseServiceRoleKey } from "./env";

/**
 * Cliente Supabase SSR ligado a las cookies de sesión HTTP actuales.
 */
export async function createServerSupabaseClient(): Promise<SupabaseClient | null> {
  const config = getSupabasePublicConfig();
  if (!config) {
    return null;
  }

  const cookieStore = await cookies();

  return createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // En Server Components de solo lectura Next.js impide mutar cookies.
        }
      },
    },
  });
}

/**
 * Cliente Supabase autenticado con un JWT recién emitido (uso exclusivo en servidor
 * cuando aún no se han propagado cookies en el mismo ciclo HTTP).
 */
export function createTokenSupabaseClient(
  accessToken: string
): SupabaseClient | null {
  if (typeof window !== "undefined") {
    throw new Error("createTokenSupabaseClient solo puede ejecutarse en el servidor.");
  }

  const config = getSupabasePublicConfig();
  if (!config || !accessToken) {
    return null;
  }

  return createClient(config.url, config.anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Cliente administrativo exclusivo de servidor (`service_role`).
 * Jamás debe importarse ni exponerse en componentes `"use client"`.
 */
export function createAdminSupabaseClient(): SupabaseClient | null {
  if (typeof window !== "undefined") {
    throw new Error("createAdminSupabaseClient solo puede ejecutarse en el servidor.");
  }

  const config = getSupabasePublicConfig();
  const serviceRoleKey = getSupabaseServiceRoleKey();

  if (!config || !serviceRoleKey) {
    return null;
  }

  return createClient(config.url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export interface SupabasePublicConfig {
  url: string;
  anonKey: string;
}

/**
 * Devuelve únicamente las variables públicas autorizadas en Next.js (`NEXT_PUBLIC_`).
 * Retorna `null` si aún no han sido configuradas en `.env.local`.
 */
export function getSupabasePublicConfig(): SupabasePublicConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY?.trim();

  if (!url || !anonKey) {
    return null;
  }

  return { url, anonKey };
}

/**
 * Obtiene la clave administrativa `service_role` / `secret` exclusivamente en servidor.
 */
export function getSupabaseServiceRoleKey(): string | null {
  if (typeof window !== "undefined") {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY no puede consultarse en el navegador.");
  }

  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SECRET_KEY?.trim();
  return key || null;
}

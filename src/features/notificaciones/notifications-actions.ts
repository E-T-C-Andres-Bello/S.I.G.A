"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? Record<never, never> : { data: T }))
  | { ok: false; message: string };

const markNotificationSchema = z.object({
  notificationId: z.string().uuid("Identificador de notificación inválido."),
  isRead: z.boolean().default(true),
});

export async function markNotificationReadAction(
  notificationId: string,
  isRead = true
): Promise<ActionResult<{ id: string; isRead: boolean; readAt: string | null }>> {
  const parsed = markNotificationSchema.safeParse({ notificationId, isRead });
  if (!parsed.success) {
    return {
      ok: false,
      message: "No se pudo identificar el aviso seleccionado.",
    };
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return {
      ok: false,
      message: "El servicio institucional no está disponible en este momento.",
    };
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return {
      ok: false,
      message: "Tu sesión expiró. Inicia sesión nuevamente.",
    };
  }

  const { data, error } = await supabase.rpc("siga_marcar_notificacion_leida", {
    p_notification_id: parsed.data.notificationId,
    p_is_read: parsed.data.isRead,
  });

  if (error) {
    return {
      ok: false,
      message: "No se pudo actualizar el estado de la notificación.",
    };
  }

  revalidatePath("/notificaciones");

  const payload =
    data && typeof data === "object"
      ? (data as { id?: string; is_read?: boolean; read_at?: string | null })
      : null;

  return {
    ok: true,
    data: {
      id: payload?.id ?? parsed.data.notificationId,
      isRead:
        typeof payload?.is_read === "boolean"
          ? payload.is_read
          : parsed.data.isRead,
      readAt: payload?.read_at ?? (parsed.data.isRead ? new Date().toISOString() : null),
    },
  };
}

export async function markAllNotificationsReadAction(): Promise<
  ActionResult<{ updatedCount: number }>
> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return {
      ok: false,
      message: "El servicio institucional no está disponible en este momento.",
    };
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return {
      ok: false,
      message: "Tu sesión expiró. Inicia sesión nuevamente.",
    };
  }

  const { data, error } = await supabase.rpc(
    "siga_marcar_todas_notificaciones_leidas"
  );

  if (error) {
    return {
      ok: false,
      message: "No se pudieron marcar todas las notificaciones como leídas.",
    };
  }

  revalidatePath("/notificaciones");

  const updatedCount =
    data && typeof data === "object" && "updated_count" in data
      ? Number((data as { updated_count?: number }).updated_count ?? 0)
      : 0;

  return {
    ok: true,
    data: { updatedCount },
  };
}

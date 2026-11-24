"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getServerAuthSession, isAuthConfigured } from "@/lib/auth/server";
import { callNeonRpcScalar, withUserDb } from "@/lib/db/neon";

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

  if (!isAuthConfigured()) {
    return {
      ok: false,
      message: "El servicio institucional no está disponible en este momento.",
    };
  }

  const session = await getServerAuthSession();
  if (!session) {
    return {
      ok: false,
      message: "Tu sesión expiró. Inicia sesión nuevamente.",
    };
  }

  try {
    const data = await withUserDb(
      { authUserId: session.authUserId, email: session.email },
      (client) =>
        callNeonRpcScalar<{ id?: string; is_read?: boolean; read_at?: string | null }>(
          client,
          "siga_marcar_notificacion_leida",
          {
            p_notification_id: parsed.data.notificationId,
            p_is_read: parsed.data.isRead,
          }
        )
    );

    revalidatePath("/notificaciones");

    return {
      ok: true,
      data: {
        id: data?.id ?? parsed.data.notificationId,
        isRead:
          typeof data?.is_read === "boolean"
            ? data.is_read
            : parsed.data.isRead,
        readAt: data?.read_at ?? (parsed.data.isRead ? new Date().toISOString() : null),
      },
    };
  } catch {
    return {
      ok: false,
      message: "No se pudo actualizar el estado de la notificación.",
    };
  }
}

export async function markAllNotificationsReadAction(): Promise<
  ActionResult<{ updatedCount: number }>
> {
  if (!isAuthConfigured()) {
    return {
      ok: false,
      message: "El servicio institucional no está disponible en este momento.",
    };
  }

  const session = await getServerAuthSession();
  if (!session) {
    return {
      ok: false,
      message: "Tu sesión expiró. Inicia sesión nuevamente.",
    };
  }

  try {
    const data = await withUserDb(
      { authUserId: session.authUserId, email: session.email },
      (client) =>
        callNeonRpcScalar<{ updated_count?: number }>(
          client,
          "siga_marcar_todas_notificaciones_leidas"
        )
    );

    revalidatePath("/notificaciones");

    return {
      ok: true,
      data: { updatedCount: Number(data?.updated_count ?? 0) },
    };
  } catch {
    return {
      ok: false,
      message: "No se pudieron marcar todas las notificaciones como leídas.",
    };
  }
}

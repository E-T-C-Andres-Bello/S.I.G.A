"use server";

import { revalidatePath } from "next/cache";
import { getServerAuthSession, isAuthConfigured } from "@/lib/auth/server";
import { callNeonRpcScalar, withUserDb } from "@/lib/db/neon";
import { devWarn } from "@/lib/dev-logger";
import {
  archiveAnnouncementSchema,
  confirmAnnouncementReadSchema,
  upsertAnnouncementSchema,
  type UpsertAnnouncementInput,
} from "@/lib/validators/bulletin";

function resolveBulletinNotifyFunctionUrl(): string | null {
  const override = process.env.NEON_FUNCTION_BULLETINNOTIFY_URL?.trim();
  if (override) return override.replace(/\/+$/, "");

  const branchId = process.env.NEON_BRANCH_ID?.trim();
  const hostSuffix = process.env.NEON_FUNCTION_HOST_SUFFIX?.trim();
  if (!branchId || !hostSuffix) return null;

  return `https://${branchId}-bulletinnotify${hostSuffix}`;
}

/**
 * Despacha en segundo plano (best-effort) el workflow de notificación por correo
 * (Neon Function `bulletinnotify` -> n8n -> Mailtrap) cuando se publica un comunicado.
 * Nunca bloquea ni revierte la publicación en la cartelera.
 */
async function dispatchBulletinPublishEmailWorkflow(
  announcementId: string
): Promise<void> {
  const targetUrl = resolveBulletinNotifyFunctionUrl();
  if (!targetUrl) {
    devWarn(
      "neon:functions",
      "Neon Function bulletinnotify no configurada; despacho de correo omitido"
    );
    return;
  }

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const workflowSecret = process.env.WORKFLOW_WEBHOOK_SECRET?.trim();
    if (workflowSecret) {
      headers["x-siga-workflow-secret"] = workflowSecret;
    }

    const res = await fetch(targetUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ record_id: announcementId }),
      signal: AbortSignal.timeout(5_000),
    });

    if (!res.ok) {
      devWarn("neon:functions", "bulletinnotify respondió estado no exitoso", {
        status: res.status,
      });
    }
  } catch (error) {
    devWarn(
      "neon:functions",
      "No se pudo invocar bulletinnotify (comunicado ya publicado)",
      { reason: error instanceof Error ? error.message : "unknown" }
    );
  }
}

type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? Record<never, never> : { data: T }))
  | { ok: false; message: string };

export async function confirmAnnouncementReadAction(
  announcementId: string
): Promise<
  ActionResult<{
    announcementId: string;
    alreadyConfirmed: boolean;
    readCount: number;
    readAt: string;
  }>
> {
  const parsed = confirmAnnouncementReadSchema.safeParse({ announcementId });
  if (!parsed.success) {
    return {
      ok: false,
      message: "No se pudo identificar el comunicado seleccionado.",
    };
  }

  if (!isAuthConfigured()) {
    return {
      ok: false,
      message: "El servicio escolar no está disponible en este momento.",
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
    const result = await withUserDb(
      { authUserId: session.authUserId, email: session.email },
      (client) =>
        callNeonRpcScalar<{
          announcement_id?: string;
          already_confirmed?: boolean;
          read_count?: number;
          read_at?: string;
        }>(client, "siga_confirm_announcement_read", {
          p_announcement_id: parsed.data.announcementId,
        })
    );

    revalidatePath("/estudiante");
    revalidatePath("/estudiante/cartelera");
    revalidatePath("/cartelera/gestion");

    return {
      ok: true,
      data: {
        announcementId: result?.announcement_id ?? parsed.data.announcementId,
        alreadyConfirmed: Boolean(result?.already_confirmed),
        readCount: Number(result?.read_count ?? 1),
        readAt: result?.read_at ?? new Date().toISOString(),
      },
    };
  } catch {
    return {
      ok: false,
      message: "No se pudo registrar tu confirmación en este momento.",
    };
  }
}

export async function upsertSchoolAnnouncementAction(
  rawInput: UpsertAnnouncementInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = upsertAnnouncementSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      message:
        parsed.error.issues[0]?.message ??
        "Revisa los campos del comunicado antes de publicar.",
    };
  }

  if (!isAuthConfigured()) {
    return {
      ok: false,
      message: "El servicio escolar no está disponible en este momento.",
    };
  }

  const session = await getServerAuthSession();
  if (!session) {
    return {
      ok: false,
      message: "Tu sesión expiró. Inicia sesión nuevamente.",
    };
  }

  const input = parsed.data;
  try {
    const result = await withUserDb(
      { authUserId: session.authUserId, email: session.email },
      (client) =>
        callNeonRpcScalar<{ id?: string }>(
          client,
          "siga_upsert_school_announcement",
          {
            p_announcement_id: input.announcementId ?? null,
            p_title: input.title,
            p_short_note: input.shortNote,
            p_body: input.body,
            p_category: input.category,
            p_target_mencion_id: input.targetMencionId ?? null,
            p_target_grade_year: input.targetGradeYear ?? null,
            p_event_date: input.eventDate ?? null,
            p_location_label: input.locationLabel ?? null,
            p_cover_webp_url: input.coverWebpUrl ?? null,
            p_theme_palette: input.themePalette
              ? JSON.stringify(input.themePalette)
              : null,
            p_is_pinned: input.isPinned,
            p_is_published: input.isPublished,
            p_expires_at: input.expiresAt ?? null,
          }
        )
    );

    if (!result?.id) {
      return {
        ok: false,
        message: "No se pudo guardar el comunicado escolar.",
      };
    }

    revalidatePath("/estudiante");
    revalidatePath("/estudiante/cartelera");
    revalidatePath("/cartelera/gestion");

    if (input.isPublished) {
      void dispatchBulletinPublishEmailWorkflow(result.id);
    }

    return {
      ok: true,
      data: { id: result.id },
    };
  } catch {
    return {
      ok: false,
      message:
        "No se pudo publicar el comunicado. Verifica tus permisos editoriales y las fechas ingresadas.",
    };
  }
}

export async function archiveSchoolAnnouncementAction(
  announcementId: string
): Promise<ActionResult<{ id: string }>> {
  const parsed = archiveAnnouncementSchema.safeParse({ announcementId });
  if (!parsed.success) {
    return {
      ok: false,
      message: "Comunicado no válido.",
    };
  }

  if (!isAuthConfigured()) {
    return {
      ok: false,
      message: "El servicio escolar no está disponible en este momento.",
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
    const result = await withUserDb(
      { authUserId: session.authUserId, email: session.email },
      (client) =>
        callNeonRpcScalar<{ id?: string }>(
          client,
          "siga_archive_school_announcement",
          {
            p_announcement_id: parsed.data.announcementId,
          }
        )
    );

    revalidatePath("/estudiante");
    revalidatePath("/estudiante/cartelera");
    revalidatePath("/cartelera/gestion");

    return {
      ok: true,
      data: { id: result?.id ?? parsed.data.announcementId },
    };
  } catch {
    return {
      ok: false,
      message: "No se pudo archivar el comunicado en este momento.",
    };
  }
}

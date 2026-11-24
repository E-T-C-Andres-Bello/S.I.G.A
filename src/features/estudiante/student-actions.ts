"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getServerAuthSession, isAuthConfigured } from "@/lib/auth/server";
import { verifyPreEnrolledAccess } from "@/lib/auth/verification";
import {
  callNeonRpcScalar,
  querySingleRow,
  withServiceDb,
  withUserDb,
} from "@/lib/db/neon";
import { devWarn } from "@/lib/dev-logger";
import {
  recoveryEmailSchema,
  studentAvatarUrlSchema,
  studentProfileContactSchema,
  studentRequestCreateSchema,
  type StudentProfileContactInput,
  type StudentProfileContactParsed,
  type StudentRequestCreateInput,
} from "@/lib/validators/student-portal";

export interface StudentCarnetTokenPayload {
  token: string;
  issuedAt: string;
  expiresAt: string;
  ttlSeconds: number;
  card: {
    fullName: string;
    cedula: string;
    institutionalEmail: string | null;
    avatarWebpUrl: string | null;
    gradeYear: number | null;
    sectionLetter: string | null;
    mencionCode: string | null;
    mencionName: string | null;
    schoolYearCode: string | null;
    schoolYearName: string | null;
    enrollmentStatus: string | null;
  };
}

type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? Record<never, never> : { data: T }))
  | { ok: false; message: string; code?: string };

async function requireAuthenticatedStudentSession() {
  if (!isAuthConfigured()) {
    return {
      ok: false as const,
      message: "El servicio institucional no está disponible en este momento.",
    };
  }

  const session = await getServerAuthSession();
  if (!session) {
    return {
      ok: false as const,
      message: "Tu sesión expiró. Inicia sesión nuevamente.",
    };
  }

  const verification = await verifyPreEnrolledAccess({
    authUserId: session.authUserId,
    email: session.email,
    loginMethod: "credentials",
  });

  if (!verification.ok) {
    return {
      ok: false as const,
      message: "No tienes permisos activos para operar en el portal estudiantil.",
    };
  }

  return {
    ok: true as const,
    authUserId: session.authUserId,
    authEmail: session.email,
    internalUserId: verification.internalUserId,
    primaryRole: verification.primaryRole,
  };
}

function mapPgRpcError(err: unknown): { message: string; code?: string } {
  const pgErr =
    err && typeof err === "object"
      ? (err as { code?: string; message?: string })
      : null;
  if (!pgErr) {
    return { message: "Ocurrió un error inesperado al procesar la solicitud." };
  }
  if (pgErr.code === "42883") {
    return {
      code: pgErr.code,
      message:
        "Este servicio aún no se encuentra habilitado en la plataforma escolar. Intenta más tarde o consulta en Control de Estudios.",
    };
  }
  if (pgErr.code === "23505") {
    return {
      code: pgErr.code,
      message: "Ya tienes una solicitud activa de este mismo tipo en curso.",
    };
  }
  if (pgErr.code === "22023") {
    return {
      code: pgErr.code,
      message: pgErr.message || "Los datos enviados no cumplen las reglas académicas.",
    };
  }
  if (pgErr.code === "42501") {
    return {
      code: pgErr.code,
      message: "No cuentas con el nivel de acceso requerido para esta operación.",
    };
  }
  return {
    code: pgErr.code,
    message: "No se pudo completar la operación en este momento. Intenta nuevamente.",
  };
}

export async function updateRecoveryEmailAction(
  rawEmail: string
): Promise<ActionResult<{ recoveryEmail: string }>> {
  const parsed = recoveryEmailSchema.safeParse(rawEmail);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Correo de recuperación inválido.",
    };
  }

  const session = await requireAuthenticatedStudentSession();
  if (!session.ok) return session;

  try {
    const data = await withUserDb(
      { authUserId: session.authUserId, email: session.authEmail },
      (client) =>
        callNeonRpcScalar<{ recovery_email?: string }>(
          client,
          "siga_actualizar_correo_recuperacion",
          { p_recovery_email: parsed.data }
        )
    );

    revalidatePath("/estudiante");
    return {
      ok: true,
      data: { recoveryEmail: data?.recovery_email ?? parsed.data },
    };
  } catch (err) {
    const mapped = mapPgRpcError(err);
    return { ok: false, message: mapped.message, code: mapped.code };
  }
}

function resolveNeonFunctionUrl(slug: string): string | null {
  const override = process.env.NEON_FUNCTION_STUDENTREQMAIL_URL?.trim();
  if (override) return override.replace(/\/+$/, "");

  const branchId = process.env.NEON_BRANCH_ID?.trim();
  const hostSuffix = process.env.NEON_FUNCTION_HOST_SUFFIX?.trim();
  if (!branchId || !hostSuffix || !/^[a-z0-9]{1,20}$/.test(slug)) {
    return null;
  }

  return `https://${branchId}-${slug}${hostSuffix}`;
}

/**
 * Despacha en segundo plano (best-effort) el workflow de notificación por correo
 * hacia la Neon Function `studentreqmail`. Nunca bloquea ni falla la creación del trámite.
 */
async function dispatchStudentRequestEmailWorkflow(requestId: string): Promise<void> {
  const targetUrl = resolveNeonFunctionUrl("studentreqmail");
  if (!targetUrl) {
    devWarn(
      "neon:functions",
      "Neon Function studentreqmail no configurada en env local; despacho omitido"
    );
    return;
  }

  try {
    const runRow = await withServiceDb((client) =>
      querySingleRow<{ id: string }>(
        client,
        `SELECT id
           FROM workflows.workflow_runs
          WHERE workflow_code = 'student_request_mailtrap'
            AND source_record_id = $1::uuid
          LIMIT 1`,
        [requestId]
      )
    );

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const webhookSecret = process.env.WORKFLOW_WEBHOOK_SECRET?.trim();
    if (webhookSecret) {
      headers["x-siga-workflow-secret"] = webhookSecret;
    }

    const res = await fetch(targetUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        record_id: requestId,
        workflow_run_id: runRow?.id ?? undefined,
      }),
      signal: AbortSignal.timeout(4_000),
    });

    if (!res.ok) {
      devWarn("neon:functions", "studentreqmail respondió estado no exitoso", {
        status: res.status,
      });
    }
  } catch (error) {
    devWarn("neon:functions", "No se pudo invocar studentreqmail (trámite ya guardado)", {
      reason: error instanceof Error ? error.message : "unknown",
    });
  }
}

export async function createStudentRequestAction(
  input: StudentRequestCreateInput
): Promise<ActionResult<{ requestId: string }>> {
  const parsed = studentRequestCreateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Revisa los campos del trámite.",
    };
  }

  const session = await requireAuthenticatedStudentSession();
  if (!session.ok) return session;

  try {
    const data = await withUserDb(
      { authUserId: session.authUserId, email: session.authEmail },
      (client) =>
        callNeonRpcScalar<{ request?: { id?: string } }>(
          client,
          "siga_crear_solicitud_estudiante",
          {
            p_request_type: parsed.data.requestType,
            p_reason: parsed.data.reason ?? undefined,
            p_client_request_id: parsed.data.clientRequestId ?? undefined,
          }
        )
    );

    const requestId = data?.request?.id ?? "";
    if (requestId) {
      await dispatchStudentRequestEmailWorkflow(requestId);
    }

    revalidatePath("/estudiante");
    revalidatePath("/estudiante/tramites");

    return {
      ok: true,
      data: { requestId },
    };
  } catch (err) {
    const mapped = mapPgRpcError(err);
    return { ok: false, message: mapped.message, code: mapped.code };
  }
}

export async function cancelStudentRequestAction(
  requestId: string
): Promise<ActionResult> {
  const idCheck = z.string().uuid().safeParse(requestId);
  if (!idCheck.success) {
    return { ok: false, message: "Identificador de solicitud inválido." };
  }

  const session = await requireAuthenticatedStudentSession();
  if (!session.ok) return session;

  try {
    await withUserDb(
      { authUserId: session.authUserId, email: session.authEmail },
      (client) =>
        callNeonRpcScalar(client, "siga_cancelar_solicitud_estudiante", {
          p_request_id: idCheck.data,
        })
    );

    revalidatePath("/estudiante");
    revalidatePath("/estudiante/tramites");

    return { ok: true };
  } catch (err) {
    const mapped = mapPgRpcError(err);
    return { ok: false, message: mapped.message, code: mapped.code };
  }
}

export async function generateStudentCarnetTokenAction(
  ttlSeconds = 120
): Promise<ActionResult<StudentCarnetTokenPayload>> {
  const session = await requireAuthenticatedStudentSession();
  if (!session.ok) return session;

  const safeTtl = Math.min(300, Math.max(60, Math.round(ttlSeconds)));

  try {
    const raw = await withUserDb(
      { authUserId: session.authUserId, email: session.authEmail },
      (client) =>
        callNeonRpcScalar<{
          token?: string;
          issued_at?: string;
          expires_at?: string;
          ttl_seconds?: number;
          card?: {
            full_name?: string;
            cedula?: string;
            institutional_email?: string | null;
            avatar_webp_url?: string | null;
            grade_year?: number | null;
            section_letter?: string | null;
            mencion_code?: string | null;
            mencion_name?: string | null;
            school_year_code?: string | null;
            school_year_name?: string | null;
            enrollment_status?: string | null;
          };
        }>(client, "siga_generar_token_carnet", { p_ttl_seconds: safeTtl })
    );

    if (!raw || !raw.token || !raw.expires_at || !raw.card) {
      return { ok: false, message: "Respuesta incompleta al firmar el Carnet QR." };
    }

    return {
      ok: true,
      data: {
        token: raw.token,
        issuedAt: raw.issued_at ?? new Date().toISOString(),
        expiresAt: raw.expires_at,
        ttlSeconds: Number(raw.ttl_seconds ?? safeTtl),
        card: {
          fullName: raw.card.full_name ?? "Estudiante E.T.C.",
          cedula: raw.card.cedula ?? "",
          institutionalEmail: raw.card.institutional_email ?? null,
          avatarWebpUrl: raw.card.avatar_webp_url ?? null,
          gradeYear: raw.card.grade_year ?? null,
          sectionLetter: raw.card.section_letter ?? null,
          mencionCode: raw.card.mencion_code ?? null,
          mencionName: raw.card.mencion_name ?? null,
          schoolYearCode: raw.card.school_year_code ?? null,
          schoolYearName: raw.card.school_year_name ?? null,
          enrollmentStatus: raw.card.enrollment_status ?? null,
        },
      },
    };
  } catch (err) {
    const mapped = mapPgRpcError(err);
    return { ok: false, message: mapped.message, code: mapped.code };
  }
}

export async function updateStudentProfileContactAction(
  input: StudentProfileContactInput
): Promise<ActionResult<StudentProfileContactParsed & { changedFields: string[] }>> {
  const parsed = studentProfileContactSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message:
        parsed.error.issues[0]?.message ??
        "Revisa los datos de contacto y emergencia ingresados.",
    };
  }

  const session = await requireAuthenticatedStudentSession();
  if (!session.ok) return session;

  try {
    const data = await withUserDb(
      { authUserId: session.authUserId, email: session.authEmail },
      (client) =>
        callNeonRpcScalar<{ changed_fields?: string[] }>(
          client,
          "siga_actualizar_perfil_estudiante",
          {
            p_phone: parsed.data.phone,
            p_recovery_email: parsed.data.recoveryEmail,
            p_emergency_contact_name: parsed.data.emergencyContactName,
            p_emergency_contact_cedula: parsed.data.emergencyContactCedula,
            p_emergency_contact_phone: parsed.data.emergencyContactPhone,
            p_emergency_contact_relationship: parsed.data.emergencyContactRelationship,
          }
        )
    );

    revalidatePath("/estudiante");
    revalidatePath("/estudiante/perfil");

    return {
      ok: true,
      data: {
        ...parsed.data,
        changedFields: Array.isArray(data?.changed_fields) ? data.changed_fields : [],
      },
    };
  } catch (err) {
    const mapped = mapPgRpcError(err);
    return { ok: false, message: mapped.message, code: mapped.code };
  }
}

export async function updateStudentAvatarUrlAction(
  avatarUrl: string | null
): Promise<ActionResult<{ avatarWebpUrl: string | null }>> {
  const parsed = studentAvatarUrlSchema.safeParse(avatarUrl);
  if (!parsed.success) {
    return {
      ok: false,
      message:
        parsed.error.issues[0]?.message ??
        "La fotografía seleccionada no cumple el formato institucional.",
    };
  }

  const session = await requireAuthenticatedStudentSession();
  if (!session.ok) return session;

  try {
    const data = await withUserDb(
      { authUserId: session.authUserId, email: session.authEmail },
      (client) =>
        callNeonRpcScalar<{ avatar_webp_url?: string | null }>(
          client,
          "siga_actualizar_avatar_estudiante",
          { p_avatar_webp_url: parsed.data }
        )
    );

    revalidatePath("/estudiante");
    revalidatePath("/estudiante/perfil");
    revalidatePath("/estudiante/carnet");

    return {
      ok: true,
      data: { avatarWebpUrl: data?.avatar_webp_url ?? parsed.data },
    };
  } catch (err) {
    const mapped = mapPgRpcError(err);
    return { ok: false, message: mapped.message, code: mapped.code };
  }
}

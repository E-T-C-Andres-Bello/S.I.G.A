"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { verifyPreEnrolledAccess } from "@/lib/supabase/auth-verification";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  recoveryEmailSchema,
  studentRequestCreateSchema,
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
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return {
      ok: false as const,
      message: "El servicio institucional no está disponible en este momento.",
    };
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return {
      ok: false as const,
      message: "Tu sesión expiró. Inicia sesión nuevamente.",
    };
  }

  const verification = await verifyPreEnrolledAccess({
    authUserId: user.id,
    email: user.email,
    loginMethod: "credentials",
    sessionClient: supabase,
  });

  if (!verification.ok) {
    return {
      ok: false as const,
      message: "No tienes permisos activos para operar en el portal estudiantil.",
    };
  }

  return {
    ok: true as const,
    supabase,
    internalUserId: verification.internalUserId,
    primaryRole: verification.primaryRole,
  };
}

function mapRpcError(error: { code?: string; message?: string } | null): string {
  if (!error) return "Ocurrió un error inesperado al procesar la solicitud.";
  if (
    error.code === "PGRST202" ||
    error.message?.includes("Could not find the function")
  ) {
    return "Este servicio aún no se encuentra habilitado en la plataforma escolar. Intenta más tarde o consulta en Control de Estudios.";
  }
  if (error.code === "23505") {
    return "Ya tienes una solicitud activa de este mismo tipo en curso.";
  }
  if (error.code === "22023") {
    return error.message || "Los datos enviados no cumplen las reglas académicas.";
  }
  if (error.code === "42501") {
    return "No cuentas con el nivel de acceso requerido para esta operación.";
  }
  return "No se pudo completar la operación en este momento. Intenta nuevamente.";
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

  const { data, error } = await session.supabase.rpc(
    "siga_actualizar_correo_recuperacion",
    {
      p_recovery_email: parsed.data,
    }
  );

  if (error) {
    return { ok: false, message: mapRpcError(error), code: error.code };
  }

  revalidatePath("/estudiante");
  const recoveryEmail =
    data && typeof data === "object" && "recovery_email" in data
      ? String((data as { recovery_email: string }).recovery_email)
      : parsed.data;

  return { ok: true, data: { recoveryEmail } };
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

  const { data, error } = await session.supabase.rpc(
    "siga_crear_solicitud_estudiante",
    {
      p_request_type: parsed.data.requestType,
      p_reason: parsed.data.reason ?? undefined,
      p_client_request_id: parsed.data.clientRequestId ?? undefined,
    }
  );

  if (error) {
    return { ok: false, message: mapRpcError(error), code: error.code };
  }

  revalidatePath("/estudiante");
  revalidatePath("/estudiante/tramites");

  const reqObj =
    data && typeof data === "object" && "request" in data
      ? (data as { request?: { id?: string } }).request
      : undefined;

  return {
    ok: true,
    data: { requestId: reqObj?.id ?? "" },
  };
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

  const { error } = await session.supabase.rpc(
    "siga_cancelar_solicitud_estudiante",
    {
      p_request_id: idCheck.data,
    }
  );

  if (error) {
    return { ok: false, message: mapRpcError(error), code: error.code };
  }

  revalidatePath("/estudiante");
  revalidatePath("/estudiante/tramites");

  return { ok: true };
}

export async function generateStudentCarnetTokenAction(
  ttlSeconds = 120
): Promise<ActionResult<StudentCarnetTokenPayload>> {
  const session = await requireAuthenticatedStudentSession();
  if (!session.ok) return session;

  const safeTtl = Math.min(300, Math.max(60, Math.round(ttlSeconds)));
  const { data, error } = await session.supabase.rpc(
    "siga_generar_token_carnet",
    {
      p_ttl_seconds: safeTtl,
    }
  );

  if (error || !data || typeof data !== "object") {
    return { ok: false, message: mapRpcError(error), code: error?.code };
  }

  const raw = data as {
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
  };

  if (!raw.token || !raw.expires_at || !raw.card) {
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
}

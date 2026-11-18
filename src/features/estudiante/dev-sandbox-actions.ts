"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { verifyPreEnrolledAccess } from "@/lib/supabase/auth-verification";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isQaStudentSandboxProfile } from "@/lib/validators/student-portal";
import { type StudentSandboxState } from "./dev-sandbox";

function toStudentSandboxState(
  raw: Omit<StudentSandboxState, "available">
): StudentSandboxState {
  return {
    available: true,
    access_tier: raw.access_tier,
    institutional_email: raw.institutional_email,
    cedula: raw.cedula,
    menciones: Array.isArray(raw.menciones) ? raw.menciones : [],
    school_years: Array.isArray(raw.school_years) ? raw.school_years : [],
    momentos: Array.isArray(raw.momentos) ? raw.momentos : [],
    current_enrollment: raw.current_enrollment ?? null,
    stats: raw.stats,
  };
}

const switchContextSchema = z.object({
  mencionCode: z.string().trim().min(2).max(24).optional(),
  gradeYear: z.number().int().min(1).max(6).optional(),
  sectionLetter: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{1,3}$/)
    .optional(),
  schoolYearCode: z.string().trim().min(4).max(24).optional(),
  activeMoment: z.number().int().min(1).max(3).optional(),
  accessTier: z.enum(["verified_workspace", "provisional_cedula"]).optional(),
});

const syntheticDataSchema = z.object({
  action: z.enum(["populate", "clear"]),
});

export type SwitchStudentContextInput = z.infer<typeof switchContextSchema>;

type DevActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? Record<never, never> : { data: T }))
  | { ok: false; message: string };

async function requireQaStudentSession() {
  if (process.env.NODE_ENV === "production") {
    return {
      ok: false as const,
      message: "Herramienta deshabilitada en producción.",
    };
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return {
      ok: false as const,
      message: "El servicio escolar no está disponible.",
    };
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      ok: false as const,
      message: "Tu sesión expiró. Vuelve a iniciar sesión.",
    };
  }

  const verification = await verifyPreEnrolledAccess({
    authUserId: user.id,
    email: user.email,
    loginMethod: "credentials",
    sessionClient: supabase,
  });

  if (!verification.ok || verification.primaryRole !== "estudiante") {
    return {
      ok: false as const,
      message: "No tienes acceso autorizado a este panel de pruebas.",
    };
  }

  const { data: userRow } = await supabase
    .from("users")
    .select("cedula, institutional_email")
    .eq("id", verification.internalUserId)
    .maybeSingle<{ cedula: string; institutional_email: string | null }>();

  if (
    !userRow ||
    !isQaStudentSandboxProfile({
      primaryRole: verification.primaryRole,
      cedula: userRow.cedula,
      institutionalEmail: userRow.institutional_email,
      authEmail: user.email,
    })
  ) {
    return {
      ok: false as const,
      message: "Esta herramienta solo aplica a la cuenta QA estudiantil.",
    };
  }

  return { ok: true as const, supabase };
}

function revalidateStudentRoutes() {
  revalidatePath("/estudiante");
  revalidatePath("/estudiante/asignaturas");
  revalidatePath("/estudiante/asignaturas", "layout");
  revalidatePath("/estudiante/carnet");
  revalidatePath("/estudiante/tramites");
  revalidatePath("/aula-virtual");
  revalidatePath("/biblioteca");
  revalidatePath("/pasantias");
}

function getCaracasDateIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Caracas",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function switchQaStudentContextAction(
  input: SwitchStudentContextInput
): Promise<DevActionResult<StudentSandboxState>> {
  const parsed = switchContextSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Parámetros de cambio de contexto inválidos." };
  }

  const session = await requireQaStudentSession();
  if (!session.ok) return session;

  const { data, error } = await session.supabase.rpc(
    "siga_dev_switch_student_context",
    {
      p_mencion_code: parsed.data.mencionCode ?? undefined,
      p_grade_year: parsed.data.gradeYear ?? undefined,
      p_section_letter: parsed.data.sectionLetter ?? undefined,
      p_school_year_code: parsed.data.schoolYearCode ?? undefined,
      p_active_moment: parsed.data.activeMoment ?? undefined,
      p_access_tier: parsed.data.accessTier ?? undefined,
      p_reference_date: getCaracasDateIso(),
    }
  );

  if (error || !data || typeof data !== "object") {
    return {
      ok: false,
      message:
        error?.message && error.code === "P0002"
          ? error.message
          : "No se pudo actualizar el contexto académico de pruebas.",
    };
  }

  revalidateStudentRoutes();

  const raw = data as Omit<StudentSandboxState, "available">;
  return {
    ok: true,
    data: toStudentSandboxState(raw),
  };
}

export async function manageQaStudentSyntheticDataAction(
  action: "populate" | "clear"
): Promise<
  DevActionResult<{ state: StudentSandboxState; verificationCode: string | null }>
> {
  const parsed = syntheticDataSchema.safeParse({ action });
  if (!parsed.success) {
    return { ok: false, message: "Acción de datos de prueba inválida." };
  }

  const session = await requireQaStudentSession();
  if (!session.ok) return session;

  const { data: opData, error: opError } = await session.supabase.rpc(
    "siga_dev_manage_student_synthetic_data",
    {
      p_action: parsed.data.action,
      p_reference_date: getCaracasDateIso(),
    }
  );

  if (opError) {
    return {
      ok: false,
      message:
        opError.code === "P0002" && opError.message
          ? opError.message
          : "No se pudieron actualizar los datos sintéticos de prueba.",
    };
  }

  const { data: stateData, error: stateError } = await session.supabase.rpc(
    "siga_dev_get_student_sandbox_state"
  );

  if (stateError || !stateData || typeof stateData !== "object") {
    revalidateStudentRoutes();
    return {
      ok: false,
      message: "Datos actualizados, pero no se pudo recargar el resumen.",
    };
  }

  revalidateStudentRoutes();

  const rawState = stateData as Omit<StudentSandboxState, "available">;
  const verificationCode =
    opData &&
    typeof opData === "object" &&
    "verification_code" in opData &&
    typeof (opData as { verification_code?: unknown }).verification_code ===
      "string"
      ? (opData as { verification_code: string }).verification_code
      : null;

  return {
    ok: true,
    data: {
      state: toStudentSandboxState(rawState),
      verificationCode,
    },
  };
}

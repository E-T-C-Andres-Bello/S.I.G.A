import type { DashboardUserProfile } from "@/lib/supabase/dashboard-session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  isQaStudentSandboxProfile,
  QA_STUDENT_CEDULA,
  QA_STUDENT_EMAIL,
} from "@/lib/validators/student-portal";

export { QA_STUDENT_CEDULA, QA_STUDENT_EMAIL };

export interface QaSandboxMencionOption {
  id: string;
  code: string;
  name: string;
}

export interface QaSandboxSchoolYearOption {
  id: string;
  code: string;
  name: string;
  status: string;
  is_current: boolean;
}

export interface QaSandboxMomentOption {
  id: string;
  moment_number: number;
  name: string;
  status: string;
}

export interface QaSandboxEnrollmentSummary {
  id: string;
  school_year_id: string;
  school_year_code: string;
  school_year_name: string;
  mencion_id: string;
  mencion_code: string;
  mencion_name: string;
  grade_year: number;
  section_id: string;
  section_letter: string;
}

export interface StudentSandboxState {
  available: boolean;
  access_tier: "provisional_cedula" | "verified_workspace" | "suspended";
  institutional_email: string | null;
  cedula: string;
  menciones: QaSandboxMencionOption[];
  school_years: QaSandboxSchoolYearOption[];
  momentos: QaSandboxMomentOption[];
  current_enrollment: QaSandboxEnrollmentSummary | null;
  stats: {
    schedule_blocks: number;
    scores: number;
    attendance: number;
    requests: number;
    official_documents: number;
    pending_attempts: number;
  };
}

/**
 * Habilita la barra QA únicamente fuera de producción y para la cuenta
 * de prueba `estudiante@etcandresbello.org` (`V99999996`).
 */
export function isQaStudentToolbarEnabled(
  profile: Pick<
    DashboardUserProfile,
    "primaryRole" | "cedula" | "institutionalEmail"
  >,
  authEmail?: string | null
): boolean {
  return isQaStudentSandboxProfile({
    primaryRole: profile.primaryRole,
    cedula: profile.cedula,
    institutionalEmail: profile.institutionalEmail,
    authEmail,
  });
}

/**
 * Carga el estado actual de contexto académico y datos de prueba para el usuario QA.
 * Para cualquier otra cuenta o en producción retorna `null` sin ejecutar consultas.
 */
export async function getQaStudentSandboxState(
  profile: DashboardUserProfile
): Promise<StudentSandboxState | null> {
  if (!isQaStudentToolbarEnabled(profile)) {
    return null;
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase.rpc(
    "siga_dev_get_student_sandbox_state"
  );

  if (error || !data || typeof data !== "object") {
    return {
      available: false,
      access_tier: profile.accessTier,
      institutional_email: profile.institutionalEmail,
      cedula: profile.cedula,
      menciones: [],
      school_years: [],
      momentos: [],
      current_enrollment: null,
      stats: {
        schedule_blocks: 0,
        scores: 0,
        attendance: 0,
        requests: 0,
        official_documents: 0,
        pending_attempts: 0,
      },
    };
  }

  const raw = data as Omit<StudentSandboxState, "available">;

  return {
    available: true,
    access_tier: raw.access_tier ?? profile.accessTier,
    institutional_email: raw.institutional_email ?? profile.institutionalEmail,
    cedula: raw.cedula ?? profile.cedula,
    menciones: Array.isArray(raw.menciones) ? raw.menciones : [],
    school_years: Array.isArray(raw.school_years) ? raw.school_years : [],
    momentos: Array.isArray(raw.momentos) ? raw.momentos : [],
    current_enrollment: raw.current_enrollment ?? null,
    stats: raw.stats ?? {
      schedule_blocks: 0,
      scores: 0,
      attendance: 0,
      requests: 0,
      official_documents: 0,
      pending_attempts: 0,
    },
  };
}

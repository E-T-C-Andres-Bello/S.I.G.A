import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface ProvisionalEnrollmentSummary {
  id: string;
  gradeYear: number;
  enrollmentStatus: string;
  enrollmentType: string;
  sectionLetter: string | null;
  mencionName: string | null;
  schoolYearName: string | null;
  emergencyContactName: string | null;
  emergencyContactRelationship: string | null;
}

export interface ProvisionalActivationRequest {
  id: string;
  status: string;
  reason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProvisionalOnboardingData {
  enrollment: ProvisionalEnrollmentSummary | null;
  activationRequest: ProvisionalActivationRequest | null;
}

interface EnrollmentJoinRow {
  id: string;
  grade_year: number;
  enrollment_status: string;
  enrollment_type: string;
  emergency_contact_name: string | null;
  emergency_contact_relationship: string | null;
  sections: { section_letter: string } | Array<{ section_letter: string }> | null;
  menciones: { name: string } | Array<{ name: string }> | null;
  school_years: { name: string } | Array<{ name: string }> | null;
}

interface ActivationRequestRow {
  id: string;
  status: string;
  reason: string | null;
  created_at: string;
  updated_at: string;
}

function unwrapSingle<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/**
 * Carga exclusivamente la ficha de inscripción y la solicitud de activación
 * para estudiantes en estado `provisional_cedula` (sin exponer notas ni aula virtual).
 */
export async function getProvisionalStudentOnboardingData(
  internalUserId: string
): Promise<ProvisionalOnboardingData> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return { enrollment: null, activationRequest: null };
  }

  const [enrollmentResult, requestResult] = await Promise.all([
    supabase
      .from("enrollments")
      .select(
        "id, grade_year, enrollment_status, enrollment_type, emergency_contact_name, emergency_contact_relationship, sections(section_letter), menciones(name), school_years(name)"
      )
      .eq("student_user_id", internalUserId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<EnrollmentJoinRow>(),
    supabase
      .from("student_requests")
      .select("id, status, reason, created_at, updated_at")
      .eq("student_user_id", internalUserId)
      .eq("request_type", "activacion_workspace")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<ActivationRequestRow>(),
  ]);

  const e = enrollmentResult.data;
  const r = requestResult.data;

  return {
    enrollment: e
      ? {
          id: e.id,
          gradeYear: e.grade_year,
          enrollmentStatus: e.enrollment_status,
          enrollmentType: e.enrollment_type,
          sectionLetter: unwrapSingle(e.sections)?.section_letter ?? null,
          mencionName: unwrapSingle(e.menciones)?.name ?? null,
          schoolYearName: unwrapSingle(e.school_years)?.name ?? null,
          emergencyContactName: e.emergency_contact_name,
          emergencyContactRelationship: e.emergency_contact_relationship,
        }
      : null,
    activationRequest: r
      ? {
          id: r.id,
          status: r.status,
          reason: r.reason,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        }
      : null,
  };
}

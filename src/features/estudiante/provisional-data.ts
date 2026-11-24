import { getServerAuthSession } from "@/lib/auth/server";
import {
  isNeonDatabaseConfigured,
  querySingleRow,
  withUserDb,
} from "@/lib/db/neon";

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
  section_letter: string | null;
  mencion_name: string | null;
  school_year_name: string | null;
}

interface ActivationRequestRow {
  id: string;
  status: string;
  reason: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Carga exclusivamente la ficha de inscripción y la solicitud de activación
 * para estudiantes en estado `provisional_cedula` (bajo RLS en Neon).
 */
export async function getProvisionalStudentOnboardingData(
  internalUserId: string
): Promise<ProvisionalOnboardingData> {
  if (!isNeonDatabaseConfigured()) {
    return { enrollment: null, activationRequest: null };
  }

  const session = await getServerAuthSession();
  if (!session) {
    return { enrollment: null, activationRequest: null };
  }

  return withUserDb(
    { authUserId: session.authUserId, email: session.email },
    async (client) => {
      const e = await querySingleRow<EnrollmentJoinRow>(
        client,
        `SELECT e.id,
                e.grade_year,
                e.enrollment_status,
                e.enrollment_type,
                e.emergency_contact_name,
                e.emergency_contact_relationship,
                s.section_letter,
                m.name AS mencion_name,
                sy.name AS school_year_name
           FROM public.enrollments e
           LEFT JOIN public.sections s ON s.id = e.section_id
           LEFT JOIN public.menciones m ON m.id = e.mencion_id
           LEFT JOIN public.school_years sy ON sy.id = e.school_year_id
          WHERE e.student_user_id = $1::uuid
            AND e.deleted_at IS NULL
          ORDER BY e.created_at DESC
          LIMIT 1`,
        [internalUserId]
      );
      const r = await querySingleRow<ActivationRequestRow>(
        client,
        `SELECT id, status, reason, created_at, updated_at
           FROM public.student_requests
          WHERE student_user_id = $1::uuid
            AND request_type = 'activacion_workspace'
          ORDER BY created_at DESC
          LIMIT 1`,
        [internalUserId]
      );

      return {
        enrollment: e
          ? {
              id: e.id,
              gradeYear: e.grade_year,
              enrollmentStatus: e.enrollment_status,
              enrollmentType: e.enrollment_type,
              sectionLetter: e.section_letter,
              mencionName: e.mencion_name,
              schoolYearName: e.school_year_name,
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
  );
}

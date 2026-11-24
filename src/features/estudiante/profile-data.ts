import type { DashboardUserProfile } from "@/lib/auth/dashboard-session";
import {
  isNeonDatabaseConfigured,
  querySingleRow,
  withServiceDb,
  withUserDb,
} from "@/lib/db/neon";

export interface StudentProfileAuditEntry {
  id: string;
  action: "profile_contact_updated" | "avatar_updated" | "avatar_removed";
  changedFields: string[];
  createdAt: string;
}

export interface StudentProfilePageData {
  authUserId: string;
  internalUserId: string;
  firstName: string;
  lastName: string;
  cedula: string;
  institutionalEmail: string | null;
  recoveryEmail: string | null;
  phone: string | null;
  avatarWebpUrl: string | null;
  accessTier: DashboardUserProfile["accessTier"];
  workspaceVerifiedAt: string | null;
  hasGoogleProvider: boolean;
  hasEmailPasswordProvider: boolean;
  enrollment: {
    id: string;
    schoolYearName: string | null;
    schoolYearCode: string | null;
    gradeYear: number;
    sectionLetter: string | null;
    mencionCode: string | null;
    mencionName: string | null;
    mencionSpecialty: string | null;
    enrollmentStatus: string;
    emergencyContactName: string | null;
    emergencyContactCedula: string | null;
    emergencyContactPhone: string | null;
    emergencyContactRelationship: string | null;
  } | null;
  recentAuditEntries: StudentProfileAuditEntry[];
}

interface UserMetaRow {
  workspace_verified_at: string | null;
  phone: string | null;
  recovery_email: string | null;
  avatar_webp_url: string | null;
}

interface EnrollmentProfileRow {
  id: string;
  grade_year: number;
  enrollment_status: string;
  emergency_contact_name: string | null;
  emergency_contact_cedula: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relationship: string | null;
  section_letter: string | null;
  mencion_code: string | null;
  mencion_name: string | null;
  mencion_specialty: string | null;
  school_year_code: string | null;
  school_year_name: string | null;
  school_year_is_current: boolean;
}

interface AuditLogRow {
  id: string;
  action: string;
  changed_fields: string[] | null;
  created_at: string;
}

/**
 * Carga en Neon (bajo RLS) los datos oficiales del perfil del estudiante,
 * matrícula vigente, proveedores vinculados y auditoría reciente.
 */
export async function getStudentProfilePageData(
  profile: DashboardUserProfile
): Promise<StudentProfilePageData> {
  const fallback: StudentProfilePageData = {
    authUserId: profile.authUserId,
    internalUserId: profile.internalUserId,
    firstName: profile.firstName,
    lastName: profile.lastName,
    cedula: profile.cedula,
    institutionalEmail: profile.institutionalEmail,
    recoveryEmail: profile.recoveryEmail,
    phone: profile.phone,
    avatarWebpUrl: profile.avatarWebpUrl,
    accessTier: profile.accessTier,
    workspaceVerifiedAt: null,
    hasGoogleProvider: false,
    hasEmailPasswordProvider: true,
    enrollment: null,
    recentAuditEntries: [],
  };

  if (!isNeonDatabaseConfigured()) {
    return fallback;
  }

  const [providerRows, userData] = await Promise.all([
    withServiceDb(async (client) => {
      const res = await client.query<{ provider_id: string }>(
        `SELECT "providerId" AS provider_id
           FROM public.auth_account
          WHERE "userId" = $1`,
        [profile.authUserId]
      );
      return res.rows;
    }),
    withUserDb(
      { authUserId: profile.authUserId, email: profile.authEmail },
      async (client) => {
        const userMeta = await querySingleRow<UserMetaRow>(
          client,
          `SELECT workspace_verified_at, phone, recovery_email, avatar_webp_url
             FROM public.users
            WHERE id = $1::uuid
            LIMIT 1`,
          [profile.internalUserId]
        );
        const enrollmentsRes = await client.query<EnrollmentProfileRow>(
          `SELECT e.id,
                  e.grade_year,
                  e.enrollment_status,
                  e.emergency_contact_name,
                  e.emergency_contact_cedula,
                  e.emergency_contact_phone,
                  e.emergency_contact_relationship,
                  s.section_letter,
                  m.code AS mencion_code,
                  m.name AS mencion_name,
                  m.specialty AS mencion_specialty,
                  sy.code AS school_year_code,
                  sy.name AS school_year_name,
                  sy.is_current AS school_year_is_current
             FROM public.enrollments e
             JOIN public.school_years sy ON sy.id = e.school_year_id
             LEFT JOIN public.sections s ON s.id = e.section_id
             LEFT JOIN public.menciones m ON m.id = e.mencion_id
            WHERE e.student_user_id = $1::uuid
              AND e.deleted_at IS NULL
            ORDER BY sy.is_current DESC, e.created_at DESC`,
          [profile.internalUserId]
        );
        const auditRes = await client.query<AuditLogRow>(
          `SELECT id, action, changed_fields, created_at
             FROM public.profile_audit_logs
            WHERE user_id = $1::uuid
            ORDER BY created_at DESC
            LIMIT 5`,
          [profile.internalUserId]
        );

        return {
          userMeta,
          enrollments: enrollmentsRes.rows,
          audits: auditRes.rows,
        };
      }
    ),
  ]);

  const providerSet = new Set(providerRows.map((p) => p.provider_id));
  const currentEnrollment =
    userData.enrollments.find((e) => e.school_year_is_current) ??
    userData.enrollments[0] ??
    null;

  const recentAuditEntries: StudentProfileAuditEntry[] = userData.audits.map(
    (row) => ({
      id: row.id,
      action:
        row.action === "avatar_updated" || row.action === "avatar_removed"
          ? row.action
          : "profile_contact_updated",
      changedFields: Array.isArray(row.changed_fields) ? row.changed_fields : [],
      createdAt: row.created_at,
    })
  );

  return {
    authUserId: profile.authUserId,
    internalUserId: profile.internalUserId,
    firstName: profile.firstName,
    lastName: profile.lastName,
    cedula: profile.cedula,
    institutionalEmail: profile.institutionalEmail,
    recoveryEmail: userData.userMeta?.recovery_email ?? profile.recoveryEmail,
    phone: userData.userMeta?.phone ?? profile.phone,
    avatarWebpUrl: userData.userMeta?.avatar_webp_url ?? profile.avatarWebpUrl,
    accessTier: profile.accessTier,
    workspaceVerifiedAt: userData.userMeta?.workspace_verified_at ?? null,
    hasGoogleProvider: providerSet.has("google"),
    hasEmailPasswordProvider:
      providerSet.has("credential") || providerSet.size === 0,
    enrollment: currentEnrollment
      ? {
          id: currentEnrollment.id,
          schoolYearName: currentEnrollment.school_year_name,
          schoolYearCode: currentEnrollment.school_year_code,
          gradeYear: currentEnrollment.grade_year,
          sectionLetter: currentEnrollment.section_letter,
          mencionCode: currentEnrollment.mencion_code,
          mencionName: currentEnrollment.mencion_name,
          mencionSpecialty: currentEnrollment.mencion_specialty,
          enrollmentStatus: currentEnrollment.enrollment_status,
          emergencyContactName: currentEnrollment.emergency_contact_name,
          emergencyContactCedula: currentEnrollment.emergency_contact_cedula,
          emergencyContactPhone: currentEnrollment.emergency_contact_phone,
          emergencyContactRelationship:
            currentEnrollment.emergency_contact_relationship,
        }
      : null,
    recentAuditEntries,
  };
}

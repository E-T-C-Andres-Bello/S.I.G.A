import type { DashboardUserProfile } from "@/lib/supabase/dashboard-session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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
  sections: { section_letter: string } | Array<{ section_letter: string }> | null;
  menciones:
    | { code: string; name: string; specialty: string | null }
    | Array<{ code: string; name: string; specialty: string | null }>
    | null;
  school_years:
    | { code: string; name: string; is_current: boolean }
    | Array<{ code: string; name: string; is_current: boolean }>
    | null;
}

interface AuditLogRow {
  id: string;
  action: string;
  changed_fields: string[] | null;
  created_at: string;
}

function unwrapSingle<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/**
 * Carga en una sola tanda paralela los datos oficiales del perfil del estudiante,
 * su matrícula vigente con contacto de emergencia, proveedores de acceso y últimos
 * registros de auditoría de su propia cuenta (bajo RLS).
 */
export async function getStudentProfilePageData(
  profile: DashboardUserProfile
): Promise<StudentProfilePageData> {
  const fallback: StudentProfilePageData = {
    authUserId: "",
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

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return fallback;
  }

  const [authUserRes, userMetaRes, enrollmentsRes, auditRes] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("users")
      .select("workspace_verified_at, phone, recovery_email, avatar_webp_url")
      .eq("id", profile.internalUserId)
      .maybeSingle<UserMetaRow>(),
    supabase
      .from("enrollments")
      .select(
        "id, grade_year, enrollment_status, emergency_contact_name, emergency_contact_cedula, emergency_contact_phone, emergency_contact_relationship, sections(section_letter), menciones(code, name, specialty), school_years!inner(code, name, is_current)"
      )
      .eq("student_user_id", profile.internalUserId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .returns<EnrollmentProfileRow[]>(),
    supabase
      .from("profile_audit_logs")
      .select("id, action, changed_fields, created_at")
      .eq("user_id", profile.internalUserId)
      .order("created_at", { ascending: false })
      .limit(5)
      .returns<AuditLogRow[]>(),
  ]);

  const authUser = authUserRes.data.user;
  const identities = authUser?.identities ?? [];
  const providersFromMeta = Array.isArray(authUser?.app_metadata?.providers)
    ? (authUser?.app_metadata?.providers as string[])
    : [];
  const providerSet = new Set<string>([
    ...identities.map((id) => id.provider),
    ...providersFromMeta,
  ]);

  const enrollments = enrollmentsRes.data ?? [];
  const currentEnrollment =
    enrollments.find((e) => unwrapSingle(e.school_years)?.is_current) ??
    enrollments[0] ??
    null;

  const section = currentEnrollment
    ? unwrapSingle(currentEnrollment.sections)
    : null;
  const mencion = currentEnrollment
    ? unwrapSingle(currentEnrollment.menciones)
    : null;
  const schoolYear = currentEnrollment
    ? unwrapSingle(currentEnrollment.school_years)
    : null;

  const userMeta = userMetaRes.data;

  const recentAuditEntries: StudentProfileAuditEntry[] = (
    auditRes.data ?? []
  ).map((row) => ({
    id: row.id,
    action:
      row.action === "avatar_updated" || row.action === "avatar_removed"
        ? row.action
        : "profile_contact_updated",
    changedFields: Array.isArray(row.changed_fields) ? row.changed_fields : [],
    createdAt: row.created_at,
  }));

  return {
    authUserId: authUser?.id ?? "",
    internalUserId: profile.internalUserId,
    firstName: profile.firstName,
    lastName: profile.lastName,
    cedula: profile.cedula,
    institutionalEmail: profile.institutionalEmail,
    recoveryEmail: userMeta?.recovery_email ?? profile.recoveryEmail,
    phone: userMeta?.phone ?? profile.phone,
    avatarWebpUrl: userMeta?.avatar_webp_url ?? profile.avatarWebpUrl,
    accessTier: profile.accessTier,
    workspaceVerifiedAt: userMeta?.workspace_verified_at ?? null,
    hasGoogleProvider: providerSet.has("google"),
    hasEmailPasswordProvider:
      providerSet.has("email") || providerSet.size === 0,
    enrollment: currentEnrollment
      ? {
          id: currentEnrollment.id,
          schoolYearName: schoolYear?.name ?? null,
          schoolYearCode: schoolYear?.code ?? null,
          gradeYear: currentEnrollment.grade_year,
          sectionLetter: section?.section_letter ?? null,
          mencionCode: mencion?.code ?? null,
          mencionName: mencion?.name ?? null,
          mencionSpecialty: mencion?.specialty ?? null,
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

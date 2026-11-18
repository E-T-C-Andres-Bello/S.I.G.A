import { createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  StudentRequestStatus,
  StudentRequestType,
} from "@/lib/validators/student-portal";

export interface StudentRequestItem {
  id: string;
  requestType: StudentRequestType;
  reason: string | null;
  status: StudentRequestStatus;
  slaEnteredAt: string;
  resolvedAt: string | null;
  officialDocumentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StudentOfficialDocumentItem {
  id: string;
  verificationCode: string;
  documentHash?: string;
  documentType: string;
  status: "valid" | "revoked";
  issuedAt: string;
  revokedAt: string | null;
  payloadSnapshot: Record<string, unknown>;
}

export interface StudentTramitesEnrollmentSummary {
  id: string;
  gradeYear: number;
  sectionLetter: string | null;
  mencionName: string | null;
  schoolYearName: string | null;
  enrollmentStatus: string;
}

export interface StudentTramitesData {
  enrollment: StudentTramitesEnrollmentSummary | null;
  requests: StudentRequestItem[];
  officialDocuments: StudentOfficialDocumentItem[];
}

interface EnrollmentJoinRow {
  id: string;
  grade_year: number;
  enrollment_status: string;
  sections: { section_letter: string } | Array<{ section_letter: string }> | null;
  menciones: { name: string } | Array<{ name: string }> | null;
  school_years: { name: string; is_current: boolean } | Array<{ name: string; is_current: boolean }> | null;
}

interface RequestRow {
  id: string;
  request_type: StudentRequestType;
  reason: string | null;
  status: StudentRequestStatus;
  sla_entered_at: string;
  resolved_at: string | null;
  official_document_id: string | null;
  created_at: string;
  updated_at: string;
}

interface OfficialDocRow {
  id: string;
  verification_code: string;
  document_hash: string;
  document_type: string;
  status: "valid" | "revoked";
  issued_at: string;
  revoked_at: string | null;
  payload_snapshot: Record<string, unknown> | null;
}

function unwrapSingle<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/**
 * Carga las solicitudes estudiantiles y los documentos oficiales emitidos
 * por Control de Estudios bajo Supabase RLS.
 */
export async function getStudentTramitesData(
  internalUserId: string
): Promise<StudentTramitesData> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return { enrollment: null, requests: [], officialDocuments: [] };
  }

  const [enrollmentResult, requestsResult, documentsResult] = await Promise.all([
    supabase
      .from("enrollments")
      .select(
        "id, grade_year, enrollment_status, sections(section_letter), menciones(name), school_years!inner(name, is_current)"
      )
      .eq("student_user_id", internalUserId)
      .eq("school_years.is_current", true)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<EnrollmentJoinRow>(),
    supabase
      .from("student_requests")
      .select(
        "id, request_type, reason, status, sla_entered_at, resolved_at, official_document_id, created_at, updated_at"
      )
      .eq("student_user_id", internalUserId)
      .order("created_at", { ascending: false })
      .returns<RequestRow[]>(),
    supabase
      .from("official_documents")
      .select(
        "id, verification_code, document_hash, document_type, status, issued_at, revoked_at, payload_snapshot"
      )
      .eq("student_user_id", internalUserId)
      .order("issued_at", { ascending: false })
      .returns<OfficialDocRow[]>(),
  ]);

  const e = enrollmentResult.data;

  return {
    enrollment: e
      ? {
          id: e.id,
          gradeYear: e.grade_year,
          enrollmentStatus: e.enrollment_status,
          sectionLetter: unwrapSingle(e.sections)?.section_letter ?? null,
          mencionName: unwrapSingle(e.menciones)?.name ?? null,
          schoolYearName: unwrapSingle(e.school_years)?.name ?? null,
        }
      : null,
    requests: (requestsResult.data ?? []).map((r) => ({
      id: r.id,
      requestType: r.request_type,
      reason: r.reason,
      status: r.status,
      slaEnteredAt: r.sla_entered_at,
      resolvedAt: r.resolved_at,
      officialDocumentId: r.official_document_id,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
    officialDocuments: (documentsResult.data ?? []).map((doc) => ({
      id: doc.id,
      verificationCode: doc.verification_code,
      documentHash: doc.document_hash,
      documentType: doc.document_type,
      status: doc.status,
      issuedAt: doc.issued_at,
      revokedAt: doc.revoked_at,
      payloadSnapshot:
        doc.payload_snapshot && typeof doc.payload_snapshot === "object"
          ? doc.payload_snapshot
          : {},
    })),
  };
}

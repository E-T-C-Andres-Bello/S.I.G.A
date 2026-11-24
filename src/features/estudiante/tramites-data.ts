import { getServerAuthSession } from "@/lib/auth/server";
import {
  isNeonDatabaseConfigured,
  querySingleRow,
  withUserDb,
} from "@/lib/db/neon";
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
  section_letter: string | null;
  mencion_name: string | null;
  school_year_name: string | null;
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

/**
 * Carga las solicitudes estudiantiles y los documentos oficiales emitidos
 * por Control de Estudios bajo RLS en Neon.
 */
export async function getStudentTramitesData(
  internalUserId: string
): Promise<StudentTramitesData> {
  if (!isNeonDatabaseConfigured()) {
    return { enrollment: null, requests: [], officialDocuments: [] };
  }

  const session = await getServerAuthSession();
  if (!session) {
    return { enrollment: null, requests: [], officialDocuments: [] };
  }

  return withUserDb(
    { authUserId: session.authUserId, email: session.email },
    async (client) => {
      const e = await querySingleRow<EnrollmentJoinRow>(
        client,
        `SELECT e.id,
                e.grade_year,
                e.enrollment_status,
                s.section_letter,
                m.name AS mencion_name,
                sy.name AS school_year_name
           FROM public.enrollments e
           JOIN public.school_years sy ON sy.id = e.school_year_id AND sy.is_current = true
           LEFT JOIN public.sections s ON s.id = e.section_id
           LEFT JOIN public.menciones m ON m.id = e.mencion_id
          WHERE e.student_user_id = $1::uuid
            AND e.deleted_at IS NULL
          ORDER BY e.created_at DESC
          LIMIT 1`,
        [internalUserId]
      );
      const requestsRes = await client.query<RequestRow>(
        `SELECT id, request_type, reason, status, sla_entered_at, resolved_at, official_document_id, created_at, updated_at
           FROM public.student_requests
          WHERE student_user_id = $1::uuid
          ORDER BY created_at DESC`,
        [internalUserId]
      );
      const documentsRes = await client.query<OfficialDocRow>(
        `SELECT id, verification_code, document_hash, document_type, status, issued_at, revoked_at, payload_snapshot
           FROM public.official_documents
          WHERE student_user_id = $1::uuid
          ORDER BY issued_at DESC`,
        [internalUserId]
      );

      return {
        enrollment: e
          ? {
              id: e.id,
              gradeYear: e.grade_year,
              enrollmentStatus: e.enrollment_status,
              sectionLetter: e.section_letter,
              mencionName: e.mencion_name,
              schoolYearName: e.school_year_name,
            }
          : null,
        requests: requestsRes.rows.map((r) => ({
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
        officialDocuments: documentsRes.rows.map((doc) => ({
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
  );
}

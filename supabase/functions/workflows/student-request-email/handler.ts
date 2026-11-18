import { createClient } from "npm:@supabase/supabase-js@2";
import { dispatchWorkflowToN8n } from "../../_shared/n8n.ts";
import { verifyWorkflowInvocationAuth } from "../../_shared/webhook-auth.ts";

const WORKFLOW_CODE = "student_request_mailtrap";
const DEV_PORTAL_BASE_URL = "http://localhost:3000";

const REQUEST_TYPE_LABELS: Record<string, string> = {
  constancia_estudio: "Constancia de Estudio",
  constancia_inscripcion: "Constancia de Inscripción",
  solvencia: "Solvencia Institucional",
  revision_notas: "Revisión Formal de Calificación",
  activacion_workspace: "Activación de Cuenta Institucional (@etcandresbello.org)",
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatCedulaDisplay(canonical: string): string {
  const cleaned = canonical.trim().toUpperCase();
  if (/^[VEJ][0-9]{6,9}$/.test(cleaned)) {
    return `${cleaned.charAt(0)}-${cleaned.slice(1)}`;
  }
  return cleaned;
}

function unwrapSingle<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

interface IncomingWorkflowPayload {
  record_id?: string;
  workflow_run_id?: string;
  record?: { id?: string };
}

interface StudentRequestDetailRow {
  id: string;
  request_type: string;
  reason: string | null;
  status: string;
  created_at: string;
  student_user_id: string;
  enrollment_id: string | null;
  users:
    | {
        id: string;
        first_name: string;
        last_name: string;
        cedula: string;
        institutional_email: string | null;
        recovery_email: string | null;
        access_tier: string;
      }
    | Array<{
        id: string;
        first_name: string;
        last_name: string;
        cedula: string;
        institutional_email: string | null;
        recovery_email: string | null;
        access_tier: string;
      }>
    | null;
  enrollments:
    | {
        grade_year: number;
        menciones: { name: string } | Array<{ name: string }> | null;
        sections: { section_letter: string } | Array<{ section_letter: string }> | null;
        school_years: { name: string } | Array<{ name: string }> | null;
      }
    | Array<{
        grade_year: number;
        menciones: { name: string } | Array<{ name: string }> | null;
        sections: { section_letter: string } | Array<{ section_letter: string }> | null;
        school_years: { name: string } | Array<{ name: string }> | null;
      }>
    | null;
}

interface StaffRoleRow {
  users:
    | {
        institutional_email: string | null;
        first_name: string;
        last_name: string;
        is_active: boolean;
        deleted_at: string | null;
      }
    | Array<{
        institutional_email: string | null;
        first_name: string;
        last_name: string;
        is_active: boolean;
        deleted_at: string | null;
      }>
    | null;
  roles: { code: string } | Array<{ code: string }> | null;
}

function buildStudentReceiptTemplate(params: {
  studentName: string;
  requestLabel: string;
  requestCode: string;
  academicLine: string | null;
  reason: string | null;
  createdAtDisplay: string;
  isWorkspaceActivation: boolean;
}): { subject: string; text: string; html: string } {
  const portalUrl = DEV_PORTAL_BASE_URL;
  const subject = `[S.I.G.A.] Solicitud registrada: ${params.requestLabel} (${params.requestCode})`;

  const nextStepsText = params.isWorkspaceActivation
    ? "Control de Estudios revisará tu solicitud de cuenta institucional @etcandresbello.org y te notificará apenas quede habilitada para vincular tu acceso completo."
    : "Control de Estudios y Secretaría revisarán tu solicitud. Cuando el documento sea aprobado, podrás descargarlo en PDF con código QR verificable desde el portal S.I.G.A.";

  const text = [
    `Hola, ${params.studentName}:`,
    "",
    `Confirmamos el registro de tu solicitud en S.I.G.A. (E.T.C. "Andrés Bello"):`,
    `- Trámite: ${params.requestLabel}`,
    `- Referencia: ${params.requestCode}`,
    `- Estado actual: Pendiente de revisión`,
    params.academicLine ? `- Matrícula: ${params.academicLine}` : null,
    `- Fecha de registro: ${params.createdAtDisplay}`,
    params.reason ? `- Detalle indicado: ${params.reason}` : null,
    "",
    nextStepsText,
    `Seguimiento en línea: ${portalUrl}/estudiante?tab=tramites`,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="es">
  <body style="margin:0;padding:24px;background:#f1f5f9;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;border:1px solid #dbe4f0;overflow:hidden;">
      <tr>
        <td style="padding:20px 24px;background:linear-gradient(135deg,#0b1d59,#1c47c4);color:#ffffff;">
          <p style="margin:0;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#bfdbfe;">E.T.C. &ldquo;Andrés Bello&rdquo; · DEA OD01340701</p>
          <h1 style="margin:6px 0 0;font-size:18px;font-weight:600;">Solicitud académica registrada en S.I.G.A.</h1>
        </td>
      </tr>
      <tr>
        <td style="padding:24px;font-size:14px;line-height:1.6;">
          <p style="margin:0 0 14px;">Hola, <strong>${escapeHtml(params.studentName)}</strong>:</p>
          <p style="margin:0 0 16px;">Confirmamos la recepción de tu trámite estudiantil con los siguientes datos:</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="8" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;font-size:13px;">
            <tr>
              <td style="color:#475569;width:38%;">Tipo de trámite</td>
              <td style="font-weight:600;color:#0f172a;">${escapeHtml(params.requestLabel)}</td>
            </tr>
            <tr>
              <td style="color:#475569;">Referencia</td>
              <td style="font-weight:600;color:#1c47c4;">${escapeHtml(params.requestCode)}</td>
            </tr>
            <tr>
              <td style="color:#475569;">Estado actual</td>
              <td><strong>Pendiente de revisión</strong></td>
            </tr>
            ${
              params.academicLine
                ? `<tr><td style="color:#475569;">Matrícula</td><td>${escapeHtml(params.academicLine)}</td></tr>`
                : ""
            }
            <tr>
              <td style="color:#475569;">Fecha de registro</td>
              <td>${escapeHtml(params.createdAtDisplay)}</td>
            </tr>
            ${
              params.reason
                ? `<tr><td style="color:#475569;vertical-align:top;">Detalle</td><td>${escapeHtml(params.reason)}</td></tr>`
                : ""
            }
          </table>
          <p style="margin:18px 0 16px;color:#334155;">${escapeHtml(nextStepsText)}</p>
          <p style="margin:0;">
            <a href="${escapeHtml(portalUrl)}/estudiante?tab=tramites" style="display:inline-block;padding:10px 18px;border-radius:999px;background:#1c47c4;color:#ffffff;text-decoration:none;font-weight:600;font-size:13px;">
              Ver estado en el Portal
            </a>
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:14px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:11px;color:#64748b;">
          Aviso automático generado por el Sistema Integral de Gestión Académica (S.I.G.A.) · Unare II, Puerto Ordaz.
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
}

function buildStaffAlertTemplate(params: {
  studentName: string;
  cedulaDisplay: string;
  studentEmail: string | null;
  requestLabel: string;
  requestCode: string;
  academicLine: string | null;
  reason: string | null;
  createdAtDisplay: string;
}): { subject: string; text: string; html: string } {
  const portalUrl = DEV_PORTAL_BASE_URL;
  const subject = `[S.I.G.A. Secretaría] Nuevo trámite: ${params.requestLabel} — ${params.studentName}`;

  const text = [
    `Nueva solicitud recibida en Control de Estudios:`,
    `- Referencia: ${params.requestCode}`,
    `- Trámite: ${params.requestLabel}`,
    `- Estudiante: ${params.studentName} (${params.cedulaDisplay})`,
    params.studentEmail ? `- Correo del solicitante: ${params.studentEmail}` : null,
    params.academicLine ? `- Matrícula: ${params.academicLine}` : null,
    `- Fecha: ${params.createdAtDisplay}`,
    params.reason ? `- Detalle: ${params.reason}` : null,
    "",
    `Gestionar solicitud: ${portalUrl}/control-estudios`,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="es">
  <body style="margin:0;padding:24px;background:#f1f5f9;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;border:1px solid #dbe4f0;overflow:hidden;">
      <tr>
        <td style="padding:18px 24px;background:#0b1d59;color:#ffffff;">
          <p style="margin:0;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#93c5fd;">Control de Estudios y Secretaría · S.I.G.A.</p>
          <h1 style="margin:6px 0 0;font-size:17px;font-weight:600;">Nuevo trámite estudiantil pendiente</h1>
        </td>
      </tr>
      <tr>
        <td style="padding:24px;font-size:14px;line-height:1.6;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="8" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;font-size:13px;">
            <tr><td style="color:#475569;width:36%;">Referencia</td><td style="font-weight:600;color:#1c47c4;">${escapeHtml(params.requestCode)}</td></tr>
            <tr><td style="color:#475569;">Trámite</td><td style="font-weight:600;">${escapeHtml(params.requestLabel)}</td></tr>
            <tr><td style="color:#475569;">Estudiante</td><td>${escapeHtml(params.studentName)} · ${escapeHtml(params.cedulaDisplay)}</td></tr>
            ${
              params.studentEmail
                ? `<tr><td style="color:#475569;">Correo</td><td>${escapeHtml(params.studentEmail)}</td></tr>`
                : ""
            }
            ${
              params.academicLine
                ? `<tr><td style="color:#475569;">Matrícula</td><td>${escapeHtml(params.academicLine)}</td></tr>`
                : ""
            }
            <tr><td style="color:#475569;">Fecha</td><td>${escapeHtml(params.createdAtDisplay)}</td></tr>
            ${
              params.reason
                ? `<tr><td style="color:#475569;vertical-align:top;">Motivo / Detalle</td><td>${escapeHtml(params.reason)}</td></tr>`
                : ""
            }
          </table>
          <p style="margin:18px 0 0;">
            <a href="${escapeHtml(portalUrl)}/control-estudios" style="display:inline-block;padding:10px 18px;border-radius:999px;background:#0b1d59;color:#ffffff;text-decoration:none;font-weight:600;font-size:13px;">
              Abrir Control de Estudios
            </a>
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
}

/**
 * Automatización 01 (`workflows/student-request-email`):
 * Al crearse una solicitud en `student_requests`, la Edge Function enriquece
 * los datos reales desde PostgreSQL, registra la notificación interna y despacha
 * el evento al flujo de **n8n**, el cual ejecuta el envío final por **Mailtrap**.
 */
export async function handleStudentRequestEmailWorkflow(
  req: Request
): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  const authResult = await verifyWorkflowInvocationAuth(req);
  if (!authResult.authorized) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(
      { ok: false, error: "Missing Supabase runtime credentials" },
      500
    );
  }

  let body: IncomingWorkflowPayload;
  try {
    body = (await req.json()) as IncomingWorkflowPayload;
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON payload" }, 400);
  }

  const recordId = body.record_id?.trim() || body.record?.id?.trim() || "";
  if (!UUID_REGEX.test(recordId)) {
    return jsonResponse(
      { ok: false, error: "Missing or invalid student_request record_id" },
      400
    );
  }

  const expectedRunId = body.workflow_run_id?.trim() || "";
  if (authResult.mode === "run_token_required" && !UUID_REGEX.test(expectedRunId)) {
    return jsonResponse(
      { ok: false, error: "Unauthorized: missing workflow_run_id" },
      401
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: claimData, error: claimError } = await supabase.rpc(
    "siga_service_claim_workflow_run",
    {
      p_workflow_code: WORKFLOW_CODE,
      p_source_record_id: recordId,
      p_source_table: "public.student_requests",
      p_expected_run_id:
        authResult.mode === "run_token_required" ? expectedRunId : null,
    }
  );

  if (claimError || !claimData || typeof claimData !== "object") {
    const status = claimError?.code === "42501" ? 401 : 500;
    return jsonResponse(
      {
        ok: false,
        error:
          status === 401
            ? "Unauthorized workflow run"
            : "Unable to claim workflow execution",
      },
      status
    );
  }

  const claim = claimData as {
    run_id: string;
    already_completed?: boolean;
  };

  if (claim.already_completed) {
    return jsonResponse({
      ok: true,
      idempotent: true,
      workflow_run_id: claim.run_id,
    });
  }

  const runId = claim.run_id;

  try {
    const { data: reqRow, error: reqError } = await supabase
      .from("student_requests")
      .select(
        "id, request_type, reason, status, created_at, student_user_id, enrollment_id, users!student_requests_student_user_id_fkey(id, first_name, last_name, cedula, institutional_email, recovery_email, access_tier), enrollments(grade_year, menciones(name), sections(section_letter), school_years(name))"
      )
      .eq("id", recordId)
      .maybeSingle<StudentRequestDetailRow>();

    if (reqError || !reqRow) {
      await supabase.rpc("siga_service_finish_workflow_run", {
        p_workflow_run_id: runId,
        p_status: "failed",
        p_result_json: {},
        p_error_message: "student_request record not found",
      });
      return jsonResponse({ ok: false, error: "Request not found" }, 404);
    }

    const student = unwrapSingle(reqRow.users);
    if (!student) {
      await supabase.rpc("siga_service_finish_workflow_run", {
        p_workflow_run_id: runId,
        p_status: "failed",
        p_result_json: {},
        p_error_message: "applicant user record not found",
      });
      return jsonResponse({ ok: false, error: "Applicant not found" }, 404);
    }

    const enrollment = unwrapSingle(reqRow.enrollments);
    const mencionName = unwrapSingle(enrollment?.menciones)?.name ?? null;
    const sectionLetter =
      unwrapSingle(enrollment?.sections)?.section_letter ?? null;
    const schoolYearName =
      unwrapSingle(enrollment?.school_years)?.name ?? null;

    const academicLine = enrollment
      ? [
          `${enrollment.grade_year}.º Año`,
          mencionName,
          sectionLetter ? `Sección ${sectionLetter}` : null,
          schoolYearName,
        ]
          .filter(Boolean)
          .join(" · ")
      : null;

    const studentName = `${student.first_name} ${student.last_name}`.trim();
    const requestLabel =
      REQUEST_TYPE_LABELS[reqRow.request_type] ?? "Solicitud Estudiantil";
    const requestCode = `TRM-${reqRow.id.slice(0, 8).toUpperCase()}`;
    const createdAtDisplay = new Intl.DateTimeFormat("es-VE", {
      timeZone: "America/Caracas",
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(reqRow.created_at));

    const studentRecipientEmail =
      student.institutional_email?.trim() ||
      student.recovery_email?.trim() ||
      null;

    // Resolver destinatarios de Control de Estudios activos en BD + secreto opcional
    const { data: staffRows } = await supabase
      .from("user_roles")
      .select(
        "roles!inner(code), users!user_roles_user_id_fkey(institutional_email, first_name, last_name, is_active, deleted_at)"
      )
      .eq("is_active", true)
      .eq("roles.code", "control_estudios")
      .returns<StaffRoleRow[]>();

    const staffEmailsMap = new Map<string, string>();
    for (const row of staffRows ?? []) {
      const staffUser = unwrapSingle(row.users);
      if (
        staffUser &&
        staffUser.is_active &&
        !staffUser.deleted_at &&
        staffUser.institutional_email &&
        !staffUser.institutional_email.endsWith(".local")
      ) {
        staffEmailsMap.set(
          staffUser.institutional_email.toLowerCase(),
          `${staffUser.first_name} ${staffUser.last_name}`.trim()
        );
      }
    }

    const overrideStaffEmail = Deno.env
      .get("CONTROL_ESTUDIOS_NOTIFY_EMAIL")
      ?.trim()
      .toLowerCase();
    if (overrideStaffEmail) {
      staffEmailsMap.set(overrideStaffEmail, "Control de Estudios S.I.G.A.");
    }

    if (studentRecipientEmail) {
      staffEmailsMap.delete(studentRecipientEmail.toLowerCase());
    }

    const staffRecipients = Array.from(staffEmailsMap.entries()).map(
      ([email, name]) => ({ email, name })
    );

    // 1. Notificación interna in-app al solicitante
    const { data: notifRow } = await supabase
      .from("notifications")
      .insert({
        recipient_user_id: student.id,
        category: "request_status",
        title: `Solicitud registrada: ${requestLabel}`,
        body: `Tu trámite (${requestCode}) quedó registrado en estado Pendiente.`,
        action_url: "/estudiante?tab=tramites",
      })
      .select("id")
      .maybeSingle<{ id: string }>();

    if (!studentRecipientEmail && staffRecipients.length === 0) {
      await supabase.rpc("siga_service_finish_workflow_run", {
        p_workflow_run_id: runId,
        p_status: "skipped",
        p_result_json: { reason: "no_recipients_available" },
        p_error_message: null,
      });
      return jsonResponse({
        ok: true,
        workflow_run_id: runId,
        status: "skipped",
      });
    }

    const studentReceipt = studentRecipientEmail
      ? buildStudentReceiptTemplate({
          studentName,
          requestLabel,
          requestCode,
          academicLine,
          reason: reqRow.reason,
          createdAtDisplay,
          isWorkspaceActivation: reqRow.request_type === "activacion_workspace",
        })
      : null;

    const staffAlert =
      staffRecipients.length > 0
        ? buildStaffAlertTemplate({
            studentName,
            cedulaDisplay: formatCedulaDisplay(student.cedula),
            studentEmail: studentRecipientEmail,
            requestLabel,
            requestCode,
            academicLine,
            reason: reqRow.reason,
            createdAtDisplay,
          })
        : null;

    // 2. Despachar hacia n8n para envío real vía Mailtrap
    const n8nPayload = {
      workflow_code: WORKFLOW_CODE,
      workflow_run_id: runId,
      record_id: reqRow.id,
      reference_code: requestCode,
      request_type: reqRow.request_type,
      request_label: requestLabel,
      created_at: reqRow.created_at,
      created_at_display: createdAtDisplay,
      student: {
        name: studentName,
        cedula_display: formatCedulaDisplay(student.cedula),
        access_tier: student.access_tier,
        recipient_email: studentRecipientEmail,
        academic_line: academicLine,
        reason: reqRow.reason,
      },
      staff_recipients: staffRecipients,
      emails: {
        student_receipt:
          studentRecipientEmail && studentReceipt
            ? {
                to: [{ email: studentRecipientEmail, name: studentName }],
                subject: studentReceipt.subject,
                text: studentReceipt.text,
                html: studentReceipt.html,
                category: "siga-tramites-acuse",
              }
            : null,
        staff_alert:
          staffAlert && staffRecipients.length > 0
            ? {
                to: staffRecipients,
                subject: staffAlert.subject,
                text: staffAlert.text,
                html: staffAlert.html,
                category: "siga-tramites-secretaria",
              }
            : null,
      },
    };

    const n8nResult = await dispatchWorkflowToN8n(n8nPayload);

    // 3. Registrar trazabilidad en `public.notification_email_logs`
    if (studentRecipientEmail) {
      const okStudent = n8nResult.ok && n8nResult.studentSent;
      await supabase.from("notification_email_logs").insert({
        notification_id: notifRow?.id ?? null,
        recipient_email: studentRecipientEmail,
        provider: "mailtrap",
        template_code: "student_request_receipt_v1",
        status: okStudent ? "sent" : "failed",
        provider_message_id: n8nResult.studentMessageId,
      });
    }

    if (staffRecipients.length > 0) {
      const okStaff = n8nResult.ok && n8nResult.staffSent;
      await supabase.from("notification_email_logs").insert(
        staffRecipients.map((recipient, idx) => ({
          notification_id: null,
          recipient_email: recipient.email,
          provider: "mailtrap",
          template_code: "control_estudios_new_request_v1",
          status: okStaff ? "sent" : "failed",
          provider_message_id:
            n8nResult.staffMessageIds[idx] ??
            n8nResult.staffMessageIds[0] ??
            null,
        }))
      );
    }

    const expectedStudent = Boolean(studentRecipientEmail);
    const expectedStaff = staffRecipients.length > 0;
    const studentSucceeded =
      !expectedStudent || (n8nResult.ok && n8nResult.studentSent);
    const staffSucceeded =
      !expectedStaff || (n8nResult.ok && n8nResult.staffSent);

    const finalStatus =
      studentSucceeded && staffSucceeded
        ? "completed"
        : (expectedStudent && n8nResult.ok && n8nResult.studentSent) ||
            (expectedStaff && n8nResult.ok && n8nResult.staffSent)
          ? "partial"
          : "failed";

    await supabase.rpc("siga_service_finish_workflow_run", {
      p_workflow_run_id: runId,
      p_status: finalStatus,
      p_result_json: {
        dispatcher: "n8n",
        n8n_status_code: n8nResult.statusCode,
        student_sent: expectedStudent ? studentSucceeded : null,
        staff_sent: expectedStaff ? staffSucceeded : null,
      },
      p_error_message: n8nResult.error ?? null,
    });

    return jsonResponse(
      {
        ok: finalStatus === "completed",
        workflow_run_id: runId,
        status: finalStatus,
        dispatcher: "n8n",
      },
      finalStatus === "failed" ? 502 : 200
    );
  } catch (err) {
    const safeError =
      err instanceof Error ? err.message.slice(0, 400) : "Unexpected error";
    await supabase.rpc("siga_service_finish_workflow_run", {
      p_workflow_run_id: runId,
      p_status: "failed",
      p_result_json: {},
      p_error_message: safeError,
    });

    return jsonResponse(
      { ok: false, workflow_run_id: runId, error: "Workflow execution failed" },
      500
    );
  }
}

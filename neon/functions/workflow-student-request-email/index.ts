import { attachDatabasePool } from "@neon/functions";
import pg, { type PoolClient } from "pg";
import { dispatchWorkflowToN8n } from "../_shared/n8n";
import { verifyWorkflowInvocationAuth } from "../_shared/webhook-auth";

const { Pool } = pg;

const WORKFLOW_CODE = "student_request_mailtrap";
const DEFAULT_PORTAL_BASE_URL = "http://localhost:3000";

const REQUEST_TYPE_LABELS: Record<string, string> = {
  constancia_estudio: "Constancia de Estudio",
  constancia_inscripcion: "Constancia de Inscripción",
  solvencia: "Solvencia Institucional",
  revision_notas: "Revisión Formal de Calificación",
  activacion_workspace:
    "Activación de Cuenta Institucional (@etcandresbello.org)",
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeNeonConnectionString(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    const sslMode = parsed.searchParams.get("sslmode");
    if (
      !sslMode ||
      sslMode === "require" ||
      sslMode === "prefer" ||
      sslMode === "verify-ca"
    ) {
      parsed.searchParams.set("sslmode", "verify-full");
    }
    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

let cachedPool: pg.Pool | null = null;

function getWorkflowPool(): pg.Pool {
  if (cachedPool) return cachedPool;
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error("DATABASE_URL no está configurada en la Neon Function.");
  }
  const pool = new Pool({
    connectionString: normalizeNeonConnectionString(connectionString),
    max: 5,
    idleTimeoutMillis: 15_000,
    connectionTimeoutMillis: 10_000,
  });
  attachDatabasePool(pool);
  cachedPool = pool;
  return pool;
}

async function withServiceClient<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getWorkflowPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL ROLE service_role");
    await client.query(
      "SELECT set_config('request.jwt.claim.role', 'service_role', true)"
    );
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore rollback errors
    }
    throw err;
  } finally {
    client.release();
  }
}

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

function resolvePortalBaseUrl(): string {
  const raw =
    process.env.SIGA_PORTAL_BASE_URL?.trim() || DEFAULT_PORTAL_BASE_URL;
  return raw.replace(/\/+$/, "");
}

interface IncomingWorkflowPayload {
  record_id?: string;
  workflow_run_id?: string;
  record?: { id?: string };
}

interface ClaimResultJson {
  run_id: string;
  already_completed?: boolean;
}

interface StudentRequestJoinedRow {
  request_id: string;
  request_type: string;
  reason: string | null;
  status: string;
  created_at: string;
  student_id: string;
  first_name: string;
  last_name: string;
  cedula: string;
  institutional_email: string | null;
  recovery_email: string | null;
  access_tier: string;
  grade_year: number | null;
  mencion_name: string | null;
  section_letter: string | null;
  school_year_name: string | null;
}

interface StaffRecipientRow {
  institutional_email: string;
  first_name: string;
  last_name: string;
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
  const portalUrl = resolvePortalBaseUrl();
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
    `Seguimiento en línea: ${portalUrl}/estudiante/tramites`,
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
            <a href="${escapeHtml(portalUrl)}/estudiante/tramites" style="display:inline-block;padding:10px 18px;border-radius:999px;background:#1c47c4;color:#ffffff;text-decoration:none;font-weight:600;font-size:13px;">
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
  const portalUrl = resolvePortalBaseUrl();
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

async function finishWorkflowRun(params: {
  runId: string;
  status: string;
  resultJson: Record<string, unknown>;
  errorMessage: string | null;
}): Promise<void> {
  await withServiceClient((client) =>
    client.query(
      `SELECT public.siga_service_finish_workflow_run(
         p_workflow_run_id := $1::uuid,
         p_status := $2::text,
         p_result_json := $3::jsonb,
         p_error_message := $4::text
       )`,
      [
        params.runId,
        params.status,
        JSON.stringify(params.resultJson),
        params.errorMessage,
      ]
    )
  );
}

/**
 * Neon Function (`studentreqmail`):
 * Automatización de acuse de recibo y alerta a Control de Estudios al crearse
 * una solicitud en `public.student_requests`, despachando el correo vía n8n / Mailtrap.
 */
async function handleRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  if (req.method === "GET") {
    return jsonResponse({
      ok: true,
      service: "siga-student-request-email",
      workflow_code: WORKFLOW_CODE,
    });
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  const authResult = verifyWorkflowInvocationAuth(req);
  if (!authResult.authorized) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  }

  if (!process.env.DATABASE_URL?.trim()) {
    return jsonResponse(
      { ok: false, error: "Missing Neon DATABASE_URL" },
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
  if (
    authResult.mode === "run_token_required" &&
    !UUID_REGEX.test(expectedRunId)
  ) {
    return jsonResponse(
      { ok: false, error: "Unauthorized: missing workflow_run_id" },
      401
    );
  }

  let claim: ClaimResultJson;
  try {
    const claimed = await withServiceClient(async (client) => {
      const res = await client.query<{ result: ClaimResultJson }>(
        `SELECT public.siga_service_claim_workflow_run(
           p_workflow_code := $1::text,
           p_source_record_id := $2::uuid,
           p_source_table := 'public.student_requests',
           p_expected_run_id := $3::uuid
         ) AS result`,
        [
          WORKFLOW_CODE,
          recordId,
          authResult.mode === "run_token_required" ? expectedRunId : null,
        ]
      );
      return res.rows[0]?.result ?? null;
    });

    if (!claimed || typeof claimed !== "object" || !claimed.run_id) {
      return jsonResponse(
        { ok: false, error: "Unable to claim workflow execution" },
        500
      );
    }
    claim = claimed;
  } catch (err) {
    const pgCode =
      err && typeof err === "object" ? (err as { code?: string }).code : null;
    const status = pgCode === "42501" ? 401 : 500;
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

  if (claim.already_completed) {
    return jsonResponse({
      ok: true,
      idempotent: true,
      workflow_run_id: claim.run_id,
    });
  }

  const runId = claim.run_id;

  try {
    const { reqRow, staffRows } = await withServiceClient(async (client) => {
      const requestResult = await client.query<StudentRequestJoinedRow>(
        `SELECT sr.id AS request_id,
                sr.request_type,
                sr.reason,
                sr.status,
                sr.created_at::text AS created_at,
                u.id AS student_id,
                u.first_name,
                u.last_name,
                u.cedula,
                u.institutional_email,
                u.recovery_email,
                u.access_tier,
                e.grade_year,
                m.name AS mencion_name,
                s.section_letter,
                sy.name AS school_year_name
           FROM public.student_requests sr
           JOIN public.users u ON u.id = sr.student_user_id
           LEFT JOIN public.enrollments e ON e.id = sr.enrollment_id
           LEFT JOIN public.menciones m ON m.id = e.mencion_id
           LEFT JOIN public.sections s ON s.id = e.section_id
           LEFT JOIN public.school_years sy ON sy.id = e.school_year_id
          WHERE sr.id = $1::uuid
          LIMIT 1`,
        [recordId]
      );

      const staffResult = await client.query<StaffRecipientRow>(
        `SELECT u.institutional_email, u.first_name, u.last_name
           FROM public.user_roles ur
           JOIN public.roles r ON r.id = ur.role_id
           JOIN public.users u ON u.id = ur.user_id
          WHERE ur.is_active = true
            AND r.code = 'control_estudios'
            AND u.is_active = true
            AND u.deleted_at IS NULL
            AND u.institutional_email IS NOT NULL`
      );

      return {
        reqRow: requestResult.rows[0] ?? null,
        staffRows: staffResult.rows,
      };
    });

    if (!reqRow) {
      await finishWorkflowRun({
        runId,
        status: "failed",
        resultJson: {},
        errorMessage: "student_request record not found",
      });
      return jsonResponse({ ok: false, error: "Request not found" }, 404);
    }

    const academicLine = reqRow.grade_year
      ? [
          `${reqRow.grade_year}.º Año`,
          reqRow.mencion_name,
          reqRow.section_letter ? `Sección ${reqRow.section_letter}` : null,
          reqRow.school_year_name,
        ]
          .filter(Boolean)
          .join(" · ")
      : null;

    const studentName = `${reqRow.first_name} ${reqRow.last_name}`.trim();
    const requestLabel =
      REQUEST_TYPE_LABELS[reqRow.request_type] ?? "Solicitud Estudiantil";
    const requestCode = `TRM-${reqRow.request_id.slice(0, 8).toUpperCase()}`;
    const createdAtDisplay = new Intl.DateTimeFormat("es-VE", {
      timeZone: "America/Caracas",
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(reqRow.created_at));

    const studentRecipientEmail =
      reqRow.institutional_email?.trim() ||
      reqRow.recovery_email?.trim() ||
      null;

    const staffEmailsMap = new Map<string, string>();
    for (const staff of staffRows) {
      const email = staff.institutional_email.trim().toLowerCase();
      if (email && !email.endsWith(".local")) {
        staffEmailsMap.set(
          email,
          `${staff.first_name} ${staff.last_name}`.trim()
        );
      }
    }

    const overrideStaffEmail = process.env.CONTROL_ESTUDIOS_NOTIFY_EMAIL?.trim().toLowerCase();
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
    const notifId = await withServiceClient(async (client) => {
      const res = await client.query<{ id: string }>(
        `INSERT INTO public.notifications (
           recipient_user_id,
           category,
           title,
           body,
           action_url
         )
         VALUES ($1::uuid, 'request_status', $2::text, $3::text, '/estudiante/tramites')
         RETURNING id`,
        [
          reqRow.student_id,
          `Solicitud registrada: ${requestLabel}`,
          `Tu trámite (${requestCode}) quedó registrado en estado Pendiente.`,
        ]
      );
      return res.rows[0]?.id ?? null;
    });

    if (!studentRecipientEmail && staffRecipients.length === 0) {
      await finishWorkflowRun({
        runId,
        status: "skipped",
        resultJson: { reason: "no_recipients_available" },
        errorMessage: null,
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
          isWorkspaceActivation:
            reqRow.request_type === "activacion_workspace",
        })
      : null;

    const staffAlert =
      staffRecipients.length > 0
        ? buildStaffAlertTemplate({
            studentName,
            cedulaDisplay: formatCedulaDisplay(reqRow.cedula),
            studentEmail: studentRecipientEmail,
            requestLabel,
            requestCode,
            academicLine,
            reason: reqRow.reason,
            createdAtDisplay,
          })
        : null;

    // 2. Despachar hacia n8n para envío vía Mailtrap
    const n8nPayload = {
      workflow_code: WORKFLOW_CODE,
      workflow_run_id: runId,
      record_id: reqRow.request_id,
      reference_code: requestCode,
      request_type: reqRow.request_type,
      request_label: requestLabel,
      created_at: reqRow.created_at,
      created_at_display: createdAtDisplay,
      student: {
        name: studentName,
        cedula_display: formatCedulaDisplay(reqRow.cedula),
        access_tier: reqRow.access_tier,
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
    await withServiceClient(async (client) => {
      if (studentRecipientEmail) {
        const okStudent = n8nResult.ok && n8nResult.studentSent;
        await client.query(
          `INSERT INTO public.notification_email_logs (
             notification_id,
             recipient_email,
             provider,
             template_code,
             status,
             provider_message_id
           )
           VALUES ($1::uuid, $2::text, 'mailtrap', 'student_request_receipt_v1', $3::text, $4::text)`,
          [
            notifId,
            studentRecipientEmail,
            okStudent ? "sent" : "failed",
            n8nResult.studentMessageId,
          ]
        );
      }

      if (staffRecipients.length > 0) {
        const okStaff = n8nResult.ok && n8nResult.staffSent;
        for (let idx = 0; idx < staffRecipients.length; idx += 1) {
          const recipient = staffRecipients[idx];
          const providerMessageId =
            n8nResult.staffMessageIds[idx] ??
            n8nResult.staffMessageIds[0] ??
            null;
          await client.query(
            `INSERT INTO public.notification_email_logs (
               notification_id,
               recipient_email,
               provider,
               template_code,
               status,
               provider_message_id
             )
             VALUES (NULL, $1::text, 'mailtrap', 'control_estudios_new_request_v1', $2::text, $3::text)`,
            [recipient.email, okStaff ? "sent" : "failed", providerMessageId]
          );
        }
      }
    });

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

    await finishWorkflowRun({
      runId,
      status: finalStatus,
      resultJson: {
        dispatcher: "n8n",
        n8n_status_code: n8nResult.statusCode,
        student_sent: expectedStudent ? studentSucceeded : null,
        staff_sent: expectedStaff ? staffSucceeded : null,
      },
      errorMessage: n8nResult.error ?? null,
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
    try {
      await finishWorkflowRun({
        runId,
        status: "failed",
        resultJson: {},
        errorMessage: safeError,
      });
    } catch {
      // ignore secondary failure
    }

    return jsonResponse(
      {
        ok: false,
        workflow_run_id: runId,
        error: "Workflow execution failed",
      },
      500
    );
  }
}

const neonFunctionHandler = {
  fetch: handleRequest,
};

export default neonFunctionHandler;

import { attachDatabasePool } from "@neon/functions";
import pg, { type PoolClient } from "pg";
import { verifyWorkflowInvocationAuth } from "../_shared/webhook-auth";

const { Pool } = pg;

const WORKFLOW_CODE = "bulletin_publish_mailtrap";
const DEFAULT_PORTAL_BASE_URL = "http://localhost:3000";
const SENDER_EMAIL = "notificaciones@etcandresbello.org";
const SENDER_NAME = 'La Cartelera Bellista · E.T.C. "Andrés Bello"';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX_COLOR_REGEX = /^#[0-9a-f]{6}$/i;
const SAFE_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const CATEGORY_LABELS: Record<string, string> = {
  urgente: "Aviso Urgente",
  evento: "Evento Escolar",
  academico: "Académico",
  mencion: "Mención Técnica",
  cultura_deporte: "Cultura y Deporte",
};

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
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
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

function safeHex(value: unknown, fallback: string): string {
  return typeof value === "string" && HEX_COLOR_REGEX.test(value.trim())
    ? value.trim()
    : fallback;
}

function hexToRgbaEmail(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return `rgba(28, 71, 196, ${alpha})`;
  const r = Number.parseInt(clean.slice(0, 2), 16);
  const g = Number.parseInt(clean.slice(2, 4), 16);
  const b = Number.parseInt(clean.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) {
    return `rgba(28, 71, 196, ${alpha})`;
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function resolveSafeHttpsImageUrl(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "https:") {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

function resolvePortalBaseUrl(): string {
  const raw =
    process.env.SIGA_PORTAL_BASE_URL?.trim() || DEFAULT_PORTAL_BASE_URL;
  return raw.replace(/\/+$/, "");
}

function resolveSafeN8nWebhookUrl(): string | null {
  const direct = process.env.N8N_WEBHOOK_URL_BULLETIN_PUBLISH?.trim();
  const base = process.env.N8N_WEBHOOK_BASE_URL?.trim();
  const raw =
    direct ||
    (base
      ? `${base.replace(/\/+$/, "")}/webhook/siga-cartelera-mailtrap`
      : "");

  if (!raw) return null;

  try {
    const parsed = new URL(raw);
    const isLocal =
      parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    if (parsed.protocol === "https:" || (parsed.protocol === "http:" && isLocal)) {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

function stripSimpleMarkdown(raw: string): string {
  return raw
    .replace(/^#{1,3}\s+/gm, "")
    .replace(/^>\s+/gm, "")
    .replace(/^[-*]\s+/gm, "• ")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/==([^=]+)==/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\[([^\]]+)\]\((https:\/\/[^)]+)\)/g, "$1 ($2)")
    .trim();
}

function formatInlineMarkdownSafe(raw: string, primaryColor: string): string {
  // Escapar HTML primero garantiza 0 % de inyección XSS antes de aplicar formato seguro
  return escapeHtml(raw)
    .replace(
      /\[([^\]]+)\]\((https:\/\/[^\s)&lt;&gt;&quot;]+)\)/g,
      `<a href="$2" target="_blank" rel="noopener noreferrer" style="color:${primaryColor};font-weight:600;text-decoration:underline;">$1</a>`
    )
    .replace(
      /==([^=]+)==/g,
      `<span style="background:#fef3c7;color:#78350f;padding:1px 6px;border-radius:5px;font-weight:600;">$1</span>`
    )
    .replace(
      /\*\*([^*]+)\*\*/g,
      `<strong style="color:#0f172a;font-weight:700;">$1</strong>`
    )
    .replace(/__([^_]+)__/g, `<span style="text-decoration:underline;">$1</span>`)
    .replace(/\*([^*]+)\*/g, `<em style="font-style:italic;">$1</em>`);
}

function renderSafeBodyHtml(rawBody: string, primaryColor: string): string {
  const blocks = rawBody
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean)
    .slice(0, 14);

  const softTint = hexToRgbaEmail(primaryColor, 0.06);

  return blocks
    .map((block) => {
      if (block === "---") {
        return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;"><tr><td style="border-top:1px solid #e2e8f0;font-size:0;line-height:0;">&nbsp;</td></tr></table>`;
      }
      if (block.startsWith("## ")) {
        return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0 10px;"><tr><td width="4" style="background:${primaryColor};border-radius:4px;">&nbsp;</td><td style="padding-left:12px;font-size:16px;line-height:1.35;font-weight:700;color:#0f172a;letter-spacing:-0.01em;">${formatInlineMarkdownSafe(block.slice(3).trim(), primaryColor)}</td></tr></table>`;
      }
      if (block.startsWith("### ")) {
        return `<h3 style="margin:16px 0 8px;font-size:14px;line-height:1.4;font-weight:700;color:#1e293b;">${formatInlineMarkdownSafe(block.slice(4).trim(), primaryColor)}</h3>`;
      }

      const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);

      // Bloque de cita editorial (> ...)
      if (lines.every((line) => line.startsWith(">"))) {
        const quoteHtml = lines
          .map((line) =>
            formatInlineMarkdownSafe(line.replace(/^>\s?/, ""), primaryColor)
          )
          .join("<br />");
        return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:16px 0;background:${softTint};border-left:3px solid ${primaryColor};border-radius:0 12px 12px 0;"><tr><td style="padding:12px 16px;font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:14px;line-height:1.65;color:#1e293b;">${quoteHtml}</td></tr></table>`;
      }

      // Lista con viñetas (- ... o * ...)
      if (lines.every((line) => /^[-*•]\s+/.test(line))) {
        const listRows = lines
          .map((line) => {
            const itemText = line.replace(/^[-*•]\s+/, "");
            return `<tr>
              <td valign="top" width="18" style="padding:3px 0;color:${primaryColor};font-size:15px;line-height:1.5;font-weight:700;">&bull;</td>
              <td valign="top" style="padding:3px 0;color:#334155;font-size:14px;line-height:1.65;">${formatInlineMarkdownSafe(itemText, primaryColor)}</td>
            </tr>`;
          })
          .join("");
        return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 14px 4px;">${listRows}</table>`;
      }

      const paragraphHtml = lines
        .map((line) => formatInlineMarkdownSafe(line, primaryColor))
        .join("<br />");
      return `<p style="margin:0 0 14px;color:#334155;font-size:14.5px;line-height:1.7;">${paragraphHtml}</p>`;
    })
    .join("");
}

function formatEventCountdownBadge(eventDateIso: string | null): string | null {
  if (!eventDateIso) return null;
  const eventMs = Date.parse(eventDateIso);
  if (!Number.isFinite(eventMs)) return null;
  const diffDays = Math.ceil((eventMs - Date.now()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "Evento programado";
  if (diffDays === 0) return "Es hoy";
  if (diffDays === 1) return "Mañana";
  return `Faltan ${diffDays} días`;
}

interface IncomingPayload {
  record_id?: string;
  announcement_id?: string;
  workflow_run_id?: string;
}

interface ClaimResultJson {
  run_id: string;
  already_completed?: boolean;
}

interface AnnouncementRow {
  id: string;
  title: string;
  short_note: string;
  body: string;
  category: string;
  target_mencion_id: string | null;
  target_mencion_code: string | null;
  target_mencion_name: string | null;
  target_grade_year: number | null;
  event_date: string | null;
  location_label: string | null;
  cover_webp_url: string | null;
  theme_palette: Record<string, unknown> | null;
  is_published: boolean;
  published_at: string;
  deleted_at: string | null;
  author_department: string | null;
  author_name: string | null;
}

interface RecipientRow {
  user_id: string;
  first_name: string;
  last_name: string;
  institutional_email: string | null;
  recovery_email: string | null;
}

function buildBulletinEmailTemplate(params: {
  announcement: AnnouncementRow;
  audienceScope: "institution" | "mention";
  audienceLabel: string;
}): { subject: string; text: string; html: string } {
  const { announcement, audienceScope, audienceLabel } = params;
  const portalUrl = resolvePortalBaseUrl();
  const categoryLabel =
    CATEGORY_LABELS[announcement.category] ?? "Comunicado Oficial";
  const departmentLabel =
    announcement.author_department?.trim() || "Dirección";
  const authorLabel = announcement.author_name?.trim() || "";
  const primaryColor = safeHex(announcement.theme_palette?.primary, "#1c47c4");
  const secondaryColor = safeHex(
    announcement.theme_palette?.secondary,
    "#0b1d59"
  );
  const accentColor = safeHex(announcement.theme_palette?.accent, "#60a5fa");
  const safeCoverUrl = resolveSafeHttpsImageUrl(announcement.cover_webp_url);
  const shortNote = announcement.short_note?.trim() || "";

  const publishedDateDisplay = announcement.published_at
    ? new Intl.DateTimeFormat("es-VE", {
        timeZone: "America/Caracas",
        day: "2-digit",
        month: "long",
        year: "numeric",
      }).format(new Date(announcement.published_at))
    : "";

  const eventDateDisplay = announcement.event_date
    ? new Intl.DateTimeFormat("es-VE", {
        timeZone: "America/Caracas",
        dateStyle: "long",
        timeStyle: "short",
      }).format(new Date(announcement.event_date))
    : null;

  const countdownBadge = formatEventCountdownBadge(announcement.event_date);

  const scopePrefix =
    audienceScope === "institution"
      ? "[Cartelera Bellista]"
      : `[Cartelera · ${announcement.target_mencion_name ?? `${announcement.target_grade_year}.º Año`}]`;

  const subject = `${scopePrefix} ${announcement.title}`;

  const plainBody = stripSimpleMarkdown(announcement.body);
  const preheaderText = (shortNote || plainBody).slice(0, 140);

  const text = [
    `E.T.C. "Andrés Bello" — La Cartelera Bellista`,
    `${categoryLabel} · Emitido por ${departmentLabel}`,
    `Dirigido a: ${audienceLabel}`,
    "",
    announcement.title,
    shortNote ? `"${shortNote}"` : null,
    eventDateDisplay ? `Fecha del evento: ${eventDateDisplay}` : null,
    announcement.location_label ? `Lugar: ${announcement.location_label}` : null,
    "",
    plainBody,
    "",
    `Ver comunicado completo en S.I.G.A.: ${portalUrl}/estudiante/cartelera`,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  const primaryTintBg = hexToRgbaEmail(primaryColor, 0.08);
  const primaryTintBorder = hexToRgbaEmail(primaryColor, 0.22);
  const scopeFooterNote =
    audienceScope === "institution"
      ? "Comunicado general enviado a toda la comunidad institucional."
      : `Comunicado dirigido específicamente a ${audienceLabel}.`;

  const metadataRows: string[] = [
    `<tr>
      <td valign="top" width="118" style="padding:7px 10px 7px 0;font-size:12px;font-weight:600;color:#64748b;white-space:nowrap;">Dirigido a</td>
      <td valign="top" style="padding:7px 0;font-size:13px;font-weight:600;color:#0f172a;">
        <span style="display:inline-block;padding:2px 10px;border-radius:999px;background:${primaryTintBg};border:1px solid ${primaryTintBorder};color:${primaryColor};font-size:12px;font-weight:600;">${escapeHtml(audienceLabel)}</span>
      </td>
    </tr>`,
  ];

  if (eventDateDisplay) {
    metadataRows.push(`<tr>
      <td valign="top" width="118" style="padding:7px 10px 7px 0;font-size:12px;font-weight:600;color:#64748b;white-space:nowrap;">Fecha y hora</td>
      <td valign="top" style="padding:7px 0;font-size:13px;font-weight:600;color:#0f172a;">${escapeHtml(eventDateDisplay)}</td>
    </tr>`);
  }

  if (announcement.location_label) {
    metadataRows.push(`<tr>
      <td valign="top" width="118" style="padding:7px 10px 7px 0;font-size:12px;font-weight:600;color:#64748b;white-space:nowrap;">Lugar</td>
      <td valign="top" style="padding:7px 0;font-size:13px;font-weight:600;color:#0f172a;">${escapeHtml(announcement.location_label)}</td>
    </tr>`);
  }

  metadataRows.push(`<tr>
    <td valign="top" width="118" style="padding:7px 10px 7px 0;font-size:12px;font-weight:600;color:#64748b;white-space:nowrap;">Emitido por</td>
    <td valign="top" style="padding:7px 0;font-size:13px;color:#334155;">
      <strong style="color:#0f172a;font-weight:600;">${escapeHtml(departmentLabel)}</strong>${authorLabel ? ` <span style="color:#64748b;">&mdash; ${escapeHtml(authorLabel)}</span>` : ""}
    </td>
  </tr>`);

  const html = `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#eaf0f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Inter,Helvetica,Arial,sans-serif;color:#0f172a;-webkit-font-smoothing:antialiased;">
    <!-- Texto de vista previa en bandeja de entrada -->
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">
      ${escapeHtml(preheaderText)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
    </div>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#eaf0f8;padding:28px 14px 36px;">
      <tr>
        <td align="center">
          <!-- Cabecera institucional discreta sobre la cartica -->
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;margin:0 auto 14px;">
            <tr>
              <td align="left" style="padding:0 6px;font-size:12px;font-weight:700;color:#1e293b;letter-spacing:-0.01em;">
                <span style="display:inline-block;width:8px;height:8px;border-radius:999px;background:${primaryColor};margin-right:7px;vertical-align:middle;"></span>E.T.C. &ldquo;Andr&eacute;s Bello&rdquo; &nbsp;<span style="font-weight:400;color:#64748b;">|&nbsp; La Cartelera Bellista</span>
              </td>
              <td align="right" style="padding:0 6px;font-size:11.5px;color:#64748b;white-space:nowrap;">
                ${escapeHtml(publishedDateDisplay)}
              </td>
            </tr>
          </table>

          <!-- Marco físico de "La Cartica" (borde blanco editorial + sombra suave) -->
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;margin:0 auto;background-color:#ffffff;border-radius:26px;border:1px solid #d5e0ee;box-shadow:0 24px 48px -18px rgba(15,23,42,0.22);">
            <tr>
              <td style="padding:12px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-radius:18px;overflow:hidden;border:1px solid #e6edf6;background-color:#ffffff;">
                  <!-- Cinta cromática superior con la paleta del comunicado -->
                  <tr>
                    <td style="height:5px;line-height:5px;font-size:0;background:${primaryColor};background-image:linear-gradient(90deg,${accentColor} 0%,${primaryColor} 52%,${secondaryColor} 100%);">&nbsp;</td>
                  </tr>

                  ${
                    safeCoverUrl
                      ? `<!-- Fotografía de portada de la cartica -->
                  <tr>
                    <td style="background:#091024;padding:0;line-height:0;font-size:0;">
                      <img src="${escapeHtml(safeCoverUrl)}" alt="${escapeHtml(announcement.title)}" width="594" style="display:block;width:100%;max-width:594px;height:auto;max-height:250px;object-fit:cover;border:0;" />
                    </td>
                  </tr>`
                      : ""
                  }

                  <!-- Afiche Editorial Bellista (cabecera de la cartica) -->
                  <tr>
                    <td style="padding:26px 26px 22px;background-color:${secondaryColor};background-image:radial-gradient(rgba(255,255,255,0.20) 1px, transparent 1px),linear-gradient(138deg,${primaryColor} 0%,${secondaryColor} 64%,#081024 100%);background-size:18px 18px,100% 100%;color:#ffffff;">
                      <!-- Fila superior de insignias -->
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                        <tr>
                          <td align="left" valign="middle">
                            <span style="display:inline-block;padding:4px 11px;border-radius:999px;background:rgba(7,12,26,0.34);border:1px solid rgba(255,255,255,0.28);color:#ffffff;font-size:11px;font-weight:600;letter-spacing:0.02em;">
                              <span style="display:inline-block;width:6px;height:6px;border-radius:999px;background:${accentColor};margin-right:6px;vertical-align:middle;"></span>${escapeHtml(categoryLabel)}
                            </span>
                            <span style="display:inline-block;margin-left:6px;padding:4px 11px;border-radius:999px;background:rgba(255,255,255,0.14);border:1px solid rgba(255,255,255,0.22);color:#f1f5f9;font-size:11px;font-weight:500;">
                              ${escapeHtml(departmentLabel)}
                            </span>
                          </td>
                          ${
                            countdownBadge
                              ? `<td align="right" valign="middle" style="white-space:nowrap;">
                            <span style="display:inline-block;padding:4px 10px;border-radius:999px;background:rgba(255,255,255,0.18);border:1px solid rgba(255,255,255,0.32);color:#ffffff;font-size:11px;font-weight:700;">
                              ${escapeHtml(countdownBadge)}
                            </span>
                          </td>`
                              : ""
                          }
                        </tr>
                      </table>

                      <!-- Título principal del comunicado -->
                      <h1 style="margin:18px 0 0;font-size:24px;line-height:1.26;font-weight:700;letter-spacing:-0.02em;color:#ffffff;">
                        ${escapeHtml(announcement.title)}
                      </h1>

                      ${
                        shortNote &&
                        shortNote.toLowerCase() !== announcement.title.trim().toLowerCase()
                          ? `<!-- Nota destacada manuscrita/editorial (sello de La Cartelera Bellista) -->
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:16px 0 0;">
                        <tr>
                          <td width="3" style="background:${accentColor};border-radius:3px;">&nbsp;</td>
                          <td style="padding:2px 0 2px 12px;font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:14.5px;line-height:1.5;color:rgba(255,255,255,0.92);">
                            &ldquo;${escapeHtml(shortNote)}&rdquo;
                          </td>
                        </tr>
                      </table>`
                          : ""
                      }

                      <!-- Pie del afiche (alcance y sello) -->
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0 0;border-top:1px solid rgba(255,255,255,0.18);">
                        <tr>
                          <td style="padding-top:12px;font-size:12px;font-weight:600;color:rgba(255,255,255,0.92);">
                            ${escapeHtml(audienceLabel)}
                          </td>
                          <td align="right" style="padding-top:12px;font-size:11px;color:rgba(255,255,255,0.72);">
                            S.I.G.A. &middot; Comunicado Oficial
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- Cuerpo editorial sobre papel blanco -->
                  <tr>
                    <td style="padding:24px 26px 26px;background-color:#ffffff;">
                      <!-- Ficha de datos clave -->
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 22px;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;">
                        <tr>
                          <td style="padding:12px 16px;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                              ${metadataRows.join("")}
                            </table>
                          </td>
                        </tr>
                      </table>

                      <!-- Contenido completo del comunicado -->
                      <div style="color:#334155;font-size:14.5px;line-height:1.7;">
                        ${renderSafeBodyHtml(announcement.body, primaryColor)}
                      </div>

                      <!-- Botón principal de acción -->
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:26px 0 0;border-top:1px solid #edf2f7;">
                        <tr>
                          <td style="padding-top:22px;">
                            <table role="presentation" cellspacing="0" cellpadding="0">
                              <tr>
                                <td style="border-radius:999px;background-color:${primaryColor};box-shadow:0 10px 22px -10px ${hexToRgbaEmail(primaryColor, 0.7)};">
                                  <a href="${escapeHtml(portalUrl)}/estudiante/cartelera" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:12px 24px;font-size:13.5px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:-0.01em;">
                                    Abrir en La Cartelera Bellista
                                  </a>
                                </td>
                              </tr>
                            </table>
                            <p style="margin:10px 0 0;font-size:11.5px;line-height:1.5;color:#64748b;">
                              Al abrir este comunicado en el portal quedar&aacute; registrado autom&aacute;ticamente en tu secci&oacute;n de Le&iacute;dos.
                            </p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- Pie institucional integrado en la cartica -->
                  <tr>
                    <td style="padding:15px 26px;background-color:#f8fafc;border-top:1px solid #e2e8f0;">
                      <p style="margin:0;font-size:11.5px;line-height:1.55;color:#475569;font-weight:600;">
                        Escuela T&eacute;cnica Comercial &ldquo;Andr&eacute;s Bello&rdquo; &middot; Unare II, Puerto Ordaz
                      </p>
                      <p style="margin:3px 0 0;font-size:11px;line-height:1.55;color:#64748b;">
                        ${escapeHtml(scopeFooterNote)} C&oacute;digo DEA OD01340701 &middot; Remitente oficial: ${SENDER_EMAIL}.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
}

async function finishWorkflowRun(params: {
  runId: string;
  status: "completed" | "partial" | "skipped" | "failed";
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
 * Neon Function (`bulletinnotify`):
 * Al publicarse un comunicado en `public.school_announcements`, determina si su
 * alcance es toda la institución o una mención/año específico, resuelve los
 * destinatarios reales en Neon PostgreSQL y despacha la notificación vía n8n + Mailtrap
 * desde `notificaciones@etcandresbello.org`.
 */
async function handleRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  if (req.method === "GET") {
    return jsonResponse({
      ok: true,
      service: "siga-bulletin-publish-email",
      workflow_code: WORKFLOW_CODE,
      sender: SENDER_EMAIL,
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

  let body: IncomingPayload;
  try {
    body = (await req.json()) as IncomingPayload;
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON payload" }, 400);
  }

  const recordId =
    body.record_id?.trim() || body.announcement_id?.trim() || "";
  if (!UUID_REGEX.test(recordId)) {
    return jsonResponse(
      { ok: false, error: "Missing or invalid announcement record_id" },
      400
    );
  }

  // Reclamo idempotente de ejecución (evita reenvíos masivos si se edita una tilde luego)
  let claim: ClaimResultJson;
  try {
    const claimed = await withServiceClient(async (client) => {
      const res = await client.query<{ result: ClaimResultJson }>(
        `SELECT public.siga_service_claim_workflow_run(
           p_workflow_code := $1::text,
           p_source_record_id := $2::uuid,
           p_source_table := 'public.school_announcements',
           p_expected_run_id := NULL::uuid
         ) AS result`,
        [WORKFLOW_CODE, recordId]
      );
      return res.rows[0]?.result ?? null;
    });

    if (!claimed || !claimed.run_id) {
      return jsonResponse(
        { ok: false, error: "Unable to claim workflow execution" },
        500
      );
    }
    claim = claimed;
  } catch {
    return jsonResponse(
      { ok: false, error: "Unable to claim workflow execution" },
      500
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
    const { announcement, recipientRows } = await withServiceClient(
      async (client) => {
        const annRes = await client.query<AnnouncementRow>(
          `SELECT sa.id,
                  sa.title,
                  sa.short_note,
                  sa.body,
                  sa.category,
                  sa.target_mencion_id,
                  m.code AS target_mencion_code,
                  m.name AS target_mencion_name,
                  sa.target_grade_year,
                  sa.event_date::text AS event_date,
                  sa.location_label,
                  sa.cover_webp_url,
                  sa.theme_palette,
                  sa.is_published,
                  sa.published_at::text AS published_at,
                  sa.deleted_at::text AS deleted_at,
                  sa.author_department,
                  trim(concat_ws(' ', u.first_name, u.last_name)) AS author_name
             FROM public.school_announcements sa
             LEFT JOIN public.menciones m ON m.id = sa.target_mencion_id
             LEFT JOIN public.users u ON u.id = sa.created_by
            WHERE sa.id = $1::uuid
            LIMIT 1`,
          [recordId]
        );

        const ann = annRes.rows[0] ?? null;
        if (!ann || !ann.is_published || ann.deleted_at !== null) {
          return { announcement: ann, recipientRows: [] as RecipientRow[] };
        }

        const isInstitutionWide =
          ann.target_mencion_id === null && ann.target_grade_year === null;

        if (isInstitutionWide) {
          // Toda la institución: todos los usuarios activos con correo válido
          const res = await client.query<RecipientRow>(
            `SELECT u.id AS user_id,
                    u.first_name,
                    u.last_name,
                    u.institutional_email,
                    u.recovery_email
               FROM public.users u
              WHERE u.is_active = true
                AND u.deleted_at IS NULL
                AND (
                  (u.institutional_email IS NOT NULL AND trim(u.institutional_email) <> '')
                  OR (u.recovery_email IS NOT NULL AND trim(u.recovery_email) <> '')
                )
              ORDER BY u.created_at ASC
              LIMIT 250`
          );
          return { announcement: ann, recipientRows: res.rows };
        }

        // Mención única y/o año específico: estudiantes matriculados en ese alcance + su coordinación
        const res = await client.query<RecipientRow>(
          `WITH target_students AS (
             SELECT DISTINCT u.id AS user_id,
                    u.first_name,
                    u.last_name,
                    u.institutional_email,
                    u.recovery_email
               FROM public.enrollments e
               JOIN public.school_years sy ON sy.id = e.school_year_id
               JOIN public.users u ON u.id = e.student_user_id
              WHERE e.deleted_at IS NULL
                AND e.enrollment_status IN ('active', 'pre_enrolled')
                AND u.is_active = true
                AND u.deleted_at IS NULL
                AND ($1::uuid IS NULL OR e.mencion_id = $1::uuid)
                AND ($2::smallint IS NULL OR e.grade_year = $2::smallint)
                AND (
                  sy.is_current = true
                  OR NOT EXISTS (SELECT 1 FROM public.school_years WHERE is_current = true)
                )
           ),
           target_coordinators AS (
             SELECT DISTINCT u.id AS user_id,
                    u.first_name,
                    u.last_name,
                    u.institutional_email,
                    u.recovery_email
               FROM public.user_roles ur
               JOIN public.roles r ON r.id = ur.role_id
               JOIN public.users u ON u.id = ur.user_id
              WHERE ur.is_active = true
                AND r.is_active = true
                AND u.is_active = true
                AND u.deleted_at IS NULL
                AND (
                  ($1::uuid IS NOT NULL AND r.code = 'coordinador_mencion' AND ur.mencion_id = $1::uuid)
                  OR ($2::smallint IN (5, 6) AND r.code = 'coordinador_pasantias')
                )
           )
           SELECT DISTINCT user_id, first_name, last_name, institutional_email, recovery_email
             FROM (
               SELECT * FROM target_students
               UNION
               SELECT * FROM target_coordinators
             ) combined
            WHERE (institutional_email IS NOT NULL AND trim(institutional_email) <> '')
               OR (recovery_email IS NOT NULL AND trim(recovery_email) <> '')
            LIMIT 250`,
          [ann.target_mencion_id, ann.target_grade_year]
        );
        return { announcement: ann, recipientRows: res.rows };
      }
    );

    if (!announcement || !announcement.is_published || announcement.deleted_at) {
      await finishWorkflowRun({
        runId,
        status: "skipped",
        resultJson: { reason: "announcement_not_published_or_missing" },
        errorMessage: null,
      });
      return jsonResponse({
        ok: true,
        workflow_run_id: runId,
        status: "skipped",
      });
    }

    const audienceScope: "institution" | "mention" =
      announcement.target_mencion_id === null &&
      announcement.target_grade_year === null
        ? "institution"
        : "mention";

    const audienceLabel =
      audienceScope === "institution"
        ? "Toda la institución"
        : [
            announcement.target_mencion_name
              ? `Mención ${announcement.target_mencion_name}`
              : null,
            announcement.target_grade_year
              ? `${announcement.target_grade_year}.º Año`
              : null,
          ]
            .filter(Boolean)
            .join(" · ");

    const recipientsMap = new Map<string, { email: string; name: string }>();
    for (const row of recipientRows) {
      const candidate =
        row.institutional_email?.trim() || row.recovery_email?.trim() || "";
      const email = candidate.toLowerCase();
      if (
        !email ||
        email.endsWith(".local") ||
        !SAFE_EMAIL_REGEX.test(email)
      ) {
        continue;
      }
      if (!recipientsMap.has(email)) {
        recipientsMap.set(email, {
          email,
          name: `${row.first_name} ${row.last_name}`.trim(),
        });
      }
    }

    const recipients = Array.from(recipientsMap.values());
    if (recipients.length === 0) {
      await finishWorkflowRun({
        runId,
        status: "skipped",
        resultJson: {
          reason: "no_recipients_for_scope",
          audience_scope: audienceScope,
        },
        errorMessage: null,
      });
      return jsonResponse({
        ok: true,
        workflow_run_id: runId,
        status: "skipped",
        audience_scope: audienceScope,
        recipient_count: 0,
      });
    }

    const n8nUrl = resolveSafeN8nWebhookUrl();
    if (!n8nUrl) {
      await finishWorkflowRun({
        runId,
        status: "failed",
        resultJson: { audience_scope: audienceScope },
        errorMessage:
          "N8N_WEBHOOK_URL_BULLETIN_PUBLISH no está configurada en Neon Functions.",
      });
      return jsonResponse(
        {
          ok: false,
          workflow_run_id: runId,
          error: "Webhook n8n de publicación de cartelera no configurado.",
        },
        503
      );
    }

    const emailContent = buildBulletinEmailTemplate({
      announcement,
      audienceScope,
      audienceLabel,
    });

    const n8nHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const n8nSecret = process.env.N8N_WEBHOOK_SECRET?.trim();
    if (n8nSecret) {
      n8nHeaders["x-siga-n8n-secret"] = n8nSecret;
    }

    const n8nPayload = {
      workflow_code: WORKFLOW_CODE,
      workflow_run_id: runId,
      record_id: announcement.id,
      audience_scope: audienceScope,
      audience_label: audienceLabel,
      target_mencion_code: announcement.target_mencion_code,
      target_mencion_name: announcement.target_mencion_name,
      target_grade_year: announcement.target_grade_year,
      category: announcement.category,
      department_label: announcement.author_department || "Dirección",
      from_email: SENDER_EMAIL,
      from_name: SENDER_NAME,
      recipient_count: recipients.length,
      recipients,
      email: {
        subject: emailContent.subject,
        text: emailContent.text,
        html: emailContent.html,
        category:
          audienceScope === "institution"
            ? "siga-cartelera-institucion"
            : "siga-cartelera-mencion",
      },
    };

    let n8nRes: Response;
    try {
      n8nRes = await fetch(n8nUrl, {
        method: "POST",
        headers: n8nHeaders,
        body: JSON.stringify(n8nPayload),
        signal: AbortSignal.timeout(25_000),
      });
    } catch (err) {
      const msg =
        err instanceof Error
          ? `Fallo de red hacia n8n: ${err.message}`
          : "Fallo de red hacia n8n";
      await finishWorkflowRun({
        runId,
        status: "failed",
        resultJson: {
          audience_scope: audienceScope,
          recipient_count: recipients.length,
        },
        errorMessage: msg.slice(0, 400),
      });
      return jsonResponse(
        { ok: false, workflow_run_id: runId, error: "Error conectando con n8n" },
        504
      );
    }

    let parsedN8n: Record<string, unknown> | null = null;
    try {
      parsedN8n = (await n8nRes.json()) as Record<string, unknown>;
    } catch {
      parsedN8n = null;
    }

    const okDelivery = n8nRes.ok && parsedN8n?.ok !== false;
    const sentCount =
      typeof parsedN8n?.sent_count === "number"
        ? parsedN8n.sent_count
        : okDelivery
          ? recipients.length
          : 0;
    const messageIds = Array.isArray(parsedN8n?.message_ids)
      ? parsedN8n.message_ids.filter((id): id is string => typeof id === "string")
      : [];

    const templateCode =
      audienceScope === "institution"
        ? "bulletin_publish_institution_v1"
        : "bulletin_publish_mention_v1";

    // Registrar trazabilidad en `public.notification_email_logs`
    await withServiceClient(async (client) => {
      for (let idx = 0; idx < recipients.length; idx += 1) {
        const recipient = recipients[idx];
        const providerMsgId = messageIds[idx] ?? messageIds[0] ?? null;
        await client.query(
          `INSERT INTO public.notification_email_logs (
             notification_id,
             recipient_email,
             provider,
             template_code,
             status,
             provider_message_id
           )
           VALUES (NULL, $1::text, 'mailtrap', $2::text, $3::text, $4::text)`,
          [
            recipient.email,
            templateCode,
            okDelivery ? "sent" : "failed",
            providerMsgId,
          ]
        );
      }
    });

    const finalStatus: "completed" | "partial" | "failed" = okDelivery
      ? sentCount >= recipients.length
        ? "completed"
        : sentCount > 0
          ? "partial"
          : "failed"
      : "failed";

    await finishWorkflowRun({
      runId,
      status: finalStatus,
      resultJson: {
        dispatcher: "n8n",
        audience_scope: audienceScope,
        audience_label: audienceLabel,
        recipient_count: recipients.length,
        sent_count: sentCount,
        n8n_status_code: n8nRes.status,
      },
      errorMessage: okDelivery
        ? null
        : typeof parsedN8n?.error === "string"
          ? parsedN8n.error
          : `n8n respondió HTTP ${n8nRes.status}`,
    });

    return jsonResponse(
      {
        ok: finalStatus === "completed" || finalStatus === "partial",
        workflow_run_id: runId,
        status: finalStatus,
        audience_scope: audienceScope,
        recipient_count: recipients.length,
        sent_count: sentCount,
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
      { ok: false, workflow_run_id: runId, error: "Workflow execution failed" },
      500
    );
  }
}

const neonFunctionHandler = {
  fetch: handleRequest,
};

export default neonFunctionHandler;

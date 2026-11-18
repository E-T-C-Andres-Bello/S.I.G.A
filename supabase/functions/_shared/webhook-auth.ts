export interface WorkflowInvocationAuthResult {
  authorized: boolean;
  mode: "service_role" | "webhook_secret" | "run_token_required" | "rejected";
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return toHex(digest);
}

function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Valida la autenticidad de invocaciones internas:
 * 1) `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` siempre autorizado.
 * 2) Si `WORKFLOW_WEBHOOK_SECRET` está configurado (opcional en desarrollo), exige `x-siga-workflow-secret`.
 * 3) En desarrollo sin `WORKFLOW_WEBHOOK_SECRET`, exige que el payload incluya el `workflow_run_id`
 *    generado por el trigger de PostgreSQL y existente en `workflows.workflow_runs`.
 */
export async function verifyWorkflowInvocationAuth(
  req: Request
): Promise<WorkflowInvocationAuthResult> {
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  const authHeader = req.headers.get("authorization")?.trim();
  if (serviceRoleKey && authHeader?.toLowerCase().startsWith("bearer ")) {
    const bearer = authHeader.slice(7).trim();
    const [expectedHash, providedHash] = await Promise.all([
      sha256Hex(serviceRoleKey),
      sha256Hex(bearer),
    ]);
    if (timingSafeEqualString(expectedHash, providedHash)) {
      return { authorized: true, mode: "service_role" };
    }
  }

  const expectedWebhookSecret = Deno.env.get("WORKFLOW_WEBHOOK_SECRET")?.trim();
  if (expectedWebhookSecret) {
    const providedWebhookSecret = req.headers.get("x-siga-workflow-secret")?.trim();
    if (!providedWebhookSecret) {
      return { authorized: false, mode: "rejected" };
    }

    const [expectedHash, providedHash] = await Promise.all([
      sha256Hex(expectedWebhookSecret),
      sha256Hex(providedWebhookSecret),
    ]);

    if (timingSafeEqualString(expectedHash, providedHash)) {
      return { authorized: true, mode: "webhook_secret" };
    }

    return { authorized: false, mode: "rejected" };
  }

  return { authorized: true, mode: "run_token_required" };
}

import { createHash, timingSafeEqual } from "node:crypto";

export interface WorkflowInvocationAuthResult {
  authorized: boolean;
  mode: "webhook_secret" | "run_token_required" | "rejected";
}

function sha256Buffer(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

function timingSafeEqualSecret(expected: string, provided: string): boolean {
  const expectedDigest = sha256Buffer(expected);
  const providedDigest = sha256Buffer(provided);
  return timingSafeEqual(expectedDigest, providedDigest);
}

/**
 * Valida la autenticidad de invocaciones internas hacia la Neon Function:
 * 1) Si `WORKFLOW_WEBHOOK_SECRET` está configurado, exige el header `x-siga-workflow-secret`.
 * 2) En desarrollo sin `WORKFLOW_WEBHOOK_SECRET`, exige que el payload incluya el
 *    `workflow_run_id` creado por el trigger en `workflows.workflow_runs`.
 */
export function verifyWorkflowInvocationAuth(
  req: Request
): WorkflowInvocationAuthResult {
  const expectedWebhookSecret = process.env.WORKFLOW_WEBHOOK_SECRET?.trim();
  if (expectedWebhookSecret) {
    const providedWebhookSecret = req.headers
      .get("x-siga-workflow-secret")
      ?.trim();
    if (!providedWebhookSecret) {
      return { authorized: false, mode: "rejected" };
    }

    if (timingSafeEqualSecret(expectedWebhookSecret, providedWebhookSecret)) {
      return { authorized: true, mode: "webhook_secret" };
    }

    return { authorized: false, mode: "rejected" };
  }

  return { authorized: true, mode: "run_token_required" };
}

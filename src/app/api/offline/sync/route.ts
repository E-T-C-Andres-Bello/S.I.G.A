import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getServerAuthSession, isAuthConfigured } from "@/lib/auth/server";
import { callNeonRpcScalar, withUserDb } from "@/lib/db/neon";

export const runtime = "nodejs";

const attendanceMutationSchema = z.object({
  kind: z.literal("attendance_batch"),
  payload: z.object({
    teacherAssignmentId: z.string().uuid(),
    momentoId: z.string().uuid(),
    sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    blockLabel: z.string().min(1).max(64),
    recordedMode: z
      .enum(["online", "offline_pwa", "qr_scan", "manual", "offline_sync"])
      .transform((mode) => {
        if (mode === "manual") return "online" as const;
        if (mode === "offline_sync") return "offline_pwa" as const;
        return mode;
      }),
    records: z
      .array(
        z.object({
          enrollment_id: z.string().uuid(),
          status: z.enum(["present", "absent", "late", "justified"]),
          note: z.string().max(300).optional(),
          client_mutation_id: z.string().uuid(),
        })
      )
      .min(1),
  }),
});

const gradeMutationSchema = z.object({
  kind: z.literal("grade_entry"),
  payload: z.object({
    evaluationItemId: z.string().uuid(),
    enrollmentId: z.string().uuid(),
    numericScore: z.number().min(0).max(20).nullable().optional(),
    literalGrade: z.enum(["A", "B", "C", "D", "E"]).nullable().optional(),
    reason: z.string().max(300).optional(),
  }),
});

const announcementReadMutationSchema = z.object({
  kind: z.literal("announcement_read"),
  payload: z.object({
    announcementId: z.string().uuid(),
  }),
});

const syncPayloadSchema = z.discriminatedUnion("kind", [
  attendanceMutationSchema,
  gradeMutationSchema,
  announcementReadMutationSchema,
]);

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isAuthConfigured()) {
    return NextResponse.json(
      { ok: false, message: "El servicio de sincronización no está disponible." },
      { status: 503 }
    );
  }

  const session = await getServerAuthSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, message: "Tu sesión institucional expiró." },
      { status: 401 }
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "Solicitud inválida." },
      { status: 400 }
    );
  }

  const parsed = syncPayloadSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "Los datos pendientes de sincronización no son válidos." },
      { status: 400 }
    );
  }

  const item = parsed.data;

  try {
    await withUserDb(
      { authUserId: session.authUserId, email: session.email },
      async (client) => {
        if (item.kind === "attendance_batch") {
          await callNeonRpcScalar(client, "siga_sync_attendance_batch", {
            p_teacher_assignment_id: item.payload.teacherAssignmentId,
            p_momento_id: item.payload.momentoId,
            p_session_date: item.payload.sessionDate,
            p_block_label: item.payload.blockLabel,
            p_recorded_mode: item.payload.recordedMode,
            p_records: JSON.stringify(item.payload.records),
          });
        } else if (item.kind === "announcement_read") {
          await callNeonRpcScalar(client, "siga_confirm_announcement_read", {
            p_announcement_id: item.payload.announcementId,
          });
        } else {
          await callNeonRpcScalar(client, "siga_registrar_nota", {
            p_evaluation_item_id: item.payload.evaluationItemId,
            p_enrollment_id: item.payload.enrollmentId,
            p_numeric_score: item.payload.numericScore ?? null,
            p_literal_grade: item.payload.literalGrade ?? null,
            p_source: "manual",
            p_reason: item.payload.reason ?? null,
          });
        }
      }
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[offline-sync] Error sincronizando mutación:", error);
    return NextResponse.json(
      { ok: false, message: "No se pudo sincronizar el registro pendiente en este momento." },
      { status: 500 }
    );
  }
}

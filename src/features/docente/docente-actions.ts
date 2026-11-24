"use server";

import { z } from "zod";
import { getAuthenticatedDashboardContext } from "@/lib/auth/dashboard-session";
import {
  callNeonRpcScalar,
  isNeonDatabaseConfigured,
  querySingleRow,
  withUserDb,
} from "@/lib/db/neon";
import type {
  EvaluationItemDto,
  EvaluationPlanDto,
  EvaluationType,
} from "./types";

export const evaluationItemSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(3, "El título de la actividad debe tener al menos 3 caracteres"),
  evaluationType: z.enum([
    "exam_online",
    "assignment_lms",
    "lab_mention",
    "classroom_activity",
    "project",
  ]),
  weightPercent: z
    .number()
    .min(1, "El porcentaje mínimo es 1 %")
    .max(100, "El porcentaje máximo es 100 %"),
  maxPoints: z.number().default(20),
  scheduledDate: z.string().nullable().optional(),
});

export const saveEvaluationPlanSchema = z.object({
  teacherAssignmentId: z.string().uuid(),
  momentoId: z.string().uuid(),
  title: z.string().min(3, "El título del plan es requerido"),
  status: z.enum(["draft", "published"]).default("draft"),
  planningAiNotes: z.string().nullable().optional(),
  items: z.array(evaluationItemSchema).min(1, "Debe incluir al menos una actividad evaluativa"),
});

export type SaveEvaluationPlanInput = z.infer<typeof saveEvaluationPlanSchema>;

export async function getEvaluationPlanAction(
  teacherAssignmentId: string,
  momentoId: string
): Promise<EvaluationPlanDto | null> {
  const profile = await getAuthenticatedDashboardContext();
  if (!isNeonDatabaseConfigured()) return null;

  return withUserDb(
    { authUserId: profile.authUserId, email: profile.authEmail },
    async (client) => {
      const assignmentCheck = await querySingleRow<{ id: string }>(
        client,
        `SELECT id
           FROM public.teacher_assignments
          WHERE id = $1::uuid
            AND teacher_user_id = $2::uuid
          LIMIT 1`,
        [teacherAssignmentId, profile.internalUserId]
      );

      if (!assignmentCheck) {
        return null;
      }

      const plan = await querySingleRow<{
        id: string;
        teacher_assignment_id: string;
        momento_id: string;
        title: string;
        planning_ai_notes: string | null;
        status: string;
      }>(
        client,
        `SELECT id, teacher_assignment_id, momento_id, title, planning_ai_notes, status
           FROM public.evaluation_plans
          WHERE teacher_assignment_id = $1::uuid
            AND momento_id = $2::uuid
          LIMIT 1`,
        [teacherAssignmentId, momentoId]
      );

      if (!plan) {
        return null;
      }

      const itemsRes = await client.query<{
        id: string;
        title: string;
        evaluation_type: string;
        weight_percent: number;
        max_points: number;
        scheduled_date: string | null;
      }>(
        `SELECT id, title, evaluation_type, weight_percent, max_points, scheduled_date
           FROM public.evaluation_items
          WHERE evaluation_plan_id = $1::uuid
          ORDER BY created_at ASC`,
        [plan.id]
      );

      const formattedItems: EvaluationItemDto[] = itemsRes.rows.map((it) => ({
        id: it.id,
        title: it.title,
        evaluationType: it.evaluation_type as EvaluationType,
        weightPercent: Number(it.weight_percent),
        maxPoints: Number(it.max_points),
        scheduledDate: it.scheduled_date,
      }));

      const totalWeight = formattedItems.reduce((acc, it) => acc + it.weightPercent, 0);

      return {
        id: plan.id,
        teacherAssignmentId: plan.teacher_assignment_id,
        momentoId: plan.momento_id,
        title: plan.title,
        planningAiNotes: plan.planning_ai_notes,
        status: plan.status as EvaluationPlanDto["status"],
        items: formattedItems,
        totalWeight,
      };
    }
  );
}

export async function saveEvaluationPlanAction(
  rawInput: SaveEvaluationPlanInput
): Promise<{ success: boolean; message: string; planId?: string }> {
  try {
    const profile = await getAuthenticatedDashboardContext();
    if (!isNeonDatabaseConfigured()) {
      return { success: false, message: "Error de conexión con el servidor institucional." };
    }

    const validated = saveEvaluationPlanSchema.parse(rawInput);

    const totalWeight = validated.items.reduce((acc, item) => acc + item.weightPercent, 0);
    if (validated.status === "published" && Math.round(totalWeight) !== 100) {
      return {
        success: false,
        message: `Para publicar el plan oficial, la suma de las ponderaciones debe ser exactamente 100 % (Suma actual: ${totalWeight.toFixed(1)} %).`,
      };
    }

    return await withUserDb(
      { authUserId: profile.authUserId, email: profile.authEmail },
      async (client) => {
        const assignmentCheck = await querySingleRow<{ id: string }>(
          client,
          `SELECT id
             FROM public.teacher_assignments
            WHERE id = $1::uuid
              AND teacher_user_id = $2::uuid
            LIMIT 1`,
          [validated.teacherAssignmentId, profile.internalUserId]
        );

        if (!assignmentCheck) {
          return {
            success: false,
            message: "No tienes autorización para editar la planificación de esta sección.",
          };
        }

        const existingPlan = await querySingleRow<{ id: string; status: string }>(
          client,
          `SELECT id, status
             FROM public.evaluation_plans
            WHERE teacher_assignment_id = $1::uuid
              AND momento_id = $2::uuid
            LIMIT 1`,
          [validated.teacherAssignmentId, validated.momentoId]
        );

        if (existingPlan?.status === "locked") {
          return {
            success: false,
            message: "Este plan de evaluación se encuentra bloqueado para el lapso seleccionado.",
          };
        }

        let planId: string;
        if (existingPlan) {
          planId = existingPlan.id;
          await client.query(
            `UPDATE public.evaluation_plans
                SET title = $1,
                    status = $2,
                    planning_ai_notes = $3,
                    updated_at = now()
              WHERE id = $4::uuid`,
            [
              validated.title,
              validated.status,
              validated.planningAiNotes ?? null,
              planId,
            ]
          );
        } else {
          const inserted = await querySingleRow<{ id: string }>(
            client,
            `INSERT INTO public.evaluation_plans
               (teacher_assignment_id, momento_id, title, status, planning_ai_notes)
             VALUES ($1::uuid, $2::uuid, $3, $4, $5)
             RETURNING id`,
            [
              validated.teacherAssignmentId,
              validated.momentoId,
              validated.title,
              validated.status,
              validated.planningAiNotes ?? null,
            ]
          );
          if (!inserted) {
            return { success: false, message: "Error al registrar la planificación." };
          }
          planId = inserted.id;
        }

        await client.query(
          `DELETE FROM public.evaluation_items WHERE evaluation_plan_id = $1::uuid`,
          [planId]
        );

        for (const item of validated.items) {
          await client.query(
            `INSERT INTO public.evaluation_items
               (evaluation_plan_id, title, evaluation_type, weight_percent, max_points, scheduled_date)
             VALUES ($1::uuid, $2, $3, $4, $5, $6)`,
            [
              planId,
              item.title,
              item.evaluationType,
              item.weightPercent,
              item.maxPoints ?? 20,
              item.scheduledDate || null,
            ]
          );
        }

        return {
          success: true,
          message:
            validated.status === "published"
              ? "¡Plan de evaluación publicado oficialmente con el 100 % de ponderación!"
              : "Borrador de planificación guardado correctamente.",
          planId,
        };
      }
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return {
        success: false,
        message: err.issues[0]?.message ?? "Datos inválidos en el formulario.",
      };
    }
    return { success: false, message: "Error inesperado al procesar la solicitud." };
  }
}

export const saveAttendanceSchema = z.object({
  teacherAssignmentId: z.string().uuid(),
  momentoId: z.string().uuid(),
  sessionDate: z.string(),
  blockLabel: z.string().default("Bloque Regular"),
  recordedMode: z.enum(["online", "offline_pwa", "qr_scan"]).default("online"),
  records: z.array(
    z.object({
      enrollmentId: z.string().uuid(),
      status: z.enum(["present", "absent", "late", "justified"]),
      note: z.string().nullable().optional(),
    })
  ),
});

export type SaveAttendanceInput = z.infer<typeof saveAttendanceSchema>;

export async function saveAttendanceSessionAction(
  rawInput: SaveAttendanceInput
): Promise<{ success: boolean; message: string }> {
  try {
    const profile = await getAuthenticatedDashboardContext();
    if (!isNeonDatabaseConfigured()) {
      return { success: false, message: "Servicio de base de datos no disponible." };
    }

    const validated = saveAttendanceSchema.parse(rawInput);

    return await withUserDb(
      { authUserId: profile.authUserId, email: profile.authEmail },
      async (client) => {
        const assignmentCheck = await querySingleRow<{ id: string }>(
          client,
          `SELECT id
             FROM public.teacher_assignments
            WHERE id = $1::uuid
              AND teacher_user_id = $2::uuid
            LIMIT 1`,
          [validated.teacherAssignmentId, profile.internalUserId]
        );

        if (!assignmentCheck) {
          return { success: false, message: "No tienes autorización sobre esta sección." };
        }

        const payloadRecords = validated.records.map((r) => ({
          enrollment_id: r.enrollmentId,
          status: r.status,
          note: r.note ?? null,
          client_mutation_id: crypto.randomUUID(),
        }));

        await callNeonRpcScalar(client, "siga_sync_attendance_batch", {
          p_teacher_assignment_id: validated.teacherAssignmentId,
          p_momento_id: validated.momentoId,
          p_session_date: validated.sessionDate,
          p_block_label: validated.blockLabel,
          p_recorded_mode: validated.recordedMode,
          p_records: JSON.stringify(payloadRecords),
        });

        return { success: true, message: "¡Asistencia de la sesión registrada con éxito!" };
      }
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { success: false, message: err.issues[0]?.message ?? "Datos inválidos." };
    }
    return { success: false, message: "Error al registrar la asistencia." };
  }
}

export const saveClassDiarySchema = z.object({
  teacherAssignmentId: z.string().uuid(),
  entryDate: z.string(),
  topicCovered: z.string().min(3, "El tema dictado es obligatorio"),
  classroomIncidents: z.string().nullable().optional(),
  deriveToOrientation: z.boolean().default(false),
});

export type SaveClassDiaryInput = z.infer<typeof saveClassDiarySchema>;

export async function saveClassDiaryAction(
  rawInput: SaveClassDiaryInput
): Promise<{ success: boolean; message: string }> {
  try {
    const profile = await getAuthenticatedDashboardContext();
    if (!isNeonDatabaseConfigured()) {
      return { success: false, message: "Servicio no disponible." };
    }

    const validated = saveClassDiarySchema.parse(rawInput);

    await withUserDb(
      { authUserId: profile.authUserId, email: profile.authEmail },
      (client) =>
        client.query(
          `INSERT INTO public.class_diary_entries
             (teacher_assignment_id, entry_date, topic_covered, classroom_incidents, derive_to_orientation, author_user_id)
           VALUES ($1::uuid, $2::date, $3, $4, $5, $6::uuid)`,
          [
            validated.teacherAssignmentId,
            validated.entryDate,
            validated.topicCovered,
            validated.classroomIncidents ?? null,
            validated.deriveToOrientation,
            profile.internalUserId,
          ]
        )
    );

    return {
      success: true,
      message: validated.deriveToOrientation
        ? "Diario guardado y caso derivado confidencialmente a Orientación y Bienestar."
        : "Anotación del diario de clases registrada exitosamente.",
    };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { success: false, message: err.issues[0]?.message ?? "Datos inválidos." };
    }
    return { success: false, message: "Error inesperado al guardar el diario." };
  }
}

export const reportTeacherAbsenceSchema = z.object({
  absenceDate: z.string(),
  reasonCategory: z.enum(["medical", "personal", "institutional"]),
  observation: z.string().nullable().optional(),
  affectedBlocks: z.array(z.string()).min(1, "Indica al menos un bloque horario afectado"),
});

export type ReportTeacherAbsenceInput = z.infer<typeof reportTeacherAbsenceSchema>;

export async function reportTeacherAbsenceAction(
  rawInput: ReportTeacherAbsenceInput
): Promise<{ success: boolean; message: string }> {
  try {
    const profile = await getAuthenticatedDashboardContext();
    if (!isNeonDatabaseConfigured()) {
      return { success: false, message: "Servicio no disponible." };
    }

    const validated = reportTeacherAbsenceSchema.parse(rawInput);

    await withUserDb(
      { authUserId: profile.authUserId, email: profile.authEmail },
      (client) =>
        client.query(
          `INSERT INTO public.teacher_absences
             (teacher_user_id, absence_date, reason_category, observation, affected_blocks, status)
           VALUES ($1::uuid, $2::date, $3, $4, $5::jsonb, 'reported')`,
          [
            profile.internalUserId,
            validated.absenceDate,
            validated.reasonCategory,
            validated.observation ?? null,
            JSON.stringify(validated.affectedBlocks),
          ]
        )
    );

    return {
      success: true,
      message: "Aviso de inasistencia enviado formalmente a Coordinación y Dirección.",
    };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { success: false, message: err.issues[0]?.message ?? "Datos inválidos." };
    }
    return { success: false, message: "Error al enviar el aviso de inasistencia." };
  }
}

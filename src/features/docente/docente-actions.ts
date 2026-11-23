"use server";

import { z } from "zod";
import { getAuthenticatedDashboardContext } from "@/lib/supabase/dashboard-session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
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

/**
 * Server Action: Obtiene el plan de evaluación y sus actividades para una asignación y momento dados.
 */
export async function getEvaluationPlanAction(
  teacherAssignmentId: string,
  momentoId: string
): Promise<EvaluationPlanDto | null> {
  const profile = await getAuthenticatedDashboardContext();
  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;

  // Validar pertenencia del docente
  const { data: assignmentCheck } = await supabase
    .from("teacher_assignments")
    .select("id")
    .eq("id", teacherAssignmentId)
    .eq("teacher_user_id", profile.internalUserId)
    .maybeSingle();

  if (!assignmentCheck) {
    return null;
  }

  const { data: plan, error: planError } = await supabase
    .from("evaluation_plans")
    .select("id, teacher_assignment_id, momento_id, title, planning_ai_notes, status")
    .eq("teacher_assignment_id", teacherAssignmentId)
    .eq("momento_id", momentoId)
    .maybeSingle();

  if (planError || !plan) {
    return null;
  }

  const { data: items, error: itemsError } = await supabase
    .from("evaluation_items")
    .select("id, title, evaluation_type, weight_percent, max_points, scheduled_date")
    .eq("evaluation_plan_id", plan.id)
    .order("created_at", { ascending: true });

  if (itemsError) {
    console.error("Error al consultar actividades de evaluación:", itemsError);
  }

  const formattedItems: EvaluationItemDto[] = (items ?? []).map((it) => ({
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

/**
 * Server Action: Guarda o actualiza un Plan de Evaluación con sus actividades ponderadas.
 * Si status es 'published', exige de forma estricta que la suma sea exactamente 100 %.
 */
export async function saveEvaluationPlanAction(
  rawInput: SaveEvaluationPlanInput
): Promise<{ success: boolean; message: string; planId?: string }> {
  try {
    const profile = await getAuthenticatedDashboardContext();
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return { success: false, message: "Error de conexión con el servidor institucional." };
    }

    const validated = saveEvaluationPlanSchema.parse(rawInput);

    // 1. Validar que la asignación docente pertenece al usuario autenticado
    const { data: assignmentCheck, error: assignError } = await supabase
      .from("teacher_assignments")
      .select("id")
      .eq("id", validated.teacherAssignmentId)
      .eq("teacher_user_id", profile.internalUserId)
      .maybeSingle();

    if (assignError || !assignmentCheck) {
      return {
        success: false,
        message: "No tienes autorización para editar la planificación de esta sección.",
      };
    }

    // 2. Suma de ponderaciones
    const totalWeight = validated.items.reduce((acc, item) => acc + item.weightPercent, 0);

    if (validated.status === "published" && Math.round(totalWeight) !== 100) {
      return {
        success: false,
        message: `Para publicar el plan oficial, la suma de las ponderaciones debe ser exactamente 100 % (Suma actual: ${totalWeight.toFixed(
          1
        )} %).`,
      };
    }

    // 3. Crear o actualizar cabecera del plan
    let planId: string;
    const { data: existingPlan } = await supabase
      .from("evaluation_plans")
      .select("id, status")
      .eq("teacher_assignment_id", validated.teacherAssignmentId)
      .eq("momento_id", validated.momentoId)
      .maybeSingle();

    if (existingPlan?.status === "locked") {
      return {
        success: false,
        message: "Este plan de evaluación se encuentra bloqueado para el lapso seleccionado.",
      };
    }

    if (existingPlan) {
      planId = existingPlan.id;
      const { error: updateError } = await supabase
        .from("evaluation_plans")
        .update({
          title: validated.title,
          status: validated.status,
          planning_ai_notes: validated.planningAiNotes ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", planId);

      if (updateError) {
        return { success: false, message: "Error al actualizar la planificación." };
      }
    } else {
      const { data: newPlan, error: insertError } = await supabase
        .from("evaluation_plans")
        .insert({
          teacher_assignment_id: validated.teacherAssignmentId,
          momento_id: validated.momentoId,
          title: validated.title,
          status: validated.status,
          planning_ai_notes: validated.planningAiNotes ?? null,
        })
        .select("id")
        .single();

      if (insertError || !newPlan) {
        return { success: false, message: "Error al registrar la planificación." };
      }
      planId = newPlan.id;
    }

    // 4. Sincronizar actividades evaluativas
    await supabase.from("evaluation_items").delete().eq("evaluation_plan_id", planId);

    const itemsToInsert = validated.items.map((item) => ({
      evaluation_plan_id: planId,
      title: item.title,
      evaluation_type: item.evaluationType,
      weight_percent: item.weightPercent,
      max_points: item.maxPoints ?? 20,
      scheduled_date: item.scheduledDate || null,
    }));

    const { error: itemsError } = await supabase.from("evaluation_items").insert(itemsToInsert);

    if (itemsError) {
      return {
        success: false,
        message: "El plan se guardó, pero hubo un error al registrar las actividades.",
        planId,
      };
    }

    return {
      success: true,
      message:
        validated.status === "published"
          ? "¡Plan de evaluación publicado oficialmente con el 100 % de ponderación!"
          : "Borrador de planificación guardado correctamente.",
      planId,
    };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return {
        success: false,
        message: err.errors[0]?.message ?? "Datos inválidos en el formulario.",
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

/**
 * Server Action: Guarda la sesión de asistencia y el pase de lista de los estudiantes.
 */
export async function saveAttendanceSessionAction(
  rawInput: SaveAttendanceInput
): Promise<{ success: boolean; message: string }> {
  try {
    const profile = await getAuthenticatedDashboardContext();
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return { success: false, message: "Servicio de base de datos no disponible." };
    }

    const validated = saveAttendanceSchema.parse(rawInput);

    // Validar asignación del docente
    const { data: assignmentCheck } = await supabase
      .from("teacher_assignments")
      .select("id")
      .eq("id", validated.teacherAssignmentId)
      .eq("teacher_user_id", profile.internalUserId)
      .maybeSingle();

    if (!assignmentCheck) {
      return { success: false, message: "No tienes autorización sobre esta sección." };
    }

    // 1. Obtener o crear la sesión de asistencia para la fecha y bloque
    let sessionId: string;
    const { data: existingSession } = await supabase
      .from("attendance_sessions")
      .select("id")
      .eq("teacher_assignment_id", validated.teacherAssignmentId)
      .eq("session_date", validated.sessionDate)
      .eq("block_label", validated.blockLabel)
      .maybeSingle();

    if (existingSession) {
      sessionId = existingSession.id;
    } else {
      const { data: newSession, error: sessionErr } = await supabase
        .from("attendance_sessions")
        .insert({
          teacher_assignment_id: validated.teacherAssignmentId,
          momento_id: validated.momentoId,
          session_date: validated.sessionDate,
          block_label: validated.blockLabel,
          recorded_mode: validated.recordedMode,
          created_by: profile.internalUserId,
          synced_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (sessionErr || !newSession) {
        return { success: false, message: "Error al crear la sesión de asistencia." };
      }
      sessionId = newSession.id;
    }

    // 2. Insertar o actualizar registros individuales de alumnos
    const recordsToUpsert = validated.records.map((r) => ({
      attendance_session_id: sessionId,
      enrollment_id: r.enrollmentId,
      status: r.status,
      note: r.note ?? null,
      client_mutation_id: crypto.randomUUID(),
    }));

    const { error: recordsErr } = await supabase
      .from("attendance_records")
      .upsert(recordsToUpsert, {
        onConflict: "attendance_session_id,enrollment_id",
        ignoreDuplicates: false,
      });

    if (recordsErr) {
      return { success: false, message: "Error al guardar el detalle de asistencia." };
    }

    return { success: true, message: "¡Asistencia de la sesión registrada con éxito!" };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { success: false, message: err.errors[0]?.message ?? "Datos inválidos." };
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

/**
 * Server Action: Guarda una anotación en el Diario de Clases con opción de derivar a Orientación.
 */
export async function saveClassDiaryAction(
  rawInput: SaveClassDiaryInput
): Promise<{ success: boolean; message: string }> {
  try {
    const profile = await getAuthenticatedDashboardContext();
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return { success: false, message: "Servicio no disponible." };
    }

    const validated = saveClassDiarySchema.parse(rawInput);

    const { error } = await supabase.from("class_diary_entries").insert({
      teacher_assignment_id: validated.teacherAssignmentId,
      entry_date: validated.entryDate,
      topic_covered: validated.topicCovered,
      classroom_incidents: validated.classroomIncidents ?? null,
      derive_to_orientation: validated.deriveToOrientation,
      author_user_id: profile.internalUserId,
    });

    if (error) {
      return { success: false, message: "Error al guardar en el diario de clases." };
    }

    return {
      success: true,
      message: validated.deriveToOrientation
        ? "Diario guardado y caso derivado confidencialmente a Orientación y Bienestar."
        : "Anotación del diario de clases registrada exitosamente.",
    };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { success: false, message: err.errors[0]?.message ?? "Datos inválidos." };
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

/**
 * Server Action: Notifica inasistencia formal anticipada a Dirección y Coordinación.
 */
export async function reportTeacherAbsenceAction(
  rawInput: ReportTeacherAbsenceInput
): Promise<{ success: boolean; message: string }> {
  try {
    const profile = await getAuthenticatedDashboardContext();
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return { success: false, message: "Servicio no disponible." };
    }

    const validated = reportTeacherAbsenceSchema.parse(rawInput);

    const { error } = await supabase.from("teacher_absences").insert({
      teacher_user_id: profile.internalUserId,
      absence_date: validated.absenceDate,
      reason_category: validated.reasonCategory,
      observation: validated.observation ?? null,
      affected_blocks: validated.affectedBlocks,
      status: "reported",
    });

    if (error) {
      return { success: false, message: "Error al registrar el aviso de inasistencia." };
    }

    return {
      success: true,
      message: "Aviso de inasistencia enviado formalmente a Coordinación y Dirección.",
    };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { success: false, message: err.errors[0]?.message ?? "Datos inválidos." };
    }
    return { success: false, message: "Error al enviar el aviso de inasistencia." };
  }
}

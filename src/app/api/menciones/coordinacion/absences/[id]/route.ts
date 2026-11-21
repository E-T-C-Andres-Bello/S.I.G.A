import { NextResponse } from "next/server";
import { z } from "zod";
import { updateTeacherAbsenceSchema } from "@/features/menciones/coordinacion-schemas";
import { resolveAuthorizedMencionScope } from "@/features/menciones/coordinacion-server";
import { getAuthenticatedDashboardContext } from "@/lib/supabase/dashboard-session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const idSchema = z.string().uuid();

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Identificador inválido." }, { status: 400 });
  }

  const profile = await getAuthenticatedDashboardContext();
  const scope = await resolveAuthorizedMencionScope(profile);
  if (!scope.ok) {
    return NextResponse.json({ error: scope.message }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const parsed = updateTeacherAbsenceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 }
    );
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Servicio de datos no disponible." },
      { status: 503 }
    );
  }

  const updatePayload: {
    status: "reported" | "acknowledged" | "reorganized";
    reviewed_by: string;
    observation?: string;
  } = {
    status: parsed.data.status,
    reviewed_by: profile.internalUserId,
  };

  if (parsed.data.observation !== undefined) {
    updatePayload.observation = parsed.data.observation;
  }

  const { error } = await supabase
    .from("teacher_absences")
    .update(updatePayload)
    .eq("id", id);

  if (error) {
    return NextResponse.json(
      { error: "No fue posible actualizar el estado de la inasistencia." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}


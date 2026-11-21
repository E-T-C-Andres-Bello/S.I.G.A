import { NextResponse } from "next/server";
import { z } from "zod";
import { toggleScenarioCatalogSchema } from "@/features/menciones/coordinacion-schemas";
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

  const parsed = toggleScenarioCatalogSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Servicio de datos no disponible." },
      { status: 503 }
    );
  }

  const { data: existing } = await supabase
    .from("mention_lab_scenarios")
    .select("id, mencion_id")
    .eq("id", id)
    .maybeSingle<{ id: string; mencion_id: string }>();

  if (!existing) {
    return NextResponse.json(
      { error: "Escenario no encontrado." },
      { status: 404 }
    );
  }

  if (
    scope.isScopedToSingleMencion &&
    existing.mencion_id !== scope.selectedMencion?.id
  ) {
    return NextResponse.json(
      { error: "No autorizado para modificar escenarios de otra mención." },
      { status: 403 }
    );
  }

  const { error } = await supabase
    .from("mention_lab_scenarios")
    .update({ is_base_catalog: parsed.data.isBaseCatalog })
    .eq("id", id);

  if (error) {
    return NextResponse.json(
      { error: "No fue posible actualizar el escenario." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
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

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Servicio de datos no disponible." },
      { status: 503 }
    );
  }

  const { data: existing } = await supabase
    .from("mention_lab_scenarios")
    .select("id, mencion_id")
    .eq("id", id)
    .maybeSingle<{ id: string; mencion_id: string }>();

  if (!existing) {
    return NextResponse.json(
      { error: "Escenario no encontrado." },
      { status: 404 }
    );
  }

  if (
    scope.isScopedToSingleMencion &&
    existing.mencion_id !== scope.selectedMencion?.id
  ) {
    return NextResponse.json(
      { error: "No autorizado para eliminar escenarios de otra mención." },
      { status: 403 }
    );
  }

  const { error } = await supabase
    .from("mention_lab_scenarios")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json(
      { error: "No fue posible eliminar el escenario porque tiene entregas asociadas." },
      { status: 409 }
    );
  }

  return NextResponse.json({ ok: true });
}


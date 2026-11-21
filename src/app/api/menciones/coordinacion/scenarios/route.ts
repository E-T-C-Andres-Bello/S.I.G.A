import { NextResponse } from "next/server";
import { createScenarioSchema } from "@/features/menciones/coordinacion-schemas";
import { resolveAuthorizedMencionScope } from "@/features/menciones/coordinacion-server";
import { getAuthenticatedDashboardContext } from "@/lib/supabase/dashboard-session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const profile = await getAuthenticatedDashboardContext();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Solicitud inválida." },
      { status: 400 }
    );
  }

  const parsed = createScenarioSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 }
    );
  }

  const scope = await resolveAuthorizedMencionScope(
    profile,
    parsed.data.mencionId
  );
  if (!scope.ok || !scope.selectedMencion) {
    return NextResponse.json(
      { error: scope.ok ? "Mención no encontrada." : scope.message },
      { status: 403 }
    );
  }

  // Si es coordinador de mención, forzar estrictamente su mención asignada
  const targetMencionId = scope.isScopedToSingleMencion
    ? scope.selectedMencion.id
    : parsed.data.mencionId;

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Servicio de datos no disponible." },
      { status: 503 }
    );
  }

  const { data, error } = await supabase
    .from("mention_lab_scenarios")
    .insert({
      mencion_id: targetMencionId,
      grade_year: parsed.data.gradeYear,
      tool_type: parsed.data.toolType,
      title: parsed.data.title,
      instructions: parsed.data.instructions,
      is_base_catalog: parsed.data.isBaseCatalog,
      created_by: profile.internalUserId,
    })
    .select(
      "id, mencion_id, grade_year, tool_type, title, instructions, is_base_catalog, created_at"
    )
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: "No fue posible registrar el escenario práctico." },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      scenario: {
        id: data.id,
        mencionId: data.mencion_id,
        gradeYear: data.grade_year,
        toolType: data.tool_type,
        title: data.title,
        instructions: data.instructions,
        isBaseCatalog: data.is_base_catalog,
        createdAt: data.created_at,
      },
    },
    { status: 201 }
  );
}


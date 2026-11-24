import { NextResponse } from "next/server";
import { createScenarioSchema } from "@/features/menciones/coordinacion-schemas";
import { resolveAuthorizedMencionScope } from "@/features/menciones/coordinacion-server";
import { getAuthenticatedDashboardContext } from "@/lib/auth/dashboard-session";
import {
  isNeonDatabaseConfigured,
  querySingleRow,
  withUserDb,
} from "@/lib/db/neon";

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

  const targetMencionId = scope.isScopedToSingleMencion
    ? scope.selectedMencion.id
    : parsed.data.mencionId;

  if (!isNeonDatabaseConfigured()) {
    return NextResponse.json(
      { error: "Servicio de datos no disponible." },
      { status: 503 }
    );
  }

  try {
    const data = await withUserDb(
      { authUserId: profile.authUserId, email: profile.authEmail },
      (client) =>
        querySingleRow<{
          id: string;
          mencion_id: string;
          grade_year: number;
          tool_type: string;
          title: string;
          instructions: string;
          is_base_catalog: boolean;
          created_at: string;
        }>(
          client,
          `INSERT INTO public.mention_lab_scenarios
             (mencion_id, grade_year, tool_type, title, instructions, is_base_catalog, created_by)
           VALUES ($1::uuid, $2, $3, $4, $5, $6, $7::uuid)
           RETURNING id, mencion_id, grade_year, tool_type, title, instructions, is_base_catalog, created_at`,
          [
            targetMencionId,
            parsed.data.gradeYear,
            parsed.data.toolType,
            parsed.data.title,
            parsed.data.instructions,
            parsed.data.isBaseCatalog,
            profile.internalUserId,
          ]
        )
    );

    if (!data) {
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
  } catch {
    return NextResponse.json(
      { error: "No fue posible registrar el escenario práctico." },
      { status: 500 }
    );
  }
}

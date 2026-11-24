import { NextResponse } from "next/server";
import { z } from "zod";
import { toggleScenarioCatalogSchema } from "@/features/menciones/coordinacion-schemas";
import { resolveAuthorizedMencionScope } from "@/features/menciones/coordinacion-server";
import { getAuthenticatedDashboardContext } from "@/lib/auth/dashboard-session";
import {
  isNeonDatabaseConfigured,
  querySingleRow,
  withUserDb,
} from "@/lib/db/neon";

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

  if (!isNeonDatabaseConfigured()) {
    return NextResponse.json(
      { error: "Servicio de datos no disponible." },
      { status: 503 }
    );
  }

  try {
    const result = await withUserDb(
      { authUserId: profile.authUserId, email: profile.authEmail },
      async (client) => {
        const existing = await querySingleRow<{ id: string; mencion_id: string }>(
          client,
          `SELECT id, mencion_id FROM public.mention_lab_scenarios WHERE id = $1::uuid LIMIT 1`,
          [id]
        );
        if (!existing) return "not_found" as const;
        if (
          scope.isScopedToSingleMencion &&
          existing.mencion_id !== scope.selectedMencion?.id
        ) {
          return "forbidden" as const;
        }
        await client.query(
          `UPDATE public.mention_lab_scenarios SET is_base_catalog = $1 WHERE id = $2::uuid`,
          [parsed.data.isBaseCatalog, id]
        );
        return "ok" as const;
      }
    );

    if (result === "not_found") {
      return NextResponse.json({ error: "Escenario no encontrado." }, { status: 404 });
    }
    if (result === "forbidden") {
      return NextResponse.json(
        { error: "No autorizado para modificar escenarios de otra mención." },
        { status: 403 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "No fue posible actualizar el escenario." },
      { status: 500 }
    );
  }
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

  if (!isNeonDatabaseConfigured()) {
    return NextResponse.json(
      { error: "Servicio de datos no disponible." },
      { status: 503 }
    );
  }

  try {
    const result = await withUserDb(
      { authUserId: profile.authUserId, email: profile.authEmail },
      async (client) => {
        const existing = await querySingleRow<{ id: string; mencion_id: string }>(
          client,
          `SELECT id, mencion_id FROM public.mention_lab_scenarios WHERE id = $1::uuid LIMIT 1`,
          [id]
        );
        if (!existing) return "not_found" as const;
        if (
          scope.isScopedToSingleMencion &&
          existing.mencion_id !== scope.selectedMencion?.id
        ) {
          return "forbidden" as const;
        }
        await client.query(
          `DELETE FROM public.mention_lab_scenarios WHERE id = $1::uuid`,
          [id]
        );
        return "ok" as const;
      }
    );

    if (result === "not_found") {
      return NextResponse.json({ error: "Escenario no encontrado." }, { status: 404 });
    }
    if (result === "forbidden") {
      return NextResponse.json(
        { error: "No autorizado para eliminar escenarios de otra mención." },
        { status: 403 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "No fue posible eliminar el escenario porque tiene entregas asociadas." },
      { status: 409 }
    );
  }
}

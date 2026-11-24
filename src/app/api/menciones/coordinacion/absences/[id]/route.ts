import { NextResponse } from "next/server";
import { z } from "zod";
import { updateTeacherAbsenceSchema } from "@/features/menciones/coordinacion-schemas";
import { resolveAuthorizedMencionScope } from "@/features/menciones/coordinacion-server";
import { getAuthenticatedDashboardContext } from "@/lib/auth/dashboard-session";
import { isNeonDatabaseConfigured, withUserDb } from "@/lib/db/neon";

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

  if (!isNeonDatabaseConfigured()) {
    return NextResponse.json(
      { error: "Servicio de datos no disponible." },
      { status: 503 }
    );
  }

  try {
    await withUserDb(
      { authUserId: profile.authUserId, email: profile.authEmail },
      async (client) => {
        if (parsed.data.observation !== undefined) {
          await client.query(
            `UPDATE public.teacher_absences
                SET status = $1,
                    reviewed_by = $2::uuid,
                    observation = $3
              WHERE id = $4::uuid`,
            [parsed.data.status, profile.internalUserId, parsed.data.observation, id]
          );
        } else {
          await client.query(
            `UPDATE public.teacher_absences
                SET status = $1,
                    reviewed_by = $2::uuid
              WHERE id = $3::uuid`,
            [parsed.data.status, profile.internalUserId, id]
          );
        }
      }
    );

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "No fue posible actualizar el estado de la inasistencia." },
      { status: 500 }
    );
  }
}

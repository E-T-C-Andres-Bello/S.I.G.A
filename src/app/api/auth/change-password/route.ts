import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getAuth, getServerAuthSession, isAuthConfigured } from "@/lib/auth/server";
import { withServiceDb } from "@/lib/db/neon";

export const runtime = "nodejs";

const changePasswordSchema = z.object({
  newPassword: z
    .string()
    .min(8, "La nueva contraseña debe tener al menos 8 caracteres.")
    .max(128, "La contraseña excede la longitud permitida."),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isAuthConfigured()) {
    return NextResponse.json(
      { ok: false, message: "El servicio de autenticación no está disponible ahora." },
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

  const parsed = changePasswordSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: parsed.error.issues[0]?.message ?? "Contraseña inválida." },
      { status: 400 }
    );
  }

  try {
    const auth = getAuth();
    const ctx = await auth.$context;
    const hashedPassword = await ctx.password.hash(parsed.data.newPassword);

    await withServiceDb(async (client) => {
      const updated = await client.query(
        `UPDATE public.auth_account
            SET password = $1,
                "updatedAt" = now()
          WHERE "userId" = $2
            AND "providerId" = 'credential'`,
        [hashedPassword, session.authUserId]
      );

      if ((updated.rowCount ?? 0) === 0) {
        await client.query(
          `INSERT INTO public.auth_account
             (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
           VALUES ($1, $2, 'credential', $2, $3, now(), now())`,
          [crypto.randomUUID(), session.authUserId, hashedPassword]
        );
      }
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message: "No se pudo actualizar la contraseña en este momento.",
      },
      { status: 500 }
    );
  }
}

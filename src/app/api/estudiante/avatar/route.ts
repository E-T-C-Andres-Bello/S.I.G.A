import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getServerAuthSession, isAuthConfigured } from "@/lib/auth/server";
import { callNeonRpcScalar, withUserDb } from "@/lib/db/neon";
import {
  deleteStudentAvatarFromNeonStorage,
  uploadStudentAvatarToNeonStorage,
} from "@/lib/storage/neon-storage";

export const runtime = "nodejs";

const MAX_AVATAR_BYTES = 512 * 1024;

export async function POST(request: Request): Promise<NextResponse> {
  if (!isAuthConfigured()) {
    return NextResponse.json(
      { ok: false, message: "El servicio no está disponible temporalmente." },
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

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { ok: false, message: "Formato de imagen inválido." },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { ok: false, message: "Debes adjuntar una fotografía en formato WebP." },
      { status: 400 }
    );
  }

  if (file.type !== "image/webp") {
    return NextResponse.json(
      { ok: false, message: "La fotografía optimizada debe estar en formato WebP." },
      { status: 400 }
    );
  }

  if (file.size <= 0 || file.size > MAX_AVATAR_BYTES) {
    return NextResponse.json(
      { ok: false, message: "La fotografía no puede superar los 512 KB." },
      { status: 400 }
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const uploadResult = await uploadStudentAvatarToNeonStorage({
    authUserId: session.authUserId,
    bytes,
    contentType: "image/webp",
  });

  if (!uploadResult.ok) {
    return NextResponse.json(
      { ok: false, message: uploadResult.message },
      { status: 503 }
    );
  }

  try {
    await withUserDb(
      { authUserId: session.authUserId, email: session.email },
      (client) =>
        callNeonRpcScalar(client, "siga_actualizar_avatar_estudiante", {
          p_avatar_webp_url: uploadResult.publicUrl,
        })
    );

    revalidatePath("/estudiante/perfil");
    revalidatePath("/estudiante/carnet");
    revalidatePath("/estudiante");

    return NextResponse.json({
      ok: true,
      avatarWebpUrl: uploadResult.publicUrl,
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message: "No se pudo registrar la nueva fotografía en tu ficha escolar.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(): Promise<NextResponse> {
  if (!isAuthConfigured()) {
    return NextResponse.json(
      { ok: false, message: "El servicio no está disponible temporalmente." },
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

  await deleteStudentAvatarFromNeonStorage(session.authUserId);

  try {
    await withUserDb(
      { authUserId: session.authUserId, email: session.email },
      (client) =>
        callNeonRpcScalar(client, "siga_actualizar_avatar_estudiante", {
          p_avatar_webp_url: null,
        })
    );

    revalidatePath("/estudiante/perfil");
    revalidatePath("/estudiante/carnet");
    revalidatePath("/estudiante");

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message: "No se pudo retirar la fotografía de perfil en este momento.",
      },
      { status: 500 }
    );
  }
}

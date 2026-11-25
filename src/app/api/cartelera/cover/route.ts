import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getServerAuthSession, isAuthConfigured } from "@/lib/auth/server";
import { querySingleRow, withUserDb } from "@/lib/db/neon";
import { uploadAnnouncementCoverToNeonStorage } from "@/lib/storage/neon-storage";

export const runtime = "nodejs";

const MAX_COVER_BYTES = 768 * 1024;

function hasValidWebpSignature(bytes: Buffer): boolean {
  if (bytes.length < 12) return false;
  const riff = bytes.subarray(0, 4).toString("ascii");
  const webp = bytes.subarray(8, 12).toString("ascii");
  return riff === "RIFF" && webp === "WEBP";
}

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

  // Verificar permisos editoriales reales en PostgreSQL
  let canUploadCover = false;
  try {
    const authCheck = await withUserDb(
      { authUserId: session.authUserId, email: session.email },
      (client) =>
        querySingleRow<{ allowed: boolean }>(
          client,
          `SELECT (
             siga_internal.has_any_role(ARRAY['direccion', 'control_estudios', 'coordinador_pasantias'])
             OR siga_internal.current_coord_mencion_id() IS NOT NULL
           ) AS allowed`
        )
    );
    canUploadCover = Boolean(authCheck?.allowed);
  } catch {
    return NextResponse.json(
      { ok: false, message: "No se pudieron verificar tus permisos editoriales." },
      { status: 500 }
    );
  }

  if (!canUploadCover) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Solo Dirección, Control de Estudios, Coordinación de Mención o Coordinación de Pasantías pueden subir portadas.",
      },
      { status: 403 }
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
      { ok: false, message: "Debes seleccionar una imagen optimizada en formato WebP." },
      { status: 400 }
    );
  }

  if (file.type !== "image/webp") {
    return NextResponse.json(
      { ok: false, message: "La imagen debe estar optimizada en formato WebP." },
      { status: 400 }
    );
  }

  if (file.size <= 0 || file.size > MAX_COVER_BYTES) {
    return NextResponse.json(
      { ok: false, message: "La imagen de portada no puede superar los 768 KB." },
      { status: 400 }
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (!hasValidWebpSignature(bytes)) {
    return NextResponse.json(
      { ok: false, message: "El archivo adjunto no tiene una firma de imagen WebP válida." },
      { status: 400 }
    );
  }

  const uploadResult = await uploadAnnouncementCoverToNeonStorage({
    objectKey: randomUUID(),
    bytes,
    contentType: "image/webp",
  });

  if (!uploadResult.ok) {
    return NextResponse.json(
      { ok: false, message: uploadResult.message },
      { status: 503 }
    );
  }

  return NextResponse.json({
    ok: true,
    coverWebpUrl: uploadResult.publicUrl,
  });
}

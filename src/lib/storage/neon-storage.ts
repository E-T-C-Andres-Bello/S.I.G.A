import { Files } from "files-sdk";
import { neon } from "files-sdk/neon";

if (typeof window !== "undefined") {
  throw new Error("neon-storage.ts solo puede ejecutarse en el servidor.");
}

export interface NeonStorageConfig {
  endpoint: string;
  region: string;
  bucket: string;
  publicBaseUrl: string;
}

export function getNeonStorageConfig(
  bucketOverride?: string
): NeonStorageConfig | null {
  const endpoint =
    process.env.AWS_ENDPOINT_URL_S3?.trim() ||
    process.env.NEON_STORAGE_ENDPOINT?.trim();
  const accessKeyId =
    process.env.AWS_ACCESS_KEY_ID?.trim() ||
    process.env.NEON_STORAGE_ACCESS_KEY_ID?.trim();
  const secretAccessKey =
    process.env.AWS_SECRET_ACCESS_KEY?.trim() ||
    process.env.NEON_STORAGE_SECRET_ACCESS_KEY?.trim();
  const region =
    process.env.AWS_REGION?.trim() ||
    process.env.NEON_STORAGE_REGION?.trim() ||
    "us-east-2";
  const bucket =
    bucketOverride ||
    process.env.NEON_STORAGE_BUCKET?.trim() ||
    "student-avatars";

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    return null;
  }

  const publicBaseUrl = (
    process.env.NEON_STORAGE_PUBLIC_BASE_URL?.trim() ||
    `${endpoint.replace(/\/+$/, "")}/${bucket}`
  ).replace(/\/+$/, "");

  return {
    endpoint: endpoint.replace(/\/+$/, ""),
    region,
    bucket,
    publicBaseUrl,
  };
}

/**
 * Crea un cliente Files SDK conectado al bucket de Neon Object Storage indicado
 * (`uploads`, `assets` o `student-avatars`).
 */
export function createNeonBucketFiles(bucket: "uploads" | "assets" | "student-avatars"): Files {
  return new Files({
    adapter: neon({ bucket }),
  });
}

/**
 * Sube una fotografía de perfil `.webp` al bucket `student-avatars` (public_read)
 * de Neon Object Storage bajo la ruta `<authUserId>/avatar.webp`.
 */
export async function uploadStudentAvatarToNeonStorage(params: {
  authUserId: string;
  bytes: Buffer;
  contentType: string;
}): Promise<{ ok: true; publicUrl: string } | { ok: false; message: string }> {
  const config = getNeonStorageConfig("student-avatars");
  if (!config) {
    return {
      ok: false,
      message:
        "El servicio de almacenamiento de fotografías aún no está habilitado en este entorno.",
    };
  }

  const key = `${params.authUserId}/avatar.webp`;
  const files = createNeonBucketFiles("student-avatars");

  try {
    await files.upload(key, params.bytes, {
      contentType: params.contentType,
    });

    const versionedUrl = `${config.publicBaseUrl}/${key}?v=${Date.now()}`;
    return { ok: true, publicUrl: versionedUrl };
  } catch (error) {
    console.error("[neon-storage] Error subiendo avatar:", error);
    return {
      ok: false,
      message: "No se pudo guardar la fotografía de perfil en este momento.",
    };
  }
}

/**
 * Elimina la fotografía de perfil del usuario en Neon Object Storage.
 */
export async function deleteStudentAvatarFromNeonStorage(
  authUserId: string
): Promise<void> {
  const config = getNeonStorageConfig("student-avatars");
  if (!config) return;

  const files = createNeonBucketFiles("student-avatars");
  try {
    await files.delete(`${authUserId}/avatar.webp`);
  } catch {
    // Si el objeto ya no existe, continuar limpiamente
  }
}

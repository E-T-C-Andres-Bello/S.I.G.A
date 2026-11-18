"use client";

export interface WebpCompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  maxOutputBytes?: number;
}

export interface CompressedWebpResult {
  blob: Blob;
  file: File;
  width: number;
  height: number;
  originalBytes: number;
  compressedBytes: number;
}

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

/**
 * Comprime y redimensiona imágenes en el navegador a formato `.webp` antes de subirlas
 * a Supabase Storage (fotos carnet estudiantil y portadas de Biblioteca).
 */
export async function compressImageToWebpClient(
  sourceFile: File,
  options?: WebpCompressionOptions
): Promise<CompressedWebpResult> {
  if (!ALLOWED_IMAGE_MIME_TYPES.has(sourceFile.type)) {
    throw new Error(
      "Formato de imagen no permitido. Usa archivos JPG, PNG o WebP."
    );
  }

  const maxWidth = options?.maxWidth ?? 960;
  const maxHeight = options?.maxHeight ?? 960;
  const quality = Math.min(0.95, Math.max(0.5, options?.quality ?? 0.82));
  const maxOutputBytes = options?.maxOutputBytes ?? 512 * 1024;

  const bitmap = await createImageBitmap(sourceFile);
  const scale = Math.min(
    1,
    maxWidth / Math.max(1, bitmap.width),
    maxHeight / Math.max(1, bitmap.height)
  );

  const targetWidth = Math.max(1, Math.round(bitmap.width * scale));
  const targetHeight = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("No se pudo inicializar el motor gráfico del navegador.");
  }

  ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
  bitmap.close();

  const encodeWithQuality = (q: number): Promise<Blob> =>
    new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("No se pudo codificar la imagen en formato WebP."));
            return;
          }
          resolve(blob);
        },
        "image/webp",
        q
      );
    });

  let blob = await encodeWithQuality(quality);
  if (blob.size > maxOutputBytes && quality > 0.6) {
    blob = await encodeWithQuality(0.65);
  }

  const baseName = sourceFile.name.replace(/\.[^.]+$/, "") || "imagen-siga";
  const webpFile = new File([blob], `${baseName}.webp`, {
    type: "image/webp",
    lastModified: Date.now(),
  });

  return {
    blob,
    file: webpFile,
    width: targetWidth,
    height: targetHeight,
    originalBytes: sourceFile.size,
    compressedBytes: blob.size,
  };
}

/**
 * Valida que un informe final de pasantías de 6.º año sea un archivo PDF auténtico
 * (`%PDF-`) dentro del límite permitido antes de enrutarlo por servidor hacia Google Drive API.
 */
export async function validateHeavyPdfForDriveUpload(
  file: File,
  maxBytes = 25 * 1024 * 1024
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return {
      ok: false,
      message: "Solo se admiten documentos en formato PDF para informes de pasantías.",
    };
  }

  if (file.size <= 0 || file.size > maxBytes) {
    return {
      ok: false,
      message: "El archivo PDF excede el tamaño máximo permitido de 25 MB.",
    };
  }

  const headerSlice = await file.slice(0, 5).arrayBuffer();
  const headerAscii = new TextDecoder("ascii").decode(headerSlice);
  if (headerAscii !== "%PDF-") {
    return {
      ok: false,
      message: "El archivo seleccionado no posee una firma PDF válida.",
    };
  }

  return { ok: true };
}

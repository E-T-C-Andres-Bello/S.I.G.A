"use client";

import {
  ANNOUNCEMENT_CATEGORY_META,
  type AnnouncementCategory,
  type AnnouncementThemePalette,
} from "@/lib/validators/bulletin";

interface HslColor {
  h: number;
  s: number;
  l: number;
}

function rgbToHsl(r: number, g: number, b: number): HslColor {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      default:
        h = (rn - gn) / d + 4;
        break;
    }
    h *= 60;
  }

  return { h, s, l };
}

function hslToHex(h: number, s: number, l: number): string {
  const hn = ((h % 360) + 360) % 360;
  const sn = Math.max(0, Math.min(1, s));
  const ln = Math.max(0, Math.min(1, l));
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((hn / 60) % 2) - 1));
  const m = ln - c / 2;

  let r = 0;
  let g = 0;
  let b = 0;
  if (hn < 60) {
    r = c;
    g = x;
  } else if (hn < 120) {
    r = x;
    g = c;
  } else if (hn < 180) {
    g = c;
    b = x;
  } else if (hn < 240) {
    g = x;
    b = c;
  } else if (hn < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  const toHex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hueDistance(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

/**
 * Extrae una paleta armónica de 4 colores (`primary`, `secondary`, `accent`, `glow`)
 * directamente desde los píxeles de la imagen del evento en el navegador,
 * ajustando saturación y luminancia para que el aura del CardFan se vea vibrante
 * tanto en tema claro como en tema oscuro.
 */
export async function extractImagePaletteClient(
  sourceFile: Blob,
  fallbackCategory: AnnouncementCategory = "evento"
): Promise<AnnouncementThemePalette> {
  const fallback = ANNOUNCEMENT_CATEGORY_META[fallbackCategory].defaultPalette;
  if (typeof window === "undefined" || typeof createImageBitmap !== "function") {
    return fallback;
  }

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(sourceFile);
    const sampleSize = 48;
    const canvas = document.createElement("canvas");
    canvas.width = sampleSize;
    canvas.height = sampleSize;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return fallback;

    ctx.drawImage(bitmap, 0, 0, sampleSize, sampleSize);
    const { data } = ctx.getImageData(0, 0, sampleSize, sampleSize);

    // 18 cubetas de matiz (20° cada una) ponderadas por saturación y balance de brillo
    const buckets = Array.from({ length: 18 }, () => ({
      weight: 0,
      sinSum: 0,
      cosSum: 0,
      sSum: 0,
      lSum: 0,
    }));

    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3] ?? 0;
      if (alpha < 140) continue;

      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;
      const { h, s, l } = rgbToHsl(r, g, b);

      // Descartar casi-blancos, casi-negros y grises demasiado planos
      if (l < 0.11 || l > 0.91 || s < 0.14) continue;

      const idx = Math.floor(h / 20) % 18;
      const chromaWeight = (0.35 + s * 1.65) * (1 - Math.abs(l - 0.52));
      const rad = (h * Math.PI) / 180;
      const bucket = buckets[idx];
      if (!bucket) continue;
      bucket.weight += chromaWeight;
      bucket.sinSum += Math.sin(rad) * chromaWeight;
      bucket.cosSum += Math.cos(rad) * chromaWeight;
      bucket.sSum += s * chromaWeight;
      bucket.lSum += l * chromaWeight;
    }

    const ranked = buckets
      .filter((b) => b.weight > 0.5)
      .map((b) => {
        const avgHue =
          ((Math.atan2(b.sinSum, b.cosSum) * 180) / Math.PI + 360) % 360;
        return {
          weight: b.weight,
          h: avgHue,
          s: b.sSum / b.weight,
          l: b.lSum / b.weight,
        };
      })
      .sort((a, b) => b.weight - a.weight);

    const first = ranked[0];
    if (!first) return fallback;

    const second =
      ranked.find((c) => hueDistance(c.h, first.h) >= 34) ?? {
        h: (first.h + 38) % 360,
        s: Math.min(0.82, Math.max(0.55, first.s)),
        l: Math.min(0.58, Math.max(0.42, first.l)),
      };

    const third =
      ranked.find(
        (c) =>
          hueDistance(c.h, first.h) >= 52 && hueDistance(c.h, second.h) >= 32
      ) ?? {
        h: (first.h + 315) % 360,
        s: Math.min(0.88, Math.max(0.62, first.s + 0.08)),
        l: 0.62,
      };

    const primary = hslToHex(
      first.h,
      Math.min(0.84, Math.max(0.52, first.s)),
      Math.min(0.52, Math.max(0.38, first.l))
    );
    const secondary = hslToHex(
      second.h,
      Math.min(0.82, Math.max(0.48, second.s)),
      Math.min(0.55, Math.max(0.4, second.l))
    );
    const accent = hslToHex(
      third.h,
      Math.min(0.9, Math.max(0.6, third.s)),
      0.62
    );
    const glow = hslToHex(
      (first.h + second.h) / 2,
      Math.min(0.88, Math.max(0.58, first.s)),
      0.56
    );

    return { primary, secondary, accent, glow };
  } catch {
    return fallback;
  } finally {
    bitmap?.close();
  }
}

"use client";

import * as React from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "cn";

export type ParticleFormationKind =
  | "torus_vortex"
  | "spiral_galaxy"
  | "neural_brain"
  | "school_crest";

export type MoodleWorkspaceSection = "overview" | "courses" | "labs";

export interface AulaVirtualParticleHeroProps {
  firstName: string;
  subtitle: string;
  mencionName: string | null;
  onExploreCourses: () => void;
}

const FORMATIONS: readonly ParticleFormationKind[] = [
  "torus_vortex",
  "spiral_galaxy",
  "neural_brain",
  "school_crest",
] as const;

const VERTEX_SHADER_SOURCE = `
  attribute vec3 aPosition;
  attribute vec3 aColor;
  attribute vec3 aMeta;

  uniform float uTime;
  uniform float uIntro;
  uniform float uFormation;
  uniform float uAspect;
  uniform float uDpr;
  uniform vec2 uPointer;
  uniform float uPointerStrength;
  uniform vec2 uPulseOrigin;
  uniform float uPulseAge;
  uniform float uIsDark;

  varying vec3 vColor;
  varying float vAlpha;

  mat2 rot(float a) {
    float s = sin(a);
    float c = cos(a);
    return mat2(c, -s, s, c);
  }

  void main() {
    vec3 pos = aPosition;
    float u = aMeta.x;
    float v = aMeta.y;
    float isStar = step(0.5, aMeta.z);

    if (isStar < 0.5) {
      if (uFormation < 0.5) {
        // 0: Toroide / Vórtice orgánico
        float wave1 = sin(4.0 * u + uTime * 1.75 + cos(3.0 * v - uTime * 1.35)) * 0.065;
        float wave2 = cos(6.0 * v - uTime * 2.1 + sin(3.0 * u)) * 0.045;
        pos.x += (wave1 + wave2) * cos(u);
        pos.y += (wave1 + wave2) * sin(u);
        pos.z += wave1 * 1.15;
      } else if (uFormation < 1.5) {
        // 1: Espiral Galáctica
        float radius = max(0.08, u);
        float spin = uTime * (0.34 / pow(radius + 0.35, 0.75));
        pos.xz = rot(spin) * pos.xz;
        pos.y += sin(radius * 5.0 - uTime * 2.0 + v) * 0.022;
      } else if (uFormation < 2.5) {
        // 2: Cerebro Neural
        float pulse = sin(uTime * 2.4 + u * 5.0 + v * 3.0) * 0.018;
        pos *= (1.0 + pulse);
      } else {
        // 3: Escudo Institucional E.T.C. "Andrés Bello" en partículas 3D
        float crestWave = sin(uTime * 2.0 + u * 4.0) * cos(uTime * 1.6 + v * 4.0) * 0.022;
        pos.z += crestWave;
      }
    }

    // Giro corto de bienvenida al entrar (uIntro: 0 -> 1)
    float introSpin = (1.0 - uIntro) * 2.4;
    float introScale = mix(0.7, 1.0, uIntro);
    pos *= introScale;

    float yaw = uTime * 0.20 + introSpin + uPointer.x * 0.55;
    float pitch = -uPointer.y * 0.40;

    if (uFormation < 0.5) {
      pitch += 0.26 + sin(uTime * 0.45) * 0.14;
    } else if (uFormation < 1.5) {
      pitch += 0.36 * cos(uTime * 0.42) + 0.22;
      yaw = uTime * 0.16 + introSpin + uPointer.x * 0.45;
    } else if (uFormation < 2.5) {
      pitch += 0.1 + sin(uTime * 0.35) * 0.08;
      yaw = uTime * 0.24 + introSpin + uPointer.x * 0.65;
    } else {
      // Escudo Institucional: balanceo 3D frontal noble para que el emblema sea legible y reactivo al mouse
      yaw = sin(uTime * 0.55) * 0.36 + introSpin + uPointer.x * 0.68;
      pitch = cos(uTime * 0.42) * 0.14 - uPointer.y * 0.48;
    }

    pos.xz = rot(yaw) * pos.xz;
    pos.yz = rot(pitch) * pos.yz;

    float camZ = 3.15;
    float depth = max(0.65, camZ - pos.z);
    vec2 screenPos = pos.xy / depth;
    screenPos.x /= max(0.55, uAspect);

    // 1. Campo de presencia del puntero
    if (isStar < 0.5 && uPointerStrength > 0.01) {
      vec2 diff = screenPos - uPointer;
      diff.x *= uAspect;
      float dist = length(diff);
      float influence = smoothstep(0.46, 0.0, dist) * uPointerStrength;
      if (influence > 0.001) {
        vec2 dir = normalize(diff + vec2(0.0001));
        vec2 swirl = vec2(-dir.y, dir.x);
        vec2 offset = (dir * 0.085 + swirl * 0.055) * influence;
        offset.x /= max(0.55, uAspect);
        screenPos += offset;
      }
    }

    // 2. Onda de pulso expansiva al hacer clic (uPulseAge: 0.0 -> 1.6s)
    float pulseBoost = 0.0;
    if (uPulseAge >= 0.0 && uPulseAge < 1.6) {
      vec2 pDiff = screenPos - uPulseOrigin;
      pDiff.x *= uAspect;
      float pDist = length(pDiff);
      float waveRadius = uPulseAge * 1.45;
      float ring = exp(-pow((pDist - waveRadius) * 7.5, 2.0));
      float decay = 1.0 - (uPulseAge / 1.6);
      float waveAmp = ring * decay;
      vec2 pDir = normalize(pDiff + vec2(0.0001));
      vec2 pOffset = pDir * waveAmp * 0.13;
      pOffset.x /= max(0.55, uAspect);
      screenPos += pOffset;
      pulseBoost = waveAmp * 1.35;
    }

    gl_Position = vec4(screenPos * 1.48, 0.0, 1.0);

    float synaptic = 0.0;
    if (isStar < 0.5) {
      synaptic = smoothstep(0.88, 1.0, sin(uTime * 3.4 + u * 6.0 + v * 4.0));
    }

    float basePt = isStar > 0.5 ? 1.35 : (1.95 + synaptic * 1.15 + pulseBoost * 2.2);
    gl_PointSize = clamp((basePt * uDpr * 2.15) / depth, 1.0, 10.0 * uDpr);

    // En modo claro oscurecemos hacia cobalto/índigo intenso para alto contraste sobre perla
    vec3 darkPalette = aColor + vec3(
      (synaptic + pulseBoost) * 0.35,
      (synaptic + pulseBoost) * 0.32,
      (synaptic + pulseBoost) * 0.45
    );
    vec3 lightPalette = mix(
      vec3(0.05, 0.18, 0.58),
      aColor * vec3(0.25, 0.42, 0.85),
      0.65
    ) + vec3(pulseBoost * 0.15, pulseBoost * 0.35, pulseBoost * 0.55);

    vColor = mix(lightPalette, darkPalette, uIsDark);
    float depthFade = smoothstep(4.8, 1.35, depth);
    float baseAlpha = isStar > 0.5
      ? mix(0.22, 0.38, uIsDark)
      : (mix(0.75, 0.52, uIsDark) + synaptic * 0.35 + pulseBoost * 0.45) * depthFade;
    vAlpha = clamp(baseAlpha * uIntro, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER_SOURCE = `
  precision mediump float;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec2 uv = gl_PointCoord - vec2(0.5);
    float d = length(uv);
    if (d > 0.5) discard;

    float glow = pow(1.0 - d * 2.0, 1.7);
    gl_FragColor = vec4(vColor, glow * vAlpha);
  }
`;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Construye los buffers 3D base para cualquiera de las 4 animaciones:
 * - `torus_vortex`, `spiral_galaxy`, `neural_brain`, o `school_crest` (emblema procedural inicial
 *   que además se refina muestreando los píxeles reales de `/images/institucion/logotipo.webp`).
 */
function buildGpuBuffers(
  formation: ParticleFormationKind,
  totalCount: number
): {
  positions: Float32Array;
  colors: Float32Array;
  meta: Float32Array;
} {
  const positions = new Float32Array(totalCount * 3);
  const colors = new Float32Array(totalCount * 3);
  const meta = new Float32Array(totalCount * 3);

  const starCount = Math.floor(totalCount * 0.08);
  const mainCount = totalCount - starCount;

  for (let i = 0; i < mainCount; i++) {
    const i3 = i * 3;

    if (formation === "torus_vortex") {
      const rings = 150;
      const perRing = Math.max(16, Math.floor(mainCount / rings));
      const ringIdx = Math.floor(i / perRing);
      const segIdx = i % perRing;

      const u = (ringIdx / rings) * Math.PI * 2;
      const v = (segIdx / perRing) * Math.PI * 2;

      const fold1 = 0.13 * Math.sin(5 * u + 3 * v);
      const fold2 = 0.075 * Math.cos(3 * u - 5 * v);
      const fold3 = 0.04 * Math.sin(8 * v + 2 * u);

      const R = 0.94 + 0.07 * Math.cos(4 * u);
      const r = 0.42 + fold1 + fold2 + fold3;

      positions[i3] = (R + r * Math.cos(v)) * Math.cos(u);
      positions[i3 + 1] = (R + r * Math.cos(v)) * Math.sin(u);
      positions[i3 + 2] = r * Math.sin(v) + 0.1 * Math.sin(3 * u);

      const sideT = (Math.cos(u) + 1) * 0.5;
      const ridgeT = (Math.sin(v * 2) + 1) * 0.5;

      colors[i3] = lerp(0.48, 0.11, sideT) + ridgeT * 0.08;
      colors[i3 + 1] = lerp(0.36, 0.92, sideT);
      colors[i3 + 2] = lerp(0.98, 0.72, sideT);

      meta[i3] = u;
      meta[i3 + 1] = v;
      meta[i3 + 2] = 0;
    } else if (formation === "spiral_galaxy") {
      const arms = 3;
      const arm = i % arms;
      const randPow = Math.pow(Math.random(), 0.85);
      const radius = 0.03 + randPow * 1.55;
      const baseAngle = radius * 4.15 + (arm * Math.PI * 2) / arms;
      const scatter = (Math.random() - 0.5) * (0.14 + 0.24 * randPow);
      const theta = baseAngle + scatter;
      const discThickness =
        (0.11 / (1 + radius * 2.4)) * (Math.random() - 0.5);

      positions[i3] = Math.cos(theta) * radius;
      positions[i3 + 1] = discThickness;
      positions[i3 + 2] = Math.sin(theta) * radius;

      if (randPow < 0.16) {
        const coreT = randPow / 0.16;
        colors[i3] = lerp(0.95, 0.35, coreT);
        colors[i3 + 1] = lerp(0.98, 0.95, coreT);
        colors[i3 + 2] = lerp(0.82, 0.75, coreT);
      } else {
        const armT = (randPow - 0.16) / 0.84;
        colors[i3] = lerp(0.16, 0.28, armT);
        colors[i3 + 1] = lerp(0.92, 0.54, armT);
        colors[i3 + 2] = lerp(0.76, 0.98, armT);
      }

      meta[i3] = radius;
      meta[i3 + 1] = theta;
      meta[i3 + 2] = 0;
    } else if (formation === "neural_brain") {
      const isCerebellum = i > mainCount * 0.81 && i <= mainCount * 0.94;
      const isStem = i > mainCount * 0.94;

      let x = 0;
      let y = 0;
      let z = 0;
      let u = 0;
      let v = 0;

      if (isStem) {
        const h = (i - mainCount * 0.94) / (mainCount * 0.06);
        const ang = i * 2.39996;
        const rad = 0.13 * (1 - h * 0.3);
        x = -0.18 - h * 0.22 + Math.cos(ang) * rad * 0.55;
        y = -0.48 - h * 0.4;
        z = Math.sin(ang) * rad;
        u = h;
        v = ang;
      } else if (isCerebellum) {
        const localIdx = i - Math.floor(mainCount * 0.81);
        const localTotal = Math.floor(mainCount * 0.13);
        const phi = Math.acos(1 - (2 * (localIdx + 0.5)) / localTotal);
        const theta = Math.PI * (1 + Math.sqrt(5)) * localIdx;
        const folia = 0.032 * Math.sin(phi * 22);

        x = -0.52 + (0.34 + folia) * Math.sin(phi) * Math.cos(theta);
        y = -0.4 + (0.24 + folia) * Math.cos(phi);
        z = (0.4 + folia) * Math.sin(phi) * Math.sin(theta);
        u = phi;
        v = theta;
      } else {
        const cortexTotal = Math.floor(mainCount * 0.81);
        const phi = Math.acos(1 - (2 * (i + 0.5)) / cortexTotal);
        const theta = Math.PI * (1 + Math.sqrt(5)) * i;

        const sx = Math.sin(phi) * Math.cos(theta);
        const sy = Math.cos(phi);
        const sz = Math.sin(phi) * Math.sin(theta);

        const gyri =
          0.065 *
            Math.sin(9 * sx + 6 * sy) *
            Math.cos(8 * sz - 5 * sx) +
          0.03 * Math.cos(14 * sy + 11 * sx);

        const frontalSlope = sx > 0 ? 1 - 0.15 * sx : 1;
        const inferiorFlat = sy < -0.15 ? 0.55 : 1;
        const temporalLobe =
          sy < 0.05 && sy > -0.48 && sx > -0.3 && sx < 0.45 ? 0.14 : 0;
        const shellJitter = 0.94 + Math.random() * 0.08;

        x = (sx * 1.12 + gyri) * shellJitter;
        y =
          (sy * 0.82 * frontalSlope * inferiorFlat +
            0.12 +
            0.08 * Math.sin(sx * 2.5) +
            gyri * 0.75) *
          shellJitter;
        const hemiSign = sz >= 0 ? 1 : -1;
        z =
          (hemiSign * 0.045 +
            sz * (0.74 + temporalLobe) +
            gyri * 0.8) *
          shellJitter;
        u = phi;
        v = theta;
      }

      positions[i3] = x;
      positions[i3 + 1] = y;
      positions[i3 + 2] = z;

      const frontT = Math.min(1, Math.max(0, (x + 1.15) / 2.3));
      const heightT = Math.min(1, Math.max(0, (y + 0.85) / 1.7));

      colors[i3] = lerp(0.56, 0.12, frontT) + heightT * 0.14;
      colors[i3 + 1] = lerp(0.38, 0.94, frontT) * (1 - heightT * 0.22);
      colors[i3 + 2] = lerp(0.98, 0.88, frontT);

      meta[i3] = u;
      meta[i3 + 1] = v;
      meta[i3 + 2] = 0;
    } else {
      // `school_crest`: Medallón heráldico 3D de la E.T.C. "Andrés Bello" (se refina al cargar logotipo.webp)
      const angle = (i / mainCount) * Math.PI * 2 * 37;
      const radial = Math.sqrt(i / mainCount) * 1.18;
      const isOuterRing = radial > 0.96 && radial < 1.18;
      const isInnerRing = radial > 0.76 && radial < 0.82;

      const x = Math.cos(angle) * radial;
      const y = Math.sin(angle) * radial;
      const z =
        (isOuterRing || isInnerRing ? 0.08 : 0.16 * (1 - radial * 0.65)) *
        (Math.random() - 0.5);

      positions[i3] = x;
      positions[i3 + 1] = y;
      positions[i3 + 2] = z;

      if (isOuterRing || isInnerRing) {
        // Anillos institucionales cobalto/dorado/cian
        colors[i3] = 0.25;
        colors[i3 + 1] = 0.78;
        colors[i3 + 2] = 0.98;
      } else {
        colors[i3] = 0.18;
        colors[i3 + 1] = 0.62;
        colors[i3 + 2] = 0.96;
      }

      meta[i3] = x;
      meta[i3 + 1] = y;
      meta[i3 + 2] = 0;
    }
  }

  for (let s = 0; s < starCount; s++) {
    const idx = (mainCount + s) * 3;
    positions[idx] = (Math.random() - 0.5) * 5.2;
    positions[idx + 1] = (Math.random() - 0.5) * 2.8;
    positions[idx + 2] = (Math.random() - 0.5) * 3.2;

    colors[idx] = 0.65;
    colors[idx + 1] = 0.88;
    colors[idx + 2] = 1.0;

    meta[idx] = Math.random() * 6.28;
    meta[idx + 1] = Math.random() * 6.28;
    meta[idx + 2] = 1;
  }

  return { positions, colors, meta };
}

/**
 * Muestrea `/images/institucion/logotipo.webp` y convierte cada píxel del escudo oficial
 * de la E.T.C. "Andrés Bello" en una nube de partículas 3D con relieve volumétrico.
 */
async function sampleSchoolLogoIntoBuffers(
  totalCount: number,
  outPositions: Float32Array,
  outColors: Float32Array,
  outMeta: Float32Array
): Promise<boolean> {
  try {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    const loaded = await new Promise<boolean>((resolve) => {
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = "/images/institucion/logotipo.webp";
    });
    if (!loaded) return false;

    const sampleSize = 180;
    const offscreen = document.createElement("canvas");
    offscreen.width = sampleSize;
    offscreen.height = sampleSize;
    const ctx = offscreen.getContext("2d");
    if (!ctx) return false;

    ctx.drawImage(img, 0, 0, sampleSize, sampleSize);
    const imgData = ctx.getImageData(0, 0, sampleSize, sampleSize).data;

    const validPixels: Array<{
      nx: number;
      ny: number;
      r: number;
      g: number;
      b: number;
      lum: number;
    }> = [];

    for (let py = 0; py < sampleSize; py++) {
      for (let px = 0; px < sampleSize; px++) {
        const idx = (py * sampleSize + px) * 4;
        const a = imgData[idx + 3] ?? 0;
        if (a < 45) continue;

        const nx = (px / (sampleSize - 1)) * 2 - 1;
        const ny = -((py / (sampleSize - 1)) * 2 - 1);
        const r = (imgData[idx] ?? 0) / 255;
        const g = (imgData[idx + 1] ?? 0) / 255;
        const b = (imgData[idx + 2] ?? 0) / 255;
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;

        validPixels.push({ nx, ny, r, g, b, lum });
      }
    }

    if (validPixels.length < 100) return false;

    const starCount = Math.floor(totalCount * 0.08);
    const mainCount = totalCount - starCount;

    for (let i = 0; i < mainCount; i++) {
      const i3 = i * 3;
      const sample =
        validPixels[
          Math.floor((i / mainCount) * validPixels.length) % validPixels.length
        ]!;

      const jitterX = (Math.random() - 0.5) * 0.015;
      const jitterY = (Math.random() - 0.5) * 0.015;
      const x = (sample.nx + jitterX) * 1.16;
      const y = (sample.ny + jitterY) * 1.16;
      // Relieve 3D según luminancia + espesor volumétrico
      const relief = (0.5 - Math.abs(sample.lum - 0.45)) * 0.28;
      const z = relief + (Math.random() - 0.5) * 0.12;

      outPositions[i3] = x;
      outPositions[i3 + 1] = y;
      outPositions[i3 + 2] = z;

      // Adaptar los colores reales del escudo al espectro luminoso de partículas (azul/cian/oro/blanco)
      outColors[i3] = Math.min(1, sample.r * 0.85 + 0.12);
      outColors[i3 + 1] = Math.min(1, sample.g * 0.9 + 0.22);
      outColors[i3 + 2] = Math.min(1, Math.max(0.55, sample.b * 1.05 + 0.25));

      outMeta[i3] = x;
      outMeta[i3 + 1] = y;
      outMeta[i3 + 2] = 0;
    }

    return true;
  } catch {
    return false;
  }
}

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

/**
 * Sección completa "Bienvenido al Aula Virtual":
 * - 4 esculturas 3D de partículas al azar (Toroide, Galaxia, Cerebro Neural y Escudo Institucional).
 * - Pulso de onda expansiva 3D al hacer clic en cualquier parte de la animación.
 * - Soporte completo de Modo Claro y Modo Oscuro.
 */
export function AulaVirtualParticleHero({
  firstName,
  subtitle,
  mencionName,
  onExploreCourses,
}: AulaVirtualParticleHeroProps) {
  const stageRef = React.useRef<HTMLElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  const [formation] = React.useState<ParticleFormationKind>(() => {
    const idx = Math.floor(Math.random() * FORMATIONS.length);
    return FORMATIONS[idx] ?? "torus_vortex";
  });

  const isDarkRef = React.useRef(true);
  const [isDark, setIsDark] = React.useState(true);

  React.useEffect(() => {
    const syncTheme = () => {
      const darkActive = document.documentElement.classList.contains("dark");
      isDarkRef.current = darkActive;
      setIsDark(darkActive);
    };
    syncTheme();
    const obs = new MutationObserver(syncTheme);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => obs.disconnect();
  }, []);

  const pointerRef = React.useRef({
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
    strength: 0,
    targetStrength: 0,
  });

  const pulseRef = React.useRef({
    originX: 0,
    originY: 0,
    triggeredAtMs: -99999,
  });

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;

    const isMobile = window.innerWidth < 768;
    const totalParticles = isMobile ? 22000 : 45000;

    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
      premultipliedAlpha: false,
    });

    if (!gl) return;

    const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;

    gl.useProgram(program);

    const { positions, colors, meta } = buildGpuBuffers(
      formation,
      totalParticles
    );

    const posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    const aPositionLoc = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(aPositionLoc);
    gl.vertexAttribPointer(aPositionLoc, 3, gl.FLOAT, false, 0, 0);

    const colBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);
    const aColorLoc = gl.getAttribLocation(program, "aColor");
    gl.enableVertexAttribArray(aColorLoc);
    gl.vertexAttribPointer(aColorLoc, 3, gl.FLOAT, false, 0, 0);

    const metaBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, metaBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, meta, gl.STATIC_DRAW);
    const aMetaLoc = gl.getAttribLocation(program, "aMeta");
    gl.enableVertexAttribArray(aMetaLoc);
    gl.vertexAttribPointer(aMetaLoc, 3, gl.FLOAT, false, 0, 0);

    let cancelled = false;
    if (formation === "school_crest") {
      void sampleSchoolLogoIntoBuffers(
        totalParticles,
        positions,
        colors,
        meta
      ).then((ok) => {
        if (!ok || cancelled) return;
        gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, colBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, metaBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, meta, gl.STATIC_DRAW);
      });
    }

    const uTimeLoc = gl.getUniformLocation(program, "uTime");
    const uIntroLoc = gl.getUniformLocation(program, "uIntro");
    const uFormationLoc = gl.getUniformLocation(program, "uFormation");
    const uAspectLoc = gl.getUniformLocation(program, "uAspect");
    const uDprLoc = gl.getUniformLocation(program, "uDpr");
    const uPointerLoc = gl.getUniformLocation(program, "uPointer");
    const uPointerStrengthLoc = gl.getUniformLocation(
      program,
      "uPointerStrength"
    );
    const uPulseOriginLoc = gl.getUniformLocation(program, "uPulseOrigin");
    const uPulseAgeLoc = gl.getUniformLocation(program, "uPulseAge");
    const uIsDarkLoc = gl.getUniformLocation(program, "uIsDark");

    const formationIndex =
      formation === "torus_vortex"
        ? 0
        : formation === "spiral_galaxy"
          ? 1
          : formation === "neural_brain"
            ? 2
            : 3;

    gl.enable(gl.BLEND);
    gl.clearColor(0, 0, 0, 0);

    let aspect = 1.6;
    let dpr = 1;
    let rafId = 0;
    let isVisible = true;
    const t0 = performance.now();

    const drawFrame = (now: number) => {
      const elapsedSec = (now - t0) / 1000;
      const introRaw = Math.min(1, Math.max(0, elapsedSec / 1.25));
      const introEased = 1 - Math.pow(1 - introRaw, 3);

      const ptr = pointerRef.current;
      ptr.x += (ptr.targetX - ptr.x) * 0.085;
      ptr.y += (ptr.targetY - ptr.y) * 0.085;
      ptr.strength += (ptr.targetStrength - ptr.strength) * 0.1;

      const darkMode = isDarkRef.current;
      if (darkMode) {
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      } else {
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      }

      const pulseAgeSec = (now - pulseRef.current.triggeredAtMs) / 1000;

      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);

      gl.uniform1f(uTimeLoc, elapsedSec);
      gl.uniform1f(uIntroLoc, introEased);
      gl.uniform1f(uFormationLoc, formationIndex);
      gl.uniform1f(uAspectLoc, aspect);
      gl.uniform1f(uDprLoc, dpr);
      gl.uniform2f(uPointerLoc, ptr.x, ptr.y);
      gl.uniform1f(uPointerStrengthLoc, ptr.strength);
      gl.uniform2f(
        uPulseOriginLoc,
        pulseRef.current.originX,
        pulseRef.current.originY
      );
      gl.uniform1f(
        uPulseAgeLoc,
        pulseAgeSec >= 0 && pulseAgeSec < 1.65 ? pulseAgeSec : -1.0
      );
      gl.uniform1f(uIsDarkLoc, darkMode ? 1.0 : 0.0);

      gl.drawArrays(gl.POINTS, 0, totalParticles);
    };

    const resize = () => {
      const rect = stage.getBoundingClientRect();
      const w = Math.max(300, Math.round(rect.width));
      const h = Math.max(480, Math.round(rect.height));
      dpr = Math.min(2, window.devicePixelRatio || 1);
      aspect = w / h;

      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      gl.viewport(0, 0, canvas.width, canvas.height);

      drawFrame(performance.now());
    };

    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(stage);

    const io = new IntersectionObserver(
      ([entry]) => {
        isVisible = Boolean(entry?.isIntersecting);
      },
      { threshold: 0.05 }
    );
    io.observe(stage);

    const loop = (now: number) => {
      if (isVisible) {
        drawFrame(now);
      }
      rafId = window.requestAnimationFrame(loop);
    };
    rafId = window.requestAnimationFrame(loop);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(rafId);
      ro.disconnect();
      io.disconnect();
      gl.deleteBuffer(posBuffer);
      gl.deleteBuffer(colBuffer);
      gl.deleteBuffer(metaBuffer);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, [formation]);

  const handlePointerMove = React.useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const el = stageRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
      const ny = -(((e.clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1);
      pointerRef.current.targetX = nx;
      pointerRef.current.targetY = ny;
      pointerRef.current.targetStrength = 1;
    },
    []
  );

  const handlePointerLeave = React.useCallback(() => {
    pointerRef.current.targetX = 0;
    pointerRef.current.targetY = 0;
    pointerRef.current.targetStrength = 0;
  }, []);

  const handleTriggerPulse = React.useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const el = stageRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
      const ny = -(((e.clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1);
      pulseRef.current.originX = nx;
      pulseRef.current.originY = ny;
      pulseRef.current.triggeredAtMs = performance.now();
    },
    []
  );

  return (
    <section
      ref={stageRef}
      aria-label="Bienvenido al Aula Virtual"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onPointerDown={handleTriggerPulse}
      className={cn(
        "relative flex min-h-screen w-full cursor-pointer flex-col justify-between overflow-hidden pt-24 pb-10 transition-colors duration-300 select-none",
        isDark
          ? "bg-[#030509] text-white"
          : "bg-gradient-to-br from-[#eaf2ff] via-[#dde8ff] to-[#f4f8ff] text-slate-900"
      )}
    >
      {/* Halos atmosféricos de esquina adaptados a Modo Claro y Modo Oscuro */}
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute -top-28 -left-24 h-80 w-96 rounded-full blur-[110px]",
          isDark ? "bg-cyan-500/18" : "bg-sky-400/30"
        )}
      />
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute top-1/4 -right-28 h-80 w-96 rounded-full blur-[120px]",
          isDark ? "bg-indigo-500/14" : "bg-blue-500/20"
        )}
      />

      {/* Lienzo WebGL GPU a pantalla completa */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 size-full"
      />

      {/* Composición limpia: Título arriba + Botón Explorar mis cursos abajo a la derecha */}
      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col justify-between px-6 py-4 sm:px-12">
        <div className="max-w-xl">
          <h1
            className={cn(
              "text-[2.6rem] leading-[1.04] font-light tracking-[-0.038em] sm:text-[4.15rem]",
              isDark ? "text-white" : "text-slate-950"
            )}
          >
            Bienvenido al
            <br />
            <span
              className={cn(
                "bg-clip-text font-normal text-transparent",
                isDark
                  ? "bg-gradient-to-r from-white via-cyan-200 to-teal-300"
                  : "bg-gradient-to-r from-[#0b1d59] via-[#1c47c4] to-[#0284c7]"
              )}
            >
              Aula Virtual
            </span>
          </h1>
          <p
            className={cn(
              "mt-3 text-xs font-medium sm:text-sm",
              isDark ? "text-cyan-200/85" : "text-slate-600"
            )}
          >
            {firstName ? `Hola, ${firstName} · ` : ""}
            {mencionName
              ? `Mención ${mencionName}`
              : 'E.T.C. "Andrés Bello"'}
          </p>
        </div>

        {/* Esquina inferior derecha: únicamente el subtítulo y el botón Explorar mis cursos */}
        <div className="mt-auto flex flex-col items-start gap-4 pt-12 sm:ml-auto sm:max-w-xs sm:items-end sm:text-right">
          <p
            className={cn(
              "text-xs leading-relaxed",
              isDark ? "text-slate-300/85" : "text-slate-600"
            )}
          >
            {subtitle}
          </p>

          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onExploreCourses}
            className={cn(
              "group inline-flex cursor-pointer items-stretch overflow-hidden rounded-xl text-xs font-semibold transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none",
              isDark
                ? "bg-white text-[#050811] shadow-[0_0_30px_rgba(56,189,248,0.28)]"
                : "bg-[#0b1d59] text-white shadow-[0_10px_25px_rgba(11,29,89,0.25)]"
            )}
          >
            <span className="px-4 py-2.5">Explorar mis cursos</span>
            <span
              className={cn(
                "flex items-center justify-center border-l px-3 transition-transform group-hover:translate-x-0.5",
                isDark
                  ? "border-slate-900/15 bg-slate-100"
                  : "border-white/20 bg-white/10"
              )}
            >
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </span>
          </button>
        </div>
      </div>
    </section>
  );
}

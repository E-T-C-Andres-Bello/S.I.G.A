"use client";

import { useEffect, useRef } from "react";

const VERTEX_SHADER = `
  attribute vec2 a_position;
  varying vec2 v_uv;

  void main() {
    v_uv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

/**
 * Atmósfera WebGL institucional de S.I.G.A.:
 * - Mantiene la paleta calmada Navy -> Azul real (#1c47c4) -> Horizonte hielo (#f7fafb / #020617).
 * - Incorpora el efecto ligero y suave de remolino local bajo el cursor (estilo poba-shade).
 */
const MIST_SHADER = `
  #ifdef GL_FRAGMENT_PRECISION_HIGH
  precision highp float;
  #else
  precision mediump float;
  #endif

  varying vec2 v_uv;
  uniform float u_time;
  uniform vec2 u_resolution;
  uniform float u_dpr;
  uniform vec2 u_mouse;
  uniform float u_cursor_presence;
  uniform float u_dark;

  #define TWO_PI 6.28318530718
  #define PI 3.14159265358979323846

  float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
  }

  float noise(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);
    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));

    vec2 u = f * f * (3.0 - 2.0 * f);

    float x1 = mix(a, b, u.x);
    float x2 = mix(c, d, u.x);
    return mix(x1, x2, u.y);
  }

  void main() {
    vec2 uv = v_uv;
    vec2 logicalRes = u_resolution / max(u_dpr, 1.0);
    float t = u_time * 0.16 - 1.175;

    // Remolino local ligero y suave alrededor del puntero (inspirado en poba-shade)
    float cursorMask = 0.0;
    if (u_cursor_presence > 0.001) {
      float minDim = min(u_resolution.x, u_resolution.y);
      vec2 p = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / max(minDim, 1.0);
      vec2 cursor = (0.5 * u_mouse * u_resolution.xy) / max(minDim, 1.0);
      vec2 cursorDelta = p - cursor;
      float cursorDistance = length(cursorDelta);
      cursorMask = u_cursor_presence * (1.0 - smoothstep(0.0, 0.56, cursorDistance));
      float cursorAngle = cursorMask * 0.54 * 2.2;
      float cc = cos(cursorAngle);
      float cs = sin(cursorAngle);
      vec2 warpedP = cursor + mat2(cc, -cs, cs, cc) * cursorDelta;
      uv = warpedP * minDim / u_resolution.xy + 0.5;
    }

    float noise_scale = 0.00338;
    uv -= 0.5;
    uv *= (noise_scale * logicalRes);
    uv /= 1.5;
    uv += 0.5;

    // Distorsión y vórtice suave de 5 iteraciones
    float n1 = noise(uv * 1.0 + t);
    float n2 = noise(uv * 2.0 - t);
    float angle = n1 * TWO_PI;
    uv.x += 0.30 * n2 * cos(angle);
    uv.y += 0.30 * n2 * sin(angle);

    for (int i = 1; i <= 5; i++) {
      float fi = float(i);
      uv.x += 0.62 / fi * cos(t + fi * 1.5 * uv.y);
      uv.y += 0.62 / fi * cos(t + fi * 1.0 * uv.x);
    }

    float sh = 1.0 - uv.y;
    sh -= 0.5;
    sh /= max(noise_scale * logicalRes.y, 0.0001);
    sh += 0.5;

    float shape_scaling = 0.104;
    float shape = smoothstep(0.45 - shape_scaling, 0.55 + shape_scaling, sh + 0.3 * (0.33 - 0.5));
    float mixer = shape;

    // Paleta institucional Navy -> Azul real #1c47c4 -> Luz celeste
    vec3 bg         = vec3(0.008, 0.024, 0.090); // #020617
    vec3 midNavy    = vec3(0.043, 0.114, 0.349); // #0b1d59
    vec3 royalBlue  = vec3(0.110, 0.278, 0.769); // #1c47c4
    vec3 brightBlue = vec3(0.245, 0.495, 0.980); // #3f7efa
    vec3 mistIce    = vec3(0.620, 0.800, 1.000); // #9eccff
    vec3 iceBottom  = vec3(0.969, 0.980, 0.984); // #f7fafb

    float mistFocus = pow(sin(clamp(mixer, 0.0, 1.0) * PI), 3.6);

    float fineMist = noise(uv * 3.2 - t * 1.1) * 0.4 + noise(uv * 1.4 + t * 0.75) * 0.6;
    float combinedDensity = mix(mixer, fineMist, 0.28) * mistFocus;

    vec3 col = mix(bg, midNavy, smoothstep(0.02, 0.42, mixer));
    col = mix(col, royalBlue, smoothstep(0.08, 0.82, combinedDensity));

    float highlight = smoothstep(0.42, 0.88, fineMist) * smoothstep(0.12, 0.9, mixer) * mistFocus;
    col = mix(col, brightBlue, highlight * 0.42);
    col += brightBlue * cursorMask * mistFocus * 0.12;

    // Haces de luz crepusculares suaves
    float mouseNormX = clamp(u_mouse.x * 0.5 + 0.5, 0.08, 0.92);
    vec2 raySource = mix(vec2(0.22, 1.25), vec2(mouseNormX, 1.24), 0.24 * u_cursor_presence);
    vec2 rayDelta = v_uv - raySource;
    vec2 rayDir = rayDelta / max(length(rayDelta), 0.0001);
    float rayAngle = atan(rayDir.y, rayDir.x);

    float rays = sin(rayAngle * 6.5 + t * 0.28) * 0.35 +
                 sin(rayAngle * 12.0 - t * 0.18) * 0.25 +
                 sin(rayAngle * 24.0 + t * 0.12) * 0.15;
    rays = smoothstep(0.15, 0.82, rays * 0.5 + 0.5);

    float rayGlow = rays * smoothstep(0.15, 0.9, combinedDensity) * clamp(1.1 - v_uv.y, 0.0, 1.0) * mistFocus * 0.65;
    col += mistIce * rayGlow * 0.32;

    // Partículas sutiles en suspensión
    float grain = random(gl_FragCoord.xy * 0.15 + t * 0.04);
    float particles = step(0.990, grain) * smoothstep(0.24, 0.9, combinedDensity) * smoothstep(0.14, 0.35, v_uv.y);
    col += mistIce * particles * 0.20;

    col = pow(max(col, 0.0), vec3(0.94));

    // Horizonte inferior limpio para lectura perfecta en el pie del Hero
    float bottomWave = (fineMist - 0.5) * 0.055 + cursorMask * 0.015;
    float bottomHaze = smoothstep(0.32, 0.11, v_uv.y + bottomWave);
    vec3 horizonColor = mix(iceBottom, bg, u_dark);
    col = mix(col, horizonColor, bottomHaze);

    gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
  }
`;

function compileShader(gl: WebGLRenderingContext, type: number, source: string) {
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

export function AtmosphericGradient() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: false,
      powerPreference: "low-power",
    });
    if (!gl) return;

    const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, MIST_SHADER);
    if (!vs || !fs) {
      if (vs) gl.deleteShader(vs);
      if (fs) gl.deleteShader(fs);
      return;
    }

    const program = gl.createProgram();
    if (!program) {
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      return;
    }
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteProgram(program);
      return;
    }

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );

    const posLoc = gl.getAttribLocation(program, "a_position");
    const timeLoc = gl.getUniformLocation(program, "u_time");
    const resLoc = gl.getUniformLocation(program, "u_resolution");
    const dprLoc = gl.getUniformLocation(program, "u_dpr");
    const mouseLoc = gl.getUniformLocation(program, "u_mouse");
    const presenceLoc = gl.getUniformLocation(program, "u_cursor_presence");
    const darkLoc = gl.getUniformLocation(program, "u_dark");

    gl.useProgram(program);
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    let targetX = 0;
    let targetY = 0;
    let targetPresence = 0;
    let mouseX = 0;
    let mouseY = 0;
    let cursorPresence = 0;
    let pointerKnown = false;
    let pointerClientX = 0;
    let pointerClientY = 0;
    let bounds = container.getBoundingClientRect();

    let targetDark = document.documentElement.classList.contains("dark") ? 1 : 0;
    let darkMix = targetDark;
    let currentDpr = 1;
    let rafId = 0;
    let lastNow: number | null = null;
    let visible = document.visibilityState === "visible";
    let inView = true;
    let disposed = false;
    const start = performance.now();

    const drawFrame = (now: number) => {
      const dt = lastNow === null ? 0 : Math.min((now - lastNow) / 1000, 0.1);
      lastNow = now;
      const follow = reducedMotion ? 1 : 1 - Math.exp(-10 * dt);

      mouseX += (targetX - mouseX) * follow;
      mouseY += (targetY - mouseY) * follow;
      cursorPresence += (targetPresence - cursorPresence) * follow;
      darkMix = reducedMotion
        ? targetDark
        : darkMix + (targetDark - darkMix) * Math.min(1, dt * 8);

      const elapsed = reducedMotion ? 0 : (now - start) / 1000;
      gl.uniform1f(timeLoc, elapsed);
      gl.uniform2f(resLoc, canvas.width, canvas.height);
      gl.uniform1f(dprLoc, currentDpr);
      gl.uniform2f(mouseLoc, mouseX, mouseY);
      gl.uniform1f(presenceLoc, reducedMotion ? 0 : cursorPresence);
      gl.uniform1f(darkLoc, darkMix);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    const resize = () => {
      bounds = container.getBoundingClientRect();
      currentDpr = Math.min(window.devicePixelRatio || 1, 1.75);
      const rawW = Math.max(1, Math.round(bounds.width * currentDpr));
      const rawH = Math.max(1, Math.round(bounds.height * currentDpr));
      const pixelScale = Math.min(
        1,
        Math.sqrt(2_000_000 / Math.max(1, rawW * rawH))
      );
      const width = Math.max(320, Math.round(rawW * pixelScale));
      const height = Math.max(320, Math.round(rawH * pixelScale));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
        // Redibujar síncronamente tras redimensionar evita que el buffer WebGL quede negro un frame.
        drawFrame(performance.now());
      }
    };

    const tick = (now: number) => {
      rafId = 0;
      if (disposed || !visible || !inView || reducedMotion) return;
      drawFrame(now);
      rafId = window.requestAnimationFrame(tick);
    };

    const requestRender = () => {
      if (!disposed && visible && inView && !reducedMotion && rafId === 0) {
        rafId = window.requestAnimationFrame(tick);
      }
    };

    const updatePointerTarget = () => {
      if (!pointerKnown || bounds.width === 0 || bounds.height === 0) return;
      const inside =
        pointerClientX >= bounds.left &&
        pointerClientX <= bounds.right &&
        pointerClientY >= bounds.top &&
        pointerClientY <= bounds.bottom;
      if (!inside) {
        targetPresence = 0;
        return;
      }
      const nextX = ((pointerClientX - bounds.left) / bounds.width) * 2 - 1;
      const nextY = -(((pointerClientY - bounds.top) / bounds.height) * 2 - 1);
      if (targetPresence === 0 && cursorPresence < 0.01) {
        mouseX = nextX;
        mouseY = nextY;
      }
      targetX = nextX;
      targetY = nextY;
      targetPresence = 1;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (reducedMotion) return;
      pointerKnown = true;
      pointerClientX = e.clientX;
      pointerClientY = e.clientY;
      bounds = container.getBoundingClientRect();
      updatePointerTarget();
    };

    const onPointerLeave = () => {
      pointerKnown = false;
      targetPresence = 0;
    };

    const onLayout = () => {
      resize();
      updatePointerTarget();
    };

    const themeObserver = new MutationObserver(() => {
      targetDark = document.documentElement.classList.contains("dark") ? 1 : 0;
      if (reducedMotion) drawFrame(performance.now());
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    const resizeObserver = new ResizeObserver(onLayout);
    resizeObserver.observe(container);

    const visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        inView = Boolean(entry?.isIntersecting);
        if (inView) requestRender();
        else if (rafId !== 0) {
          window.cancelAnimationFrame(rafId);
          rafId = 0;
          lastNow = null;
        }
      },
      { threshold: 0.05 }
    );
    visibilityObserver.observe(container);

    const onVisibilityChange = () => {
      visible = document.visibilityState === "visible";
      if (visible) requestRender();
      else if (rafId !== 0) {
        window.cancelAnimationFrame(rafId);
        rafId = 0;
        lastNow = null;
      }
    };

    resize();
    drawFrame(performance.now());
    window.addEventListener("resize", onLayout);
    window.addEventListener("scroll", onLayout, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointercancel", onPointerLeave);
    window.addEventListener("blur", onPointerLeave);
    document.documentElement.addEventListener("pointerleave", onPointerLeave);
    document.addEventListener("visibilitychange", onVisibilityChange);

    if (!reducedMotion) requestRender();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(rafId);
      themeObserver.disconnect();
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      window.removeEventListener("resize", onLayout);
      window.removeEventListener("scroll", onLayout);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointercancel", onPointerLeave);
      window.removeEventListener("blur", onPointerLeave);
      document.documentElement.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      suppressHydrationWarning
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden bg-[linear-gradient(180deg,#020617_0%,#0b1d59_36%,#1c47c4_60%,#a9c5f8_84%,#f7fafb_100%)] dark:bg-[linear-gradient(180deg,#020617_0%,#0b1d59_42%,#1c47c4_64%,#06112e_86%,#020617_100%)]"
    >
      <canvas ref={canvasRef} className="block size-full" />
    </div>
  );
}

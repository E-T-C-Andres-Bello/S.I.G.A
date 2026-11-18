"use client";

import * as React from "react";
import { cn } from "cn";
import { SigaLoginForm, type SigaLoginFormProps } from "@/components/auth/SigaLoginForm";

const VERTEX_SMOKEY_SOURCE = `
  attribute vec2 a_position;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const FRAGMENT_SMOKEY_SOURCE = `
  precision mediump float;

  uniform vec2 iResolution;
  uniform float iTime;
  uniform vec2 iMouse;
  uniform vec3 u_color;

  void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 centeredUV = (2.0 * fragCoord - iResolution.xy) / max(min(iResolution.x, iResolution.y), 1.0);
    float time = iTime * 0.42;

    vec2 mouse = iMouse / max(iResolution, vec2(1.0));
    vec2 rippleCenter = 2.0 * mouse - 1.0;

    vec2 distortion = centeredUV;
    for (float i = 1.0; i < 8.0; i++) {
      distortion.x += 0.5 / i * cos(i * 2.0 * distortion.y + time + rippleCenter.x * 3.1415);
      distortion.y += 0.5 / i * cos(i * 2.0 * distortion.x + time + rippleCenter.y * 3.1415);
    }

    float wave = abs(sin(distortion.x + distortion.y + time));
    float glow = smoothstep(0.9, 0.18, wave);

    vec3 baseNavy = vec3(0.012, 0.031, 0.105);
    fragColor = vec4(mix(baseNavy, u_color, glow), 1.0);
  }

  void main() {
    mainImage(gl_FragColor, gl_FragCoord.xy);
  }
`;

export type SmokeyBlurSize = "none" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";

export interface SmokeyBackgroundProps {
  backdropBlurAmount?: SmokeyBlurSize;
  color?: string;
  className?: string;
}

const BLUR_CLASS_MAP: Record<SmokeyBlurSize, string> = {
  none: "backdrop-blur-none",
  sm: "backdrop-blur-sm",
  md: "backdrop-blur-md",
  lg: "backdrop-blur-lg",
  xl: "backdrop-blur-xl",
  "2xl": "backdrop-blur-2xl",
  "3xl": "backdrop-blur-3xl",
};

function hexToRgbNormalized(hex: string): [number, number, number] {
  const sanitized = hex.replace("#", "");
  if (sanitized.length !== 6) return [0.11, 0.278, 0.769];
  const r = Number.parseInt(sanitized.slice(0, 2), 16) / 255;
  const g = Number.parseInt(sanitized.slice(2, 4), 16) / 255;
  const b = Number.parseInt(sanitized.slice(4, 6), 16) / 255;
  return [
    Number.isFinite(r) ? r : 0.11,
    Number.isFinite(g) ? g : 0.278,
    Number.isFinite(b) ? b : 0.769,
  ];
}

/**
 * Fondo WebGL interactivo libre de parpadeos negros:
 * - Compila los shaders una sola vez (puntero almacenado en ref).
 * - Redibuja síncronamente al redimensionar en ResizeObserver.
 */
export function SmokeyBackground({
  backdropBlurAmount = "sm",
  color = "#1c47c4",
  className = "",
}: SmokeyBackgroundProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: false,
      powerPreference: "low-power",
    });
    if (!gl) return;

    const compileShader = (type: number, source: string): WebGLShader | null => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vertexShader = compileShader(gl.VERTEX_SHADER, VERTEX_SMOKEY_SOURCE);
    const fragmentShader = compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SMOKEY_SOURCE);
    if (!vertexShader || !fragmentShader) {
      if (vertexShader) gl.deleteShader(vertexShader);
      if (fragmentShader) gl.deleteShader(fragmentShader);
      return;
    }

    const program = gl.createProgram();
    if (!program) {
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      return;
    }

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      gl.deleteProgram(program);
      return;
    }

    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );

    const positionLoc = gl.getAttribLocation(program, "a_position");
    const resLoc = gl.getUniformLocation(program, "iResolution");
    const timeLoc = gl.getUniformLocation(program, "iTime");
    const mouseLoc = gl.getUniformLocation(program, "iMouse");
    const colorLoc = gl.getUniformLocation(program, "u_color");

    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    const [r, g, b] = hexToRgbNormalized(color);
    gl.uniform3f(colorLoc, r, g, b);

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;
    let hovering = false;
    let rafId = 0;
    let disposed = false;
    let lastNow: number | null = null;
    const startTime = performance.now();

    const drawFrame = (now: number) => {
      const dt = lastNow === null ? 0 : Math.min((now - lastNow) / 1000, 0.1);
      lastNow = now;
      const follow = reducedMotion ? 1 : 1 - Math.exp(-8 * dt);

      const fallbackX = canvas.width * 0.5;
      const fallbackY = canvas.height * 0.5;
      const destX = hovering ? targetX : fallbackX;
      const destY = hovering ? targetY : fallbackY;

      mouseX += (destX - mouseX) * follow;
      mouseY += (destY - mouseY) * follow;

      const elapsed = reducedMotion ? 0 : (now - startTime) / 1000;
      gl.uniform2f(resLoc, canvas.width, canvas.height);
      gl.uniform1f(timeLoc, elapsed);
      gl.uniform2f(mouseLoc, mouseX, mouseY);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const nextWidth = Math.max(320, Math.round(rect.width * dpr));
      const nextHeight = Math.max(320, Math.round(rect.height * dpr));

      if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
        canvas.width = nextWidth;
        canvas.height = nextHeight;
        gl.viewport(0, 0, nextWidth, nextHeight);
        if (!hovering) {
          mouseX = nextWidth * 0.5;
          mouseY = nextHeight * 0.5;
        }
        drawFrame(performance.now());
      }
    };

    const tick = (now: number) => {
      rafId = 0;
      if (disposed || reducedMotion) return;
      drawFrame(now);
      rafId = window.requestAnimationFrame(tick);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (reducedMotion) return;
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const dprX = canvas.width / rect.width;
      const dprY = canvas.height / rect.height;
      targetX = (event.clientX - rect.left) * dprX;
      targetY = canvas.height - (event.clientY - rect.top) * dprY;
      hovering = true;
    };

    const onPointerLeave = () => {
      hovering = false;
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onPointerLeave);

    resize();
    drawFrame(performance.now());
    if (!reducedMotion) {
      rafId = window.requestAnimationFrame(tick);
    }

    return () => {
      disposed = true;
      window.cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      document.documentElement.removeEventListener("pointerleave", onPointerLeave);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
    };
  }, [color]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 size-full overflow-hidden bg-[radial-gradient(80%_70%_at_50%_40%,#1c47c4_0%,#06112d_65%,#020617_100%)]",
        className
      )}
    >
      <canvas ref={canvasRef} className="block size-full" />
      <div className={cn("absolute inset-0", BLUR_CLASS_MAP[backdropBlurAmount])} />
    </div>
  );
}

/**
 * Tarjeta glassmórfica de acceso adaptada a S.I.G.A. (componente UI en `src/components/ui/login-form.tsx`).
 */
export function LoginForm({
  className,
  ...formProps
}: SigaLoginFormProps & { className?: string }) {
  return (
    <div
      className={cn(
        "w-full max-w-[23.5rem] rounded-2xl border border-white/25 bg-[#06112d]/76 p-6 shadow-2xl backdrop-blur-xl sm:p-7",
        className
      )}
    >
      <SigaLoginForm {...formProps} />
    </div>
  );
}

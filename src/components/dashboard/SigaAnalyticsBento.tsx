"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "cn";
import type {
  StudentDashboardData,
  StudentSubjectSummary,
} from "@/features/estudiante/dashboard-data";

/* ------------------------------------------------------------------ */
/*  S.I.G.A. · Analytics Bento Adaptado (basado en AnalyticsBento)     */
/*  4 tarjetas interactivas en SVG puro (sin librerías externas)       */
/*  conectadas a datos reales de Neon y estado base 0 honesto.        */
/* ------------------------------------------------------------------ */

type Point = { label: string; value: number; subtitle?: string };

const fmtInt = (n: number) => Math.round(n).toLocaleString("es-VE");
const fmtDec = (n: number) =>
  n.toLocaleString("es-VE", {
    minimumFractionDigits: n % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  });
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

export function useReducedMotion() {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(m.matches);
    const onChange = () => setReduced(m.matches);
    m.addEventListener("change", onChange);
    return () => m.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

function useSize() {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [size, setSize] = React.useState({ w: 0, h: 0 });
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const w = Math.round(entry.contentRect.width);
      const h = Math.round(entry.contentRect.height);
      setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

/** Trazado suave Catmull-Rom convertido a curvas Bézier cúbicas */
function smooth(P: [number, number][]) {
  const n = P.length;
  if (n < 2) return "";
  const g = (i: number) => P[Math.max(0, Math.min(n - 1, i))];
  let d = `M${P[0][0].toFixed(1)},${P[0][1].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = g(i - 1);
    const p1 = g(i);
    const p2 = g(i + 1);
    const p3 = g(i + 2);
    const k = 0.18;
    const c1x = p1[0] + (p2[0] - p0[0]) * k;
    const c1y = p1[1] + (p2[1] - p0[1]) * k;
    const c2x = p2[0] - (p3[0] - p1[0]) * k;
    const c2y = p2[1] - (p3[1] - p1[1]) * k;
    d += `C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

export function CountUp({
  value,
  prefix = "",
  suffix = "",
  decimals = false,
  duration = 950,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: boolean;
  duration?: number;
}) {
  const ref = React.useRef<HTMLSpanElement | null>(null);
  const from = React.useRef(0);
  const reduce = useReducedMotion();

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const formatVal = (v: number) =>
      `${prefix}${decimals ? fmtDec(v) : fmtInt(v)}${suffix}`;

    if (reduce) {
      el.textContent = formatVal(value);
      from.current = value;
      return;
    }

    const startVal = from.current;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      const current = startVal + (value - startVal) * easeOutCubic(t);
      el.textContent = formatVal(current);
      from.current = current;
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, prefix, suffix, decimals, duration, reduce]);

  return (
    <span ref={ref}>
      {prefix}0{suffix}
    </span>
  );
}

/* ---------------- Tooltip Flotante ---------------- */

type Tip = {
  title: string;
  rows: { label: string; value: string; color?: string }[];
};
type TipApi = {
  show: (x: number, y: number, t: Tip) => void;
  hide: () => void;
};
type TipRef = { current: TipApi | null };

function BentoTooltip({ api }: { api: TipRef }) {
  const [tip, setTip] = React.useState<(Tip & { x: number; y: number }) | null>(
    null
  );
  const [pos, setPos] = React.useState({ l: 0, t: 0 });
  const box = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    api.current = {
      show: (x, y, t) => setTip({ ...t, x, y }),
      hide: () => setTip(null),
    };
    return () => {
      api.current = null;
    };
  }, [api]);

  React.useLayoutEffect(() => {
    if (!tip || !box.current) return;
    const r = box.current.getBoundingClientRect();
    let l = tip.x + 14;
    let t = tip.y - r.height - 12;
    if (l + r.width > window.innerWidth - 8) l = tip.x - r.width - 14;
    if (t < 8) t = tip.y + 16;
    setPos({ l, t });
  }, [tip]);

  return (
    <div
      ref={box}
      role="tooltip"
      className={cn(
        "siga-glass-surface font-hero pointer-events-none fixed z-50 whitespace-nowrap rounded-xl border px-3 py-2 text-xs text-foreground shadow-xl transition-opacity duration-150",
        tip ? "opacity-100" : "opacity-0"
      )}
      style={{ left: pos.l, top: pos.t }}
    >
      {tip && (
        <>
          <div className="mb-1 text-[11px] font-medium text-muted-foreground">
            {tip.title}
          </div>
          {tip.rows.map((r) => (
            <div
              key={r.label}
              className="flex items-center justify-between gap-3.5"
            >
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                {r.color && (
                  <i
                    className="inline-block size-2 rounded-[2px]"
                    style={{ background: r.color }}
                  />
                )}
                {r.label}
              </span>
              <b className="font-semibold tabular-nums text-foreground">
                {r.value}
              </b>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

/* ---------------- Componentes Compartidos ---------------- */

function Segmented({
  items,
  value,
  onChange,
  label,
}: {
  items: string[];
  value: number;
  onChange: (i: number) => void;
  label: string;
}) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const [thumb, setThumb] = React.useState({ x: 0, w: 0 });

  React.useLayoutEffect(() => {
    const b = refs.current[value];
    if (b) setThumb({ x: b.offsetLeft, w: b.offsetWidth });
  }, [value, items]);

  return (
    <div
      role="tablist"
      aria-label={label}
      className="siga-glass-inner relative inline-grid h-[32px] auto-cols-fr grid-flow-col rounded-xl border p-[2px]"
    >
      <div
        className=" bg-primary text-primary-foreground absolute top-[2px] bottom-[2px] rounded-[9px] shadow-xs transition-[transform,width] duration-300 [transition-timing-function:cubic-bezier(.2,.9,.25,1)]"
        style={{
          width: thumb.w,
          transform: `translateX(${thumb.x - 2}px)`,
          left: 2,
        }}
      />
      {items.map((it, i) => (
        <button
          key={it}
          ref={(el) => {
            refs.current[i] = el;
          }}
          role="tab"
          type="button"
          aria-selected={i === value}
          onClick={() => onChange(i)}
          className={cn(
            "relative z-10 cursor-pointer rounded-[9px] px-3 text-xs font-medium tracking-[-0.01em] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/50",
            i === value
              ? "text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {it}
        </button>
      ))}
    </div>
  );
}

/* ---------------- A: Curva de Rendimiento MPPE 1–20 ---------------- */

function GradeCurveChart({
  series,
  caption,
  colors,
  tip,
}: {
  series: Point[];
  caption: string;
  colors: [string, string];
  tip: TipRef;
}) {
  const [ref, { w: W, h: H }] = useSize();
  const reduce = useReducedMotion();
  const [drawn, setDrawn] = React.useState(false);
  const [hover, setHover] = React.useState<number | null>(null);
  const id = React.useId().replace(/:/g, "");

  React.useEffect(() => {
    if (!W) return;
    const r = requestAnimationFrame(() =>
      requestAnimationFrame(() => setDrawn(true))
    );
    return () => cancelAnimationFrame(r);
  }, [W]);

  const vals = series.map((s) => s.value);
  const top = 28;
  const bot = 16;
  const mn = 0;
  const mx = 20;
  const Y = (v: number) => top + (1 - (v - mn) / (mx - mn)) * (H - top - bot);
  const ticks = [0, 10, 15, 20];

  const P = vals.map(
    (v, i) =>
      [
        16 + (i / Math.max(1, vals.length - 1)) * Math.max(20, W - 64),
        Y(v),
      ] as [number, number]
  );
  const d = W ? smooth(P) : "";
  const last = P[P.length - 1] ?? [16, Y(0)];

  const move = (e: React.PointerEvent) => {
    const svg = (e.currentTarget as SVGRectElement).ownerSVGElement;
    if (!svg || P.length === 0) return;
    const r = svg.getBoundingClientRect();
    const i = Math.max(
      0,
      Math.min(
        vals.length - 1,
        Math.round(((e.clientX - r.left - 16) / Math.max(1, W - 64)) * (vals.length - 1))
      )
    );
    setHover(i);
    tip.current?.show(r.left + P[i][0], r.top + P[i][1], {
      title: series[i].subtitle ?? series[i].label,
      rows: [
        {
          label: "Calificación",
          value: vals[i] > 0 ? `${fmtDec(vals[i])} / 20 pts` : "Sin nota (0 pts)",
          color: colors[1],
        },
      ],
    });
  };

  return (
    <div
      ref={ref}
      className="siga-glass-inner relative min-h-[145px] flex-1 overflow-hidden rounded-[18px] border"
    >
      <div className="pointer-events-none absolute top-2.5 left-3 z-10 text-[11px] font-medium tracking-[-0.01em] text-muted-foreground">
        {caption}
      </div>
      {W > 0 && H > 0 && (
        <svg
          width={W}
          height={H}
          className="block"
          role="img"
          aria-label={caption}
        >
          <defs>
            <linearGradient id={`${id}l`} x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" style={{ stopColor: colors[0] }} />
              <stop offset="1" style={{ stopColor: colors[1] }} />
            </linearGradient>
            <linearGradient id={`${id}a`} x1="0" x2="0" y1="0" y2="1">
              <stop
                offset="0"
                style={{ stopColor: colors[1], stopOpacity: 0.24 }}
              />
              <stop
                offset="1"
                style={{ stopColor: colors[1], stopOpacity: 0 }}
              />
            </linearGradient>
            <linearGradient id={`${id}m`} x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor="#fff" stopOpacity="0.25" />
              <stop offset="1" stopColor="#fff" stopOpacity="1" />
            </linearGradient>
            <mask id={`${id}k`}>
              <rect width={W} height={H} fill={`url(#${id}m)`} />
            </mask>
          </defs>

          {ticks.map((v) => (
            <g key={v}>
              <line
                x1={0}
                x2={W}
                y1={Y(v)}
                y2={Y(v)}
                className={
                  v === 10
                    ? "stroke-primary/35 dark:stroke-sky-400/35"
                    : "stroke-border/70"
                }
                strokeDasharray={v === 10 ? "3 3" : undefined}
                strokeWidth={1}
              />
              <text
                x={W - 8}
                y={Y(v) - 4}
                textAnchor="end"
                fontSize={10}
                className="fill-muted-foreground tabular-nums"
              >
                {v}pt
              </text>
            </g>
          ))}

          <path
            d={`${d}L${last[0].toFixed(1)},${H}L${P[0][0].toFixed(1)},${H}Z`}
            fill={`url(#${id}a)`}
            mask={`url(#${id}k)`}
          />
          <path
            d={d}
            pathLength={1}
            fill="none"
            stroke={`url(#${id}l)`}
            strokeWidth={2.5}
            strokeLinecap="round"
            style={{
              strokeDasharray: 1,
              strokeDashoffset: drawn || reduce ? 0 : 1,
              transition: reduce
                ? "none"
                : "stroke-dashoffset 1.3s cubic-bezier(.3,.8,.2,1) .15s",
            }}
          />
          <circle
            cx={last[0]}
            cy={last[1]}
            r={4.2}
            style={{ fill: colors[1] }}
            className="stroke-card"
            strokeWidth={2}
          />

          {hover !== null && P[hover] && (
            <>
              <line
                x1={P[hover][0]}
                x2={P[hover][0]}
                y1={0}
                y2={H}
                className="stroke-primary/50"
                strokeWidth={1}
              />
              <circle
                cx={P[hover][0]}
                cy={P[hover][1]}
                r={4.5}
                style={{ fill: colors[1] }}
                className="stroke-card"
                strokeWidth={2}
              />
            </>
          )}
          <rect
            width={W}
            height={H}
            fill="transparent"
            onPointerMove={move}
            onPointerLeave={() => {
              setHover(null);
              tip.current?.hide();
            }}
          />
        </svg>
      )}
    </div>
  );
}

/* ---------------- B: Ondas de Asistencia vs Evaluaciones ---------------- */

function AttendanceWavesChart({
  attendanceSeries,
  evaluationSeries,
  labels,
  colors,
  tip,
}: {
  attendanceSeries: number[][];
  evaluationSeries: number[][];
  labels: { top: string; bottom: string; context: string };
  colors: { top: [string, string]; bottom: [string, string] };
  tip: TipRef;
}) {
  const [ref, { w: W, h: H }] = useSize();
  const reduce = useReducedMotion();
  const id = React.useId().replace(/:/g, "");
  const paths = React.useRef<(SVGPathElement | null)[]>([]);
  const [hover, setHover] = React.useState<number | null>(null);

  const n = attendanceSeries[0]?.length ?? 7;
  const max = Math.max(
    1,
    ...attendanceSeries.flat(),
    ...evaluationSeries.flat()
  );
  const pad = 18;
  const mid = H / 2;
  const amp = Math.max(12, H / 2 - 16);
  const X = (i: number) =>
    pad + 6 + (i / Math.max(1, n - 1)) * Math.max(20, W - 2 * pad - 12);

  const sets = React.useMemo(
    () => [
      ...attendanceSeries.map((a, k) => ({ a, dir: -1, k, g: "d" })),
      ...evaluationSeries.map((a, k) => ({ a, dir: 1, k, g: "m" })),
    ],
    [attendanceSeries, evaluationSeries]
  );

  React.useEffect(() => {
    if (!W || !H) return;
    let raf = 0;
    const t0 = performance.now();
    const frame = (now: number) => {
      const t = (now - t0) / 1000;
      const grow = reduce ? 1 : easeOutCubic(Math.min(1, t / 1.2));
      sets.forEach((s, j) => {
        const breathe = reduce
          ? 1
          : 1 + Math.sin(t * 1.2 + s.k * 0.9) * 0.04;
        const P = s.a.map((v, i) => {
          const idleRipple =
            v === 0 && !reduce
              ? Math.sin(t * 1.4 + i * 0.65 + s.dir) * 2.2
              : 0;
          const yOffset =
            s.dir * (3 + (v / max) * amp * grow * breathe) + idleRipple;
          return [X(i), mid + yOffset] as [number, number];
        });
        paths.current[j]?.setAttribute("d", smooth(P));
      });
      if (!reduce) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [W, H, sets, reduce, max]);

  const dayNames = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  const move = (e: React.PointerEvent) => {
    const svg = (e.currentTarget as SVGRectElement).ownerSVGElement;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const i = Math.max(
      0,
      Math.min(
        n - 1,
        Math.round(
          ((e.clientX - r.left - pad - 6) / Math.max(1, W - 2 * pad - 12)) *
            (n - 1)
        )
      )
    );
    setHover(i);
    tip.current?.show(r.left + X(i), r.top + 14, {
      title: `${dayNames[i % 7] ?? `Día ${i + 1}`} · ${labels.context}`,
      rows: [
        {
          label: labels.top,
          value: `${fmtInt(attendanceSeries[0]?.[i] ?? 0)} reg.`,
          color: colors.top[0],
        },
        {
          label: labels.bottom,
          value: `${fmtInt(evaluationSeries[0]?.[i] ?? 0)} act.`,
          color: colors.bottom[1],
        },
      ],
    });
  };

  return (
    <div
      ref={ref}
      className="siga-glass-inner relative min-h-[145px] flex-1 overflow-hidden rounded-[18px] border"
    >
      {W > 0 && H > 0 && (
        <svg
          width={W}
          height={H}
          className="block"
          role="img"
          aria-label={`${labels.top} y ${labels.bottom}`}
        >
          <defs>
            <linearGradient id={`${id}d`} x1="0" x2="1" y1="0" y2="0">
              <stop offset=".1" style={{ stopColor: colors.top[0] }} />
              <stop offset=".9" style={{ stopColor: colors.top[1] }} />
            </linearGradient>
            <linearGradient id={`${id}m`} x1="0" x2="1" y1="0" y2="0">
              <stop offset=".15" style={{ stopColor: colors.bottom[0] }} />
              <stop offset=".85" style={{ stopColor: colors.bottom[1] }} />
            </linearGradient>
          </defs>

          {Array.from({ length: 9 }, (_, i) => 10 + ((H - 20) * i) / 8).map(
            (y) => (
              <g key={y} className="stroke-muted-foreground/45">
                <line x1={8} x2={14} y1={y} y2={y} strokeWidth={1} />
                <line x1={W - 14} x2={W - 8} y1={y} y2={y} strokeWidth={1} />
              </g>
            )
          )}

          <line
            x1={pad + 6}
            x2={W - pad - 6}
            y1={mid}
            y2={mid}
            className="stroke-border"
            strokeWidth={1}
          />

          {sets.map((s, j) => (
            <path
              key={`${s.g}${s.k}`}
              ref={(el) => {
                paths.current[j] = el;
              }}
              fill="none"
              stroke={`url(#${id}${s.g})`}
              strokeWidth={s.k === 0 ? 2.5 : 1.5}
              strokeLinecap="round"
              opacity={s.k === 0 ? 1 : 0.42}
            />
          ))}

          {hover !== null && (
            <line
              x1={X(hover)}
              x2={X(hover)}
              y1={4}
              y2={H - 4}
              className="stroke-primary/50"
              strokeWidth={1}
            />
          )}

          <rect
            width={W}
            height={H}
            fill="transparent"
            onPointerMove={move}
            onPointerLeave={() => {
              setHover(null);
              tip.current?.hide();
            }}
          />
        </svg>
      )}
    </div>
  );
}

/* ---------------- C: Treemap Curricular ---------------- */

type TreemapInputItem = {
  name: string;
  code: string;
  group: string;
  weightVal: number;
  displayValue: number;
  statusText: string;
};

type Rect = TreemapInputItem & {
  x: number;
  y: number;
  w: number;
  h: number;
};

function squarify(
  items: TreemapInputItem[],
  x: number,
  y: number,
  w: number,
  h: number
): Rect[] {
  const total = items.reduce((a, b) => a + b.weightVal, 0) || 1;
  const scale = (w * h) / total;
  const out: Rect[] = [];
  let rest = items.map((i) => ({ ...i, a: i.weightVal * scale }));

  const worst = (row: typeof rest, len: number) => {
    const s = row.reduce((a, b) => a + b.a, 0);
    const mx = Math.max(...row.map((r) => r.a));
    const mn = Math.min(...row.map((r) => r.a));
    return Math.max((len * len * mx) / (s * s), (s * s) / (len * len * mn));
  };

  while (rest.length) {
    const len = Math.min(w, h);
    const row = [rest[0]];
    let i = 1;
    while (i < rest.length && worst([...row, rest[i]], len) <= worst(row, len)) {
      row.push(rest[i++]);
    }
    rest = rest.slice(i);
    const s = row.reduce((a, b) => a + b.a, 0);
    if (w >= h) {
      const cw = s / h;
      let cy = y;
      for (const r of row) {
        const rh = r.a / cw;
        out.push({ ...r, x, y: cy, w: cw, h: rh });
        cy += rh;
      }
      x += cw;
      w -= cw;
    } else {
      const rh = s / w;
      let cx = x;
      for (const r of row) {
        const rw = r.a / rh;
        out.push({ ...r, x: cx, y, w: rw, h: rh });
        cx += rw;
      }
      y += rh;
      h -= rh;
    }
  }
  return out;
}

const TileIcon = () => (
  <svg viewBox="0 0 14 14" className="size-3.5 shrink-0" aria-hidden="true">
    <rect x="1" y="1" width="12" height="12" rx="4" fill="currentColor" opacity=".9" />
    <path
      d="M7 3.6l1 2.4 2.4 1-2.4 1L7 10.4 6 8 3.6 7 6 6z"
      fill="var(--tile-bg)"
    />
  </svg>
);

const CURRICULUM_GROUPS = [
  { id: "aprobada", name: "Aprobada (≥10)", color: "#1c47c4", ink: "light" as const },
  { id: "destacada", name: "Destacada (≥16)", color: "#0ea5e9", ink: "light" as const },
  { id: "pendiente", name: "Por calificar", color: "#334155", ink: "light" as const },
  { id: "refuerzo", name: "En refuerzo (<10)", color: "#e11d48", ink: "light" as const },
];

function CurriculumTreemap({
  items,
  periodLabel,
  tip,
  compact = false,
}: {
  items: TreemapInputItem[];
  periodLabel: string;
  tip: TipRef;
  compact?: boolean;
}) {
  const [ref, { w: W, h: H }] = useSize();
  const [placed, setPlaced] = React.useState(false);

  React.useEffect(() => {
    if (W) {
      const r = requestAnimationFrame(() =>
        requestAnimationFrame(() => setPlaced(true))
      );
      return () => cancelAnimationFrame(r);
    }
  }, [W]);

  const G = 5;
  const sorted = React.useMemo(
    () => [...items].sort((a, b) => b.weightVal - a.weightVal),
    [items]
  );
  const rects = W && H ? squarify(sorted, 0, 0, W + G, H + G) : [];

  if (items.length === 0) {
    return (
      <div
        className={cn(
          "siga-glass-inner mt-2 flex items-center justify-center rounded-2xl border border-dashed px-4 text-center text-xs text-muted-foreground",
          compact ? "h-[205px] sm:h-[225px]" : "h-[250px] sm:h-[280px]"
        )}
      >
        Sin asignaturas inscritas en este período todavía.
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className={cn(
        "relative mt-2",
        compact ? "h-[205px] sm:h-[225px]" : "h-[250px] sm:h-[280px]"
      )}
      role="region"
      aria-label={`Mapa de asignaturas del año actual · ${periodLabel}`}
    >
      {rects.map((r) => {
        const g =
          CURRICULUM_GROUPS.find((x) => x.id === r.group) ??
          CURRICULUM_GROUPS[2];
        const w = Math.max(0, r.w - G);
        const h = Math.max(0, r.h - G);
        const tiny = h < 48 || w < 62;
        const showName = h >= 62 && w >= 84;

        return (
          <Link
            key={r.code + r.name}
            href={`/estudiante/asignaturas/${encodeURIComponent(r.code)}`}
            aria-label={`${r.name}: ${r.statusText}`}
            className="absolute flex flex-col justify-between overflow-hidden rounded-[14px] border border-white/20 p-2.5 text-white shadow-sm transition-[left,top,width,height,filter] duration-700 [transition-timing-function:cubic-bezier(.2,.9,.25,1)] hover:brightness-110 focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:outline-none motion-reduce:transition-none"
            style={{
              left: placed ? r.x : W / 2,
              top: placed ? r.y : H / 2,
              width: placed ? w : 0,
              height: placed ? h : 0,
              background: g.color,
              ["--tile-bg" as string]: g.color,
            }}
            onPointerMove={(e) =>
              tip.current?.show(e.clientX, e.clientY, {
                title: `${periodLabel} · ${g.name}`,
                rows: [
                  { label: r.name, value: r.statusText, color: g.color },
                  { label: "Código", value: r.code },
                ],
              })
            }
            onPointerLeave={() => tip.current?.hide()}
          >
            <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.04em] uppercase">
              <TileIcon />
              {showName ? (
                <span className="truncate">{r.name}</span>
              ) : (
                <span className="truncate">{r.code}</span>
              )}
            </div>
            {!tiny && (
              <div className="flex items-end justify-between gap-1.5">
                <span className="font-kpi-num text-xl leading-none font-light tracking-normal sm:text-2xl">
                  <CountUp value={r.displayValue} duration={850} />
                </span>
                <span className="rounded-md bg-black/45 px-1.5 py-0.5 text-[9.5px] font-medium tabular-nums text-white backdrop-blur-xs">
                  {r.statusText}
                </span>
              </div>
            )}
          </Link>
        );
      })}
    </div>
  );
}

/* ---------------- D: Radar Polar de Competencias ---------------- */

function AcademicRadar({
  values,
  axis,
  periodLabel,
  color,
  tip,
  compact = false,
}: {
  values: number[];
  axis: string[];
  periodLabel: string;
  color: string;
  tip: TipRef;
  compact?: boolean;
}) {
  const [ref, { w }] = useSize();
  const reduce = useReducedMotion();
  const line = React.useRef<SVGPathElement | null>(null);
  const cur = React.useRef<number[] | null>(null);
  const [hover, setHover] = React.useState<number | null>(null);

  const maxDiameter = compact ? 236 : 340;
  const N = values.length;
  const S = Math.min(w || maxDiameter, maxDiameter);
  const R = Math.max(40, S / 2 - (compact ? 28 : 34));
  const C = S / 2;
  const ang = (i: number) => -Math.PI / 2 + (i / N) * Math.PI * 2;

  const norm = (v: number[]) => {
    const hi = Math.max(...v);
    if (hi <= 0) return v.map(() => 0.24);
    return v.map((x) => 0.24 + (Math.max(0, Math.min(20, x)) / 20) * 0.76);
  };

  const fit = (v: number[]) => {
    const K = Math.min(5, Math.floor(N / 2));
    const co: [number, number][] = [];
    for (let k = 0; k <= K; k++) {
      let a = 0;
      let b = 0;
      v.forEach((x, i) => {
        const th = (i / N) * Math.PI * 2;
        a += x * Math.cos(k * th);
        b += x * Math.sin(k * th);
      });
      co.push([(a * (k ? 2 : 1)) / N, (b * (k ? 2 : 1)) / N]);
    }
    return (th: number) =>
      co.reduce(
        (r, [a, b], k) => r + a * Math.cos(k * th) + b * Math.sin(k * th),
        0
      );
  };

  const at = (f: (t: number) => number, th: number): [number, number] => {
    const v = Math.max(0.08, f(th));
    const a = -Math.PI / 2 + th;
    return [
      C + Math.cos(a) * (R * 0.18 + v * R * 0.82),
      C + Math.sin(a) * (R * 0.18 + v * R * 0.82),
    ];
  };

  const shape = (v: number[]) => {
    const f = fit(norm(v));
    let d = "";
    for (let j = 0; j <= 160; j++) {
      const p = at(f, (j / 160) * Math.PI * 2);
      d += (j ? "L" : "M") + p[0].toFixed(2) + "," + p[1].toFixed(2);
    }
    return d + "Z";
  };

  const point = (v: number[], i: number) =>
    at(fit(norm(v)), (i / N) * Math.PI * 2);

  React.useEffect(() => {
    if (!S) return;
    const from = cur.current ?? values.map(() => 0);
    const to = values;
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = reduce ? 1 : easeOutCubic(Math.min(1, (now - t0) / 850));
      cur.current = from.map((v, i) => v + ((to[i] ?? 0) - v) * t);
      line.current?.setAttribute("d", shape(cur.current));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, S, reduce]);

  const move = (e: React.PointerEvent) => {
    const svg = (e.currentTarget as SVGRectElement).ownerSVGElement;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const x = e.clientX - r.left - C;
    const y = e.clientY - r.top - C;
    if (Math.hypot(x, y) < R * 0.18) {
      setHover(null);
      tip.current?.hide();
      return;
    }
    let a = Math.atan2(y, x) + Math.PI / 2;
    if (a < 0) a += Math.PI * 2;
    const i = Math.round((a / (Math.PI * 2)) * N) % N;
    const p = point(values, i);
    setHover(i);
    tip.current?.show(r.left + p[0], r.top + p[1], {
      title: `${axis[i]} · ${periodLabel}`,
      rows: [
        {
          label: "Nivel",
          value: values[i] > 0 ? `${fmtDec(values[i])} / 20 pts` : "0 pts (Pendiente)",
          color,
        },
      ],
    });
  };

  const hp = hover !== null ? point(values, hover) : null;

  return (
    <div
      ref={ref}
      className={cn(
        "mx-auto mt-1 w-full",
        compact ? "max-w-[236px]" : "max-w-[340px]"
      )}
      style={{ height: S || (compact ? 225 : 280) }}
    >
      {S > 0 && (
        <svg
          width={S}
          height={S}
          className="mx-auto block"
          role="img"
          aria-label={`Radar de rendimiento · ${periodLabel}`}
        >
          {[0.33, 0.66, 1].map((k) => (
            <circle
              key={k}
              cx={C}
              cy={C}
              r={R * k}
              fill="none"
              className="stroke-border"
              strokeWidth={1}
            />
          ))}
          {axis.map((m, i) => (
            <g key={`${m}-${i}`}>
              <line
                x1={C + Math.cos(ang(i)) * R * 0.2}
                y1={C + Math.sin(ang(i)) * R * 0.2}
                x2={C + Math.cos(ang(i)) * R}
                y2={C + Math.sin(ang(i)) * R}
                className="stroke-border"
                strokeWidth={1}
              />
              <text
                x={C + Math.cos(ang(i)) * (R + 17)}
                y={C + Math.sin(ang(i)) * (R + 17)}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={10.5}
                className="fill-muted-foreground font-medium tabular-nums"
              >
                {m}
              </text>
            </g>
          ))}
          <path
            ref={line}
            fill={color}
            fillOpacity={0.14}
            strokeWidth={2.4}
            strokeLinejoin="round"
            style={{ stroke: color }}
          />
          <circle
            cx={C}
            cy={C}
            r={R * 0.2}
            className="fill-card stroke-border"
            strokeWidth={1}
          />
          <g
            transform={`translate(${C - 11} ${C - 11})`}
            fill="none"
            className="stroke-primary dark:stroke-sky-400"
            strokeWidth={1.4}
            strokeLinejoin="round"
          >
            <path d="M11 1.5l8.5 5v9L11 20.5l-8.5-5v-9z M11 1.5v19 M2.5 6.5L19.5 15.5 M19.5 6.5L2.5 15.5" />
          </g>
          {hp && (
            <circle
              cx={hp[0]}
              cy={hp[1]}
              r={4.5}
              className="stroke-card"
              strokeWidth={2}
              style={{ fill: color }}
            />
          )}
          <rect
            width={S}
            height={S}
            fill="transparent"
            onPointerMove={move}
            onPointerLeave={() => {
              setHover(null);
              tip.current?.hide();
            }}
          />
        </svg>
      )}
    </div>
  );
}

/* ---------------- Bloque Principal SigaAnalyticsBento ---------------- */

export interface SigaAnalyticsBentoProps {
  data: StudentDashboardData;
  /** `overview`: solo Curva MPPE + Ondas (Dashboard); `curriculum`: solo Mapa Treemap + Balance Radar (Asignaturas y Pensum). */
  variant?: "overview" | "curriculum" | "all";
}

export function SigaAnalyticsBento({
  data,
  variant = "all",
}: SigaAnalyticsBentoProps) {
  const tip = React.useRef<TipApi | null>(null);
  const [periodIdx, setPeriodIdx] = React.useState(() =>
    data.activeMomentNumber && data.activeMomentNumber >= 1 && data.activeMomentNumber <= 3
      ? data.activeMomentNumber - 1
      : 0
  );
  const [radarMode, setRadarMode] = React.useState(0);

  const hasSubjects = data.subjectsSummary.length > 0;
  const gradedList = React.useMemo(
    () =>
      data.subjectsSummary.filter(
        (s): s is StudentSubjectSummary & { finalNumeric: number } =>
          typeof s.finalNumeric === "number"
      ),
    [data.subjectsSummary]
  );

  /* 1. Serie para Curva de Rendimiento (puntos reales o base 0 honesta) */
  const gradeCurveSeries = React.useMemo<Point[]>(() => {
    if (gradedList.length >= 2) {
      return gradedList.map((s) => ({
        label: s.subjectCode,
        subtitle: `${s.subjectName} (${s.subjectCode})`,
        value: s.finalNumeric,
      }));
    }
    if (hasSubjects) {
      return data.subjectsSummary.slice(0, 6).map((s) => ({
        label: s.subjectCode,
        subtitle: s.subjectName,
        value: s.finalNumeric ?? 0,
      }));
    }
    return [
      { label: "M1", subtitle: "1.º Momento Pedagógico", value: 0 },
      { label: "C1", subtitle: "Corte Parcial I", value: 0 },
      { label: "M2", subtitle: "2.º Momento Pedagógico", value: 0 },
      { label: "C2", subtitle: "Corte Parcial II", value: 0 },
      { label: "M3", subtitle: "3.º Momento Pedagógico", value: 0 },
    ];
  }, [data.subjectsSummary, gradedList, hasSubjects]);

  /* 2. Series para Ondas de Asistencia y Evaluaciones */
  const attendanceWaveSets = React.useMemo(() => {
    const baseAtt =
      data.attendanceSessionsCount > 0
        ? [
            Math.max(1, Math.round(data.attendanceSessionsCount * 0.2)),
            Math.max(1, Math.round(data.attendanceSessionsCount * 0.35)),
            Math.max(1, Math.round(data.attendanceSessionsCount * 0.5)),
            Math.max(1, Math.round(data.attendanceSessionsCount * 0.65)),
            Math.max(1, Math.round(data.attendanceSessionsCount * 0.85)),
            data.attendanceSessionsCount,
            data.attendanceSessionsCount,
          ]
        : [0, 0, 0, 0, 0, 0, 0];

    const evalCount = gradedList.length + data.upcomingEvaluations.length;
    const baseEval =
      evalCount > 0
        ? [
            0,
            Math.min(1, evalCount),
            Math.round(evalCount * 0.4),
            Math.round(evalCount * 0.6),
            Math.round(evalCount * 0.8),
            evalCount,
            evalCount,
          ]
        : [0, 0, 0, 0, 0, 0, 0];

    return {
      attendance: [baseAtt, [0, 0, 0, 0, 0, 0, 0]],
      evaluations: [baseEval, [0, 0, 0, 0, 0, 0, 0]],
    };
  }, [
    data.attendanceSessionsCount,
    data.upcomingEvaluations.length,
    gradedList.length,
  ]);

  /* 3. Datos para el Treemap Curricular */
  const periodTabs = React.useMemo(
    () =>
      [1, 2, 3].map((num) => {
        const momentMeta = data.momentos.find((m) => m.momentNumber === num);
        const list = data.momentGradesByNumber[num] ?? (num === (data.activeMomentNumber ?? 1) ? data.subjectsSummary : []);
        const gradedCount = list.filter(
          (s) => s.finalNumeric !== null || s.finalLiteral !== null
        ).length;
        const statusText =
          momentMeta?.status === "open"
            ? "Lapso activo"
            : momentMeta?.status === "closed" || momentMeta?.status === "locked"
              ? "Cerrado"
              : "Programado";
        return {
          momentNumber: num,
          label: `${num}.º Momento`,
          total: list.length,
          status: statusText,
          compare:
            gradedCount > 0
              ? `${gradedCount} calificada(s)`
              : statusText === "Lapso activo"
                ? "0 evaluadas aún"
                : statusText,
        };
      }),
    [data.activeMomentNumber, data.momentGradesByNumber, data.momentos, data.subjectsSummary]
  );

  const selectedPeriodSubjects = React.useMemo(
    () =>
      data.momentGradesByNumber[periodIdx + 1] ??
      (periodIdx + 1 === (data.activeMomentNumber ?? 1) ? data.subjectsSummary : []),
    [data.activeMomentNumber, data.momentGradesByNumber, data.subjectsSummary, periodIdx]
  );

  const treemapItems = React.useMemo<TreemapInputItem[]>(() => {
    if (selectedPeriodSubjects.length > 0) {
      return selectedPeriodSubjects.map((s) => {
        const score = s.finalNumeric ?? 0;
        const group =
          s.finalNumeric === null && s.finalLiteral === null
            ? "pendiente"
            : score >= 16 || s.finalLiteral === "A"
              ? "destacada"
              : score >= 10 ||
                  s.finalLiteral === "B" ||
                  s.finalLiteral === "C" ||
                  s.finalLiteral === "D"
                ? "aprobada"
                : "refuerzo";
        return {
          name: s.subjectName,
          code: s.subjectCode,
          group,
          weightVal: Math.max(8, score || 10),
          displayValue: score,
          statusText:
            s.finalNumeric !== null
              ? `${s.finalNumeric}/20`
              : s.finalLiteral ?? "Pendiente",
        };
      });
    }

    return [];
  }, [selectedPeriodSubjects]);

  /* 4. Datos para el Radar Académico (exclusivo del año actual) */
  const radarData = React.useMemo(() => {
    const activeSliceSource =
      selectedPeriodSubjects.length >= 3
        ? selectedPeriodSubjects
        : data.subjectsSummary;
    if (radarMode === 0 && activeSliceSource.length >= 3) {
      const slice = activeSliceSource.slice(0, 8);
      return {
        axis: slice.map((s) => s.subjectCode.slice(0, 4).toUpperCase()),
        values: slice.map((s) => s.finalNumeric ?? 0),
      };
    }
    return {
      axis: ["PROM", "ASIS", "AVAN", "ÁREA", "PUNT", "EVAL"],
      values:
        radarMode === 0
          ? [
              data.averageGrade ?? 0,
              data.averageGrade ?? 0,
              data.averageGrade ?? 0,
              data.averageGrade ?? 0,
              data.averageGrade ?? 0,
              data.averageGrade ?? 0,
            ]
          : [
              data.averageGrade ?? 0,
              data.attendancePercent ? (data.attendancePercent / 100) * 20 : 0,
              data.completionPercent ? (data.completionPercent / 100) * 20 : 0,
              data.enrolledSubjectsCount > 0
                ? Math.min(20, (gradedList.filter((s) => s.finalNumeric >= 10).length / data.enrolledSubjectsCount) * 20)
                : 0,
              data.attendanceSessionsCount > 0 ? 16 : 0,
              gradedList.length > 0 ? Math.min(20, (gradedList.length / Math.max(1, data.enrolledSubjectsCount)) * 20) : 0,
            ],
    };
  }, [
    data.attendancePercent,
    data.attendanceSessionsCount,
    data.averageGrade,
    data.completionPercent,
    data.enrolledSubjectsCount,
    data.subjectsSummary,
    gradedList,
    radarMode,
    selectedPeriodSubjects,
  ]);

  const showOverview = variant !== "curriculum";
  const showCurriculum = variant !== "overview";

  return (
    <div id="asignaturas" className="font-hero w-full text-foreground">
      <div className="grid grid-cols-12 gap-5">
        {showOverview ? (
          <>
            {/* TARJETA A: Curva de Rendimiento MPPE */}
            <section
              aria-label="Curva de rendimiento académico"
              className="siga-glass-surface col-span-12 flex flex-col rounded-[28px] border p-5 sm:p-6 lg:col-span-5"
            >
          <div className="flex flex-1 flex-col gap-5 sm:flex-row">
            <div className="shrink-0 sm:w-48">
              <div className="text-xs leading-snug font-medium tracking-[-0.01em] text-muted-foreground">
                Rendimiento del Lapso
              </div>
              <div className="font-kpi-num mt-3 flex items-baseline gap-2.5 text-[38px] leading-[1.1] font-light sm:text-[42px]">
                <CountUp
                  value={data.averageGrade ?? 0}
                  decimals={data.averageGrade !== null}
                />
                <span className="rounded-full bg-primary/14 px-2.5 py-0.5 text-[11px] font-semibold tracking-normal text-primary dark:text-[#7dd3fc]">
                  {data.averageGrade !== null ? "MPPE 1–20" : "Sin notas"}
                </span>
              </div>
              <p className="mt-2.5 text-xs leading-[1.6] text-muted-foreground">
                {data.averageGrade !== null
                  ? "Promedio real sobre asignaturas calificadas."
                  : "Línea en 0 pts hasta que tus docentes carguen notas."}
              </p>

              {/* Bullet Bar de Umbral MPPE (Mejora #6 del Plan) */}
              <div className="mt-5">
                <div className="flex items-center justify-between text-[11px] leading-normal font-medium text-muted-foreground">
                  <span>Meta aprobatoria: 10 pts</span>
                  <span className="tabular-nums">
                    {data.averageGrade !== null
                      ? `${data.averageGrade}/20`
                      : "0/20"}
                  </span>
                </div>
                <div
                  className="relative mt-2 flex h-2 w-full overflow-hidden rounded-full bg-muted/70"
                  role="progressbar"
                  aria-label="Promedio frente a meta aprobatoria de 10 puntos"
                  aria-valuemin={0}
                  aria-valuemax={20}
                  aria-valuenow={data.averageGrade ?? 0}
                >
                  <div className="h-full w-1/2 bg-rose-500/20" />
                  <div className="h-full w-1/4 bg-amber-500/20" />
                  <div className="h-full w-1/4 bg-emerald-500/25" />
                  <span
                    aria-hidden="true"
                    className="absolute top-0 bottom-0 left-1/2 w-[2px] bg-foreground/70"
                    title="Mínimo aprobatorio (10 pts)"
                  />
                  <div
                    className="bg-primary absolute inset-y-0 left-0 rounded-full transition-all duration-700"
                    style={{
                      width: `${Math.min(100, ((data.averageGrade ?? 0) / 20) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            <GradeCurveChart
              series={gradeCurveSeries}
              caption={
                hasSubjects
                  ? "Calificaciones por asignatura (Escala 1–20)"
                  : "Escala MPPE 1–20 · Esperando primera calificación"
              }
              colors={["var(--ab-rev-a)", "var(--ab-rev-b)"]}
              tip={tip}
            />
          </div>
        </section>

        {/* TARJETA B: Pulso de Asistencia y Actividades */}
        <section
          aria-label="Pulso de asistencia y evaluaciones"
          className="siga-glass-surface col-span-12 flex flex-col rounded-[28px] border p-5 sm:p-6 lg:col-span-7"
        >
          <div className="flex flex-1 flex-col gap-5 sm:flex-row">
            <div className="shrink-0 sm:w-52">
              <div className="text-xs leading-snug font-medium tracking-[-0.01em] text-muted-foreground">
                Asistencia y Actividad
              </div>
              <div className="font-kpi-num mt-3 flex items-baseline gap-2.5 text-[38px] leading-[1.1] font-light sm:text-[42px]">
                <CountUp
                  value={data.attendancePercent ?? 0}
                  suffix="%"
                />
                <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold tracking-normal text-emerald-700 dark:text-emerald-300">
                  Meta ≥ 75%
                </span>
              </div>
              <p className="mt-2.5 text-xs leading-[1.6] text-muted-foreground">
                {data.attendanceSessionsCount > 0
                  ? `${data.attendanceSessionsCount} pases de asistencia registrados en aula.`
                  : "Sin pases registrados todavía en este momento."}
              </p>

              <div className="mt-5 flex flex-col gap-2 text-xs leading-normal text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <i
                    className="h-0.5 w-3.5 rounded-sm"
                    style={{
                      background: "linear-gradient(90deg,#38bdf8,#1c47c4)",
                    }}
                  />
                  Asistencia presencial
                </span>
                <span className="inline-flex items-center gap-2">
                  <i
                    className="h-0.5 w-3.5 rounded-sm"
                    style={{
                      background: "linear-gradient(90deg,#818cf8,#10b981)",
                    }}
                  />
                  Evaluaciones del lapso
                </span>
              </div>
            </div>

            <AttendanceWavesChart
              attendanceSeries={attendanceWaveSets.attendance}
              evaluationSeries={attendanceWaveSets.evaluations}
              labels={{
                top: "Asistencias",
                bottom: "Evaluaciones",
                context: data.activeMomentName ?? "Lapso actual",
              }}
              colors={{
                top: ["#38bdf8", "#1c47c4"],
                bottom: ["#818cf8", "#10b981"],
              }}
              tip={tip}
            />
          </div>
        </section>
          </>
        ) : null}

        {showCurriculum ? (
          <>
            {/* TARJETA C: Mapa Visual del Año Actual (compacto, sin tabla redundante) */}
            <section
              aria-label="Mapa de asignaturas del año actual"
              className="siga-glass-surface col-span-12 flex flex-col justify-between rounded-[24px] border p-4 sm:p-5 lg:col-span-7"
            >
              <div>
                <div className="flex flex-col items-start justify-between gap-2.5 sm:flex-row sm:items-center">
                  <div>
                    <h2 className="m-0 text-sm leading-snug font-semibold tracking-[-0.02em] text-foreground sm:text-[15px]">
                      Mapa del Año Actual
                    </h2>
                    <p className="mt-0.5 text-[11.5px] leading-[1.45] text-muted-foreground">
                      {hasSubjects
                        ? `${data.gradeYear ? `${data.gradeYear}.º Año · ` : ""}${data.subjectsSummary.length} área(s) inscrita(s) · Haz clic en una materia para abrirla`
                        : "Sin asignaturas inscritas en el período vigente"}
                    </p>
                  </div>

                  {/* Selector compacto de los 3 Momentos Pedagógicos */}
                  <div
                    role="group"
                    aria-label="Seleccionar momento pedagógico"
                    className="siga-glass-inner inline-flex items-center gap-0.5 rounded-xl border p-0.5"
                  >
                    {periodTabs.map((p, i) => (
                      <button
                        key={p.label}
                        type="button"
                        aria-pressed={i === periodIdx}
                        onClick={() => setPeriodIdx(i)}
                        className={cn(
                          "cursor-pointer rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none",
                          i === periodIdx
                            ? "bg-primary text-primary-foreground shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {p.momentNumber}.º Mom.
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[10.5px] leading-normal text-muted-foreground">
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {CURRICULUM_GROUPS.map((g) => (
                      <span
                        key={g.id}
                        className="inline-flex items-center gap-1.5"
                      >
                        <i
                          className="size-2 rounded-[2px]"
                          style={{ background: g.color }}
                        />
                        {g.name}
                      </span>
                    ))}
                  </div>
                  <span className="tabular-nums">
                    {periodTabs[periodIdx]?.label} ·{" "}
                    {periodTabs[periodIdx]?.compare}
                  </span>
                </div>
              </div>

              <CurriculumTreemap
                items={treemapItems}
                periodLabel={periodTabs[periodIdx]?.label ?? "1.º Momento"}
                tip={tip}
                compact
              />
            </section>

            {/* TARJETA D: Radar de Competencias del Año Actual (compacto y nivelado) */}
            <section
              aria-label="Radar de competencias académicas"
              className="siga-glass-surface col-span-12 flex flex-col justify-between rounded-[24px] border p-4 sm:p-5 lg:col-span-5"
            >
              <div className="flex items-start justify-between gap-2.5">
                <div>
                  <h2 className="m-0 text-sm leading-snug font-semibold tracking-[-0.02em] text-foreground sm:text-[15px]">
                    Balance de Competencias
                  </h2>
                  <p className="mt-0.5 text-[11.5px] leading-[1.45] text-muted-foreground">
                    {radarMode === 0
                      ? `${periodTabs[periodIdx]?.label ?? "Lapso actual"} · Escala 1–20`
                      : "Indicadores globales del año actual"}
                  </p>
                </div>
                <Segmented
                  label="Vista del radar"
                  items={["Materias", "Global"]}
                  value={radarMode}
                  onChange={setRadarMode}
                />
              </div>

              <AcademicRadar
                values={radarData.values}
                axis={radarData.axis}
                periodLabel={
                  radarMode === 0
                    ? (periodTabs[periodIdx]?.label ?? "Por asignatura")
                    : "Indicadores globales"
                }
                color="var(--ab-radar)"
                tip={tip}
                compact
              />

              <div className="mt-1 flex items-center justify-between border-t border-border/50 pt-2.5 text-[11px] text-muted-foreground">
                <span>Avance evaluado del lapso</span>
                <span className="font-semibold tabular-nums text-foreground">
                  {data.completionPercent}% ({gradedList.length}/
                  {data.enrolledSubjectsCount})
                </span>
              </div>
            </section>
          </>
        ) : null}
      </div>

      <BentoTooltip api={tip} />
    </div>
  );
}

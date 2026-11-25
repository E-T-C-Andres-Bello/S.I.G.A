"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Check, FastForward, Sparkles } from "lucide-react";
import {
  hexToRgba,
  type AnnouncementThemePalette,
} from "@/lib/validators/bulletin";

export type BulletinAiStage = "title" | "meta" | "body";

export interface BulletinAgentsOverlayProps {
  active: boolean;
  phaseLabel: string;
  stage: BulletinAiStage;
  progress: number;
  currentTitle: string;
  currentShortNote: string;
  currentBody: string;
  sheetRef: React.RefObject<HTMLElement | null>;
  palette: AnnouncementThemePalette;
  onSkip: () => void;
}

interface Point {
  x: number;
  y: number;
}

interface HighlightBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface LiveTargets {
  redactor: Point;
  estilo: Point;
  corrector: Point;
  activeHighlight: HighlightBox | null;
  activeCaret: Point | null;
  activeColor: string;
  clickBurst: Point | null;
}

function measureTextWidthPx(text: string, font: string): number {
  if (typeof document === "undefined" || !text) return 0;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return text.length * 8;
  ctx.font = font;
  return ctx.measureText(text).width;
}

function computeBodyCaretPoint(
  textarea: HTMLTextAreaElement,
  sheetRect: DOMRect,
  currentBody: string
): { caret: Point; lineBox: HighlightBox } {
  const rect = textarea.getBoundingClientRect();
  const styles = window.getComputedStyle(textarea);
  const padLeft = parseFloat(styles.paddingLeft) || 16;
  const padTop = parseFloat(styles.paddingTop) || 14;
  const padRight = parseFloat(styles.paddingRight) || 16;
  const lineHeight = parseFloat(styles.lineHeight) || 26;
  const font = `${styles.fontWeight} ${styles.fontSize} ${styles.fontFamily}`;
  const contentWidth = Math.max(80, rect.width - padLeft - padRight);

  const rawLines = currentBody.split("\n");
  let visualRow = 0;
  let lastLineWidth = 0;

  for (let i = 0; i < rawLines.length; i += 1) {
    const lineText = rawLines[i] ?? "";
    const w = measureTextWidthPx(lineText, font);
    const wrappedRows = Math.max(1, Math.ceil((w + 4) / contentWidth));
    if (i < rawLines.length - 1) {
      visualRow += wrappedRows;
    } else {
      visualRow += wrappedRows - 1;
      lastLineWidth = wrappedRows > 1 ? w % contentWidth : w;
    }
  }

  const maxVisibleRows = Math.max(
    1,
    Math.floor((rect.height - padTop * 2) / lineHeight)
  );
  const clampedRow = Math.min(visualRow, maxVisibleRows - 1);

  const relLeft = rect.left - sheetRect.left + padLeft;
  const relTop = rect.top - sheetRect.top + padTop + clampedRow * lineHeight;
  const caretX = Math.min(
    rect.left - sheetRect.left + rect.width - padRight - 6,
    relLeft + Math.max(8, lastLineWidth)
  );
  const caretY = Math.min(
    rect.top - sheetRect.top + rect.height - 18,
    relTop + lineHeight * 0.52
  );

  return {
    caret: { x: caretX, y: caretY },
    lineBox: {
      x: relLeft - 4,
      y: Math.min(
        rect.top - sheetRect.top + rect.height - lineHeight - 6,
        relTop
      ),
      width: Math.min(contentWidth + 8, Math.max(56, lastLineWidth + 24)),
      height: lineHeight,
    },
  };
}

function computeInputCaretPoint(
  el: HTMLElement,
  sheetRect: DOMRect,
  text: string
): { caret: Point; box: HighlightBox } {
  const rect = el.getBoundingClientRect();
  const styles = window.getComputedStyle(el);
  const padLeft = parseFloat(styles.paddingLeft) || 10;
  const font = `${styles.fontWeight} ${styles.fontSize} ${styles.fontFamily}`;
  const textWidth = measureTextWidthPx(text, font);

  const relLeft = rect.left - sheetRect.left;
  const relTop = rect.top - sheetRect.top;
  const usableWidth = Math.max(40, rect.width - padLeft * 2);
  const clampedTextWidth = Math.min(usableWidth, Math.max(12, textWidth));

  return {
    caret: {
      x: relLeft + padLeft + clampedTextWidth,
      y: relTop + rect.height * 0.55,
    },
    box: {
      x: relLeft + padLeft - 4,
      y: relTop + 2,
      width: Math.min(rect.width - 4, clampedTextWidth + 16),
      height: Math.max(24, rect.height - 4),
    },
  };
}

interface DynamicCursorProps {
  name: string;
  actionLabel: string;
  color: string;
  point: Point;
  isPrimary: boolean;
  isDone: boolean;
}

function DynamicAgentCursor({
  name,
  actionLabel,
  color,
  point,
  isPrimary,
  isDone,
}: DynamicCursorProps) {
  return (
    <motion.div
      aria-hidden="true"
      initial={false}
      animate={{
        x: point.x,
        y: point.y,
        scale: isPrimary ? 1.05 : 0.92,
        opacity: isPrimary ? 1 : 0.88,
      }}
      transition={{
        type: "spring",
        stiffness: isPrimary ? 260 : 170,
        damping: isPrimary ? 24 : 22,
        mass: 0.65,
      }}
      className="pointer-events-none absolute top-0 left-0 z-20 flex items-start gap-1 will-change-transform"
    >
      {/* Puntero colaborativo anclado a la punta exacta (x, y) */}
      <motion.svg
        width="18"
        height="18"
        viewBox="0 0 20 20"
        fill="none"
        animate={isPrimary ? { rotate: [0, -8, 4, 0] } : { rotate: 0 }}
        transition={{ duration: 0.45, repeat: isPrimary ? Infinity : 0 }}
        className="shrink-0 drop-shadow-md"
      >
        <path
          d="M3 2.5L16.5 9.2L10.3 11.1L7.8 17.2L3 2.5Z"
          fill={color}
          stroke="#ffffff"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </motion.svg>

      <span
        className="mt-2.5 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold whitespace-nowrap text-white shadow-lg"
        style={{
          background: color,
          boxShadow: `0 6px 18px -4px ${hexToRgba(color, 0.72)}`,
        }}
      >
        {isDone ? (
          <Check className="size-2.5 shrink-0" aria-hidden="true" />
        ) : (
          <span
            className={
              isPrimary
                ? "size-1.5 animate-ping rounded-full bg-white"
                : "size-1.5 rounded-full bg-white/80"
            }
          />
        )}
        <span>{name}</span>
        {isPrimary ? (
          <span className="font-normal text-white/85">· {actionLabel}</span>
        ) : null}
      </span>
    </motion.div>
  );
}

/**
 * Coreografía real de 3 mini-agentes colaborativos (*Redactor*, *Estilo*, *Corrector*)
 * que miden las coordenadas DOM reales del título, etiqueta, categoría y renglón activo
 * del cuerpo para posarse exactamente sobre el texto que van escribiendo y revisando.
 */
export function BulletinAgentsOverlay({
  active,
  phaseLabel,
  stage,
  progress,
  currentTitle,
  currentShortNote,
  currentBody,
  sheetRef,
  palette,
  onSkip,
}: BulletinAgentsOverlayProps) {
  const [targets, setTargets] = React.useState<LiveTargets | null>(null);

  React.useLayoutEffect(() => {
    if (!active) {
      setTargets(null);
      return;
    }

    const sheetEl = sheetRef.current;
    if (!sheetEl) return;

    const sheetRect = sheetEl.getBoundingClientRect();
    const titleEl = sheetEl.querySelector<HTMLElement>('[data-ai-target="title"]');
    const shortNoteEl = sheetEl.querySelector<HTMLElement>(
      '[data-ai-target="shortNote"]'
    );
    const categoryEl = sheetEl.querySelector<HTMLElement>(
      '[data-ai-target="category"]'
    );
    const bodyEl = sheetEl.querySelector<HTMLTextAreaElement>(
      '[data-ai-target="body"]'
    );

    const titlePos = titleEl
      ? computeInputCaretPoint(titleEl, sheetRect, currentTitle)
      : {
          caret: { x: sheetRect.width * 0.3, y: 92 },
          box: { x: 24, y: 78, width: 200, height: 34 },
        };

    const shortNotePos = shortNoteEl
      ? computeInputCaretPoint(shortNoteEl, sheetRect, currentShortNote)
      : {
          caret: { x: sheetRect.width * 0.28, y: 174 },
          box: { x: 24, y: 158, width: 170, height: 34 },
        };

    const categoryRect = categoryEl?.getBoundingClientRect();
    const categoryCenter: Point = categoryRect
      ? {
          x: categoryRect.left - sheetRect.left + categoryRect.width * 0.45,
          y: categoryRect.top - sheetRect.top + categoryRect.height * 0.55,
        }
      : { x: sheetRect.width * 0.72, y: 174 };

    const bodyPos = bodyEl
      ? computeBodyCaretPoint(bodyEl, sheetRect, currentBody)
      : {
          caret: { x: sheetRect.width * 0.4, y: 310 },
          lineBox: { x: 24, y: 296, width: 260, height: 26 },
        };

    // Posiciones dinámicas: cada agente interactúa directamente con su zona real
    let redactor: Point = titlePos.caret;
    let estilo: Point = shortNotePos.caret;
    let corrector: Point = bodyPos.caret;
    let activeHighlight: HighlightBox | null = titlePos.box;
    let activeCaret: Point | null = titlePos.caret;
    let activeColor = palette.primary;
    let clickBurst: Point | null = null;

    if (stage === "title") {
      redactor = titlePos.caret;
      estilo = {
        x: shortNotePos.caret.x + 14,
        y: shortNotePos.caret.y - 6,
      };
      corrector = {
        x: bodyPos.lineBox.x + 28,
        y: bodyPos.lineBox.y + 8,
      };
      activeHighlight = titlePos.box;
      activeCaret = titlePos.caret;
      activeColor = palette.primary;
    } else if (stage === "meta") {
      // Redactor termina el titular y baja hacia el inicio del cuerpo
      redactor = {
        x: bodyPos.lineBox.x + 18,
        y: bodyPos.lineBox.y + 10,
      };
      // Estilo primero escribe la etiqueta manuscrita y luego pulsa la categoría
      const touchingCategory = progress > 0.5;
      estilo = touchingCategory ? categoryCenter : shortNotePos.caret;
      corrector = {
        x: bodyPos.caret.x,
        y: bodyPos.caret.y + 12,
      };
      activeHighlight = touchingCategory && categoryRect
        ? {
            x: categoryRect.left - sheetRect.left,
            y: categoryRect.top - sheetRect.top,
            width: categoryRect.width,
            height: categoryRect.height,
          }
        : shortNotePos.box;
      activeCaret = touchingCategory ? null : shortNotePos.caret;
      activeColor = palette.secondary;
      clickBurst = touchingCategory ? categoryCenter : shortNotePos.caret;
    } else {
      // Fase cuerpo: Redactor va justo en el caret de escritura y Corrector revisa detrás en la misma línea
      redactor = bodyPos.caret;
      estilo = categoryCenter;
      corrector = {
        x: Math.max(bodyPos.lineBox.x + 16, bodyPos.caret.x - 92),
        y: Math.max(bodyPos.lineBox.y + 4, bodyPos.caret.y - 10),
      };
      activeHighlight = bodyPos.lineBox;
      activeCaret = bodyPos.caret;
      activeColor = palette.accent;
      clickBurst = bodyPos.caret;
    }

    setTargets({
      redactor,
      estilo,
      corrector,
      activeHighlight,
      activeCaret,
      activeColor,
      clickBurst,
    });
  }, [
    active,
    currentBody,
    currentShortNote,
    currentTitle,
    palette.accent,
    palette.primary,
    palette.secondary,
    progress,
    sheetRef,
    stage,
  ]);

  if (!active || !targets) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="pointer-events-none absolute inset-0 z-30 overflow-hidden rounded-[28px]"
      style={{
        boxShadow: `inset 0 0 0 1.5px ${hexToRgba(targets.activeColor, 0.72)}, 0 0 36px -10px ${hexToRgba(palette.glow, 0.4)}`,
      }}
    >
      {/* Resaltado luminoso pegado al texto real que se está modificando */}
      {targets.activeHighlight ? (
        <motion.div
          aria-hidden="true"
          initial={false}
          animate={{
            x: targets.activeHighlight.x,
            y: targets.activeHighlight.y,
            width: targets.activeHighlight.width,
            height: targets.activeHighlight.height,
          }}
          transition={{ type: "spring", stiffness: 280, damping: 28 }}
          className="pointer-events-none absolute top-0 left-0 rounded-lg will-change-transform"
          style={{
            background: hexToRgba(targets.activeColor, 0.14),
            boxShadow: `inset 0 0 0 1px ${hexToRgba(targets.activeColor, 0.35)}`,
          }}
        />
      ) : null}

      {/* Caret vertical luminoso en la punta exacta donde se inserta el texto */}
      {targets.activeCaret ? (
        <motion.div
          aria-hidden="true"
          initial={false}
          animate={{
            x: targets.activeCaret.x,
            y: targets.activeCaret.y - 11,
            opacity: [1, 0.25, 1],
          }}
          transition={{
            x: { type: "spring", stiffness: 340, damping: 28 },
            y: { type: "spring", stiffness: 340, damping: 28 },
            opacity: { duration: 0.55, repeat: Infinity },
          }}
          className="pointer-events-none absolute top-0 left-0 h-[22px] w-[2.5px] rounded-full"
          style={{
            background: targets.activeColor,
            boxShadow: `0 0 10px ${hexToRgba(targets.activeColor, 0.9)}`,
          }}
        />
      ) : null}

      {/* Pulso circular sutil cuando un agente toca/ajusta un control o línea */}
      {targets.clickBurst ? (
        <motion.span
          key={`${stage}-${Math.round(targets.clickBurst.y / 24)}`}
          aria-hidden="true"
          initial={{
            x: targets.clickBurst.x - 10,
            y: targets.clickBurst.y - 10,
            scale: 0.4,
            opacity: 0.85,
          }}
          animate={{
            x: targets.clickBurst.x - 10,
            y: targets.clickBurst.y - 10,
            scale: 2.1,
            opacity: 0,
          }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          className="pointer-events-none absolute top-0 left-0 size-5 rounded-full border-2"
          style={{ borderColor: targets.activeColor }}
        />
      ) : null}

      {/* 3 Mini-agentes anclados a las coordenadas reales del documento */}
      <DynamicAgentCursor
        name="Redactor"
        actionLabel={stage === "title" ? "escribiendo titular" : "redactando"}
        color={palette.primary}
        point={targets.redactor}
        isPrimary={stage === "title" || stage === "body"}
        isDone={false}
      />
      <DynamicAgentCursor
        name="Estilo"
        actionLabel={progress > 0.5 ? "ajustando categoría" : "etiquetando"}
        color={palette.secondary}
        point={targets.estilo}
        isPrimary={stage === "meta"}
        isDone={stage === "body"}
      />
      <DynamicAgentCursor
        name="Corrector"
        actionLabel="puliendo líneas"
        color={palette.accent}
        point={targets.corrector}
        isPrimary={stage === "body"}
        isDone={false}
      />

      {/* Píldora superior flotante con progreso y botón para completar al instante */}
      <div className="pointer-events-auto absolute top-3.5 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/30 bg-slate-950/85 py-1.5 pr-2 pl-3.5 text-white shadow-xl backdrop-blur-md">
        <Sparkles
          className="size-3.5 animate-spin text-sky-300"
          style={{ animationDuration: "2.4s" }}
          aria-hidden="true"
        />
        <span className="text-[11.5px] font-medium whitespace-nowrap">
          {phaseLabel}
        </span>
        <button
          type="button"
          onClick={onSkip}
          className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-[10.5px] font-semibold text-white transition-colors hover:bg-white/25 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
        >
          <FastForward className="size-3" aria-hidden="true" />
          Completar ya
        </button>
      </div>
    </motion.div>
  );
}

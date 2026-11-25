"use client";

import * as React from "react";
import { Award, ChevronDown, ChevronUp, Sparkles, TrendingUp } from "lucide-react";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  CvLevelCode,
  PortfolioEvaluationResult,
  SelectiveCoachSignal,
} from "@/features/portafolio/cv-scoring";

export interface PortfolioScoreMeterProps {
  evaluation: PortfolioEvaluationResult;
  onSelectSignal?: (signal: SelectiveCoachSignal) => void;
}

const LEVEL_STYLES: Record<
  CvLevelCode,
  { badge: string; bar: string; ring: string }
> = {
  borrador: {
    badge: "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
    bar: "bg-slate-500",
    ring: "text-slate-500",
  },
  en_construccion: {
    badge: "border-amber-300/70 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-950/50 dark:text-amber-200",
    bar: "bg-amber-500",
    ring: "text-amber-500",
  },
  listo_pasantias: {
    badge: "border-sky-300/70 bg-sky-50 text-sky-800 dark:border-sky-500/40 dark:bg-sky-950/50 dark:text-sky-200",
    bar: "bg-sky-600",
    ring: "text-sky-600",
  },
  tecnico_destacado: {
    badge: "border-indigo-300/70 bg-indigo-50 text-indigo-800 dark:border-indigo-500/40 dark:bg-indigo-950/50 dark:text-indigo-200",
    bar: "bg-indigo-600",
    ring: "text-indigo-600",
  },
  excelencia: {
    badge: "border-emerald-300/70 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-950/50 dark:text-emerald-200",
    bar: "bg-emerald-600",
    ring: "text-emerald-600",
  },
};

export function PortfolioScoreMeter({
  evaluation,
  onSelectSignal,
}: PortfolioScoreMeterProps) {
  const [expanded, setExpanded] = React.useState(false);
  const style = LEVEL_STYLES[evaluation.levelCode];

  return (
    <div className="rounded-2xl border border-border/80 bg-card/90 p-4 shadow-xs backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative flex size-12 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-muted/40">
            <span className={cn("text-lg font-bold tabular-nums", style.ring)}>
              {evaluation.totalScore}
            </span>
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-foreground">
                Nivel de tu Currículum
              </span>
              <Badge variant="outline" className={cn("text-[11px] font-semibold", style.badge)}>
                {evaluation.levelCode === "excelencia" ? (
                  <Award className="mr-1 size-3" aria-hidden="true" />
                ) : (
                  <TrendingUp className="mr-1 size-3" aria-hidden="true" />
                )}
                {evaluation.levelLabel}
              </Badge>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {evaluation.levelSummary}
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setExpanded((prev) => !prev)}
          className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <span>{expanded ? "Ocultar desglose" : "Ver desglose"}</span>
          {expanded ? (
            <ChevronUp className="size-3.5" aria-hidden="true" />
          ) : (
            <ChevronDown className="size-3.5" aria-hidden="true" />
          )}
        </Button>
      </div>

      {/* Barra de progreso principal */}
      <div className="mt-3">
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full transition-all duration-500", style.bar)}
            style={{ width: `${Math.max(4, evaluation.totalScore)}%` }}
          />
        </div>
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <span>
            {evaluation.nextMilestoneLabel
              ? `Siguiente meta: ${evaluation.nextMilestoneLabel}`
              : "Puntaje sobresaliente alcanzado"}
          </span>
          <span className="tabular-nums font-medium text-foreground">
            {evaluation.totalScore} / 100 pts
          </span>
        </div>
      </div>

      {/* Señales de alto impacto disponibles (máximo 3, discretas) */}
      {evaluation.signals.length > 0 && onSelectSignal ? (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-3">
          <span className="mr-1 inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
            <Sparkles className="size-3 text-primary" aria-hidden="true" />
            Oportunidades clave:
          </span>
          {evaluation.signals.map((sig) => (
            <button
              key={sig.id}
              type="button"
              onClick={() => onSelectSignal(sig)}
              className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/6 px-2.5 py-1 text-[11px] font-medium text-primary transition-colors hover:border-primary/50 hover:bg-primary/12"
            >
              <span>{sig.shortCue}</span>
            </button>
          ))}
        </div>
      ) : null}

      {/* Desglose por 6 dimensiones */}
      {expanded ? (
        <div className="mt-3 grid grid-cols-1 gap-2.5 border-t border-border/60 pt-3 sm:grid-cols-2 lg:grid-cols-3">
          {evaluation.dimensions.map((dim) => {
            const pct = Math.round((dim.score / Math.max(1, dim.maxScore)) * 100);
            return (
              <div
                key={dim.id}
                className="rounded-xl border border-border/60 bg-muted/25 p-2.5"
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-medium text-foreground">{dim.label}</span>
                  <span className="tabular-nums font-semibold text-muted-foreground">
                    {dim.score}/{dim.maxScore}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      pct >= 80
                        ? "bg-emerald-500"
                        : pct >= 50
                          ? "bg-primary"
                          : "bg-amber-500"
                    )}
                    style={{ width: `${Math.max(5, pct)}%` }}
                  />
                </div>
                <p className="mt-1 text-[10.5px] leading-snug text-muted-foreground">
                  {dim.hint}
                </p>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

"use client";

import * as React from "react";
import {
  Award,
  CalendarCheck,
  Lock,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { StudentMedal } from "@/features/estudiante/medals";

export interface StudentMedalsStripProps {
  medals: StudentMedal[];
}

const MEDAL_ICON_BY_ID: Record<string, typeof Award> = {
  "asistencia-ejemplar": CalendarCheck,
  "cuadro-honor": Award,
  "invicto-lapso": Sparkles,
  "avance-lapso": TrendingUp,
  "workspace-verificado": ShieldCheck,
};

/**
 * Franja de logros académicos reales calculados a partir de calificaciones,
 * asistencia y verificación institucional.
 */
export function StudentMedalsStrip({ medals }: StudentMedalsStripProps) {
  const unlockedCount = medals.filter((m) => m.unlocked).length;

  return (
    <section
      aria-label="Medallas de desempeño y puntualidad"
      className="siga-glass-surface rounded-[28px] border p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base leading-snug font-semibold tracking-[-0.02em] text-foreground">
            Medallas de Desempeño y Puntualidad
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Insignias desbloqueadas automáticamente según tu asistencia y
            rendimiento oficial del momento.
          </p>
        </div>

        <Badge variant="secondary" className="tabular-nums">
          {unlockedCount} / {medals.length} desbloqueadas
        </Badge>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {medals.map((medal) => {
          const Icon = MEDAL_ICON_BY_ID[medal.id] ?? Award;

          return (
            <Tooltip key={medal.id}>
              <TooltipTrigger asChild>
                <div
                  className={cn(
                    "siga-glass-inner flex flex-col justify-between gap-3 rounded-2xl border p-4 transition-colors",
                    medal.unlocked
                      ? "border-primary/35 bg-primary/8 dark:border-sky-400/35 dark:bg-sky-500/10"
                      : "opacity-85"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-xl border",
                        medal.unlocked
                          ? "siga-active-icon-glow border-transparent"
                          : "border-border bg-muted/60 text-muted-foreground"
                      )}
                    >
                      {medal.unlocked ? (
                        <Icon className="size-4" aria-hidden="true" />
                      ) : (
                        <Lock className="size-4" aria-hidden="true" />
                      )}
                    </span>

                    <Badge
                      variant={medal.unlocked ? "default" : "outline"}
                      className="text-[10px]"
                    >
                      {medal.unlocked ? "Obtenida" : "En progreso"}
                    </Badge>
                  </div>

                  <div>
                    <h3 className="text-xs font-semibold text-foreground">
                      {medal.title}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                      {medal.description}
                    </p>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-[10.5px] tabular-nums text-muted-foreground">
                      <span>Progreso</span>
                      <span className="font-medium text-foreground">
                        {medal.progressLabel}
                      </span>
                    </div>
                    <Progress
                      value={medal.progressPercent}
                      aria-label={`Progreso de medalla ${medal.title}: ${medal.progressPercent}%`}
                      className="h-1.5"
                    />
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-56">
                {medal.description}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </section>
  );
}

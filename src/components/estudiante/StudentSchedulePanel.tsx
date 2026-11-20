"use client";

import * as React from "react";
import {
  CalendarClock,
  Clock,
  Download,
  MapPin,
  Printer,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import type { StudentScheduleBlock } from "@/features/estudiante/dashboard-data";

export interface StudentSchedulePanelProps {
  scheduleBlocks: StudentScheduleBlock[];
  todayIso: string;
  sectionLabel: string;
  studentName: string;
  cedulaDisplay: string;
  schoolYearName: string | null;
  gradeYear?: number | null;
  mencionName?: string | null;
  sectionLetter?: string | null;
}

const SCHOOL_DAYS = [
  { day: 1, short: "Lun", label: "Lunes" },
  { day: 2, short: "Mar", label: "Martes" },
  { day: 3, short: "Mié", label: "Miércoles" },
  { day: 4, short: "Jue", label: "Jueves" },
  { day: 5, short: "Vie", label: "Viernes" },
] as const;

function resolveCaracasWeekdayNumber(todayIso: string): number {
  const [y, m, d] = todayIso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  const jsDay = dt.getUTCDay();
  // Lunes=1 .. Viernes=5; fin de semana muestra Lunes por defecto
  return jsDay >= 1 && jsDay <= 5 ? jsDay : 1;
}

/**
 * Visor de horario escolar fijo de la sección (Lunes a Viernes · 7:00 AM – 3:30 PM).
 */
export function StudentSchedulePanel({
  scheduleBlocks,
  todayIso,
  sectionLabel,
  studentName,
  cedulaDisplay,
  schoolYearName,
  gradeYear,
  mencionName,
  sectionLetter,
}: StudentSchedulePanelProps) {
  const activeWeekday = React.useMemo(
    () => resolveCaracasWeekdayNumber(todayIso),
    [todayIso]
  );
  const [selectedDay, setSelectedDay] = React.useState<number>(activeWeekday);
  const [exportingMode, setExportingMode] = React.useState<
    "print" | "download" | null
  >(null);
  const exportLockRef = React.useRef(false);

  const handleExportPdf = React.useCallback(
    async (mode: "print" | "download") => {
      if (exportLockRef.current || scheduleBlocks.length === 0) return;
      exportLockRef.current = true;
      setExportingMode(mode);

      try {
        const { exportStudentSchedulePdf } = await import(
          "@/components/pdf/StudentSchedulePdf"
        );
        const result = await exportStudentSchedulePdf(
          scheduleBlocks,
          {
            studentName,
            cedulaDisplay,
            sectionLabel,
            schoolYearName,
            gradeYear,
            mencionName,
            sectionLetter,
          },
          mode
        );
        if (mode === "print" && result.openedInTab) {
          toast.success("Horario institucional listo para imprimir en nueva pestaña.");
        } else {
          toast.success("Horario escolar descargado en PDF.");
        }
      } catch {
        toast.error(
          "No se pudo generar el PDF del horario en este momento. Intenta nuevamente."
        );
      } finally {
        setExportingMode(null);
        exportLockRef.current = false;
      }
    },
    [
      cedulaDisplay,
      gradeYear,
      mencionName,
      scheduleBlocks,
      schoolYearName,
      sectionLabel,
      sectionLetter,
      studentName,
    ]
  );

  const blocksByDay = React.useMemo(() => {
    const map = new Map<number, StudentScheduleBlock[]>();
    for (const dayObj of SCHOOL_DAYS) {
      map.set(dayObj.day, []);
    }
    for (const block of scheduleBlocks) {
      const bucket = map.get(block.dayOfWeek);
      if (bucket) {
        bucket.push(block);
      }
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    return map;
  }, [scheduleBlocks]);

  const mobileDayBlocks = blocksByDay.get(selectedDay) ?? [];

  return (
    <section
      aria-label="Horario escolar fijo de la sección"
      className="siga-glass-surface rounded-[28px] border p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base leading-snug font-semibold tracking-[-0.02em] text-foreground">
            Horario Escolar de Sección
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {sectionLabel} · Jornada diurna fija (Lunes a Viernes · 7:00 AM –
            3:30 PM).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="tabular-nums">
            {scheduleBlocks.length} bloque(s) semanal(es)
          </Badge>

          {scheduleBlocks.length > 0 ? (
            <>
              <Button
                type="button"
                size="sm"
                onClick={() => void handleExportPdf("print")}
                disabled={exportingMode !== null}
                className="rounded-xl text-xs"
              >
                {exportingMode === "print" ? (
                  <>
                    <Spinner data-icon="inline-start" />
                    Preparando PDF...
                  </>
                ) : (
                  <>
                    <Printer data-icon="inline-start" />
                    Imprimir horario
                  </>
                )}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void handleExportPdf("download")}
                disabled={exportingMode !== null}
                aria-label="Descargar horario en PDF"
                className="siga-glass-inner rounded-xl text-xs"
              >
                {exportingMode === "download" ? (
                  <>
                    <Spinner data-icon="inline-start" />
                    Descargando...
                  </>
                ) : (
                  <>
                    <Download data-icon="inline-start" />
                    PDF
                  </>
                )}
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {scheduleBlocks.length === 0 ? (
        <Empty className="siga-glass-inner mt-5 rounded-2xl border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CalendarClock aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle className="text-base">
              Horario escolar en preparación
            </EmptyTitle>
            <EmptyDescription>
              Tu sección aún no tiene bloques de horario asignados. En cuanto
              Control de Estudios o Coordinación publique la carga horaria,
              aparecerá aquí automáticamente.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          {/* Selector por día para móvil y tablet */}
          <div className="mt-4 flex flex-col gap-3 lg:hidden">
            <div
              role="tablist"
              aria-label="Seleccionar día de la semana"
              className="siga-glass-inner grid grid-cols-5 gap-1 rounded-2xl border p-1"
            >
              {SCHOOL_DAYS.map((d) => {
                const isSelected = selectedDay === d.day;
                const isToday = activeWeekday === d.day;
                return (
                  <button
                    key={d.day}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => setSelectedDay(d.day)}
                    className={cn(
                      "flex cursor-pointer flex-col items-center rounded-xl py-2 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none",
                      isSelected
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <span>{d.short}</span>
                    {isToday ? (
                      <span className="mt-0.5 text-[9px] opacity-80">Hoy</span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            {mobileDayBlocks.length === 0 ? (
              <div className="siga-glass-inner rounded-2xl border border-dashed p-4 text-center text-xs text-muted-foreground">
                Sin bloques asignados para el día{" "}
                {SCHOOL_DAYS.find((d) => d.day === selectedDay)?.label}.
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {mobileDayBlocks.map((block) => (
                  <ScheduleBlockCard key={block.id} block={block} />
                ))}
              </div>
            )}
          </div>

          {/* Grilla completa de 5 días para escritorio */}
          <div className="mt-5 hidden grid-cols-5 gap-3 lg:grid">
            {SCHOOL_DAYS.map((d) => {
              const dayBlocks = blocksByDay.get(d.day) ?? [];
              const isToday = activeWeekday === d.day;
              return (
                <div
                  key={d.day}
                  className={cn(
                    "siga-glass-inner flex flex-col gap-2.5 rounded-2xl border p-3",
                    isToday && "ring-1 ring-primary/45"
                  )}
                >
                  <div className="flex items-center justify-between border-b border-border/60 pb-2">
                    <span className="text-xs font-semibold text-foreground">
                      {d.label}
                    </span>
                    {isToday ? (
                      <Badge className="px-2 py-0 text-[10px]">Hoy</Badge>
                    ) : (
                      <span className="text-[11px] tabular-nums text-muted-foreground">
                        {dayBlocks.length} blq.
                      </span>
                    )}
                  </div>

                  {dayBlocks.length === 0 ? (
                    <p className="py-6 text-center text-[11px] text-muted-foreground">
                      Sin clases asignadas
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {dayBlocks.map((block) => (
                        <ScheduleBlockCard key={block.id} block={block} compact />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

function ScheduleBlockCard({
  block,
  compact = false,
}: {
  block: StudentScheduleBlock;
  compact?: boolean;
}) {
  return (
    <article
      className={cn(
        "rounded-xl border border-border/65 bg-background/70 transition-colors hover:border-primary/40",
        compact ? "p-2.5" : "p-3.5"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold tabular-nums text-primary dark:text-[#7dd3fc]">
          <Clock className="size-3" aria-hidden="true" />
          {block.startTime} – {block.endTime}
        </span>
        <Badge variant="outline" className="px-1.5 py-0 text-[9.5px]">
          {block.subjectCode}
        </Badge>
      </div>

      <h3 className="mt-1.5 text-xs leading-snug font-semibold text-foreground">
        {block.subjectName}
      </h3>

      <div className="mt-2 flex flex-col gap-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 truncate">
          <MapPin className="size-3 shrink-0" aria-hidden="true" />
          <span className="truncate">{block.roomLabel}</span>
        </span>
        <span className="inline-flex items-center gap-1.5 truncate">
          <UserCheck className="size-3 shrink-0" aria-hidden="true" />
          <span className="truncate">{block.teacherName}</span>
        </span>
      </div>
    </article>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Calendar,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
} from "lucide-react";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type {
  StudentCalendarEventItem,
  StudentCalendarEventSource,
} from "@/features/estudiante/dashboard-data";

export interface StudentFullCalendarDialogProps {
  events: StudentCalendarEventItem[];
  todayIso: string;
  schoolYearName: string | null;
  trigger?: React.ReactNode;
}

const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const WEEKDAY_HEADERS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const SOURCE_META: Record<
  StudentCalendarEventSource,
  { label: string; dotClass: string; badgeClass: string }
> = {
  evaluation: {
    label: "Evaluación",
    dotClass: "bg-primary dark:bg-sky-400",
    badgeClass: "bg-primary/12 text-primary dark:text-sky-300",
  },
  assignment: {
    label: "Aula Virtual",
    dotClass: "bg-cyan-500 dark:bg-cyan-300",
    badgeClass: "bg-cyan-500/14 text-cyan-700 dark:text-cyan-300",
  },
  pending_exam: {
    label: "Pendiente",
    dotClass: "bg-amber-500 dark:bg-amber-300",
    badgeClass: "bg-amber-500/14 text-amber-700 dark:text-amber-300",
  },
};

function parseIsoDateParts(iso: string): { year: number; month: number; day: number } {
  const [y, m, d] = iso.split("-").map(Number);
  return {
    year: Number.isFinite(y) ? y : 2026,
    month: Number.isFinite(m) ? m - 1 : 0,
    day: Number.isFinite(d) ? d : 1,
  };
}

function toIsoDate(year: number, monthIndex: number, day: number): string {
  const dt = new Date(Date.UTC(year, monthIndex, day));
  return dt.toISOString().slice(0, 10);
}

function formatFullSpanishDate(iso: string): string {
  const { year, month, day } = parseIsoDateParts(iso);
  const dt = new Date(Date.UTC(year, month, day, 12, 0, 0));
  return new Intl.DateTimeFormat("es-VE", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(dt);
}

function buildMonthGrid(year: number, monthIndex: number) {
  const firstOfMonth = new Date(Date.UTC(year, monthIndex, 1));
  const jsWeekday = firstOfMonth.getUTCDay();
  const leadingOffset = jsWeekday === 0 ? 6 : jsWeekday - 1;
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const totalCells = Math.ceil((leadingOffset + daysInMonth) / 7) * 7;

  return Array.from({ length: totalCells }, (_, idx) => {
    const dayOffset = idx - leadingOffset + 1;
    const cellDate = new Date(Date.UTC(year, monthIndex, dayOffset));
    const cellIso = cellDate.toISOString().slice(0, 10);
    return {
      iso: cellIso,
      dayNumber: cellDate.getUTCDate(),
      inCurrentMonth: cellDate.getUTCMonth() === monthIndex,
    };
  });
}

/**
 * Modal de Calendario Académico Mensual completo con evaluaciones programadas,
 * entregas del Aula Virtual y exámenes de materias pendientes.
 */
export function StudentFullCalendarDialog({
  events,
  todayIso,
  schoolYearName,
  trigger,
}: StudentFullCalendarDialogProps) {
  const todayParts = React.useMemo(() => parseIsoDateParts(todayIso), [todayIso]);
  const [open, setOpen] = React.useState(false);
  const [viewYear, setViewYear] = React.useState(todayParts.year);
  const [viewMonth, setViewMonth] = React.useState(todayParts.month);
  const [selectedIso, setSelectedIso] = React.useState(todayIso);

  const eventsByDate = React.useMemo(() => {
    const map = new Map<string, StudentCalendarEventItem[]>();
    for (const ev of events) {
      const list = map.get(ev.dateIso) ?? [];
      list.push(ev);
      map.set(ev.dateIso, list);
    }
    return map;
  }, [events]);

  const monthCells = React.useMemo(
    () => buildMonthGrid(viewYear, viewMonth),
    [viewMonth, viewYear]
  );

  const monthPrefix = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-`;
  const monthEventsCount = React.useMemo(
    () => events.filter((ev) => ev.dateIso.startsWith(monthPrefix)).length,
    [events, monthPrefix]
  );

  const selectedDayEvents = eventsByDate.get(selectedIso) ?? [];

  const nextUpcomingEvent = React.useMemo(
    () => events.find((ev) => ev.dateIso >= todayIso) ?? events[0] ?? null,
    [events, todayIso]
  );

  const handlePrevMonth = () => {
    const dt = new Date(Date.UTC(viewYear, viewMonth - 1, 1));
    setViewYear(dt.getUTCFullYear());
    setViewMonth(dt.getUTCMonth());
  };

  const handleNextMonth = () => {
    const dt = new Date(Date.UTC(viewYear, viewMonth + 1, 1));
    setViewYear(dt.getUTCFullYear());
    setViewMonth(dt.getUTCMonth());
  };

  const handleJumpToDate = (iso: string) => {
    const parts = parseIsoDateParts(iso);
    setViewYear(parts.year);
    setViewMonth(parts.month);
    setSelectedIso(iso);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      const targetIso = eventsByDate.has(todayIso)
        ? todayIso
        : (nextUpcomingEvent?.dateIso ?? todayIso);
      const parts = parseIsoDateParts(targetIso);
      setViewYear(parts.year);
      setViewMonth(parts.month);
      setSelectedIso(targetIso);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="siga-glass-inner w-full cursor-pointer rounded-xl text-xs"
          >
            <CalendarDays data-icon="inline-start" aria-hidden="true" />
            Ver calendario completo
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="font-hero max-h-[90vh] overflow-y-auto rounded-[28px] p-5 sm:max-w-4xl sm:p-6">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2 pr-8">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Calendar className="size-4.5 text-primary" aria-hidden="true" />
              Calendario Académico Completo
            </DialogTitle>
            {schoolYearName ? (
              <Badge variant="secondary" className="text-[11px]">
                {schoolYearName}
              </Badge>
            ) : null}
          </div>
          <DialogDescription className="text-xs">
            Consulta las fechas de tus evaluaciones programadas, entregas del
            Aula Virtual y exámenes de materias pendientes.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Columna izquierda: Grilla mensual navegable */}
          <div className="flex flex-col gap-3 lg:col-span-7">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border bg-muted/35 px-3 py-2">
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  size="icon-sm"
                  variant="outline"
                  onClick={handlePrevMonth}
                  aria-label="Mes anterior"
                  className="rounded-xl"
                >
                  <ChevronLeft className="size-4" aria-hidden="true" />
                </Button>
                <span className="min-w-36 text-center text-sm font-semibold text-foreground">
                  {MONTH_NAMES[viewMonth]} {viewYear}
                </span>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="outline"
                  onClick={handleNextMonth}
                  aria-label="Mes siguiente"
                  className="rounded-xl"
                >
                  <ChevronRight className="size-4" aria-hidden="true" />
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[11px] tabular-nums">
                  {monthEventsCount} en este mes
                </Badge>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => handleJumpToDate(todayIso)}
                  className="h-7 rounded-lg px-2.5 text-xs"
                >
                  Hoy
                </Button>
              </div>
            </div>

            {/* Cabecera Lunes–Domingo */}
            <div className="grid grid-cols-7 gap-1 text-center">
              {WEEKDAY_HEADERS.map((label) => (
                <span
                  key={label}
                  className="py-1 text-[11px] font-semibold text-muted-foreground"
                >
                  {label}
                </span>
              ))}
            </div>

            {/* Celdas del mes */}
            <div
              role="grid"
              aria-label={`Calendario de ${MONTH_NAMES[viewMonth]} ${viewYear}`}
              className="grid grid-cols-7 gap-1.5"
            >
              {monthCells.map((cell) => {
                const dayEvents = eventsByDate.get(cell.iso) ?? [];
                const isSelected = cell.iso === selectedIso;
                const isToday = cell.iso === todayIso;
                const sources = Array.from(
                  new Set(dayEvents.map((ev) => ev.source))
                );

                return (
                  <button
                    key={cell.iso}
                    type="button"
                    onClick={() => {
                      setSelectedIso(cell.iso);
                      if (!cell.inCurrentMonth) {
                        const parts = parseIsoDateParts(cell.iso);
                        setViewYear(parts.year);
                        setViewMonth(parts.month);
                      }
                    }}
                    aria-pressed={isSelected}
                    aria-current={isToday ? "date" : undefined}
                    aria-label={`${formatFullSpanishDate(cell.iso)}, ${dayEvents.length} asignación(es)`}
                    className={cn(
                      "flex min-h-14 cursor-pointer flex-col items-center justify-between rounded-xl border p-1.5 text-xs transition-all focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground shadow-xs"
                        : isToday
                          ? "border-primary/55 bg-primary/8 text-foreground"
                          : cell.inCurrentMonth
                            ? "border-border/65 bg-background/75 text-foreground hover:border-primary/40 hover:bg-muted/50"
                            : "border-transparent bg-muted/20 text-muted-foreground/60 hover:bg-muted/35"
                    )}
                  >
                    <span className="font-semibold tabular-nums">
                      {cell.dayNumber}
                    </span>

                    {dayEvents.length > 0 ? (
                      <span className="flex items-center gap-1">
                        {sources.slice(0, 3).map((src) => (
                          <span
                            key={src}
                            aria-hidden="true"
                            className={cn(
                              "size-1.5 rounded-full",
                              isSelected
                                ? "bg-primary-foreground"
                                : SOURCE_META[src].dotClass
                            )}
                          />
                        ))}
                        {dayEvents.length > 1 ? (
                          <span
                            className={cn(
                              "text-[9.5px] font-semibold tabular-nums",
                              isSelected
                                ? "text-primary-foreground/90"
                                : "text-muted-foreground"
                            )}
                          >
                            {dayEvents.length}
                          </span>
                        ) : null}
                      </span>
                    ) : (
                      <span className="h-2" aria-hidden="true" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Leyenda de fuentes */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-muted-foreground">
              <div className="flex flex-wrap items-center gap-3">
                {(
                  Object.keys(SOURCE_META) as StudentCalendarEventSource[]
                ).map((sourceKey) => (
                  <span key={sourceKey} className="inline-flex items-center gap-1.5">
                    <span
                      aria-hidden="true"
                      className={cn(
                        "size-2 rounded-full",
                        SOURCE_META[sourceKey].dotClass
                      )}
                    />
                    {SOURCE_META[sourceKey].label}
                  </span>
                ))}
              </div>
              <span className="tabular-nums">
                Total en el año: {events.length} asignación(es)
              </span>
            </div>
          </div>

          {/* Columna derecha: Detalle de asignaciones del día seleccionado */}
          <aside
            aria-label="Asignaciones del día seleccionado"
            className="flex flex-col gap-3 rounded-2xl border bg-muted/25 p-4 lg:col-span-5"
          >
            <div className="border-b border-border/60 pb-2.5">
              <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                Fecha seleccionada
              </p>
              <h3 className="mt-0.5 text-sm font-semibold capitalize text-foreground">
                {formatFullSpanishDate(selectedIso)}
              </h3>
            </div>

            {selectedDayEvents.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2.5 py-8 text-center">
                <span className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Clock className="size-4.5" aria-hidden="true" />
                </span>
                <p className="text-xs font-medium text-foreground">
                  Sin asignaciones para esta fecha
                </p>
                <p className="max-w-60 text-[11px] leading-relaxed text-muted-foreground">
                  {events.length === 0
                    ? "Cuando tus docentes publiquen evaluaciones o entregas con fecha, aparecerán aquí."
                    : "Selecciona cualquier día marcado con punto para revisar sus evaluaciones o entregas."}
                </p>
                {nextUpcomingEvent &&
                nextUpcomingEvent.dateIso !== selectedIso ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleJumpToDate(nextUpcomingEvent.dateIso)}
                    className="mt-1 rounded-xl text-xs"
                  >
                    Ir a próxima fecha ({nextUpcomingEvent.dateIso.slice(8, 10)}/
                    {nextUpcomingEvent.dateIso.slice(5, 7)})
                  </Button>
                ) : null}
              </div>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {selectedDayEvents.map((ev) => {
                  const meta = SOURCE_META[ev.source];
                  return (
                    <li
                      key={ev.id}
                      className="rounded-xl border bg-background/85 p-3 shadow-2xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge
                            variant="outline"
                            className="font-mono text-[10px]"
                          >
                            {ev.subjectCode}
                          </Badge>
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                              meta.badgeClass
                            )}
                          >
                            {meta.label}
                          </span>
                        </div>

                        {ev.weightPercent !== null ? (
                          <Badge
                            variant="secondary"
                            className="text-[10px] tabular-nums"
                          >
                            {ev.weightPercent}%
                          </Badge>
                        ) : ev.timeLabel ? (
                          <Badge
                            variant="secondary"
                            className="text-[10px] tabular-nums"
                          >
                            {ev.timeLabel}
                          </Badge>
                        ) : null}
                      </div>

                      <p className="mt-2 text-xs leading-snug font-semibold text-foreground">
                        {ev.title}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {ev.subjectName} · {ev.typeLabel}
                        {ev.momentNumber !== null && ev.source === "evaluation"
                          ? ` · Momento ${ev.momentNumber}`
                          : ""}
                      </p>

                      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border/50 pt-2">
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                          {ev.isCompleted ? (
                            <CheckCircle2
                              className="size-3.5 text-emerald-600 dark:text-emerald-400"
                              aria-hidden="true"
                            />
                          ) : (
                            <Clock
                              className="size-3.5 text-primary"
                              aria-hidden="true"
                            />
                          )}
                          {ev.statusLabel}
                        </span>

                        <Link
                          href={ev.href}
                          onClick={() => setOpen(false)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline dark:text-sky-300"
                        >
                          <span>Abrir</span>
                          <ArrowUpRight className="size-3" aria-hidden="true" />
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Re-export helper for unit testing date grid construction if needed
export { buildMonthGrid, toIsoDate };

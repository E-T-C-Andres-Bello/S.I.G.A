"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  Database,
  Eraser,
  ExternalLink,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import type { StudentSandboxState } from "@/features/estudiante/dev-sandbox";
import {
  manageQaStudentSyntheticDataAction,
  switchQaStudentContextAction,
  type SwitchStudentContextInput,
} from "@/features/estudiante/dev-sandbox-actions";

export interface StudentDevToolbarProps {
  initialState: StudentSandboxState;
}

const SECTION_LETTERS = ["A", "B", "C"] as const;
const GRADE_YEARS = [1, 2, 3, 4, 5, 6] as const;

/**
 * Barra flotante de pruebas QA exclusiva para la cuenta estudiantil de desarrollo
 * (`estudiante@etcandresbello.org`, fuera de producción). Permite alternar
 * mención, año cursante, sección, período escolar, momento y nivel de acceso.
 */
export function StudentDevToolbar({ initialState }: StudentDevToolbarProps) {
  const router = useRouter();
  const [state, setState] = React.useState<StudentSandboxState>(initialState);
  const [open, setOpen] = React.useState(false);
  const [busyLabel, setBusyLabel] = React.useState<string | null>(null);
  const [lastVerificationCode, setLastVerificationCode] = React.useState<
    string | null
  >(null);

  const actionLockRef = React.useRef(false);

  React.useEffect(() => {
    setState(initialState);
  }, [initialState]);

  const currentEnrollment = state.current_enrollment;
  const activeMomentNumber =
    state.momentos.find((m) => m.status === "open")?.moment_number ?? 1;

  const handleSwitch = React.useCallback(
    async (payload: SwitchStudentContextInput, label: string) => {
      if (actionLockRef.current) return;
      actionLockRef.current = true;
      setBusyLabel(label);

      try {
        const res = await switchQaStudentContextAction(payload);
        if (!res.ok) {
          toast.error(res.message);
          return;
        }
        setState(res.data);
        toast.success("Contexto académico QA actualizado.");
        router.refresh();
      } catch {
        toast.error("No se pudo aplicar el cambio de contexto QA.");
      } finally {
        setBusyLabel(null);
        actionLockRef.current = false;
      }
    },
    [router]
  );

  const handleSyntheticData = React.useCallback(
    async (action: "populate" | "clear") => {
      if (actionLockRef.current) return;
      actionLockRef.current = true;
      setBusyLabel(
        action === "populate" ? "Poblando datos..." : "Limpiando datos..."
      );

      try {
        const res = await manageQaStudentSyntheticDataAction(action);
        if (!res.ok) {
          toast.error(res.message);
          return;
        }
        setState(res.data.state);
        setLastVerificationCode(res.data.verificationCode);
        toast.success(
          action === "populate"
            ? "Datos sintéticos generados para el contexto actual."
            : "Datos sintéticos limpiados."
        );
        router.refresh();
      } catch {
        toast.error("No se pudo actualizar los datos sintéticos QA.");
      } finally {
        setBusyLabel(null);
        actionLockRef.current = false;
      }
    },
    [router]
  );

  const summaryBadge = currentEnrollment
    ? `${currentEnrollment.grade_year}.º · ${currentEnrollment.mencion_name} · ${currentEnrollment.section_letter}`
    : "Sin matrícula asignada";

  const isBusy = busyLabel !== null;

  return (
    <div
      aria-label="Barra de pruebas académicas QA"
      className="font-hero fixed bottom-4 left-1/2 z-40 flex max-w-[calc(100vw-1.5rem)] -translate-x-1/2 flex-col items-center gap-2"
    >
      {open ? (
        <div className="siga-glass-surface w-[min(92vw,420px)] rounded-[24px] border p-4 text-xs text-foreground shadow-2xl">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5">
                <Wrench className="size-3.5 text-primary" aria-hidden="true" />
                <p className="font-semibold text-foreground">
                  Selector QA · Entorno Estudiantil
                </p>
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Cuenta exclusiva de pruebas ({state.institutional_email})
              </p>
            </div>
            <Badge
              variant={
                state.access_tier === "verified_workspace"
                  ? "default"
                  : "secondary"
              }
              className="shrink-0 text-[10px]"
            >
              {state.access_tier === "verified_workspace"
                ? "Verificado"
                : "Provisional"}
            </Badge>
          </div>

          <Separator className="my-3" />

          {!state.available ? (
            <div className="space-y-3 rounded-xl border border-dashed p-3 text-muted-foreground">
              <p className="leading-relaxed">
                Los controles de pruebas en servidor aún no se encuentran
                habilitados en este entorno.
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => router.refresh()}
              >
                <RefreshCw data-icon="inline-start" />
                Recargar estado
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Mención y Año cursante */}
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="block text-[11px] font-medium text-muted-foreground">
                    Mención Técnica
                  </label>
                  <Select
                    value={currentEnrollment?.mencion_code ?? ""}
                    onValueChange={(value) =>
                      void handleSwitch(
                        { mencionCode: value },
                        "Cambiando mención..."
                      )
                    }
                    disabled={isBusy || state.menciones.length === 0}
                  >
                    <SelectTrigger className="h-8 w-full text-xs">
                      <SelectValue
                        placeholder={
                          state.menciones.length === 0
                            ? "Sin menciones cargadas"
                            : "Selecciona mención"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {state.menciones.map((m) => (
                        <SelectItem key={m.id} value={m.code} className="text-xs">
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-medium text-muted-foreground">
                    Año Cursante
                  </label>
                  <Select
                    value={
                      currentEnrollment?.grade_year
                        ? String(currentEnrollment.grade_year)
                        : ""
                    }
                    onValueChange={(value) =>
                      void handleSwitch(
                        { gradeYear: Number(value) },
                        "Cambiando año..."
                      )
                    }
                    disabled={isBusy || state.menciones.length === 0}
                  >
                    <SelectTrigger className="h-8 w-full text-xs">
                      <SelectValue placeholder="Año" />
                    </SelectTrigger>
                    <SelectContent>
                      {GRADE_YEARS.map((yr) => (
                        <SelectItem
                          key={yr}
                          value={String(yr)}
                          className="text-xs"
                        >
                          {yr}.º Año{yr === 6 ? " (Pasantías)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Sección y Período Escolar */}
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="block text-[11px] font-medium text-muted-foreground">
                    Sección
                  </label>
                  <Select
                    value={currentEnrollment?.section_letter ?? "A"}
                    onValueChange={(value) =>
                      void handleSwitch(
                        { sectionLetter: value },
                        "Cambiando sección..."
                      )
                    }
                    disabled={isBusy || state.menciones.length === 0}
                  >
                    <SelectTrigger className="h-8 w-full text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SECTION_LETTERS.map((letter) => (
                        <SelectItem
                          key={letter}
                          value={letter}
                          className="text-xs"
                        >
                          Sección {letter}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-medium text-muted-foreground">
                    Período Escolar
                  </label>
                  <Select
                    value={
                      state.school_years.find((sy) => sy.is_current)?.code ?? ""
                    }
                    onValueChange={(value) =>
                      void handleSwitch(
                        { schoolYearCode: value },
                        "Cambiando período..."
                      )
                    }
                    disabled={isBusy || state.school_years.length === 0}
                  >
                    <SelectTrigger className="h-8 w-full text-xs">
                      <SelectValue
                        placeholder={
                          state.school_years.length === 0
                            ? "Sin períodos"
                            : "Período"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {state.school_years.map((sy) => (
                        <SelectItem key={sy.id} value={sy.code} className="text-xs">
                          {sy.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Momento Pedagógico y Nivel de Acceso */}
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <div className="space-y-1">
                  <span className="block text-[11px] font-medium text-muted-foreground">
                    Momento Activo
                  </span>
                  <div className="grid grid-cols-3 gap-1">
                    {([1, 2, 3] as const).map((mom) => (
                      <Button
                        key={mom}
                        type="button"
                        size="sm"
                        variant={
                          activeMomentNumber === mom ? "default" : "outline"
                        }
                        onClick={() =>
                          void handleSwitch(
                            { activeMoment: mom },
                            `Abriendo Momento ${mom}...`
                          )
                        }
                        disabled={isBusy || state.school_years.length === 0}
                        className="h-7 px-2 text-[11px]"
                      >
                        {mom === 1 ? "I" : mom === 2 ? "II" : "III"} Mom.
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="block text-[11px] font-medium text-muted-foreground">
                    Nivel de Acceso
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      void handleSwitch(
                        {
                          accessTier:
                            state.access_tier === "verified_workspace"
                              ? "provisional_cedula"
                              : "verified_workspace",
                        },
                        "Cambiando nivel de acceso..."
                      )
                    }
                    disabled={isBusy}
                    className="h-7 w-full justify-start text-[11px]"
                  >
                    {state.access_tier === "verified_workspace" ? (
                      <>
                        <ShieldAlert
                          data-icon="inline-start"
                          aria-hidden="true"
                        />
                        Pasar a Provisional
                      </>
                    ) : (
                      <>
                        <ShieldCheck
                          data-icon="inline-start"
                          aria-hidden="true"
                        />
                        Restaurar Verificado
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Datos Sintéticos QA + Enlace directo al Verificador */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-muted-foreground">
                  <span>Datos sintéticos de prueba</span>
                  <span className="tabular-nums">
                    {state.stats.schedule_blocks} bloq · {state.stats.scores}{" "}
                    notas · {state.stats.official_documents} PDF
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void handleSyntheticData("populate")}
                    disabled={isBusy || !currentEnrollment}
                    className="h-8 flex-1 text-xs"
                  >
                    {busyLabel === "Poblando datos..." ? (
                      <Spinner data-icon="inline-start" />
                    ) : (
                      <Database data-icon="inline-start" aria-hidden="true" />
                    )}
                    Poblar datos
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void handleSyntheticData("clear")}
                    disabled={isBusy || !currentEnrollment}
                    className="h-8 text-xs"
                  >
                    {busyLabel === "Limpiando datos..." ? (
                      <Spinner data-icon="inline-start" />
                    ) : (
                      <Eraser data-icon="inline-start" aria-hidden="true" />
                    )}
                    Limpiar
                  </Button>
                </div>

                {lastVerificationCode ? (
                  <div className="flex items-center justify-between gap-2 rounded-xl border bg-background/60 px-2.5 py-1.5 text-[11px]">
                    <span className="truncate font-medium text-foreground">
                      Código generado: {lastVerificationCode}
                    </span>
                    <Link
                      href={`/verificar?code=${encodeURIComponent(lastVerificationCode)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex shrink-0 items-center gap-1 font-medium text-primary hover:underline"
                    >
                      Probar
                      <ExternalLink className="size-3" aria-hidden="true" />
                    </Link>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className={cn(
          "siga-glass-pill inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border px-3.5 text-xs font-medium text-foreground shadow-lg transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none",
          isBusy && "opacity-85"
        )}
      >
        {isBusy ? (
          <Spinner className="size-3.5 text-primary" />
        ) : (
          <Wrench className="size-3.5 text-primary" aria-hidden="true" />
        )}
        <span className="font-semibold">QA</span>
        <span className="hidden text-muted-foreground sm:inline">·</span>
        <span className="max-w-[200px] truncate text-[11.5px] text-muted-foreground sm:max-w-xs">
          {busyLabel ?? summaryBadge}
        </span>
        {open ? (
          <ChevronDown
            className="size-3.5 text-muted-foreground"
            aria-hidden="true"
          />
        ) : (
          <ChevronUp
            className="size-3.5 text-muted-foreground"
            aria-hidden="true"
          />
        )}
      </button>
    </div>
  );
}

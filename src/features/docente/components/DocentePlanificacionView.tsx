"use client";

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  AlertCircle,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileSpreadsheet,
  GraduationCap,
  Layers,
  Loader2,
  Plus,
  Save,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getEvaluationPlanAction,
  saveEvaluationPlanAction,
} from "../docente-actions";
import {
  EVALUATION_TYPE_LABELS,
  type EvaluationItemDto,
  type EvaluationType,
  type MomentoOption,
  type TeacherSectionAssignment,
} from "../types";

interface Props {
  assignments: TeacherSectionAssignment[];
  momentos: MomentoOption[];
  initialAssignmentId?: string;
  initialMomentoId?: string;
}

interface AiProposal {
  pedagogicalIntent: string;
  contents: string[];
  didacticStrategies: string[];
  suggestedItems: {
    title: string;
    evaluationType: EvaluationType;
    weightPercent: number;
    maxPoints: number;
    learningIndicator?: string;
  }[];
}

export function DocentePlanificacionView({
  assignments,
  momentos,
  initialAssignmentId,
  initialMomentoId,
}: Props) {
  const [selectedAssignmentId, setSelectedAssignmentId] = React.useState<string>(
    initialAssignmentId ?? assignments[0]?.assignmentId ?? ""
  );

  const [selectedMomentoId, setSelectedMomentoId] = React.useState<string>(
    initialMomentoId ?? momentos[0]?.id ?? ""
  );

  const [planTitle, setPlanTitle] = React.useState("");
  const [planStatus, setPlanStatus] = React.useState<"draft" | "published" | "locked">("draft");
  const [aiNotes, setAiNotes] = React.useState<string | null>(null);
  const [items, setItems] = React.useState<EvaluationItemDto[]>([]);
  const [loadingPlan, setLoadingPlan] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [feedback, setFeedback] = React.useState<{ type: "success" | "error"; text: string } | null>(null);

  // Modal de IA
  const [isAiModalOpen, setIsAiModalOpen] = React.useState(false);
  const [aiCustomTopic, setAiCustomTopic] = React.useState("");
  const [isAiLoading, setIsAiLoading] = React.useState(false);
  const [aiProposal, setAiProposal] = React.useState<AiProposal | null>(null);

  const currentAssignment = React.useMemo(
    () => assignments.find((a) => a.assignmentId === selectedAssignmentId),
    [assignments, selectedAssignmentId]
  );

  const currentMomento = React.useMemo(
    () => momentos.find((m) => m.id === selectedMomentoId),
    [momentos, selectedMomentoId]
  );

  // Cargar plan al cambiar de sección o momento
  React.useEffect(() => {
    if (!selectedAssignmentId || !selectedMomentoId) return;

    let active = true;
    setLoadingPlan(true);
    setFeedback(null);

    getEvaluationPlanAction(selectedAssignmentId, selectedMomentoId)
      .then((plan) => {
        if (!active) return;
        if (plan) {
          setPlanTitle(plan.title);
          setPlanStatus(plan.status);
          setAiNotes(plan.planningAiNotes);
          setItems(plan.items);
        } else {
          // Inicializar plantilla en blanco con título sugerido
          const mom = momentos.find((m) => m.id === selectedMomentoId);
          setPlanTitle(`Plan de Evaluación — ${mom?.name ?? "Momento Pedagógico"}`);
          setPlanStatus("draft");
          setAiNotes(null);
          setItems([
            {
              title: "Actividad Diagnóstica / Primera Evaluación",
              evaluationType: "classroom_activity",
              weightPercent: 25,
              maxPoints: 20,
              scheduledDate: null,
            },
            {
              title: "Taller Práctico / Guía de Ejercicios",
              evaluationType: "assignment_lms",
              weightPercent: 25,
              maxPoints: 20,
              scheduledDate: null,
            },
            {
              title: "Práctica de Especialidad / Laboratorio",
              evaluationType: "lab_mention",
              weightPercent: 25,
              maxPoints: 20,
              scheduledDate: null,
            },
            {
              title: "Prueba Objetiva o Examen Parcial",
              evaluationType: "exam_online",
              weightPercent: 25,
              maxPoints: 20,
              scheduledDate: null,
            },
          ]);
        }
      })
      .finally(() => {
        if (active) setLoadingPlan(false);
      });

    return () => {
      active = false;
    };
  }, [selectedAssignmentId, selectedMomentoId, momentos]);

  const totalWeight = React.useMemo(() => {
    return items.reduce((acc, item) => acc + (Number(item.weightPercent) || 0), 0);
  }, [items]);

  const isExact100 = Math.round(totalWeight) === 100;
  const isOver100 = totalWeight > 100;
  const isUnder100 = totalWeight < 100;

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        title: `Nueva Actividad Evaluativa #${prev.length + 1}`,
        evaluationType: "classroom_activity",
        weightPercent: Math.max(0, 100 - totalWeight),
        maxPoints: 20,
        scheduledDate: null,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateItem = (
    index: number,
    field: keyof EvaluationItemDto,
    value: string | number | null
  ) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index]!, [field]: value };
      return copy;
    });
  };

  const handleSave = async (publish: boolean) => {
    setSaving(true);
    setFeedback(null);

    const res = await saveEvaluationPlanAction({
      teacherAssignmentId: selectedAssignmentId,
      momentoId: selectedMomentoId,
      title: planTitle,
      status: publish ? "published" : "draft",
      planningAiNotes: aiNotes,
      items,
    });

    setSaving(false);
    if (res.success) {
      setPlanStatus(publish ? "published" : "draft");
      setFeedback({ type: "success", text: res.message });
    } else {
      setFeedback({ type: "error", text: res.message });
    }
  };

  // Solicitar sugerencia curricular a Gemini 2.5 Flash
  const handleGenerateAiPlan = async () => {
    if (!currentAssignment || !currentMomento) return;
    setIsAiLoading(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/ai/docente/planificacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectName: currentAssignment.subjectName,
          gradeYear: currentAssignment.gradeYear,
          mencion: currentAssignment.mencionName,
          momento: currentMomento.number,
          customTopic: aiCustomTopic.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "No se pudo obtener la sugerencia de IA.");
      }

      setAiProposal(data.proposal);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al conectar con el Asistente IA.";
      setFeedback({ type: "error", text: msg });
    } finally {
      setIsAiLoading(false);
    }
  };

  // Aplicar propuesta de IA al formulario activo
  const handleApplyAiProposal = () => {
    if (!aiProposal) return;

    const formattedItems: EvaluationItemDto[] = aiProposal.suggestedItems.map((s) => ({
      title: s.title,
      evaluationType: s.evaluationType,
      weightPercent: Number(s.weightPercent) || 20,
      maxPoints: Number(s.maxPoints) || 20,
      scheduledDate: null,
    }));

    setItems(formattedItems);
    setAiNotes(
      `Intención Pedagógica MPPE:\n${aiProposal.pedagogicalIntent}\n\nEstrategias:\n- ${aiProposal.didacticStrategies.join(
        "\n- "
      )}`
    );
    setIsAiModalOpen(false);
    setFeedback({
      type: "success",
      text: "¡Propuesta de planificación curricular MPPE aplicada! Revisa las fechas y guarda tus cambios.",
    });
  };

  if (assignments.length === 0) {
    return (
      <div className="siga-glass-surface rounded-[28px] border p-8 text-center">
        <GraduationCap className="mx-auto size-12 text-muted-foreground opacity-60" />
        <h2 className="mt-4 text-xl font-medium text-foreground">
          Sin asignaciones académicas vigentes
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Actualmente no tienes secciones ni asignaturas asignadas en el año escolar en curso.
          Consulta con Control de Estudios o la Coordinación de Mención.
        </p>
      </div>
    );
  }

  return (
    <div className="font-hero flex flex-col gap-6 pb-12">
      {/* Encabezado */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="siga-glass-pill inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium text-primary">
              <ClipboardCheck className="size-3.5" />
              Módulo 2.1 · Planificación MPPE
            </span>
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-medium",
                planStatus === "published"
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                  : planStatus === "locked"
                  ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                  : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
              )}
            >
              {planStatus === "published"
                ? "Plan Publicado"
                : planStatus === "locked"
                ? "Momento Cerrado"
                : "Borrador de Trabajo"}
            </span>
          </div>

          <h1 className="mt-2 text-2xl font-normal tracking-tight text-foreground sm:text-3xl">
            Planificación de Evaluaciones Ponderadas
          </h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Define las actividades del lapso asegurando el 100 % de ponderación obligatoria para el cálculo oficial de notas.
          </p>
        </div>

        {/* Acciones principales */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            className="siga-glass-surface rounded-full border px-4 text-xs font-medium text-primary hover:bg-primary/10"
            onClick={() => setIsAiModalOpen(true)}
          >
            <Sparkles className="size-3.5 text-sky-500" />
            Asistente IA Curricular
          </Button>

          <Button
            type="button"
            variant="outline"
            disabled={saving || loadingPlan || planStatus === "locked"}
            onClick={() => handleSave(false)}
            className="rounded-full px-4 text-xs font-medium"
          >
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            Guardar Borrador
          </Button>

          <Button
            type="button"
            disabled={!isExact100 || saving || loadingPlan || planStatus === "locked"}
            onClick={() => handleSave(true)}
            className="rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
            Publicar Plan Oficial (100 %)
          </Button>
        </div>
      </div>

      {/* Avisos y Feedback */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={cn(
              "flex items-center gap-3 rounded-2xl border p-4 text-xs font-medium sm:text-sm",
              feedback.type === "success"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                : "border-destructive/30 bg-destructive/10 text-destructive dark:text-rose-300"
            )}
          >
            {feedback.type === "success" ? (
              <CheckCircle2 className="size-4 shrink-0" />
            ) : (
              <AlertCircle className="size-4 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selectores de Sección y Momento */}
      <div className="siga-glass-surface grid grid-cols-1 gap-4 rounded-[24px] border p-5 sm:grid-cols-2 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <label className="block text-xs font-medium text-muted-foreground">
            Asignatura y Sección Asignada
          </label>
          <div className="mt-2">
            <Select
              value={selectedAssignmentId}
              onValueChange={(val) => setSelectedAssignmentId(val)}
            >
              <SelectTrigger className="w-full rounded-xl border bg-background/50">
                <SelectValue placeholder="Seleccionar asignatura asignada..." />
              </SelectTrigger>
              <SelectContent>
                {assignments.map((a) => (
                  <SelectItem key={a.assignmentId} value={a.assignmentId}>
                    <span className="font-medium text-foreground">{a.subjectName}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({a.sectionFullName})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="lg:col-span-4">
          <label className="block text-xs font-medium text-muted-foreground">
            Momento Pedagógico (Lapso)
          </label>
          <div className="mt-2">
            <Select
              value={selectedMomentoId}
              onValueChange={(val) => setSelectedMomentoId(val)}
            >
              <SelectTrigger className="w-full rounded-xl border bg-background/50">
                <SelectValue placeholder="Seleccionar momento..." />
              </SelectTrigger>
              <SelectContent>
                {momentos.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name} {m.status === "open" ? "(Ventana Abierta)" : `(${m.status})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Semáforo de Ponderación (MPPE 100 %) */}
      <div
        className={cn(
          "flex flex-col justify-between gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center",
          isExact100
            ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200"
            : isOver100
            ? "border-rose-500/35 bg-rose-500/10 text-rose-900 dark:text-rose-200"
            : "border-amber-500/35 bg-amber-500/10 text-amber-900 dark:text-amber-200"
        )}
      >
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-xl",
              isExact100
                ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-300"
                : isOver100
                ? "bg-rose-500/20 text-rose-600 dark:text-rose-300"
                : "bg-amber-500/20 text-amber-600 dark:text-amber-300"
            )}
          >
            {isExact100 ? (
              <CheckCircle2 className="size-5" />
            ) : (
              <AlertCircle className="size-5" />
            )}
          </span>
          <div>
            <p className="text-sm font-semibold">
              {isExact100
                ? "Ponderación Completa y Válida (100 %)"
                : isOver100
                ? `Exceso de Ponderación (+${(totalWeight - 100).toFixed(1)} %)`
                : `Ponderación Incompleta (Faltan ${(100 - totalWeight).toFixed(1)} %)`}
            </p>
            <p className="text-xs opacity-90">
              {isExact100
                ? "El plan cumple con la normativa de evaluación MPPE y puede ser publicado."
                : "Ajusta los porcentajes de cada actividad para alcanzar exactamente el 100 % requerido."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <span className="font-mono text-xl font-bold tracking-tight">
            {totalWeight.toFixed(1)} %
          </span>
          <span className="text-xs opacity-75">/ 100 %</span>
        </div>
      </div>

      {/* Editor del Plan */}
      <div className="siga-glass-surface rounded-[28px] border p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-4 border-b pb-4 sm:flex-row sm:items-center">
          <div className="w-full max-w-xl">
            <label className="block text-xs font-medium text-muted-foreground">
              Título del Plan de Evaluación
            </label>
            <input
              type="text"
              value={planTitle}
              onChange={(e) => setPlanTitle(e.target.value)}
              placeholder="Ej. Plan de Evaluación I Lapso — Redes y Enrutamiento"
              className="mt-1.5 w-full rounded-xl border border-input bg-background/60 px-3.5 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddItem}
            className="rounded-full border-dashed px-3 text-xs"
          >
            <Plus className="size-3.5" />
            Agregar Actividad
          </Button>
        </div>

        {/* Lista de Actividades Evaluativas */}
        {loadingPlan ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No hay actividades en este plan. Presiona &laquo;Agregar Actividad&raquo; o utiliza el Asistente IA Curricular.
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            {items.map((item, idx) => (
              <div
                key={item.id ?? idx}
                className="siga-glass-inner flex flex-col gap-3 rounded-2xl border p-4 transition-all lg:flex-row lg:items-center"
              >
                {/* Numerador y Título */}
                <div className="flex items-center gap-2.5 lg:w-5/12">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">
                    {idx + 1}
                  </span>
                  <input
                    type="text"
                    value={item.title}
                    onChange={(e) => handleUpdateItem(idx, "title", e.target.value)}
                    placeholder="Descripción de la actividad..."
                    className="w-full rounded-lg border border-input/60 bg-background/50 px-3 py-1.5 text-xs font-medium text-foreground outline-none focus:border-primary sm:text-sm"
                  />
                </div>

                {/* Tipo de Actividad */}
                <div className="lg:w-3/12">
                  <Select
                    value={item.evaluationType}
                    onValueChange={(val) =>
                      handleUpdateItem(idx, "evaluationType", val as EvaluationType)
                    }
                  >
                    <SelectTrigger className="w-full rounded-lg text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(EVALUATION_TYPE_LABELS).map(([k, label]) => (
                        <SelectItem key={k} value={k} className="text-xs">
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Ponderación (%) */}
                <div className="flex items-center gap-2 lg:w-2/12">
                  <label className="text-[11px] text-muted-foreground lg:hidden">
                    Ponderación:
                  </label>
                  <div className="relative w-full">
                    <input
                      type="number"
                      min={1}
                      max={100}
                      step={1}
                      value={item.weightPercent}
                      onChange={(e) =>
                        handleUpdateItem(idx, "weightPercent", Number(e.target.value))
                      }
                      className="w-full rounded-lg border border-input/60 bg-background/50 px-3 py-1.5 text-right text-xs font-semibold text-foreground outline-none focus:border-primary"
                    />
                    <span className="pointer-events-none absolute right-2.5 top-1.5 text-xs text-muted-foreground">
                      %
                    </span>
                  </div>
                </div>

                {/* Fecha Estimada */}
                <div className="flex items-center gap-2 lg:w-2/12">
                  <label className="text-[11px] text-muted-foreground lg:hidden">Fecha:</label>
                  <input
                    type="date"
                    value={item.scheduledDate ?? ""}
                    onChange={(e) =>
                      handleUpdateItem(idx, "scheduledDate", e.target.value || null)
                    }
                    className="w-full rounded-lg border border-input/60 bg-background/50 px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveItem(idx)}
                    className="size-8 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal / Dialog del Asistente IA Curricular MPPE */}
      <Dialog open={isAiModalOpen} onOpenChange={setIsAiModalOpen}>
        <DialogContent className="max-w-2xl rounded-[28px] border bg-background/95 backdrop-blur-xl p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-normal">
              <Sparkles className="size-5 text-sky-500" />
              Asistente de Planificación Académica MPPE
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Genera una propuesta estructurada de contenidos, estrategias e instrumentos evaluativos
              ponderados con Gemini 2.5 Flash adaptada a la especialidad técnica.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-3 space-y-4">
            <div className="siga-glass-inner rounded-xl border p-3 text-xs">
              <p className="text-muted-foreground">Contexto curricular:</p>
              <p className="mt-1 font-semibold text-foreground">
                {currentAssignment?.subjectName} · {currentAssignment?.sectionFullName} (
                {currentMomento?.name})
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground">
                Énfasis temático o contenido que deseas abarcar (opcional)
              </label>
              <input
                type="text"
                value={aiCustomTopic}
                onChange={(e) => setAiCustomTopic(e.target.value)}
                placeholder="Ej. Configuración de VLANs y direccionamiento IPv4 / Valoración aduanera CIF..."
                className="mt-1.5 w-full rounded-xl border border-input bg-background/60 px-3.5 py-2 text-xs text-foreground outline-none focus:border-primary"
              />
            </div>

            {isAiLoading && (
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-xs text-muted-foreground">
                <Loader2 className="size-6 animate-spin text-sky-500" />
                <p>Consultando lineamientos curriculares MPPE con Gemini 2.5 Flash...</p>
              </div>
            )}

            {aiProposal && !isAiLoading && (
              <div className="max-h-80 space-y-3 overflow-y-auto rounded-xl border p-4 text-xs">
                <div>
                  <h4 className="font-semibold text-primary">Propósito Formativo:</h4>
                  <p className="mt-0.5 text-muted-foreground">{aiProposal.pedagogicalIntent}</p>
                </div>

                <div>
                  <h4 className="font-semibold text-foreground">Contenidos Sugeridos:</h4>
                  <ul className="mt-1 list-disc pl-4 text-muted-foreground">
                    {aiProposal.contents.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold text-foreground">
                    Actividades Evaluativas Sugeridas (100 %):
                  </h4>
                  <div className="mt-2 space-y-1.5">
                    {aiProposal.suggestedItems.map((it, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded-lg bg-accent/40 p-2 text-xs"
                      >
                        <div>
                          <span className="font-medium text-foreground">{it.title}</span>
                          <span className="ml-2 text-[10px] text-muted-foreground">
                            ({EVALUATION_TYPE_LABELS[it.evaluationType] ?? it.evaluationType})
                          </span>
                        </div>
                        <span className="font-bold text-primary">{it.weightPercent} %</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="mt-4 gap-2">
            {!aiProposal ? (
              <Button
                type="button"
                disabled={isAiLoading}
                onClick={handleGenerateAiPlan}
                className="w-full rounded-full bg-sky-600 text-xs font-semibold text-white hover:bg-sky-500"
              >
                {isAiLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                Generar Propuesta Curricular
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGenerateAiPlan}
                  className="rounded-full text-xs"
                >
                  Regenerar
                </Button>
                <Button
                  type="button"
                  onClick={handleApplyAiProposal}
                  className="rounded-full bg-primary text-xs font-semibold text-primary-foreground"
                >
                  Aplicar Propuesta al Plan
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

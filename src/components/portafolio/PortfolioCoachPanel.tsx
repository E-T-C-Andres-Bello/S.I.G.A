"use client";

import * as React from "react";
import {
  Check,
  HelpCircle,
  Loader2,
  Plus,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";
import { cn } from "cn";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { SelectiveCoachSignal } from "@/features/portafolio/cv-scoring";
import type { PortfolioCoachResponsePayload } from "@/lib/validators/portfolio";

export interface CoachChatTurn {
  id: string;
  role: "user" | "assistant";
  content: string;
  whyItMatters?: string | null;
  guidingQuestions?: string[];
  suggestedText?: string | null;
  suggestedSkills?: string[];
  sectionKey: string;
}

export interface PortfolioCoachPanelProps {
  activeSignal: SelectiveCoachSignal | null;
  mencionName: string | null;
  gradeYear: number | null;
  remainingQuota: number;
  quotaLimit: number;
  onQuotaChange: (remaining: number) => void;
  onApplySuggestion: (sectionKey: string, text: string) => void;
  onAddSuggestedSkill: (skillName: string) => void;
  onClearSignal: () => void;
}

const STORAGE_KEY = "siga_portfolio_coach_history_v1";

export function PortfolioCoachPanel({
  activeSignal,
  mencionName,
  gradeYear,
  remainingQuota,
  quotaLimit,
  onQuotaChange,
  onApplySuggestion,
  onAddSuggestedSkill,
  onClearSignal,
}: PortfolioCoachPanelProps) {
  const [turns, setTurns] = React.useState<CoachChatTurn[]>([]);
  const [input, setInput] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [confirmClear, setConfirmClear] = React.useState(false);
  const [appliedTurnIds, setAppliedTurnIds] = React.useState<Record<string, boolean>>({});
  const lockRef = React.useRef(false);
  const endRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CoachChatTurn[];
        if (Array.isArray(parsed)) setTurns(parsed.slice(-24));
      }
    } catch {
      // ignore localStorage read errors
    }
  }, []);

  React.useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(turns.slice(-24)));
    } catch {
      // ignore localStorage write errors
    }
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [turns]);

  const sendMessage = async (rawMsg: string) => {
    const clean = rawMsg.trim();
    if (clean.length < 2 || lockRef.current) return;

    lockRef.current = true;
    setSending(true);
    setConfirmClear(false);

    const sectionKey = activeSignal?.sectionKey ?? "general";
    const userTurn: CoachChatTurn = {
      id: `u-${Date.now()}`,
      role: "user",
      content: clean,
      sectionKey,
    };

    const nextHistory = [...turns, userTurn].slice(-6).map((t) => ({
      role: t.role,
      content: t.content,
    }));

    setTurns((prev) => [...prev, userTurn]);
    setInput("");

    try {
      const response = await fetch("/api/estudiante/portafolio/ai-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "coach",
          sectionKey,
          focusItemTitle: activeSignal?.focusItemTitle ?? "",
          message: clean,
          mencionName: mencionName ?? "",
          gradeYear,
          currentBlockText: activeSignal?.currentBlockText ?? "",
          history: nextHistory,
        }),
      });

      const data = (await response.json()) as
        | PortfolioCoachResponsePayload
        | { ok: false; message?: string };

      if (!response.ok || !data.ok) {
        toast.error(
          (!data.ok && data.message) ||
            "No pudimos conectar con el Coach en este momento."
        );
        return;
      }

      if (typeof data.remainingQuota === "number") {
        onQuotaChange(data.remainingQuota);
      }

      const assistantTurn: CoachChatTurn = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: data.reply,
        whyItMatters: data.whyItMatters,
        guidingQuestions: data.guidingQuestions,
        suggestedText: data.suggestedText,
        suggestedSkills: data.suggestedSkills,
        sectionKey,
      };
      setTurns((prev) => [...prev, assistantTurn]);
    } catch {
      toast.error("Error de conexión al consultar al Coach de Portafolio.");
    } finally {
      setSending(false);
      lockRef.current = false;
    }
  };

  const handleClearHistory = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    setTurns([]);
    setConfirmClear(false);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    toast.success("Historial del Coach limpiado.");
  };

  return (
    <div className="flex flex-col rounded-2xl border border-border/80 bg-card shadow-xs">
      {/* Encabezado sobrio */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="size-4" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Coach Socrático de Portafolio
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Te guía con preguntas para que construyas un currículum auténtico.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10.5px] tabular-nums">
            {remainingQuota}/{quotaLimit} consultas/h
          </Badge>
          {turns.length > 0 ? (
            <Button
              type="button"
              variant={confirmClear ? "destructive" : "ghost"}
              size="sm"
              className="h-7 gap-1 px-2 text-[11px]"
              onClick={handleClearHistory}
            >
              <Trash2 className="size-3" aria-hidden="true" />
              {confirmClear ? "¿Confirmar?" : "Limpiar"}
            </Button>
          ) : null}
        </div>
      </div>

      {/* Foco activo cuando el estudiante hace clic en una flecha editorial */}
      {activeSignal ? (
        <div className="border-b border-indigo-200/70 bg-indigo-50/70 px-4 py-3 dark:border-indigo-900/50 dark:bg-indigo-950/30">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-indigo-950 dark:text-indigo-100">
                Enfoque activo: {activeSignal.shortCue}
              </p>
              <p className="text-[11.5px] leading-snug text-indigo-900/80 dark:text-indigo-200/80">
                {activeSignal.whyItMatters}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[11px] text-indigo-700 dark:text-indigo-300"
              onClick={onClearSignal}
            >
              Cambiar
            </Button>
          </div>

          <div className="mt-2.5 space-y-1.5">
            <p className="text-[10.5px] font-semibold tracking-wide text-indigo-700 uppercase dark:text-indigo-300">
              Preguntas para empezar a mejorarlo
            </p>
            <div className="flex flex-col gap-1.5">
              {activeSignal.guidingQuestions.map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() =>
                    setInput((prev) =>
                      prev ? prev : `Sobre "${q}": `
                    )
                  }
                  className="flex items-start gap-1.5 rounded-lg border border-indigo-200/80 bg-white/90 px-2.5 py-1.5 text-left text-[11.5px] text-slate-800 transition-colors hover:border-indigo-400 hover:bg-white dark:border-indigo-800 dark:bg-slate-900/80 dark:text-slate-100"
                >
                  <HelpCircle
                    className="mt-0.5 size-3.5 shrink-0 text-indigo-600 dark:text-indigo-400"
                    aria-hidden="true"
                  />
                  <span>{q}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* Conversación */}
      <div className="max-h-[340px] space-y-3 overflow-y-auto px-4 py-3">
        {turns.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 p-4 text-center">
            <p className="text-xs font-medium text-foreground">
              ¿Qué sección quieres pulir hoy?
            </p>
            <p className="mt-1 text-[11.5px] text-muted-foreground">
              Haz clic en cualquier señal discreta sobre tu hoja de vida o cuéntame
              qué hiciste en un proyecto para ayudarte a redactarlo con impacto real.
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-1.5">
              {[
                "Hazme 2 preguntas para mejorar mi resumen profesional",
                "¿Cómo describir mejor mi proyecto socioproductivo?",
                "¿Qué habilidades destacan más en mi mención?",
              ].map((starter) => (
                <Button
                  key={starter}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-auto py-1.5 text-[11px]"
                  disabled={sending}
                  onClick={() => void sendMessage(starter)}
                >
                  {starter}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          turns.map((turn) => (
            <div
              key={turn.id}
              className={cn(
                "flex flex-col gap-1.5",
                turn.role === "user" ? "items-end" : "items-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[92%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed",
                  turn.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "border border-border/70 bg-muted/40 text-foreground"
                )}
              >
                <p className="whitespace-pre-line">{turn.content}</p>

                {turn.whyItMatters ? (
                  <p className="mt-2 border-t border-border/50 pt-1.5 text-[11px] text-muted-foreground">
                    <strong className="text-foreground">Por qué importa:</strong>{" "}
                    {turn.whyItMatters}
                  </p>
                ) : null}

                {turn.guidingQuestions && turn.guidingQuestions.length > 0 ? (
                  <div className="mt-2 space-y-1">
                    {turn.guidingQuestions.map((q, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setInput(`Respondiendo a "${q}": `)}
                        className="block w-full rounded-lg border border-border/60 bg-background/80 px-2.5 py-1.5 text-left text-[11px] text-foreground transition-colors hover:border-primary/50"
                      >
                        • {q}
                      </button>
                    ))}
                  </div>
                ) : null}

                {turn.suggestedText ? (
                  <div className="mt-2.5 rounded-xl border border-primary/25 bg-background p-2.5">
                    <p className="text-[10.5px] font-semibold tracking-wide text-primary uppercase">
                      Propuesta construida contigo
                    </p>
                    <p className="mt-1 whitespace-pre-line text-xs text-foreground">
                      {turn.suggestedText}
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant={appliedTurnIds[turn.id] ? "secondary" : "default"}
                      className="mt-2 h-7 gap-1 text-[11px]"
                      onClick={() => {
                        onApplySuggestion(turn.sectionKey, turn.suggestedText ?? "");
                        setAppliedTurnIds((prev) => ({ ...prev, [turn.id]: true }));
                      }}
                    >
                      <Check className="size-3" aria-hidden="true" />
                      {appliedTurnIds[turn.id]
                        ? "Aplicado a tu borrador"
                        : "Aplicar a esta sección"}
                    </Button>
                  </div>
                ) : null}

                {turn.suggestedSkills && turn.suggestedSkills.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {turn.suggestedSkills.map((sk) => (
                      <button
                        key={sk}
                        type="button"
                        onClick={() => onAddSuggestedSkill(sk)}
                        className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[10.5px] font-medium text-foreground hover:border-primary/50"
                      >
                        <Plus className="size-2.5 text-primary" aria-hidden="true" />
                        {sk}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      {/* Entrada de respuesta */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void sendMessage(input);
        }}
        className="border-t border-border/70 p-3"
      >
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Responde con tus palabras qué hiciste o pregunta cómo mejorar una sección..."
            rows={2}
            maxLength={1000}
            className="min-h-[54px] resize-none text-xs"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendMessage(input);
              }
            }}
          />
          <Button
            type="submit"
            size="icon"
            disabled={sending || input.trim().length < 2}
            className="size-10 shrink-0"
            aria-label="Enviar al Coach IA"
          >
            {sending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="size-4" aria-hidden="true" />
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

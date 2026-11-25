"use client";

import * as React from "react";
import {
  Bot,
  FilePlus2,
  History,
  Send,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  hexToRgba,
  stripRichFormatting,
  type AnnouncementCategory,
  type AnnouncementThemePalette,
} from "@/lib/validators/bulletin";
import type {
  BulletinAiRequestMode,
  BulletinAiSuggestion,
} from "@/lib/validators/bulletin-ai";
import { BulletinRichText } from "./BulletinRichText";

export interface BulletinAiDraftSnapshot {
  title: string;
  shortNote: string;
  category: AnnouncementCategory;
  locationLabel: string;
  audienceLabel: string;
  body: string;
}

export interface BulletinAiAssistantChatProps {
  storageKey: string;
  draft: BulletinAiDraftSnapshot;
  palette: AnnouncementThemePalette;
  departmentLabel: string;
  isApplyingSuggestion: boolean;
  onApplySuggestion: (
    suggestion: BulletinAiSuggestion,
    scope: "full" | "body"
  ) => void;
}

interface ChatMessageItem {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
  suggestion?: BulletinAiSuggestion | null;
  isError?: boolean;
}

const MAX_STORED_MESSAGES = 30;

const QUICK_PROMPTS: ReadonlyArray<{
  id: string;
  label: string;
  mode: BulletinAiRequestMode;
  prompt: string;
}> = [
  {
    id: "draft",
    label: "Redactar comunicado",
    mode: "draft",
    prompt:
      "Redacta un borrador completo y atractivo para este comunicado con título corto, etiqueta y lista clara de indicaciones.",
  },
  {
    id: "formal",
    label: "Hacer más formal",
    mode: "improve",
    prompt:
      "Mejora la redacción del borrador actual con un tono institucional claro, cordial y bien estructurado.",
  },
  {
    id: "summarize",
    label: "Resumir claro",
    mode: "summarize",
    prompt:
      "Resume el comunicado actual para que los estudiantes lo lean en 15 segundos manteniendo lo más importante.",
  },
  {
    id: "headline",
    label: "Mejorar título",
    mode: "improve",
    prompt:
      "Propón un título más llamativo (máximo 80 caracteres) y una etiqueta corta (máximo 32 caracteres) para la tarjeta.",
  },
];

function formatMessageTime(iso?: string): string {
  if (!iso) return "";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  return new Intl.DateTimeFormat("es-VE", {
    timeZone: "America/Caracas",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(ms));
}

function readStoredChatHistory(storageKey: string): ChatMessageItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(
        (item): item is ChatMessageItem =>
          Boolean(item) &&
          typeof item === "object" &&
          typeof (item as ChatMessageItem).id === "string" &&
          ((item as ChatMessageItem).role === "user" ||
            (item as ChatMessageItem).role === "assistant") &&
          typeof (item as ChatMessageItem).content === "string"
      )
      .slice(-MAX_STORED_MESSAGES);
  } catch {
    return [];
  }
}

export function BulletinAiAssistantChat({
  storageKey,
  draft,
  palette,
  departmentLabel,
  isApplyingSuggestion,
  onApplySuggestion,
}: BulletinAiAssistantChatProps) {
  const [messages, setMessages] = React.useState<ChatMessageItem[]>([]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [remainingQuota, setRemainingQuota] = React.useState<number | null>(
    null
  );
  const [limitPerHour, setLimitPerHour] = React.useState<number>(25);
  const [confirmClearHistory, setConfirmClearHistory] = React.useState(false);

  const sendLockRef = React.useRef(false);
  const hydratedKeyRef = React.useRef<string | null>(null);
  const clearConfirmTimerRef = React.useRef<number | null>(null);
  const scrollEndRef = React.useRef<HTMLDivElement | null>(null);

  // Cargar historial persistente del chat por usuario y comunicado
  React.useEffect(() => {
    const restored = readStoredChatHistory(storageKey);
    hydratedKeyRef.current = storageKey;
    setMessages(restored);
    setConfirmClearHistory(false);
  }, [storageKey]);

  // Guardar historial automáticamente cuando cambia la conversación
  React.useEffect(() => {
    if (typeof window === "undefined" || hydratedKeyRef.current !== storageKey) {
      return;
    }
    try {
      if (messages.length === 0) {
        window.localStorage.removeItem(storageKey);
      } else {
        window.localStorage.setItem(
          storageKey,
          JSON.stringify(messages.slice(-MAX_STORED_MESSAGES))
        );
      }
    } catch {
      // Ignorar si almacenamiento local está restringido o lleno
    }
  }, [messages, storageKey]);

  React.useEffect(() => {
    return () => {
      if (clearConfirmTimerRef.current !== null) {
        window.clearTimeout(clearConfirmTimerRef.current);
      }
    };
  }, []);

  React.useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, loading]);

  const handleClearHistory = () => {
    if (messages.length === 0) return;

    if (!confirmClearHistory) {
      setConfirmClearHistory(true);
      if (clearConfirmTimerRef.current !== null) {
        window.clearTimeout(clearConfirmTimerRef.current);
      }
      clearConfirmTimerRef.current = window.setTimeout(() => {
        setConfirmClearHistory(false);
      }, 4500);
      return;
    }

    if (clearConfirmTimerRef.current !== null) {
      window.clearTimeout(clearConfirmTimerRef.current);
      clearConfirmTimerRef.current = null;
    }
    setConfirmClearHistory(false);
    setMessages([]);
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // Ignorar si almacenamiento local está restringido
    }
    toast.success("Historial del chat borrado.");
  };

  const sendMessage = async (
    rawPrompt: string,
    mode: BulletinAiRequestMode = "chat"
  ) => {
    const cleanPrompt = rawPrompt.trim();
    if (!cleanPrompt || sendLockRef.current || loading) return;

    sendLockRef.current = true;
    setLoading(true);
    setInput("");
    setConfirmClearHistory(false);

    const nowIso = new Date().toISOString();
    const userMsg: ChatMessageItem = {
      id: `u-${Date.now()}`,
      role: "user",
      content: cleanPrompt,
      createdAt: nowIso,
    };

    const historyForRequest = messages
      .filter((m) => !m.isError)
      .slice(-6)
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, userMsg].slice(-MAX_STORED_MESSAGES));

    try {
      const res = await fetch("/api/cartelera/ai-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: cleanPrompt,
          mode,
          history: historyForRequest,
          draft,
        }),
      });

      const json = (await res.json()) as {
        ok?: boolean;
        reply?: string;
        suggestion?: BulletinAiSuggestion | null;
        message?: string;
        remaining?: number;
        limitPerHour?: number;
      };

      if (typeof json.remaining === "number") {
        setRemainingQuota(json.remaining);
      }
      if (typeof json.limitPerHour === "number") {
        setLimitPerHour(json.limitPerHour);
      }

      if (!res.ok || !json.ok || !json.reply) {
        const errText =
          json.message ??
          "El asistente de redacción no está disponible en este momento.";
        setMessages((prev) =>
          [
            ...prev,
            {
              id: `e-${Date.now()}`,
              role: "assistant" as const,
              content: errText,
              createdAt: new Date().toISOString(),
              isError: true,
            },
          ].slice(-MAX_STORED_MESSAGES)
        );
        if (res.status === 429) {
          toast.warning(errText);
        }
        return;
      }

      setMessages((prev) =>
        [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: "assistant" as const,
            content: json.reply!,
            createdAt: new Date().toISOString(),
            suggestion: json.suggestion ?? null,
          },
        ].slice(-MAX_STORED_MESSAGES)
      );
    } catch {
      setMessages((prev) =>
        [
          ...prev,
          {
            id: `e-${Date.now()}`,
            role: "assistant" as const,
            content:
              "No fue posible conectar con el asistente. Verifica tu conexión e inténtalo nuevamente.",
            createdAt: new Date().toISOString(),
            isError: true,
          },
        ].slice(-MAX_STORED_MESSAGES)
      );
    } finally {
      setLoading(false);
      sendLockRef.current = false;
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void sendMessage(input, "chat");
  };

  return (
    <section
      aria-label="Asistente IA para redactar comunicados"
      className="siga-glass-surface overflow-hidden rounded-[28px] border"
    >
      {/* Cabecera del asistente */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-5 py-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="grid size-8 shrink-0 place-items-center rounded-xl text-white shadow-xs transition-colors duration-500"
            style={{ background: palette.primary }}
          >
            <Sparkles className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-xs font-semibold text-foreground">
              Asistente de Redacción IA
            </h2>
            <p className="truncate text-[10.5px] text-muted-foreground">
              Apoyo para {departmentLabel} · Historial guardado localmente
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {messages.length > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-muted/40 px-2 py-0.5 text-[10.5px] font-medium tabular-nums text-muted-foreground">
              <History className="size-3" aria-hidden="true" />
              {messages.length}
            </span>
          ) : null}
          {remainingQuota !== null ? (
            <span className="rounded-full border border-border/70 bg-muted/40 px-2.5 py-0.5 text-[10.5px] font-medium tabular-nums text-muted-foreground">
              {remainingQuota}/{limitPerHour} h
            </span>
          ) : null}
          {messages.length > 0 ? (
            <Button
              type="button"
              variant={confirmClearHistory ? "destructive" : "ghost"}
              size="sm"
              className="h-7 rounded-full px-2.5 text-[11px]"
              title="Borrar historial del chat"
              aria-label="Borrar historial del chat del asistente"
              onClick={handleClearHistory}
            >
              <Trash2 className="mr-1 size-3" aria-hidden="true" />
              <span>
                {confirmClearHistory ? "Confirmar" : "Borrar historial"}
              </span>
            </Button>
          ) : null}
        </div>
      </div>

      {/* Chips de acciones rápidas */}
      <div className="flex flex-wrap gap-1.5 border-b border-border/50 bg-muted/20 px-4 py-2.5">
        {QUICK_PROMPTS.map((chip) => (
          <button
            key={chip.id}
            type="button"
            disabled={loading || isApplyingSuggestion}
            onClick={() => void sendMessage(chip.prompt, chip.mode)}
            className="cursor-pointer rounded-full border border-border/70 bg-background/80 px-2.5 py-1 text-[11px] font-medium text-foreground/85 transition-colors hover:border-primary/45 hover:bg-primary/8 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Hilo conversacional */}
      <div className="flex max-h-[300px] min-h-[168px] flex-col gap-3 overflow-y-auto px-4 py-3.5">
        {messages.length === 0 ? (
          <div className="my-auto flex flex-col items-center justify-center py-4 text-center">
            <span
              className="grid size-10 place-items-center rounded-2xl border"
              style={{
                background: hexToRgba(palette.primary, 0.1),
                borderColor: hexToRgba(palette.primary, 0.25),
                color: palette.primary,
              }}
            >
              <Bot className="size-5" aria-hidden="true" />
            </span>
            <p className="mt-2.5 text-xs font-semibold text-foreground">
              Cuéntame qué comunicado quieres preparar
            </p>
            <p className="mt-1 max-w-xs text-[11px] leading-relaxed text-muted-foreground">
              Por ejemplo: &ldquo;Avisa a 6.º año que el jueves a las 9 AM es la
              charla de pasantías en el Patio Central&rdquo;.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const msgTime = formatMessageTime(msg.createdAt);
            return (
              <div
                key={msg.id}
                className={cn(
                  "flex flex-col gap-1.5",
                  msg.role === "user" ? "items-end" : "items-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[90%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed",
                    msg.role === "user"
                      ? "rounded-br-sm text-white"
                      : msg.isError
                        ? "rounded-bl-sm border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-200"
                        : "siga-glass-inner rounded-bl-sm border text-foreground"
                  )}
                  style={
                    msg.role === "user"
                      ? { background: palette.primary }
                      : undefined
                  }
                >
                  {msg.role === "assistant" && !msg.isError ? (
                    <BulletinRichText
                      content={msg.content}
                      accentColor={palette.primary}
                      className="space-y-1.5 [&_p]:text-xs"
                    />
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>

                {msgTime ? (
                  <span className="px-1 text-[10px] text-muted-foreground/75 tabular-nums">
                    {msgTime}
                  </span>
                ) : null}

                {/* Tarjeta de propuesta estructurada con botones de control humano */}
                {msg.suggestion ? (
                  <div
                    className="w-full rounded-2xl border p-3.5 shadow-xs"
                    style={{
                      background: hexToRgba(palette.primary, 0.06),
                      borderColor: hexToRgba(palette.primary, 0.28),
                    }}
                  >
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
                      <Wand2
                        className="size-3.5"
                        style={{ color: palette.primary }}
                        aria-hidden="true"
                      />
                      <span>Propuesta lista para tu hoja</span>
                    </div>

                    {msg.suggestion.title ? (
                      <p className="mt-1.5 text-xs font-semibold text-foreground">
                        {msg.suggestion.title}
                      </p>
                    ) : null}

                    {msg.suggestion.shortNote ? (
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        Etiqueta: {msg.suggestion.shortNote}
                      </p>
                    ) : null}

                    {msg.suggestion.body ? (
                      <p className="mt-1.5 line-clamp-3 text-[11px] leading-relaxed text-muted-foreground">
                        {stripRichFormatting(msg.suggestion.body)}
                      </p>
                    ) : null}

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={isApplyingSuggestion}
                        onClick={() => onApplySuggestion(msg.suggestion!, "full")}
                        className="h-8 rounded-full px-3.5 text-[11.5px]"
                        style={{ background: palette.primary, color: "#ffffff" }}
                      >
                        <Sparkles className="mr-1.5 size-3.5" aria-hidden="true" />
                        <span>Aplicar a la hoja</span>
                      </Button>

                      {msg.suggestion.body ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isApplyingSuggestion}
                          onClick={() =>
                            onApplySuggestion(msg.suggestion!, "body")
                          }
                          className="h-8 rounded-full px-3 text-[11.5px]"
                        >
                          <FilePlus2
                            className="mr-1.5 size-3.5"
                            aria-hidden="true"
                          />
                          <span>Solo el cuerpo</span>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })
        )}

        {loading ? (
          <div className="siga-glass-inner flex w-fit items-center gap-2 rounded-2xl rounded-bl-sm border px-3.5 py-2 text-xs text-muted-foreground">
            <Spinner className="size-3.5" />
            <span>Preparando propuesta editorial...</span>
          </div>
        ) : null}
        <div ref={scrollEndRef} />
      </div>

      {/* Entrada del chat */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 border-t border-border/60 bg-muted/20 p-3"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value.slice(0, 1200))}
          placeholder="Pide una idea, mejora de tono o resumen..."
          aria-label="Instrucción para el asistente de redacción"
          disabled={loading}
          className="h-9 min-w-0 flex-1 rounded-full border border-border/70 bg-background px-3.5 text-xs text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-primary"
        />
        <Button
          type="submit"
          size="icon"
          disabled={loading || input.trim().length < 2}
          aria-label="Enviar consulta al asistente"
          className="size-9 shrink-0 rounded-full"
          style={{ background: palette.primary, color: "#ffffff" }}
        >
          <Send className="size-3.5" aria-hidden="true" />
        </Button>
      </form>
    </section>
  );
}

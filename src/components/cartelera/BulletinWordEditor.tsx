"use client";

import * as React from "react";
import {
  Bold,
  Eraser,
  Heading2,
  Heading3,
  Highlighter,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Underline,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface BulletinWordEditorProps {
  value: string;
  onChange: (nextValue: string) => void;
  maxLength?: number;
  placeholder?: string;
}

interface RibbonToolButtonProps {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}

function RibbonToolButton({
  title,
  onClick,
  disabled = false,
  children,
}: RibbonToolButtonProps) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex size-8 cursor-pointer items-center justify-center rounded-lg text-foreground/80 transition-colors hover:bg-primary/12 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40 dark:hover:text-sky-300"
      )}
    >
      {children}
    </button>
  );
}

/**
 * Editor de comunicados tipo Word súper sencillo y 100 % seguro contra XSS.
 * Aplica formato estructurado limpio (`##`, `**`, `*`, `__`, `==`, listas, citas, enlaces HTTPS)
 * sin exigir al profesor conocer ninguna sintaxis técnica ni almacenar HTML crudo.
 */
export function BulletinWordEditor({
  value,
  onChange,
  maxLength = 4000,
  placeholder = "Escribe aquí el cuerpo de tu comunicado escolar...",
}: BulletinWordEditorProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const [undoStack, setUndoStack] = React.useState<string[]>([]);
  const [redoStack, setRedoStack] = React.useState<string[]>([]);

  const [linkBarOpen, setLinkBarOpen] = React.useState(false);
  const [linkLabel, setLinkLabel] = React.useState("");
  const [linkUrl, setLinkUrl] = React.useState("https://");

  const commitChange = React.useCallback(
    (nextValue: string, selectionStart?: number, selectionEnd?: number) => {
      const bounded = nextValue.slice(0, maxLength);
      setUndoStack((prev) => [...prev.slice(-24), value]);
      setRedoStack([]);
      onChange(bounded);

      if (
        typeof selectionStart === "number" &&
        typeof selectionEnd === "number"
      ) {
        requestAnimationFrame(() => {
          const el = textareaRef.current;
          if (!el) return;
          el.focus();
          el.setSelectionRange(selectionStart, selectionEnd);
        });
      }
    },
    [maxLength, onChange, value]
  );

  const wrapSelection = React.useCallback(
    (prefix: string, suffix: string, fallbackText: string) => {
      const el = textareaRef.current;
      const start = el?.selectionStart ?? value.length;
      const end = el?.selectionEnd ?? value.length;
      const selected = value.slice(start, end) || fallbackText;
      const inserted = `${prefix}${selected}${suffix}`;
      const next = value.slice(0, start) + inserted + value.slice(end);
      commitChange(
        next,
        start + prefix.length,
        start + prefix.length + selected.length
      );
    },
    [commitChange, value]
  );

  const prefixLines = React.useCallback(
    (linePrefix: string, fallbackText: string, numbered = false) => {
      const el = textareaRef.current;
      const start = el?.selectionStart ?? value.length;
      const end = el?.selectionEnd ?? value.length;

      // Expandir al inicio de la línea actual
      const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
      const selected = value.slice(lineStart, end);

      if (!selected.trim()) {
        const prefix = numbered ? "1. " : linePrefix;
        const needsLeadingBreak =
          lineStart > 0 && value[lineStart - 1] !== "\n" ? "\n" : "";
        const inserted = `${needsLeadingBreak}${prefix}${fallbackText}`;
        const next =
          value.slice(0, start) + inserted + value.slice(end);
        const selStart = start + needsLeadingBreak.length + prefix.length;
        commitChange(next, selStart, selStart + fallbackText.length);
        return;
      }

      const formatted = selected
        .split("\n")
        .map((line, idx) => {
          const clean = line.replace(/^(#{1,3}\s+|>\s+|[-*]\s+|\d+\.\s+)/, "");
          if (!clean.trim()) return line;
          return `${numbered ? `${idx + 1}. ` : linePrefix}${clean}`;
        })
        .join("\n");

      const next = value.slice(0, lineStart) + formatted + value.slice(end);
      commitChange(next, lineStart, lineStart + formatted.length);
    },
    [commitChange, value]
  );

  const insertDivider = React.useCallback(() => {
    const el = textareaRef.current;
    const pos = el?.selectionEnd ?? value.length;
    const snippet = "\n\n---\n\n";
    const next = value.slice(0, pos) + snippet + value.slice(pos);
    commitChange(next, pos + snippet.length, pos + snippet.length);
  }, [commitChange, value]);

  const handleInsertLink = () => {
    const cleanUrl = linkUrl.trim();
    if (!cleanUrl.startsWith("https://") || cleanUrl.length < 12) {
      toast.error("Ingresa un enlace seguro que comience con https://");
      return;
    }
    const cleanLabel = linkLabel.trim() || "Ver enlace";
    const el = textareaRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const snippet = `[${cleanLabel}](${cleanUrl})`;
    const next = value.slice(0, start) + snippet + value.slice(end);
    commitChange(next, start + snippet.length, start + snippet.length);
    setLinkBarOpen(false);
    setLinkLabel("");
    setLinkUrl("https://");
  };

  const handleUndo = () => {
    const prev = undoStack[undoStack.length - 1];
    if (prev === undefined) return;
    setUndoStack((s) => s.slice(0, -1));
    setRedoStack((s) => [...s.slice(-24), value]);
    onChange(prev);
  };

  const handleRedo = () => {
    const next = redoStack[redoStack.length - 1];
    if (next === undefined) return;
    setRedoStack((s) => s.slice(0, -1));
    setUndoStack((s) => [...s.slice(-24), value]);
    onChange(next);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const key = e.key.toLowerCase();
    if (key === "b") {
      e.preventDefault();
      wrapSelection("**", "**", "texto destacado");
    } else if (key === "i") {
      e.preventDefault();
      wrapSelection("*", "*", "texto en cursiva");
    } else if (key === "u") {
      e.preventDefault();
      wrapSelection("__", "__", "texto subrayado");
    }
  };

  const wordCount = React.useMemo(() => {
    const clean = value.trim();
    return clean ? clean.split(/\s+/).length : 0;
  }, [value]);

  return (
    <div className="overflow-hidden rounded-2xl border border-border/80 bg-background/85 shadow-xs">
      {/* Cinta de herramientas tipo Word */}
      <div
        role="toolbar"
        aria-label="Herramientas de formato del comunicado"
        className="flex flex-wrap items-center gap-1 border-b border-border/70 bg-muted/35 px-2.5 py-2"
      >
        <RibbonToolButton
          title="Subtítulo principal"
          onClick={() => prefixLines("## ", "Subtítulo del comunicado")}
        >
          <Heading2 className="size-4" aria-hidden="true" />
        </RibbonToolButton>
        <RibbonToolButton
          title="Sección secundaria"
          onClick={() => prefixLines("### ", "Sección")}
        >
          <Heading3 className="size-4" aria-hidden="true" />
        </RibbonToolButton>

        <span className="mx-1 h-5 w-px bg-border/80" aria-hidden="true" />

        <RibbonToolButton
          title="Negrita (Ctrl+B)"
          onClick={() => wrapSelection("**", "**", "texto importante")}
        >
          <Bold className="size-4" aria-hidden="true" />
        </RibbonToolButton>
        <RibbonToolButton
          title="Cursiva (Ctrl+I)"
          onClick={() => wrapSelection("*", "*", "énfasis")}
        >
          <Italic className="size-4" aria-hidden="true" />
        </RibbonToolButton>
        <RibbonToolButton
          title="Subrayado (Ctrl+U)"
          onClick={() => wrapSelection("__", "__", "detalle clave")}
        >
          <Underline className="size-4" aria-hidden="true" />
        </RibbonToolButton>
        <RibbonToolButton
          title="Resaltar información clave"
          onClick={() => wrapSelection("==", "==", "fecha o dato clave")}
        >
          <Highlighter className="size-4" aria-hidden="true" />
        </RibbonToolButton>

        <span className="mx-1 h-5 w-px bg-border/80" aria-hidden="true" />

        <RibbonToolButton
          title="Lista con viñetas"
          onClick={() => prefixLines("- ", "Primer punto")}
        >
          <List className="size-4" aria-hidden="true" />
        </RibbonToolButton>
        <RibbonToolButton
          title="Lista numerada"
          onClick={() => prefixLines("1. ", "Primer paso", true)}
        >
          <ListOrdered className="size-4" aria-hidden="true" />
        </RibbonToolButton>
        <RibbonToolButton
          title="Aviso o cita destacada"
          onClick={() => prefixLines("> ", "Nota importante para recordar.")}
        >
          <Quote className="size-4" aria-hidden="true" />
        </RibbonToolButton>
        <RibbonToolButton
          title="Línea separadora"
          onClick={insertDivider}
        >
          <Minus className="size-4" aria-hidden="true" />
        </RibbonToolButton>

        <span className="mx-1 h-5 w-px bg-border/80" aria-hidden="true" />

        <RibbonToolButton
          title="Insertar enlace seguro"
          onClick={() => {
            const el = textareaRef.current;
            if (el) {
              const sel = value.slice(el.selectionStart, el.selectionEnd).trim();
              if (sel) setLinkLabel(sel);
            }
            setLinkBarOpen((prev) => !prev);
          }}
        >
          <Link2 className="size-4" aria-hidden="true" />
        </RibbonToolButton>

        <div className="ml-auto flex items-center gap-0.5">
          <RibbonToolButton
            title="Vaciar texto del cuerpo (se puede deshacer)"
            disabled={value.length === 0}
            onClick={() => {
              commitChange("", 0, 0);
              toast.info("Texto borrado. Pulsa Deshacer si quieres recuperarlo.");
            }}
          >
            <Eraser className="size-4" aria-hidden="true" />
          </RibbonToolButton>
          <span className="mx-1 h-5 w-px bg-border/80" aria-hidden="true" />
          <RibbonToolButton
            title="Deshacer"
            disabled={undoStack.length === 0}
            onClick={handleUndo}
          >
            <Undo2 className="size-4" aria-hidden="true" />
          </RibbonToolButton>
          <RibbonToolButton
            title="Rehacer"
            disabled={redoStack.length === 0}
            onClick={handleRedo}
          >
            <Redo2 className="size-4" aria-hidden="true" />
          </RibbonToolButton>
        </div>
      </div>

      {/* Barra desplegable para enlace HTTPS */}
      {linkBarOpen ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-border/70 bg-primary/5 px-3 py-2">
          <Input
            value={linkLabel}
            onChange={(e) => setLinkLabel(e.target.value)}
            placeholder="Texto del enlace (ej. Ver cronograma)"
            className="h-8 max-w-[200px] text-xs"
          />
          <Input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://..."
            className="h-8 min-w-[200px] flex-1 text-xs"
          />
          <Button type="button" size="sm" className="h-8 text-xs" onClick={handleInsertLink}>
            Insertar
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => setLinkBarOpen(false)}
          >
            Cerrar
          </Button>
        </div>
      ) : null}

      {/* Hoja de redacción cómoda */}
      <textarea
        ref={textareaRef}
        data-ai-target="body"
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={11}
        maxLength={maxLength}
        aria-label="Cuerpo del comunicado"
        className="w-full resize-y bg-transparent px-4 py-3.5 text-sm leading-7 text-foreground outline-none placeholder:text-muted-foreground/70"
      />

      {/* Pie de hoja con métricas y atajos */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 bg-muted/20 px-3.5 py-2 text-[11px] text-muted-foreground">
        <span>
          Consejo: selecciona texto y usa la barra superior (o Ctrl+B, Ctrl+I, Ctrl+U).
        </span>
        <span className="tabular-nums">
          {wordCount} palabras · {value.length}/{maxLength} caracteres
        </span>
      </div>
    </div>
  );
}

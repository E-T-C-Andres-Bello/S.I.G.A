"use client";

import * as React from "react";
import { cn } from "cn";

export interface BulletinRichTextProps {
  content: string;
  accentColor?: string;
  className?: string;
}

const INLINE_TOKEN_REGEX =
  /(\*\*[^*\n]+\*\*|__[^_\n]+__|==[^=\n]+==|\*[^*\n]+\*|\[[^\]\n]+\]\(https:\/\/[^\s)]+\))/g;

function renderInlineTokens(text: string, keyPrefix: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  INLINE_TOKEN_REGEX.lastIndex = 0;
  while ((match = INLINE_TOKEN_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    const tokenKey = `${keyPrefix}-${match.index}`;

    if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(
        <strong key={tokenKey} className="font-semibold text-foreground">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("__") && token.endsWith("__")) {
      parts.push(
        <u key={tokenKey} className="underline decoration-primary/60 underline-offset-4">
          {token.slice(2, -2)}
        </u>
      );
    } else if (token.startsWith("==") && token.endsWith("==")) {
      parts.push(
        <mark
          key={tokenKey}
          className="rounded-md bg-amber-300/35 px-1.5 py-0.5 font-medium text-foreground dark:bg-amber-400/25"
        >
          {token.slice(2, -2)}
        </mark>
      );
    } else if (token.startsWith("*") && token.endsWith("*")) {
      parts.push(
        <em key={tokenKey} className="italic">
          {token.slice(1, -1)}
        </em>
      );
    } else if (token.startsWith("[")) {
      const linkMatch = /^\[([^\]]+)\]\((https:\/\/[^\s)]+)\)$/.exec(token);
      if (linkMatch) {
        parts.push(
          <a
            key={tokenKey}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary underline decoration-primary/45 underline-offset-4 transition-colors hover:decoration-primary dark:text-sky-300"
          >
            {linkMatch[1]}
          </a>
        );
      } else {
        parts.push(token);
      }
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

/**
 * Renderizador de texto enriquecido 100 % seguro contra XSS (sin `dangerouslySetInnerHTML`).
 * Soporta subtítulos, listas con viñetas/numeradas, citas destacadas, separadores,
 * negrita, cursiva, subrayado, resaltado y enlaces HTTPS validados.
 */
export function BulletinRichText({
  content,
  accentColor,
  className,
}: BulletinRichTextProps) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const rawLine = lines[i] ?? "";
    const trimmed = rawLine.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    if (trimmed === "---") {
      blocks.push(
        <hr key={`hr-${i}`} className="my-3 border-border/70" />
      );
      i += 1;
      continue;
    }

    if (trimmed.startsWith("## ")) {
      blocks.push(
        <h3
          key={`h2-${i}`}
          className="pt-1 text-base font-semibold tracking-[-0.015em] text-foreground sm:text-lg"
        >
          {renderInlineTokens(trimmed.slice(3), `h2-${i}`)}
        </h3>
      );
      i += 1;
      continue;
    }

    if (trimmed.startsWith("### ")) {
      blocks.push(
        <h4
          key={`h3-${i}`}
          className="pt-1 text-sm font-semibold text-foreground sm:text-[15px]"
        >
          {renderInlineTokens(trimmed.slice(4), `h3-${i}`)}
        </h4>
      );
      i += 1;
      continue;
    }

    if (trimmed.startsWith("> ")) {
      const quoteLines: string[] = [];
      const start = i;
      while (i < lines.length && (lines[i]?.trim().startsWith("> ") ?? false)) {
        quoteLines.push(lines[i]!.trim().slice(2));
        i += 1;
      }
      blocks.push(
        <blockquote
          key={`quote-${start}`}
          className="rounded-r-xl border-l-4 bg-muted/45 px-4 py-2.5 text-sm leading-relaxed text-foreground/95"
          style={accentColor ? { borderLeftColor: accentColor } : undefined}
        >
          {quoteLines.map((ql, idx) => (
            <p key={idx} className={idx > 0 ? "mt-1.5" : undefined}>
              {renderInlineTokens(ql, `q-${start}-${idx}`)}
            </p>
          ))}
        </blockquote>
      );
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const listItems: string[] = [];
      const start = i;
      while (i < lines.length && /^[-*]\s+/.test(lines[i]?.trim() ?? "")) {
        listItems.push(lines[i]!.trim().replace(/^[-*]\s+/, ""));
        i += 1;
      }
      blocks.push(
        <ul
          key={`ul-${start}`}
          className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-foreground/90"
        >
          {listItems.map((li, idx) => (
            <li key={idx}>{renderInlineTokens(li, `ul-${start}-${idx}`)}</li>
          ))}
        </ul>
      );
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const listItems: string[] = [];
      const start = i;
      while (i < lines.length && /^\d+\.\s+/.test(lines[i]?.trim() ?? "")) {
        listItems.push(lines[i]!.trim().replace(/^\d+\.\s+/, ""));
        i += 1;
      }
      blocks.push(
        <ol
          key={`ol-${start}`}
          className="list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-foreground/90"
        >
          {listItems.map((li, idx) => (
            <li key={idx}>{renderInlineTokens(li, `ol-${start}-${idx}`)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // Párrafo normal (agrupa líneas consecutivas no vacías sin prefijo de bloque)
    const paraLines: string[] = [trimmed];
    const start = i;
    i += 1;
    while (i < lines.length) {
      const nextTrimmed = lines[i]?.trim() ?? "";
      if (
        !nextTrimmed ||
        nextTrimmed === "---" ||
        nextTrimmed.startsWith("## ") ||
        nextTrimmed.startsWith("### ") ||
        nextTrimmed.startsWith("> ") ||
        /^[-*]\s+/.test(nextTrimmed) ||
        /^\d+\.\s+/.test(nextTrimmed)
      ) {
        break;
      }
      paraLines.push(nextTrimmed);
      i += 1;
    }

    blocks.push(
      <p
        key={`p-${start}`}
        className="text-sm leading-relaxed text-foreground/90"
      >
        {renderInlineTokens(paraLines.join(" "), `p-${start}`)}
      </p>
    );
  }

  return <div className={cn("space-y-3", className)}>{blocks}</div>;
}

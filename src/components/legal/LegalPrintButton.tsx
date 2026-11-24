"use client";

import { Printer } from "lucide-react";

interface LegalPrintButtonProps {
  label: string;
  ariaLabel: string;
}

export function LegalPrintButton({ label, ariaLabel }: LegalPrintButtonProps) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      aria-label={ariaLabel}
      className="inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 text-xs font-medium text-primary transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <Printer className="size-3.5 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}

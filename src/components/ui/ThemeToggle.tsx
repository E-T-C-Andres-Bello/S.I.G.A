"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "siga-theme";

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

/**
 * Interruptor ligero de modo claro / oscuro sincronizado con `.dark` en `<html>`
 * y persistencia en localStorage sin provocar parpadeos ni errores de hidratación.
 */
export function ThemeToggle({
  className,
  showLabel = false,
}: ThemeToggleProps) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const sync = () => {
      setIsDark(document.documentElement.classList.contains("dark"));
    };
    sync();

    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  const toggleTheme = () => {
    const root = document.documentElement;
    const nextDark = !root.classList.contains("dark");
    root.classList.toggle("dark", nextDark);
    setIsDark(nextDark);
    try {
      window.localStorage.setItem(STORAGE_KEY, nextDark ? "dark" : "light");
    } catch {
      // Ignorar si el almacenamiento local está bloqueado
    }
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      aria-pressed={isDark}
      title={isDark ? "Modo claro" : "Modo oscuro"}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
        className
      )}
    >
      <Moon className="size-3.5 dark:hidden" aria-hidden="true" />
      <Sun className="hidden size-3.5 dark:block" aria-hidden="true" />
      {showLabel && (
        <>
          <span className="dark:hidden">Modo oscuro</span>
          <span className="hidden dark:inline">Modo claro</span>
        </>
      )}
    </button>
  );
}

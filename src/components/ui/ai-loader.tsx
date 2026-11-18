import * as React from "react";
import { cn } from "cn";

export interface LoaderProps {
  size?: number;
  text?: string;
  subtitle?: string;
  className?: string;
}

/**
 * Pantalla de carga global S.I.G.A. basada en el Orb Loader de referencia,
 * adaptada al contexto institucional de la E.T.C. "Andrés Bello".
 */
export const Component: React.FC<LoaderProps> = ({
  size = 180,
  text = "S.I.G.A.",
  subtitle = 'E.T.C. "Andrés Bello" · Sistema Integral de Gestión Académica',
  className,
}) => {
  const letters = text.split("");

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Cargando ${text}`}
      className={cn(
        "font-hero fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-b from-[#1a3379] via-[#0f172a] to-[#020617] px-6 text-white select-none",
        className
      )}
    >
      <div
        className="relative flex items-center justify-center gap-0.5 text-xl font-semibold tracking-[0.14em]"
        style={{ width: size, height: size }}
      >
        {letters.map((letter, index) => (
          <span
            key={`${letter}-${index}`}
            className="animate-loaderLetter inline-block text-white opacity-40"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            {letter === " " ? "\u00A0" : letter}
          </span>
        ))}

        <div
          aria-hidden="true"
          className="animate-loaderCircle absolute inset-0 rounded-full"
        />
      </div>

      {subtitle ? (
        <p className="mt-6 text-center text-xs font-medium tracking-[0.16em] text-sky-200/80 uppercase">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
};

export { Component as SigaGlobalLoader };
export default Component;

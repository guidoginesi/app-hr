"use client";

import { cn } from "../../lib/utils";

interface TabNavOption<T extends string> {
  value: T;
  label: React.ReactNode;
}

interface TabNavProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: TabNavOption<T>[];
  /** "md" (default) = tabs de sección · "sm" = toggle de vista compacto. */
  size?: "sm" | "md";
  /** Línea inferior full-width bajo toda la fila (divisor de sección). Default true. */
  bar?: boolean;
  className?: string;
  "aria-label"?: string;
}

// Toggle de vista con subrayado, SIN paneles de contenido (controlado, no-Radix —
// evita el mismatch de hidratación de useId). Activo subrayado en naranja.
// A11y: como NO hay tabpanels ni navegación por flechas, NO usa el patrón ARIA de
// tabs (role="tablist"/"tab" sería incorrecto sin paneles); se modela como grupo de
// botones-toggle (role="group" + aria-pressed). Para tabs CON contenido usar `Tabs`
// (Radix); para cápsula usar SegmentedControl.
export function TabNav<T extends string>({
  value,
  onChange,
  options,
  size = "md",
  bar = true,
  className,
  ...props
}: TabNavProps<T>) {
  return (
    <div
      role="group"
      className={cn("flex items-center", bar && "border-b", size === "sm" ? "gap-4" : "gap-5", className)}
      {...props}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "inline-flex items-center -mb-px border-b-2 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-t-[var(--radius)]",
              size === "sm" ? "pb-1.5 pt-0.5 text-sm" : "pb-2 pt-1 text-sm",
              active
                ? "border-brand text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

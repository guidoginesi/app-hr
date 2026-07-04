"use client";

import { cn } from "../../lib/utils";

interface SegmentedControlOption<T extends string> {
  value: T;
  label: React.ReactNode;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedControlOption<T>[];
  size?: "sm" | "md";
  className?: string;
  "aria-label"?: string;
}

// Switch de vista/escala (Consolidado/Caja, Diario/Mensual, Real/Proyectado…).
// Cápsula tokenizada. Para navegar entre SECCIONES usar Tabs (subrayado), no esto.
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  size = "md",
  className,
  ...props
}: SegmentedControlProps<T>) {
  const pad = size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm";
  return (
    <div
      role="tablist"
      className={cn("inline-flex items-center gap-1 p-1 bg-secondary rounded-[var(--radius)] w-fit flex-wrap", className)}
      {...props}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "rounded-[calc(var(--radius)-2px)] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              pad,
              active
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

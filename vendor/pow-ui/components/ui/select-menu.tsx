"use client";

import { cn } from "../../lib/utils";
import { Dropdown, DropdownTrigger, DropdownContent, DropdownItem } from "./dropdown";

export type SelectOption = { value: string; label: string; disabled?: boolean };

interface SelectMenuProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** Alineación del panel respecto del trigger. */
  align?: "start" | "end";
  ariaLabel?: string;
}

// Select on-brand basado en el Dropdown (Radix): abre siempre hacia abajo, en
// portal, con el ancho del trigger. Alternativa al <select> nativo (que en macOS
// se despliega encima del ítem seleccionado y no se puede posicionar por CSS).
// Para value="" como opción real (ej. "Todos"), incluíla en `options`; para
// placeholder, omitíla de `options` y pasá `placeholder`.
export function SelectMenu({
  value,
  onChange,
  options,
  placeholder = "Seleccioná…",
  className,
  disabled = false,
  align = "start",
  ariaLabel,
}: SelectMenuProps) {
  const selected = options.find((o) => o.value === value);

  return (
    <Dropdown>
      <DropdownTrigger
        disabled={disabled}
        aria-label={ariaLabel}
        className={cn(
          "inline-flex h-9 items-center justify-between gap-2 rounded-[var(--radius)] border border-input bg-card px-3 text-sm text-foreground transition-colors",
          "hover:border-[var(--gray-300)] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
      >
        <span className={cn("truncate", !selected && "text-muted-foreground")}>
          {selected ? selected.label : placeholder}
        </span>
        <svg className="h-4 w-4 shrink-0 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </DropdownTrigger>
      <DropdownContent align={align} className="max-h-72 min-w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto">
        {options.map((o) => (
          <DropdownItem key={o.value} disabled={o.disabled} onSelect={() => onChange(o.value)}>
            <span className="flex-1 truncate">{o.label}</span>
            {o.value === value && (
              <svg className="h-4 w-4 shrink-0 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </DropdownItem>
        ))}
      </DropdownContent>
    </Dropdown>
  );
}

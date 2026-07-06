import { cn } from "../../lib/utils";

export type BarItem = {
  label: string;
  value: number;
  /** Texto a la derecha de la barra (ej. "47.8% · 78"). Si se omite y showPercent
   *  está activo, se muestra el % calculado. */
  hint?: string;
  /** Tono del relleno. Default = tinta (neutral). Usá los semánticos SOLO cuando
   *  la barra comunique un estado/severidad real (no para categorías). */
  tone?: "default" | "brand" | "success" | "warning" | "danger";
};

// Relleno + track por tono. Default/brand = patrón de balances del portal
// (relleno naranja sobre track naranja claro). Los semánticos usan su track subtle.
const FILL: Record<NonNullable<BarItem["tone"]>, string> = {
  default: "bg-brand",
  brand: "bg-brand",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

const TRACK: Record<NonNullable<BarItem["tone"]>, string> = {
  default: "bg-accent",
  brand: "bg-accent",
  success: "bg-success-subtle",
  warning: "bg-warning-subtle",
  danger: "bg-danger-subtle",
};

// Lista de barras horizontales finas: label + valor arriba, barra + medida a la
// derecha. Patrón del DS para distribuciones/rankings. Un solo color por barra
// (tinta por defecto) — el color no decora, solo comunica estado si se pasa `tone`.
export function BarList({
  items,
  max,
  showPercent = false,
  emptyLabel = "Sin datos",
  className,
}: {
  items: BarItem[];
  /** Máximo para escalar el ancho; default = mayor value de la lista. */
  max?: number;
  /** Muestra el % calculado a la derecha cuando el ítem no trae `hint`. */
  showPercent?: boolean;
  emptyLabel?: string;
  className?: string;
}) {
  if (!items.length) {
    return <p className={cn("text-sm text-muted-foreground", className)}>{emptyLabel}</p>;
  }
  const top = max ?? Math.max(1, ...items.map((i) => i.value));

  return (
    <div className={cn("space-y-3", className)}>
      {items.map((it, i) => {
        const pct = top > 0 ? (it.value / top) * 100 : 0;
        const hint = it.hint ?? (showPercent ? `${Math.round(pct)}%` : null);
        return (
          <div key={`${it.label}-${i}`}>
            <div className="mb-1 flex items-center justify-between gap-2 text-xs">
              <span className="truncate text-muted-foreground">{it.label}</span>
              <span className="shrink-0 font-medium text-foreground tabular-nums">{it.value}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={cn("h-2 flex-1 overflow-hidden rounded-full", TRACK[it.tone ?? "default"])}>
                <div
                  className={cn("h-2 rounded-full transition-all duration-500", FILL[it.tone ?? "default"])}
                  style={{ width: `${pct}%` }}
                />
              </div>
              {hint && (
                <span className="w-12 shrink-0 text-right text-xs text-muted-foreground tabular-nums">{hint}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

import { cn } from "../../lib/utils";

type Tone = "default" | "success" | "warning" | "danger";

// Métrica neutra → tarjeta blanca + número en tinta. Estado (success/warning/
// danger) → superficie tintada + número del color del estado. El color SOLO
// aparece cuando comunica un estado.
const surfaceTone: Record<Tone, string> = {
  default: "bg-card border-[var(--border)]",
  success: "bg-success-subtle border-success/20",
  warning: "bg-warning-subtle border-warning/30",
  danger: "bg-danger-subtle border-danger/20",
};

const valueTone: Record<Tone, string> = {
  default: "text-foreground",
  success: "text-[var(--green-700)]",
  warning: "text-[var(--amber-600)]",
  danger: "text-[var(--red-600)]",
};

interface StatProps {
  label: string;
  value: string;
  sub?: string;
  tone?: Tone;
  trend?: React.ReactNode; // ej. un <Badge>
  /** Ícono opcional. Si se pasa, el layout es: ícono + valor arriba, label debajo. */
  icon?: React.ReactNode;
  /** Hace la tarjeta clickeable (drill-down). */
  onClick?: () => void;
  className?: string;
}

// KPI / métrica. La superficie de dashboard más repetida de la app.
export function Stat({ label, value, sub, tone = "default", trend, icon, onClick, className }: StatProps) {
  const Comp = onClick ? "button" : "div";

  // Con ícono: ícono + valor en una fila arriba, label debajo (a lo ancho).
  if (icon) {
    return (
      <Comp
        onClick={onClick}
        className={cn(
          "rounded-[var(--radius)] border p-6 text-left shadow-sm",
          surfaceTone[tone],
          onClick && "w-full cursor-pointer transition-shadow hover:shadow-md",
          className
        )}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
            {icon}
          </div>
          <span className={cn("text-2xl font-bold nums-tabular", valueTone[tone])}>{value}</span>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{label}</p>
        {(sub || trend) && (
          <div className="flex items-center gap-2 mt-1">
            {sub && <span className="type-secondary text-muted-foreground">{sub}</span>}
            {trend}
          </div>
        )}
      </Comp>
    );
  }

  // Sin ícono: layout clásico (label arriba, valor debajo).
  return (
    <Comp
      onClick={onClick}
      className={cn(
        "rounded-[var(--radius)] border p-4 text-left shadow-sm",
        surfaceTone[tone],
        onClick && "w-full cursor-pointer transition-shadow hover:shadow-md",
        className
      )}
    >
      <div className="type-label text-muted-foreground">{label}</div>
      <div className={cn("text-xl font-bold nums-tabular mt-1", valueTone[tone])}>{value}</div>
      {(sub || trend) && (
        <div className="flex items-center gap-2 mt-1">
          {sub && <span className="type-secondary text-muted-foreground">{sub}</span>}
          {trend}
        </div>
      )}
    </Comp>
  );
}

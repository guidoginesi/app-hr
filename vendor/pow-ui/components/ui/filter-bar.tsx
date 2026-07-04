import { cn } from "../../lib/utils";

// Contenedor para barras de filtros: alinea controles (search/selects) a la
// izquierda y acciones a la derecha, con espaciado consistente.
export function FilterBar({
  children,
  actions,
  className,
}: {
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2 flex-wrap", className)}>
      <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">{children}</div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

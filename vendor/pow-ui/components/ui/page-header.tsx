import { cn } from "../../lib/utils";
import { Breadcrumb, type Crumb } from "./breadcrumb";

interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumb?: Crumb[];
  actions?: React.ReactNode;
  className?: string;
}

// Encabezado de página estándar: breadcrumb + título (display) + descripción
// + acciones a la derecha. Mantiene consistente el arranque de cada pantalla.
export function PageHeader({ title, description, breadcrumb, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4 flex-wrap", className)}>
      <div className="min-w-0">
        {breadcrumb && <Breadcrumb items={breadcrumb} className="mb-1.5" />}
        <h1 className="type-display">{title}</h1>
        {description && <p className="type-secondary text-muted-foreground mt-1 max-w-2xl">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

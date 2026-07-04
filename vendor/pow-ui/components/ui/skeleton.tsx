import { cn } from "../../lib/utils";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-[var(--radius)] bg-secondary", className)}
      {...props}
    />
  );
}

// Placeholder de carga para bloques de contenido (listas, tablas, detalles async).
// Imita unas filas. Usar en vez de texto "Cargando…".
export function SkeletonRows({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-2.5 py-1", className)} aria-busy aria-label="Cargando">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-3.5 w-40" />
          <Skeleton className="h-3.5 w-24 ml-auto" />
        </div>
      ))}
    </div>
  );
}

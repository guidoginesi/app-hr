import { ChevronsUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "../../lib/utils";

// Tabla tokenizada. Pensada para las superficies densas de la app
// (cobranzas, liquidaciones, cashflow). Montos → usar `numeric` en TableCell/TableHead
// para alinear a la derecha con tabular-nums.

export function Table({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto rounded-[var(--radius)] border">
      <table className={cn("w-full text-sm border-collapse", className)} {...props} />
    </div>
  );
}

export function TableHeader({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("bg-muted", className)} {...props} />;
}

export function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={className} {...props} />;
}

export function TableRow({
  className,
  selected,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement> & { selected?: boolean }) {
  return (
    <tr
      data-selected={selected || undefined}
      className={cn(
        "border-b last:border-0 transition-colors hover:bg-muted/60",
        selected && "bg-accent",
        className
      )}
      {...props}
    />
  );
}

export function TableHead({
  className,
  numeric,
  sortable,
  sorted = null,
  onSort,
  children,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement> & {
  numeric?: boolean;
  /** Habilita el orden por esta columna. */
  sortable?: boolean;
  /** Estado de orden actual de ESTA columna: "asc" | "desc" | null (no ordenada). */
  sorted?: "asc" | "desc" | null;
  onSort?: () => void;
}) {
  return (
    <th
      aria-sort={sortable ? (sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none") : undefined}
      onClick={sortable ? onSort : undefined}
      className={cn(
        "group px-3 py-2 text-[11px] font-semibold uppercase tracking-wide border-b",
        sorted ? "text-foreground" : "text-muted-foreground",
        numeric ? "text-right" : "text-left",
        sortable && "cursor-pointer select-none hover:text-foreground",
        className
      )}
      {...props}
    >
      {sortable ? (
        <span className={cn("inline-flex items-center gap-1.5", numeric && "flex-row-reverse")}>
          <span>{children}</span>
          {/* Ícono de ancho fijo SIEMPRE presente: sin layout shift al ordenar. */}
          <span className="shrink-0 w-3.5 inline-flex justify-center">
            {sorted === "asc" ? (
              <ArrowUp className="h-3.5 w-3.5 text-accent-foreground" />
            ) : sorted === "desc" ? (
              <ArrowDown className="h-3.5 w-3.5 text-accent-foreground" />
            ) : (
              <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
            )}
          </span>
        </span>
      ) : (
        children
      )}
    </th>
  );
}

export function TableCell({
  className,
  numeric,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <td
      className={cn("px-3 py-2.5 align-middle", numeric && "text-right nums-tabular", className)}
      {...props}
    />
  );
}

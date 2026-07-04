"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";

interface PaginationProps {
  page: number; // 1-based
  pageCount: number;
  onPageChange: (page: number) => void;
  className?: string;
}

// Devuelve los números a mostrar con elipsis: 1 … 4 5 [6] 7 8 … 20
function pageItems(page: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const items: (number | "…")[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(total - 1, page + 1);
  if (start > 2) items.push("…");
  for (let i = start; i <= end; i++) items.push(i);
  if (end < total - 1) items.push("…");
  items.push(total);
  return items;
}

export function Pagination({ page, pageCount, onPageChange, className }: PaginationProps) {
  if (pageCount <= 1) return null;
  const items = pageItems(page, pageCount);
  const btn =
    "h-8 min-w-8 px-2 inline-flex items-center justify-center rounded-[var(--radius)] text-sm font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none";
  return (
    <nav className={cn("flex items-center gap-1", className)} aria-label="Paginación">
      <button className={cn(btn, "text-muted-foreground hover:bg-secondary")} disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Anterior">
        <ChevronLeft className="h-4 w-4" />
      </button>
      {items.map((it, i) =>
        it === "…" ? (
          <span key={`e${i}`} className="h-8 w-8 grid place-items-center text-muted-foreground text-sm">…</span>
        ) : (
          <button
            key={it}
            onClick={() => onPageChange(it)}
            aria-current={it === page ? "page" : undefined}
            className={cn(btn, it === page ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-secondary")}
          >
            {it}
          </button>
        )
      )}
      <button className={cn(btn, "text-muted-foreground hover:bg-secondary")} disabled={page >= pageCount} onClick={() => onPageChange(page + 1)} aria-label="Siguiente">
        <ChevronRight className="h-4 w-4" />
      </button>
    </nav>
  );
}

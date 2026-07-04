import { ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";

export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumb({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={cn("flex items-center gap-1 text-sm", className)}>
      {items.map((c, i) => {
        const last = i === items.length - 1;
        return (
          <span key={`${c.label}-${i}`} className="flex items-center gap-1">
            {c.href && !last ? (
              <a href={c.href} className="text-muted-foreground hover:text-foreground transition-colors">
                {c.label}
              </a>
            ) : (
              <span className={last ? "text-foreground font-medium" : "text-muted-foreground"} aria-current={last ? "page" : undefined}>
                {c.label}
              </span>
            )}
            {!last && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />}
          </span>
        );
      })}
    </nav>
  );
}

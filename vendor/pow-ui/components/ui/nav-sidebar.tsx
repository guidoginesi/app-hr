"use client";

import { cn } from "../../lib/utils";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  href?: string;
  icon?: LucideIcon;
  active?: boolean;
}
export interface NavGroup {
  label?: string;
  items: NavItem[];
}

// Sidebar de navegación genérico y data-driven. El ítem activo usa el accent
// naranja de marca. `header` y `footer` son slots (logo, user menu, etc.).
export function NavSidebar({
  groups,
  header,
  footer,
  className,
}: {
  groups: NavGroup[];
  header?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <aside className={cn("w-56 shrink-0 flex flex-col border-r bg-card", className)}>
      {header && <div className="px-3 py-4">{header}</div>}
      <nav className="flex-1 overflow-y-auto px-3 pb-4 space-y-4">
        {groups.map((g, gi) => (
          <div key={g.label ?? gi}>
            {g.label && <div className="type-label text-muted-foreground px-2 mb-1">{g.label}</div>}
            <div className="space-y-0.5">
              {g.items.map((it) => {
                const Icon = it.icon;
                const Comp = it.href ? "a" : "div";
                return (
                  <Comp
                    key={it.label}
                    {...(it.href ? { href: it.href } : {})}
                    aria-current={it.active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2 px-2 py-1.5 rounded-[var(--radius)] text-sm font-medium transition-colors cursor-pointer",
                      it.active
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    )}
                  >
                    {Icon && <Icon className={cn("h-4 w-4 shrink-0", it.active && "text-brand")} />}
                    <span className="truncate">{it.label}</span>
                  </Comp>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      {footer && <div className="border-t px-3 py-3">{footer}</div>}
    </aside>
  );
}

'use client';

import { useEffect, useState } from 'react';

type Item = { id: string; title: string };

/**
 * Índice "En esta página" con resaltado del paso visible.
 *
 * Lee los pasos del DOM (`[data-manual-step]`) en vez de recibirlos por prop:
 * así cada manual escribe sus títulos una sola vez, dentro de su ManualStep, y
 * el índice no se desincroniza cuando alguien agrega o renombra un paso.
 */
export function ManualToc() {
  const [items, setItems] = useState<Item[]>([]);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-manual-step]'));
    setItems(nodes.map((n) => ({ id: n.id, title: n.dataset.manualTitle ?? '' })).filter((i) => i.id && i.title));
    if (nodes.length === 0) return;

    // Se marca el paso más arriba de los que están entrando en pantalla; el
    // rootMargin corre la línea de disparo debajo del header sticky.
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-96px 0px -60% 0px', threshold: 0 },
    );
    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, []);

  if (items.length < 2) return null;

  return (
    <nav aria-label="En esta página" className="sticky top-6 hidden xl:block">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">En esta página</p>
      <ul className="space-y-1 border-l border-[var(--border)]">
        {items.map((i) => {
          const isActive = active === i.id;
          return (
            <li key={i.id}>
              <a
                href={`#${i.id}`}
                aria-current={isActive ? 'true' : undefined}
                className={`-ml-px block border-l py-1.5 pl-4 text-sm transition-colors ${
                  isActive
                    ? 'border-[var(--brand)] font-medium text-foreground'
                    : 'border-transparent text-muted-foreground hover:border-[var(--gray-300)] hover:text-foreground'
                }`}
              >
                {i.title}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

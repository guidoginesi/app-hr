import Link from 'next/link';

export type ManualCard = {
  href: string;
  title: string;
  desc: string;
  /** ISO (YYYY-MM-DD). Se muestra a la derecha y ordena los "Nuevo". */
  updated: string;
};

/** Un manual es "nuevo" durante sus primeros 14 días. */
const NEW_DAYS = 14;

function esNuevo(updated: string, today: Date): boolean {
  const [y, m, d] = updated.split('-').map(Number);
  if (!y) return false;
  const diff = (today.getTime() - Date.UTC(y, m - 1, d)) / 86_400_000;
  return diff >= 0 && diff <= NEW_DAYS;
}

function formatear(updated: string): string {
  const [y, m, d] = updated.split('-');
  return `${d}/${m}/${y}`;
}

/**
 * Índice de manuales: una fila por manual, con la fecha de la última
 * actualización y un distintivo para los recién agregados.
 */
export function ManualIndex({ manuals }: { manuals: ManualCard[] }) {
  const today = new Date();
  const ordenados = [...manuals].sort((a, b) => b.updated.localeCompare(a.updated));

  return (
    <div className="space-y-3">
      {ordenados.map((m) => (
        <Link
          key={m.href}
          href={m.href}
          className="group flex items-center gap-4 rounded-xl border border-[var(--border)] bg-white px-5 py-4 shadow-sm transition-colors hover:border-[var(--gray-300)]"
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-foreground group-hover:text-[var(--brand-strong)]">
                {m.title}
              </h3>
              {esNuevo(m.updated, today) && (
                <span className="inline-flex items-center rounded-full bg-success-subtle px-2 py-0.5 text-xs font-medium text-[var(--green-700)]">
                  Nuevo
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{m.desc}</p>
          </div>
          <span className="hidden shrink-0 text-sm nums-tabular text-muted-foreground sm:block">
            {formatear(m.updated)}
          </span>
          <svg
            className="h-5 w-5 shrink-0 text-[var(--gray-300)] group-hover:text-muted-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      ))}
    </div>
  );
}

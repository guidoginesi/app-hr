'use client';

import type { StatusBucket } from './statusBuckets';
import { BUCKET_LABELS } from './statusBuckets';

export type ChipValue = 'all' | StatusBucket;

export function StatusFilterChips({
  value,
  counts,
  order,
  onChange,
}: {
  value: ChipValue;
  counts: Record<StatusBucket, number>;
  /** Buckets a mostrar, en orden. Permite ocultar p.ej. "Canceladas" donde no aplica. */
  order: StatusBucket[];
  onChange: (value: ChipValue) => void;
}) {
  const total = order.reduce((sum, b) => sum + counts[b], 0);
  const chips: { value: ChipValue; label: string; count: number }[] = [
    { value: 'all', label: 'Todos', count: total },
    ...order.map((b) => ({ value: b as ChipValue, label: BUCKET_LABELS[b], count: counts[b] })),
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => {
        const active = value === chip.value;
        return (
          <button
            key={chip.value}
            type="button"
            onClick={() => onChange(chip.value)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors ${
              active
                ? 'border-transparent bg-primary text-primary-foreground'
                : 'border-[var(--border)] bg-white text-muted-foreground hover:bg-muted'
            }`}
          >
            {chip.label}
            <span
              className={`inline-flex min-w-[1.5rem] items-center justify-center rounded-full px-1.5 text-xs tabular-nums ${
                active ? 'bg-white/20 text-primary-foreground' : 'bg-secondary text-secondary-foreground'
              }`}
            >
              {chip.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

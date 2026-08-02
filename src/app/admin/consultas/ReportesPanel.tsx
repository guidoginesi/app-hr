'use client';

import { useCallback, useEffect, useState } from 'react';

type Stats = {
  total: number;
  abiertas: number;
  vencidas: number;
  por_categoria: { category: string; label: string; total: number; abiertas: number; resueltas: number }[];
  tiempo_respuesta: {
    respondidas: number;
    mediana_horas: number;
    p90_horas: number;
    cumplimiento_sla_pct: number | null;
    sin_responder: number;
  };
  recurrentes: {
    reabiertas: number;
    continuaciones: number;
    repetidas_por_persona: { employee_name: string; category_label: string; total: number }[];
  };
};

const hs = (h: number) => (h >= 24 ? `${Math.round((h / 24) * 10) / 10} días` : `${h} h`);

export function ReportesPanel() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (from) p.set('from', from);
      if (to) p.set('to', to);
      const res = await fetch(`/api/admin/inquiries/stats?${p.toString()}`);
      if (res.ok) setStats(await res.json());
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !stats) return <div className="py-16 text-center text-sm text-muted-foreground">Cargando…</div>;
  if (!stats) return null;

  const t = stats.tiempo_respuesta;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Período:</span>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Desde"
          className="rounded-lg border border-[var(--border)] px-2 py-1.5 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-ring" />
        <span className="text-xs text-muted-foreground">→</span>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Hasta"
          className="rounded-lg border border-[var(--border)] px-2 py-1.5 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-ring" />
        {(from || to) && (
          <button type="button" onClick={() => { setFrom(''); setTo(''); }}
            className="text-xs font-medium text-[var(--brand-strong)] hover:underline">Limpiar</button>
        )}
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          ['Consultas', stats.total, null],
          ['Mediana de 1ª respuesta', t.respondidas ? hs(t.mediana_horas) : '—', 'p90: ' + (t.respondidas ? hs(t.p90_horas) : '—')],
          ['Cumplimiento del objetivo', t.cumplimiento_sla_pct === null ? '—' : `${t.cumplimiento_sla_pct}%`, `${t.respondidas} respondidas`],
          ['Sin responder', t.sin_responder, stats.vencidas > 0 ? `${stats.vencidas} vencidas` : null],
        ].map(([label, value, hint]) => (
          <div key={label as string} className="rounded-xl border border-[var(--border)] bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label as string}</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{value as string | number}</p>
            {hint && <p className="mt-1 text-xs text-muted-foreground">{hint as string}</p>}
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm">
        <div className="border-b border-[var(--border)] px-6 py-4">
          <h3 className="text-sm font-semibold text-foreground">Volumen por categoría</h3>
        </div>
        {stats.por_categoria.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-muted-foreground">Sin datos en este período.</p>
        ) : (
          <table className="min-w-full divide-y divide-[var(--border)]">
            <thead className="bg-muted">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Categoría</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Abiertas</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Resueltas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {stats.por_categoria.map((c) => (
                <tr key={c.category} className="hover:bg-muted">
                  <td className="px-6 py-3 text-sm text-foreground">{c.label}</td>
                  <td className="px-4 py-3 text-center text-sm font-semibold text-foreground">{c.total}</td>
                  <td className="px-4 py-3 text-center text-sm text-muted-foreground">{c.abiertas}</td>
                  <td className="px-4 py-3 text-center text-sm text-muted-foreground">{c.resueltas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-white shadow-sm">
        <div className="border-b border-[var(--border)] px-6 py-4">
          <h3 className="text-sm font-semibold text-foreground">Consultas recurrentes</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Lo que se repite suele señalar un problema de comunicación o de proceso, no una duda individual.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reabiertas</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{stats.recurrentes.reabiertas}</p>
            <p className="mt-1 text-xs text-muted-foreground">La respuesta no alcanzó</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Continuaciones</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{stats.recurrentes.continuaciones}</p>
            <p className="mt-1 text-xs text-muted-foreground">Se volvió a preguntar lo mismo</p>
          </div>
        </div>
        {stats.recurrentes.repetidas_por_persona.length > 0 && (
          <div className="border-t border-[var(--border)] px-6 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Misma persona, misma categoría (3 o más)
            </p>
            <ul className="mt-2 space-y-1">
              {stats.recurrentes.repetidas_por_persona.map((r, i) => (
                <li key={i} className="flex items-center justify-between text-sm">
                  <span className="text-foreground">
                    {r.employee_name} <span className="text-muted-foreground">· {r.category_label}</span>
                  </span>
                  <span className="font-semibold text-foreground">{r.total}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

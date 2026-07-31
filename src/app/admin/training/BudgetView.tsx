'use client';

import { useEffect, useState } from 'react';

type Row = { employee_id: string; employee_name: string; department: string; total_usd: number; committed_usd: number; consumed_usd: number; available_usd: number };
type Area = { area: string; total: number; committed: number; consumed: number; available: number; count: number };
type Global = { total: number; committed: number; consumed: number; available: number };

const usd = (n: number) => `USD ${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(n)}`;

export function BudgetView() {
  const [rows, setRows] = useState<Row[]>([]);
  const [byArea, setByArea] = useState<Area[]>([]);
  const [global, setGlobal] = useState<Global | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/admin/training/budget');
        const data = await res.json();
        if (res.ok) { setRows(data.rows ?? []); setByArea(data.byArea ?? []); setGlobal(data.global ?? null); setYear(data.year ?? null); }
      } finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="flex items-center justify-center py-16"><div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--border)] border-t-transparent" /></div>;

  return (
    <div className="space-y-6">
      {/* Global */}
      {global && (
        <div className="grid gap-4 sm:grid-cols-4">
          <Card value={usd(global.total)} label={`Budget total ${year ?? ''}`} />
          <Card value={usd(global.committed)} label="Comprometido" />
          <Card value={usd(global.consumed)} label="Consumido" />
          <Card value={usd(global.available)} label="Disponible" accent />
        </div>
      )}

      {/* Por área */}
      <div className="rounded-xl border border-[var(--border)] bg-white shadow-sm">
        <div className="border-b border-[var(--border)] px-6 py-4"><h2 className="text-base font-semibold text-foreground">Por área</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-[var(--border)] bg-muted text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="px-6 py-3">Área</th><th className="px-6 py-3 text-center">Personas</th><th className="px-6 py-3 text-right">Total</th><th className="px-6 py-3 text-right">Comprometido</th><th className="px-6 py-3 text-right">Consumido</th><th className="px-6 py-3 text-right">Disponible</th>
            </tr></thead>
            <tbody className="divide-y divide-[var(--border)]">
              {byArea.map((a) => (
                <tr key={a.area}>
                  <td className="px-6 py-3 font-medium text-foreground">{a.area}</td>
                  <td className="px-6 py-3 text-center text-muted-foreground nums-tabular">{a.count}</td>
                  <td className="px-6 py-3 text-right text-muted-foreground nums-tabular">{usd(a.total)}</td>
                  <td className="px-6 py-3 text-right text-muted-foreground nums-tabular">{usd(a.committed)}</td>
                  <td className="px-6 py-3 text-right text-muted-foreground nums-tabular">{usd(a.consumed)}</td>
                  <td className="px-6 py-3 text-right font-medium text-foreground nums-tabular">{usd(a.available)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Por persona */}
      <div className="rounded-xl border border-[var(--border)] bg-white shadow-sm">
        <div className="border-b border-[var(--border)] px-6 py-4"><h2 className="text-base font-semibold text-foreground">Por persona</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-[var(--border)] bg-muted text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="px-6 py-3">Colaborador</th><th className="px-6 py-3">Área</th><th className="px-6 py-3 text-right">Total</th><th className="px-6 py-3 text-right">Comprometido</th><th className="px-6 py-3 text-right">Consumido</th><th className="px-6 py-3 text-right">Disponible</th>
            </tr></thead>
            <tbody className="divide-y divide-[var(--border)]">
              {rows.map((r) => (
                <tr key={r.employee_id} className="hover:bg-muted transition-colors">
                  <td className="px-6 py-3 font-medium text-foreground">{r.employee_name}</td>
                  <td className="px-6 py-3 text-muted-foreground">{r.department}</td>
                  <td className="px-6 py-3 text-right text-muted-foreground nums-tabular">{usd(r.total_usd)}</td>
                  <td className="px-6 py-3 text-right text-muted-foreground nums-tabular">{usd(r.committed_usd)}</td>
                  <td className="px-6 py-3 text-right text-muted-foreground nums-tabular">{usd(r.consumed_usd)}</td>
                  <td className="px-6 py-3 text-right font-medium text-foreground nums-tabular">{usd(r.available_usd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Card({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white p-5 shadow-sm">
      <div className={`text-xl font-bold nums-tabular ${accent ? 'text-[var(--brand-strong)]' : 'text-foreground'}`}>{value}</div>
      <div className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

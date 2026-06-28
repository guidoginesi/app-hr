'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';

type PersonalObjective = { title: string; achievement: number | null };

type BonusRow = {
  id: string;
  name: string;
  department: string;
  seniority_level: string | null;
  seniority_label: string;
  weights: { company: number; area: number };
  corporate: { completion: number; gateMet: boolean };
  personal: {
    completion: number;
    evaluatedCount: number;
    totalCount: number;
    objectives: PersonalObjective[];
  };
  proRata: { applies: boolean; factor: number; months: number; percentage: number };
  bonus: { base: number; final: number };
};

type CorporateSummary = {
  billingTarget: number | null;
  billingActual: number | null;
  billingGateMet: boolean;
  billingCompletion: number;
  npsCompletion: number;
  totalCompletion: number;
  npsQuarters: { quarter: string; actual: number | null; target: number | null; met: boolean }[];
};

type Props = {
  bonusRows: BonusRow[];
  corporateSummary: CorporateSummary;
  selectedYear: number;
  availableYears: number[];
};

function getBonusColor(pct: number) {
  if (pct >= 80) return 'text-[var(--green-700)] bg-success-subtle';
  if (pct >= 50) return 'text-[var(--amber-600)] bg-warning-subtle';
  return 'text-[var(--red-600)] bg-danger-subtle';
}

function BonusBar({ value, max = 100 }: { value: number; max?: number }) {
  const width = Math.min((value / max) * 100, 100);
  const color = value >= 80 ? 'bg-success' : value >= 50 ? 'bg-warning' : 'bg-danger';
  return (
    <div className="h-1.5 w-full rounded-full bg-secondary">
      <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${width}%` }} />
    </div>
  );
}

function DetailModal({ row, onClose }: { row: BonusRow; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
          <div>
            <h3 className="font-semibold text-foreground">{row.name}</h3>
            <p className="text-xs text-muted-foreground">{row.department} · {row.seniority_label}</p>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-secondary text-muted-foreground">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Weights */}
          <div className="rounded-xl border border-[var(--border)] bg-muted p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pesos por seniority</p>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div>
                <p className="text-xs text-muted-foreground">Corporativo</p>
                <p className="text-xl font-bold text-cat-violet">{row.weights.company}%</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Personal</p>
                <p className="text-xl font-bold text-accent-foreground">{row.weights.area}%</p>
              </div>
            </div>
          </div>

          {/* Corporate */}
          <div className="rounded-xl border border-[var(--border)] bg-muted p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Objetivos Corporativos</p>
              {row.corporate.gateMet
                ? <span className="rounded-full bg-success-subtle px-2 py-0.5 text-xs font-medium text-[var(--green-700)]">Gate cumplido</span>
                : <span className="rounded-full bg-danger-subtle px-2 py-0.5 text-xs font-medium text-[var(--red-600)]">Gate no cumplido</span>}
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-sm text-muted-foreground">Completion corporativo</span>
              <span className="font-semibold text-foreground">{row.corporate.completion.toFixed(1)}%</span>
            </div>
          </div>

          {/* Personal */}
          <div className="rounded-xl border border-[var(--border)] bg-muted p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Objetivos Personales</p>
              <span className="text-xs text-muted-foreground">{row.personal.evaluatedCount}/{row.personal.totalCount} evaluados</span>
            </div>
            {row.personal.objectives.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin objetivos personales</p>
            ) : (
              <div className="space-y-2">
                {row.personal.objectives.map((obj, i) => (
                  <div key={i} className="flex items-center justify-between gap-3">
                    <p className="text-sm text-secondary-foreground flex-1 truncate">{obj.title}</p>
                    {obj.achievement !== null
                      ? <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${getBonusColor(obj.achievement)}`}>{obj.achievement}%</span>
                      : <span className="shrink-0 text-xs text-muted-foreground">Sin evaluar</span>}
                  </div>
                ))}
              </div>
            )}
            {row.personal.evaluatedCount > 0 && (
              <div className="mt-3 flex items-center justify-between border-t border-[var(--border)] pt-3">
                <span className="text-sm font-medium text-secondary-foreground">Promedio</span>
                <span className="font-semibold text-foreground">{row.personal.completion.toFixed(1)}%</span>
              </div>
            )}
          </div>

          {/* Desglose del cálculo */}
          <div className="rounded-xl border border-[var(--border)] bg-white p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Desglose del cálculo</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Componente corporativo ({row.corporate.completion.toFixed(1)}% × {row.weights.company}%)
                </span>
                <span className="font-semibold text-cat-violet">
                  {(row.corporate.completion * row.weights.company / 100).toFixed(2)}%
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Componente personal ({row.personal.completion.toFixed(1)}% × {row.weights.area}%)
                </span>
                <span className="font-semibold text-accent-foreground">
                  {(row.personal.completion * row.weights.area / 100).toFixed(2)}%
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-[var(--border)] pt-2 text-sm font-medium">
                <span className="text-secondary-foreground">Subtotal</span>
                <span className="text-foreground">{row.bonus.base.toFixed(2)}%</span>
              </div>
              {row.proRata.applies && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--amber-600)]">Pro-rata ({row.proRata.months} meses)</span>
                  <span className="font-medium text-[var(--amber-600)]">× {row.proRata.percentage}%</span>
                </div>
              )}
            </div>
            <div className="mt-3 flex items-center justify-between rounded-lg bg-muted px-4 py-3">
              <span className="font-semibold text-foreground">Bono a pagar</span>
              <span className={`text-2xl font-bold ${row.bonus.final >= 80 ? 'text-[var(--green-700)]' : row.bonus.final >= 50 ? 'text-[var(--amber-600)]' : 'text-[var(--red-600)]'}`}>
                {row.bonus.final.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute inset-0" onClick={onClose} />
    </div>
  );
}

export function BonosClient({ bonusRows, corporateSummary, selectedYear, availableYears }: Props) {
  const router = useRouter();
  const [deptFilter, setDeptFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'bonus' | 'personal' | 'corporate'>('bonus');
  const [sortDesc, setSortDesc] = useState(true);
  const [detailRow, setDetailRow] = useState<BonusRow | null>(null);

  const departments = useMemo(() => {
    const depts = new Set(bonusRows.map(r => r.department));
    return Array.from(depts).sort();
  }, [bonusRows]);

  const filtered = useMemo(() => {
    return bonusRows
      .filter(r => {
        const matchDept = deptFilter === 'all' || r.department === deptFilter;
        const matchSearch = search === '' || r.name.toLowerCase().includes(search.toLowerCase());
        return matchDept && matchSearch;
      })
      .sort((a, b) => {
        let diff = 0;
        if (sortBy === 'name') diff = a.name.localeCompare(b.name);
        else if (sortBy === 'bonus') diff = a.bonus.final - b.bonus.final;
        else if (sortBy === 'personal') diff = a.personal.completion - b.personal.completion;
        else if (sortBy === 'corporate') diff = a.corporate.completion - b.corporate.completion;
        return sortDesc ? -diff : diff;
      });
  }, [bonusRows, deptFilter, search, sortBy, sortDesc]);

  const stats = useMemo(() => {
    // Only employees where all personal objectives are evaluated (bonus is calculable)
    const calculable = bonusRows.filter(r =>
      r.personal.totalCount === 0 || r.personal.evaluatedCount === r.personal.totalCount
    );
    const avg = calculable.length > 0
      ? calculable.reduce((s, r) => s + r.bonus.final, 0) / calculable.length
      : 0;
    const noPersonal = bonusRows.filter(r => r.personal.totalCount === 0).length;
    const pendingEval = bonusRows.filter(r => r.personal.totalCount > 0 && r.personal.evaluatedCount < r.personal.totalCount).length;
    return { avg, calculable: calculable.length, noPersonal, pendingEval };
  }, [bonusRows]);

  function toggleSort(col: typeof sortBy) {
    if (sortBy === col) setSortDesc(d => !d);
    else { setSortBy(col); setSortDesc(true); }
  }

  function SortIcon({ col }: { col: typeof sortBy }) {
    if (sortBy !== col) return <span className="text-muted-foreground">↕</span>;
    return <span className="text-[var(--red-600)]">{sortDesc ? '↓' : '↑'}</span>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Bonos</h1>
          <p className="mt-1 text-sm text-muted-foreground">Cálculo de bono a pagar por empleado según objetivos</p>
        </div>
        <select
          value={selectedYear}
          onChange={e => router.push(`/admin/objectives/bonos?year=${e.target.value}`)}
          className="rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-secondary-foreground shadow-sm focus:border-danger/20 focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {availableYears.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* Corporate summary banner */}
      <div className={`rounded-xl border p-5 ${corporateSummary.billingGateMet ? 'border-success/20 bg-success-subtle' : 'border-danger/20 bg-danger-subtle'}`}>
        <div className="flex flex-wrap items-center gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Gate de Facturación</p>
            <div className="mt-1 flex items-center gap-2">
              {corporateSummary.billingGateMet
                ? <span className="inline-flex items-center rounded-full bg-success-subtle px-2.5 py-0.5 text-sm font-medium text-[var(--green-700)]">Cumplido</span>
                : <span className="inline-flex items-center rounded-full bg-danger-subtle px-2.5 py-0.5 text-sm font-medium text-[var(--red-600)]">No cumplido</span>}
              {corporateSummary.billingTarget !== null && (
                <span className="text-sm text-muted-foreground">
                  {corporateSummary.billingActual?.toLocaleString('es-AR') ?? '-'} / {corporateSummary.billingTarget.toLocaleString('es-AR')}
                </span>
              )}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Corp. Facturación</p>
            <p className="mt-1 text-xl font-bold text-secondary-foreground">{corporateSummary.billingCompletion.toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Corp. NPS</p>
            <p className="mt-1 text-xl font-bold text-secondary-foreground">{corporateSummary.npsCompletion.toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Score Corporativo</p>
            <p className="mt-1 text-xl font-bold text-secondary-foreground">{corporateSummary.totalCompletion.toFixed(1)}%</p>
          </div>
          {corporateSummary.npsQuarters.length > 0 && (
            <div className="flex gap-2">
              {corporateSummary.npsQuarters.map(q => (
                <span key={q.quarter} className={`rounded-full px-2 py-0.5 text-xs font-medium ${q.met ? 'bg-success-subtle text-[var(--green-700)]' : 'bg-secondary text-muted-foreground'}`}>
                  {q.quarter} {q.met ? '✓' : '✗'}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-[var(--border)] bg-white p-4 shadow-sm text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Promedio bono a pagar</p>
          <p className="mt-2 text-3xl font-bold text-[var(--red-600)]">{stats.avg.toFixed(1)}%</p>
          <p className="mt-1 text-xs text-muted-foreground">{stats.calculable} con bono calculado</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-white p-4 shadow-sm text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Empleados</p>
          <p className="mt-2 text-3xl font-bold text-foreground">{bonusRows.length}</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-white p-4 shadow-sm text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sin objetivos</p>
          <p className="mt-2 text-3xl font-bold text-muted-foreground">{stats.noPersonal}</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-white p-4 shadow-sm text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pend. evaluación</p>
          <p className="mt-2 text-3xl font-bold text-[var(--amber-600)]">{stats.pendingEval}</p>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-[var(--border)] bg-white shadow-sm">
        {/* Filters */}
        <div className="flex items-center gap-4 border-b border-[var(--border)] px-6 py-4">
          <input
            type="text"
            placeholder="Buscar empleado..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 rounded-lg border border-[var(--border)] px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-danger/20 focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <select
            value={deptFilter}
            onChange={e => setDeptFilter(e.target.value)}
            className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm focus:border-danger/20 focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="all">Todas las áreas</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <span className="text-xs text-muted-foreground shrink-0">{filtered.length} empleados</span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[var(--border)]">
            <thead className="bg-muted">
              <tr>
                <th
                  className="cursor-pointer px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
                  onClick={() => toggleSort('name')}
                >
                  Empleado <SortIcon col="name" />
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Área</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Seniority</th>
                <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pesos</th>
                <th
                  className="cursor-pointer px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
                  onClick={() => toggleSort('corporate')}
                >
                  Corporativo <SortIcon col="corporate" />
                </th>
                <th
                  className="cursor-pointer px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
                  onClick={() => toggleSort('personal')}
                >
                  Personal <SortIcon col="personal" />
                </th>
                <th
                  className="cursor-pointer px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
                  onClick={() => toggleSort('bonus')}
                >
                  Bono a pagar <SortIcon col="bonus" />
                </th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] bg-white">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-sm text-muted-foreground">
                    No se encontraron empleados
                  </td>
                </tr>
              ) : (
                filtered.map(row => (
                  <tr key={row.id} className="hover:bg-muted">
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-foreground">{row.name}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{row.department}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                        {row.seniority_label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-xs text-muted-foreground">{row.weights.company}% corp / {row.weights.area}% pers</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-sm font-semibold text-secondary-foreground">{row.corporate.completion.toFixed(1)}%</span>
                        <BonusBar value={row.corporate.completion} />
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col items-center gap-1">
                        {row.personal.totalCount === 0 ? (
                          <span className="text-xs text-muted-foreground">Sin obj.</span>
                        ) : row.personal.evaluatedCount < row.personal.totalCount ? (
                          <span className="text-xs text-[var(--amber-600)]">Pend. evaluación</span>
                        ) : (
                          <>
                            <span className="text-sm font-semibold text-secondary-foreground">{row.personal.completion.toFixed(1)}%</span>
                            <BonusBar value={row.personal.completion} />
                          </>
                        )}
                        <span className="text-xs text-muted-foreground">{row.personal.evaluatedCount}/{row.personal.totalCount}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex flex-col items-center gap-1">
                        {row.personal.totalCount === 0 ? (
                          <span className="text-xs text-muted-foreground">Pend. carga obj.</span>
                        ) : row.personal.evaluatedCount < row.personal.totalCount ? (
                          <span className="text-xs text-[var(--amber-600)]">Pend. evaluación</span>
                        ) : (
                          <span className={`rounded-full px-3 py-1 text-sm font-bold ${getBonusColor(row.bonus.final)}`}>
                            {row.bonus.final.toFixed(1)}%
                          </span>
                        )}
                        {row.proRata.applies && (
                          <span className="text-xs text-[var(--amber-600)]">Pro-rata {row.proRata.months}m ({Math.round(row.proRata.percentage)}%)</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => setDetailRow(row)}
                        className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-muted"
                      >
                        Ver
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {detailRow && <DetailModal row={detailRow} onClose={() => setDetailRow(null)} />}
    </div>
  );
}

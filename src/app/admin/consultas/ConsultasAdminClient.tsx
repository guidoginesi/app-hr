'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@pow/ui/components/ui/page-header';
import { SelectMenu } from '@pow/ui/components/ui/select-menu';
import { INQUIRY_CATEGORIES, CATEGORY_LABELS, STATUS_LABELS_HR, type InquiryCategory, type InquiryStatus } from '@/lib/inquiries';
import { ReportesPanel } from './ReportesPanel';

type Item = {
  id: string;
  employee_name: string;
  employee_email: string | null;
  category: InquiryCategory;
  subject: string;
  status: InquiryStatus;
  created_at: string;
  last_activity_at: string;
  sla_overdue: boolean;
  is_open: boolean;
  message_count: number;
  leader_shares: number;
  reopen_count: number;
};

const statusPill: Record<InquiryStatus, string> = {
  nueva: 'bg-accent text-[var(--brand-strong)]',
  en_curso: 'bg-secondary text-secondary-foreground',
  esperando_colaborador: 'bg-warning-subtle text-[var(--amber-600)]',
  resuelta: 'bg-success-subtle text-[var(--green-700)]',
  cerrada: 'bg-secondary text-muted-foreground',
};

export function ConsultasAdminClient() {
  const [items, setItems] = useState<Item[]>([]);
  const [stats, setStats] = useState({ total: 0, nuevas: 0, abiertas: 0, vencidas: 0 });
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [q, setQ] = useState('');
  const [onlyOpen, setOnlyOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'bandeja' | 'reportes'>('bandeja');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (status) p.set('status', status);
      if (category) p.set('category', category);
      if (q.trim()) p.set('q', q.trim());
      if (onlyOpen) p.set('only_open', '1');
      const res = await fetch(`/api/admin/inquiries?${p.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setItems(data.items ?? []);
        setStats(data.stats ?? { total: 0, nuevas: 0, abiertas: 0, vencidas: 0 });
      }
    } finally {
      setLoading(false);
    }
  }, [status, category, q, onlyOpen]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Consultas"
        description="Bandeja única de People. Las consultas de los colaboradores llegan acá."
      />

      <div className="inline-flex rounded-lg border border-[var(--border)] p-0.5">
        {([
          ['bandeja', 'Bandeja'],
          ['reportes', 'Reportes'],
        ] as const).map(([val, label]) => (
          <button
            key={val}
            type="button"
            onClick={() => setTab(val)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === val ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'reportes' && <ReportesPanel />}

      {tab === 'bandeja' && (
      <>
      <div className="grid grid-cols-4 gap-4">
        {[
          ['Abiertas', stats.abiertas],
          ['Nuevas', stats.nuevas],
          ['Vencidas', stats.vencidas],
          ['Total', stats.total],
        ].map(([label, value]) => (
          <div key={label as string} className="rounded-xl border border-[var(--border)] bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label as string}</p>
            <p className={`mt-1 text-3xl font-bold ${label === 'Vencidas' && (value as number) > 0 ? 'text-[var(--red-600)]' : 'text-foreground'}`}>
              {value as number}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por asunto…"
          className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-ring sm:w-64"
        />
        <SelectMenu
          ariaLabel="Estado"
          className="min-w-[170px]"
          value={status}
          onChange={setStatus}
          options={[
            { value: '', label: 'Estado: todos' },
            { value: 'nueva', label: 'Nueva' },
            { value: 'en_curso', label: 'En curso' },
            { value: 'esperando_colaborador', label: 'Esperando al colaborador' },
            { value: 'resuelta', label: 'Resuelta' },
            { value: 'cerrada', label: 'Cerrada' },
          ]}
        />
        <SelectMenu
          ariaLabel="Categoría"
          className="min-w-[190px]"
          value={category}
          onChange={setCategory}
          options={[{ value: '', label: 'Categoría: todas' }, ...INQUIRY_CATEGORIES]}
        />
        <label className="flex cursor-pointer items-center gap-2 text-sm text-secondary-foreground">
          <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} />
          Solo abiertas
        </label>
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm">
        {loading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Cargando…</div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">No hay consultas con estos filtros.</div>
        ) : (
          <table className="min-w-full divide-y divide-[var(--border)]">
            <thead className="bg-muted">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Consulta</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Colaborador</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Categoría</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Últ. actividad</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {items.map((i) => (
                <tr key={i.id} className="hover:bg-muted">
                  <td className="px-6 py-3">
                    <Link href={`/admin/consultas/${i.id}`} className="text-sm font-medium text-foreground hover:text-[var(--brand-strong)]">
                      {i.subject}
                    </Link>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      {i.sla_overdue && (
                        <span className="rounded bg-danger-subtle px-1.5 py-0.5 text-[10px] font-semibold text-[var(--red-600)]">
                          Sin responder — vencida
                        </span>
                      )}
                      {i.leader_shares > 0 && (
                        <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                          Compartida con el líder
                        </span>
                      )}
                      {i.reopen_count > 0 && (
                        <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                          Reabierta ×{i.reopen_count}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-foreground">{i.employee_name}</p>
                    {i.employee_email && <p className="text-xs text-muted-foreground">{i.employee_email}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{CATEGORY_LABELS[i.category]}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusPill[i.status]}`}>
                      {STATUS_LABELS_HR[i.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(i.last_activity_at).toLocaleDateString('es-AR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      </>
      )}
    </div>
  );
}

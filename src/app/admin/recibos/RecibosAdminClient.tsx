'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@pow/ui/components/ui/button';
import { PageHeader } from '@pow/ui/components/ui/page-header';
import { SelectMenu } from '@pow/ui/components/ui/select-menu';
import { formatPayrollPeriodLabelFromKey, type PayrollPeriodType } from '@/lib/payrollPeriods';
import { RECEIPT_STATUS_LABELS, type ReceiptStatus } from '@/lib/payrollReceipts';

type Item = {
  id: string;
  period_id: string;
  employee_name: string;
  employee_email: string | null;
  sent_at: string | null;
  acknowledged_at: string | null;
  receipt_status: ReceiptStatus;
};

type Period = {
  period_id: string;
  period_year: number;
  period_month: number;
  period_type: PayrollPeriodType | null;
  publicados: number;
  confirmados: number;
  pendientes: number;
  exentos: number;
};

const fmt = (iso: string | null): string =>
  iso
    ? new Date(iso).toLocaleString('es-AR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

const statusBadge: Record<ReceiptStatus, string> = {
  recibido: 'bg-success-subtle text-[var(--green-700)]',
  pendiente: 'bg-warning-subtle text-[var(--amber-600)]',
  no_requiere: 'bg-secondary text-muted-foreground',
  no_publicado: 'bg-secondary text-muted-foreground',
};

export function RecibosAdminClient() {
  const [items, setItems] = useState<Item[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [periodId, setPeriodId] = useState('');
  const [filter, setFilter] = useState<'all' | 'recibido' | 'pendiente'>('all');
  const [loading, setLoading] = useState(true);
  const [reminding, setReminding] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/receipts');
      const data = await res.json();
      if (res.ok) {
        setItems(data.items ?? []);
        setPeriods(data.periods ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visible = items.filter((i) => {
    if (periodId && i.period_id !== periodId) return false;
    if (i.receipt_status === 'no_publicado') return false;
    if (filter === 'recibido') return i.receipt_status === 'recibido';
    if (filter === 'pendiente') return i.receipt_status === 'pendiente';
    return true;
  });

  const scoped = periods.filter((p) => !periodId || p.period_id === periodId);
  const totals = scoped.reduce(
    (acc, p) => ({
      publicados: acc.publicados + p.publicados,
      confirmados: acc.confirmados + p.confirmados,
      pendientes: acc.pendientes + p.pendientes,
    }),
    { publicados: 0, confirmados: 0, pendientes: 0 },
  );
  const pct = totals.publicados > 0 ? Math.round((totals.confirmados / totals.publicados) * 100) : 0;

  const exportCsv = () => {
    const qs = periodId ? `?period_id=${periodId}` : '';
    window.location.href = `/api/admin/receipts/export${qs}`;
  };

  const remind = async () => {
    if (!periodId) {
      setMessage({ type: 'error', text: 'Elegí un período para enviar recordatorios.' });
      return;
    }
    setReminding(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/payroll/periods/${periodId}/remind-pending`, { method: 'POST' });
      const data = await res.json();
      setMessage(
        res.ok
          ? { type: 'success', text: data.message || 'Recordatorios enviados' }
          : { type: 'error', text: data.error || 'Error al enviar recordatorios' },
      );
    } catch {
      setMessage({ type: 'error', text: 'Error al enviar recordatorios' });
    } finally {
      setReminding(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recepción de recibos"
        description="Quién confirmó haber recibido su recibo de sueldo. La constancia acredita la recepción del documento, no la conformidad con lo liquidado."
      />

      {message && (
        <div
          className={`rounded-lg p-4 text-sm ${
            message.type === 'success'
              ? 'bg-success-subtle text-[var(--green-700)]'
              : 'bg-danger-subtle text-[var(--red-600)]'
          }`}
        >
          {message.text}
          <button onClick={() => setMessage(null)} className="ml-2 text-xs underline">
            Cerrar
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <SelectMenu
          ariaLabel="Período"
          className="min-w-[220px]"
          value={periodId}
          onChange={setPeriodId}
          options={[
            { value: '', label: 'Todos los períodos' },
            ...periods.map((p) => ({
              value: p.period_id,
              label: formatPayrollPeriodLabelFromKey({
                year: p.period_year,
                month: p.period_month,
                period_type: p.period_type ?? 'MONTHLY',
              }),
            })),
          ]}
        />
        <div className="inline-flex rounded-lg border border-[var(--border)] p-0.5">
          {([
            ['all', 'Todos'],
            ['recibido', 'Confirmados'],
            ['pendiente', 'Pendientes'],
          ] as const).map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => setFilter(val)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === val ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {periodId && totals.pendientes > 0 && (
            <Button variant="outline" size="sm" loading={reminding} onClick={remind}>
              Recordar a pendientes ({totals.pendientes})
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={exportCsv}>
            Exportar constancias
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          ['Publicados', totals.publicados, null],
          ['Confirmados', totals.confirmados, pct],
          ['Pendientes', totals.pendientes, null],
        ].map(([label, value, percent]) => (
          <div key={label as string} className="rounded-xl border border-[var(--border)] bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label as string}</p>
            <p className="mt-1 text-3xl font-bold text-foreground">{value as number}</p>
            {percent !== null && (
              <>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-success transition-all" style={{ width: `${percent}%` }} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{percent as number}%</p>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm">
        {loading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Cargando…</div>
        ) : visible.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            No hay recibos publicados para este filtro.
          </div>
        ) : (
          <table className="min-w-full divide-y divide-[var(--border)]">
            <thead className="bg-muted">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Colaborador</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Publicado</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Confirmado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {visible.map((i) => (
                <tr key={i.id} className="hover:bg-muted">
                  <td className="px-6 py-3">
                    <p className="text-sm font-medium text-foreground">{i.employee_name}</p>
                    {i.employee_email && <p className="text-xs text-muted-foreground">{i.employee_email}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmt(i.sent_at)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusBadge[i.receipt_status]}`}>
                      {RECEIPT_STATUS_LABELS[i.receipt_status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmt(i.acknowledged_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

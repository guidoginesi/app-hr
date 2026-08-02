'use client';

import { useState } from 'react';
import { Button } from '@pow/ui/components/ui/button';
import { receiptStatus, type ReceiptStatus } from '@/lib/payrollReceipts';

export type AckSettlement = {
  id: string;
  employee_name: string;
  employee_email?: string | null;
  contract_type: string;
  status: string;
  sent_at?: string | null;
  payslip_url: string | null;
  payslip2_url: string | null;
  requires_acknowledgement?: boolean | null;
  acknowledged_at?: string | null;
};

type Filter = 'all' | 'recibido' | 'pendiente';

const fmt = (iso: string | null | undefined): string =>
  iso
    ? new Date(iso).toLocaleString('es-AR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

const asReceipt = (s: AckSettlement) => ({
  status: s.status,
  requires_acknowledgement: s.requires_acknowledgement,
  acknowledged_at: s.acknowledged_at,
  pdf_storage_path: s.payslip_url,
  pdf2_storage_path: s.payslip2_url,
});

export function ReceiptAcknowledgementSection({
  settlements,
  onRemind,
  reminding = false,
}: {
  settlements: AckSettlement[];
  onRemind?: () => void;
  reminding?: boolean;
}) {
  const [filter, setFilter] = useState<Filter>('all');

  // Solo relación de dependencia: el monotributista no recibe recibo.
  const relDep = settlements.filter((s) => s.contract_type === 'RELACION_DEPENDENCIA');
  const withStatus = relDep.map((s) => ({ s, st: receiptStatus(asReceipt(s)) as ReceiptStatus }));

  const publicados = withStatus.filter((x) => x.st !== 'no_publicado');
  const confirmados = publicados.filter((x) => x.st === 'recibido');
  const pendientes = publicados.filter((x) => x.st === 'pendiente');
  const exentos = publicados.filter((x) => x.st === 'no_requiere');

  if (relDep.length === 0) return null;

  // % sobre los que requieren acuse (los exentos no se pueden confirmar).
  const conAcuse = confirmados.length + pendientes.length;
  const pct = conAcuse > 0 ? Math.round((confirmados.length / conAcuse) * 100) : 0;

  const rows = publicados.filter((x) => {
    if (filter === 'recibido') return x.st === 'recibido';
    if (filter === 'pendiente') return x.st === 'pendiente';
    return true;
  });

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-6 py-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Recepción de recibos</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Constancia de que el colaborador accedió a su recibo. No es conformidad con lo liquidado.
          </p>
        </div>
        {onRemind && pendientes.length > 0 && (
          <Button variant="outline" size="sm" loading={reminding} onClick={onRemind}>
            Recordar a pendientes ({pendientes.length})
          </Button>
        )}
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-3 gap-4 px-6 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Publicados</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{publicados.length}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Confirmados</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{confirmados.length}</p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-success transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{pct}%</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pendientes</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{pendientes.length}</p>
          {exentos.length > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">{exentos.length} sin acuse requerido</p>
          )}
        </div>
      </div>

      {/* Filtro */}
      <div className="flex gap-1 border-t border-[var(--border)] px-6 py-3">
        {([
          ['all', `Todos (${publicados.length})`],
          ['recibido', `Confirmados (${confirmados.length})`],
          ['pendiente', `Pendientes (${pendientes.length})`],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key as Filter)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === key ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tabla */}
      {rows.length === 0 ? (
        <div className="px-6 py-10 text-center text-sm text-muted-foreground">
          {publicados.length === 0
            ? 'Todavía no hay recibos publicados en este período.'
            : 'No hay liquidaciones en este filtro.'}
        </div>
      ) : (
        <div className="overflow-x-auto">
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
              {rows.map(({ s, st }) => (
                <tr key={s.id} className="hover:bg-muted">
                  <td className="px-6 py-3">
                    <p className="text-sm font-medium text-foreground">{s.employee_name}</p>
                    {s.employee_email && <p className="text-xs text-muted-foreground">{s.employee_email}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmt(s.sent_at)}</td>
                  <td className="px-4 py-3">
                    {st === 'recibido' ? (
                      <span className="inline-flex rounded-full bg-success-subtle px-2 py-0.5 text-[10px] font-semibold text-[var(--green-700)]">
                        Recibido
                      </span>
                    ) : st === 'pendiente' ? (
                      <span className="inline-flex rounded-full bg-warning-subtle px-2 py-0.5 text-[10px] font-semibold text-[var(--amber-600)]">
                        Pendiente
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        Sin acuse requerido
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmt(s.acknowledged_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@pow/ui/components/ui/button';
import { ADVANCE_STATUS_LABELS } from '@/lib/salaryAdvances';
import type { SalaryAdvanceStatus } from '@/types/salaryAdvance';

type Row = {
  id: string;
  employee_name: string;
  amount: number;
  status: SalaryAdvanceStatus;
  mode: 'computado' | 'informado';
  applied: boolean;
};

const ars = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(n);

export function PeriodAdvancesSection({ periodId }: { periodId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [periodType, setPeriodType] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/payroll/periods/${periodId}/advances`);
      const data = await res.json();
      if (res.ok) {
        setRows(data.advances ?? []);
        setPeriodType(data.period_type ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, [periodId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await fetch(`/api/admin/payroll/periods/${periodId}/advances`, { method: 'POST' });
      await fetchData();
    } finally {
      setRefreshing(false);
    }
  };

  // Los adelantos solo aplican a períodos mensuales.
  if (!loading && periodType && periodType !== 'MONTHLY') return null;
  if (loading) return null;

  const hasInformed = rows.some((r) => r.mode === 'informado');

  return (
    <div className="rounded-xl border border-[var(--border)] bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Adelantos del mes</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {rows.length === 0 ? 'Sin adelantos para descontar este mes' : `${rows.length} adelanto${rows.length !== 1 ? 's' : ''} a descontar`}
          </p>
        </div>
        <Button variant="secondary" onClick={refresh} loading={refreshing}>
          Actualizar adelantos
        </Button>
      </div>

      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-muted text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-6 py-3">Colaborador</th>
                <th className="px-6 py-3 text-right">Monto</th>
                <th className="px-6 py-3">Descuento</th>
                <th className="px-6 py-3">Estado adelanto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-6 py-3 font-medium text-foreground">{r.employee_name}</td>
                  <td className="px-6 py-3 text-right font-medium text-foreground nums-tabular">− {ars(r.amount)}</td>
                  <td className="px-6 py-3">
                    {r.mode === 'computado' ? (
                      <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">Computado</span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-warning-subtle px-2.5 py-0.5 text-xs font-medium text-[var(--amber-600)]">Informado</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-muted-foreground">{ADVANCE_STATUS_LABELS[r.status]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {hasInformed && (
        <div className="border-t border-[var(--border)] px-6 py-3">
          <p className="text-xs text-muted-foreground">
            <b className="text-foreground">Informado</b>: en relación de dependencia el recibo es un PDF, así que el descuento no se computa solo — aplicalo al armar el recibo. Al cerrar el período, el adelanto se marca saldado igualmente.
          </p>
        </div>
      )}
    </div>
  );
}

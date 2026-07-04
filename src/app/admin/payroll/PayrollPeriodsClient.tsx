'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  formatPayrollPeriodLabelFromKey,
  MONTH_NAMES,
  PAYROLL_PERIOD_TYPE_OPTIONS,
  periodTypeBadge,
  type PayrollPeriodType,
} from '@/lib/payrollPeriods';

type PeriodStatus = 'DRAFT' | 'IN_REVIEW' | 'SENT' | 'CLOSED';

async function readApiError(res: Response, fallback: string): Promise<string> {
  const contentType = res.headers.get('Content-Type') || '';
  if (contentType.includes('application/json')) {
    const data = await res.json();
    return data.error || fallback;
  }
  return fallback;
}

type PayrollPeriod = {
  id: string;
  year: number;
  month: number;
  period_type: PayrollPeriodType;
  status: PeriodStatus;
  settlement_counts: {
    total: number;
    draft: number;
    ready_to_send: number;
    sent: number;
  };
  created_at: string;
};

export function PayrollPeriodsClient() {
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [formData, setFormData] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    period_type: 'MONTHLY' as PayrollPeriodType,
  });

  const fetchPeriods = async () => {
    try {
      const res = await fetch('/api/admin/payroll/periods');
      if (res.ok) {
        const data = await res.json();
        setPeriods(data.periods || data);
      }
    } catch {
      setMessage({ type: 'error', text: 'Error al cargar los periodos' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPeriods();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const payload =
        formData.period_type === 'MONTHLY'
          ? formData
          : { year: formData.year, period_type: formData.period_type };

      const res = await fetch('/api/admin/payroll/periods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        await res.json();
        await fetchPeriods();
        setShowModal(false);
        setMessage({ type: 'success', text: 'Periodo creado exitosamente' });
      } else {
        const text = await readApiError(res, 'Error al crear el periodo');
        setMessage({ type: 'error', text });
      }
    } catch {
      setMessage({ type: 'error', text: 'Error al crear el periodo' });
    } finally {
      setSaving(false);
    }
  };

  const selectedType = PAYROLL_PERIOD_TYPE_OPTIONS.find((o) => o.value === formData.period_type);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Periodos de Liquidación</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestiona liquidaciones mensuales y períodos de SAC (Sueldo Anual Complementario)
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-[var(--primary-hover)]"
        >
          Nuevo periodo
        </button>
      </div>

      {message && (
        <div className={`rounded-lg p-4 text-sm ${
          message.type === 'success' ? 'bg-success-subtle text-[var(--green-700)]' : 'bg-danger-subtle text-[var(--red-600)]'
        }`}>
          {message.text}
          <button onClick={() => setMessage(null)} className="ml-2 text-xs underline">
            Cerrar
          </button>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setShowModal(false)} />
            <div className="relative w-full max-w-md rounded-xl bg-white shadow-2xl">
              <div className="border-b border-[var(--border)] px-6 py-4">
                <h2 className="text-lg font-semibold text-foreground">Nuevo periodo</h2>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="space-y-4 p-6">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-secondary-foreground">Tipo de periodo *</label>
                    <select
                      value={formData.period_type}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          period_type: e.target.value as PayrollPeriodType,
                        }))
                      }
                      className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      {PAYROLL_PERIOD_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {selectedType && (
                      <p className="mt-1 text-xs text-muted-foreground">{selectedType.description}</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-secondary-foreground">Año *</label>
                    <input
                      type="number"
                      value={formData.year}
                      onChange={(e) => setFormData((prev) => ({ ...prev, year: parseInt(e.target.value) }))}
                      min={2020}
                      max={2100}
                      required
                      className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                  {formData.period_type === 'MONTHLY' ? (
                    <div>
                      <label className="mb-1 block text-sm font-medium text-secondary-foreground">Mes *</label>
                      <select
                        value={formData.month}
                        onChange={(e) => setFormData((prev) => ({ ...prev, month: parseInt(e.target.value) }))}
                        required
                        className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        {MONTH_NAMES.map((name, idx) => (
                          <option key={idx + 1} value={idx + 1}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-[var(--orange-100)] bg-accent px-3 py-2 text-sm text-accent-foreground">
                      Se liquidará en Diciembre (2do semestre: Julio–Diciembre).
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-3 border-t border-[var(--border)] px-6 py-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-muted"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-[var(--primary-hover)] disabled:opacity-50"
                  >
                    {saving ? 'Creando...' : 'Crear periodo'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-[var(--border)] bg-white shadow-sm">
        {loading ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-muted-foreground">Cargando periodos...</p>
          </div>
        ) : periods.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-muted-foreground">No hay periodos de liquidación</p>
            <p className="mt-1 text-xs text-muted-foreground">Crea un periodo para comenzar</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border)] bg-muted text-left">
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Periodo</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Empleados</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Listos</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Enviados</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {periods.map((period) => {
                  const badge = periodTypeBadge(period.period_type ?? 'MONTHLY');
                  return (
                    <tr key={period.id} className="transition-colors hover:bg-muted">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">
                            {formatPayrollPeriodLabelFromKey({
                              year: period.year,
                              month: period.month,
                              period_type: period.period_type ?? 'MONTHLY',
                            })}
                          </span>
                          {badge && (
                            <span className="inline-flex items-center rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
                              {badge}
                            </span>
                          )}
                          {period.status === 'CLOSED' && (
                            <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
                              Cerrado
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{period.settlement_counts?.total ?? 0}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{period.settlement_counts?.ready_to_send ?? 0}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{period.settlement_counts?.sent ?? 0}</td>
                      <td className="px-6 py-4">
                        <Link
                          href={`/admin/payroll/${period.id}`}
                          className="text-sm font-medium text-accent-foreground hover:text-accent-foreground"
                        >
                          Ver detalle
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

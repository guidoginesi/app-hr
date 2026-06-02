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
        const data = await res.json();
        setMessage({ type: 'error', text: data.error || 'Error al crear el periodo' });
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
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Periodos de Liquidación</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Gestiona liquidaciones mensuales y períodos de SAC (Sueldo Anual Complementario)
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Nuevo periodo
        </button>
      </div>

      {message && (
        <div className={`rounded-lg p-4 text-sm ${
          message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
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
              <div className="border-b border-zinc-200 px-6 py-4">
                <h2 className="text-lg font-semibold text-zinc-900">Nuevo periodo</h2>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="space-y-4 p-6">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-zinc-700">Tipo de periodo *</label>
                    <select
                      value={formData.period_type}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          period_type: e.target.value as PayrollPeriodType,
                        }))
                      }
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                    >
                      {PAYROLL_PERIOD_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {selectedType && (
                      <p className="mt-1 text-xs text-zinc-500">{selectedType.description}</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-zinc-700">Año *</label>
                    <input
                      type="number"
                      value={formData.year}
                      onChange={(e) => setFormData((prev) => ({ ...prev, year: parseInt(e.target.value) }))}
                      min={2020}
                      max={2100}
                      required
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                    />
                  </div>
                  {formData.period_type === 'MONTHLY' ? (
                    <div>
                      <label className="mb-1 block text-sm font-medium text-zinc-700">Mes *</label>
                      <select
                        value={formData.month}
                        onChange={(e) => setFormData((prev) => ({ ...prev, month: parseInt(e.target.value) }))}
                        required
                        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                      >
                        {MONTH_NAMES.map((name, idx) => (
                          <option key={idx + 1} value={idx + 1}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-sm text-indigo-800">
                      {formData.period_type === 'SAC_1'
                        ? 'Se liquidará en Junio (1er semestre: Enero–Junio).'
                        : 'Se liquidará en Diciembre (2do semestre: Julio–Diciembre).'}
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-3 border-t border-zinc-200 px-6 py-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {saving ? 'Creando...' : 'Crear periodo'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
        {loading ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-zinc-500">Cargando periodos...</p>
          </div>
        ) : periods.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-zinc-500">No hay periodos de liquidación</p>
            <p className="mt-1 text-xs text-zinc-400">Crea un periodo para comenzar</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-left">
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Periodo</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Empleados</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Listos</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Enviados</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {periods.map((period) => {
                  const badge = periodTypeBadge(period.period_type ?? 'MONTHLY');
                  return (
                    <tr key={period.id} className="transition-colors hover:bg-zinc-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-zinc-900">
                            {formatPayrollPeriodLabelFromKey({
                              year: period.year,
                              month: period.month,
                              period_type: period.period_type ?? 'MONTHLY',
                            })}
                          </span>
                          {badge && (
                            <span className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                              {badge}
                            </span>
                          )}
                          {period.status === 'CLOSED' && (
                            <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">
                              Cerrado
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-zinc-600">{period.settlement_counts?.total ?? 0}</td>
                      <td className="px-6 py-4 text-sm text-zinc-600">{period.settlement_counts?.ready_to_send ?? 0}</td>
                      <td className="px-6 py-4 text-sm text-zinc-600">{period.settlement_counts?.sent ?? 0}</td>
                      <td className="px-6 py-4">
                        <Link
                          href={`/admin/payroll/${period.id}`}
                          className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
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

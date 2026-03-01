'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

type PeriodStatus = 'DRAFT' | 'IN_REVIEW' | 'SENT' | 'CLOSED';

type PayrollPeriod = {
  id: string;
  year: number;
  month: number;
  status: PeriodStatus;
  employee_count: number;
  ready_count: number;
  sent_count: number;
  created_at: string;
};

const statusConfig: Record<PeriodStatus, { label: string; classes: string }> = {
  DRAFT: { label: 'Borrador', classes: 'bg-zinc-100 text-zinc-700' },
  IN_REVIEW: { label: 'En revisión', classes: 'bg-amber-100 text-amber-700' },
  SENT: { label: 'Enviado', classes: 'bg-emerald-100 text-emerald-700' },
  CLOSED: { label: 'Cerrado', classes: 'bg-zinc-100 text-zinc-600' },
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
      const res = await fetch('/api/admin/payroll/periods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Periodos de Liquidación</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Gestiona los periodos de liquidación mensual
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

      {/* New Period Modal */}
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

      {/* Periods Table */}
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
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Estado</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Empleados</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Listos</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Enviados</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {periods.map((period) => {
                  const config = statusConfig[period.status];
                  return (
                    <tr key={period.id} className="transition-colors hover:bg-zinc-50">
                      <td className="px-6 py-4 text-sm font-medium text-zinc-900">
                        {MONTH_NAMES[period.month - 1]} {period.year}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.classes}`}>
                          {config.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-zinc-600">{period.employee_count}</td>
                      <td className="px-6 py-4 text-sm text-zinc-600">{period.ready_count}</td>
                      <td className="px-6 py-4 text-sm text-zinc-600">{period.sent_count}</td>
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

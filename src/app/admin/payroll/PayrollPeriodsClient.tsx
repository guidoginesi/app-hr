'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import {
  formatPayrollPeriodLabelFromKey,
  MONTH_NAMES,
  PAYROLL_PERIOD_TYPE_OPTIONS,
  periodTypeBadge,
  type PayrollPeriodType,
} from '@/lib/payrollPeriods';
import { Button } from '@pow/ui/components/ui/button';
import { SelectMenu } from '@pow/ui/components/ui/select-menu';
import { Sheet, SheetContent, SheetClose } from '@pow/ui/components/ui/sheet';
import { SkeletonRows } from '@pow/ui/components/ui/skeleton';

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

export function PayrollPeriodsClient({ soloLectura = false }: { soloLectura?: boolean }) {
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

      <Sheet open={showModal} onOpenChange={(o) => { if (!o) setShowModal(false); }}>
        <SheetContent side="right" flush title="Nuevo periodo">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
            <h2 className="text-base font-semibold text-foreground">Nuevo periodo</h2>
            <SheetClose
              aria-label="Cerrar"
              className="-mr-1.5 grid h-8 w-8 place-items-center rounded-[var(--radius)] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-5 w-5" />
            </SheetClose>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 space-y-4 overflow-y-auto p-6">
              <div>
                <label className="mb-1 block text-sm font-medium text-secondary-foreground">Tipo de periodo *</label>
                <SelectMenu
                  ariaLabel="Tipo de periodo"
                  className="w-full"
                  value={formData.period_type}
                  onChange={(v) =>
                    setFormData((prev) => ({ ...prev, period_type: v as PayrollPeriodType }))
                  }
                  options={PAYROLL_PERIOD_TYPE_OPTIONS.map((option) => ({
                    value: option.value,
                    label: option.label,
                  }))}
                />
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
                  <SelectMenu
                    ariaLabel="Mes"
                    className="w-full"
                    value={String(formData.month)}
                    onChange={(v) => setFormData((prev) => ({ ...prev, month: parseInt(v) }))}
                    options={MONTH_NAMES.map((name, idx) => ({
                      value: String(idx + 1),
                      label: name,
                    }))}
                  />
                </div>
              ) : (
                <div className="rounded-lg border border-[var(--orange-100)] bg-accent px-3 py-2 text-sm text-accent-foreground">
                  Se liquidará en Diciembre (2do semestre: Julio–Diciembre).
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 border-t border-[var(--border)] p-4">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                Cancelar
              </Button>
              <Button type="submit" loading={saving}>
                Crear periodo
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm">
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">Periodos de liquidación</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Liquidaciones mensuales y períodos de SAC (Sueldo Anual Complementario)
            </p>
          </div>
          {!soloLectura && <Button onClick={() => setShowModal(true)}>Nuevo periodo</Button>}
        </div>
        {loading ? (
          <div className="px-6 py-6">
            <SkeletonRows rows={5} />
          </div>
        ) : periods.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-muted-foreground">No hay periodos de liquidación</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {soloLectura ? 'Todavía no hay ninguno cargado' : 'Crea un periodo para comenzar'}
            </p>
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
                          className="text-sm font-medium text-foreground hover:text-brand"
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

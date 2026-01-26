'use client';

import { useState } from 'react';
import { CorporateObjective, CorporateObjectiveType, OBJECTIVE_TYPE_LABELS, Quarter, QUARTER_LABELS } from '@/types/corporate-objectives';

type CorporateObjectivesClientProps = {
  initialObjectives: CorporateObjective[];
  currentYear: number;
};

type NpsQuarterForm = {
  title: string;
  description: string;
  target_value: string | number;
  actual_value: string | number;
};

const QUARTERS: Quarter[] = ['q1', 'q2', 'q3', 'q4'];

export function CorporateObjectivesClient({ initialObjectives, currentYear }: CorporateObjectivesClientProps) {
  const [objectives, setObjectives] = useState<CorporateObjective[]>(initialObjectives);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [saving, setSaving] = useState<string | null>(null); // Track which form is saving
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state for billing (annual)
  const [billingForm, setBillingForm] = useState(() => {
    const existing = initialObjectives.find(o => o.year === currentYear && o.objective_type === 'billing');
    return {
      title: existing?.title || `Facturación ${currentYear}`,
      description: existing?.description || '',
      target_value: existing?.target_value || '',
      gate_percentage: existing?.gate_percentage || 90,
      cap_percentage: existing?.cap_percentage || 150,
      actual_value: existing?.actual_value || '',
    };
  });

  // Form state for NPS (quarterly)
  const [npsQuarterForms, setNpsQuarterForms] = useState<Record<Quarter, NpsQuarterForm>>(() => {
    const forms: Record<Quarter, NpsQuarterForm> = {} as Record<Quarter, NpsQuarterForm>;
    QUARTERS.forEach(q => {
      const existing = initialObjectives.find(o => o.year === currentYear && o.objective_type === 'nps' && o.quarter === q);
      forms[q] = {
        title: existing?.title || `NPS ${QUARTER_LABELS[q]} ${currentYear}`,
        description: existing?.description || '',
        target_value: existing?.target_value || '',
        actual_value: existing?.actual_value || '',
      };
    });
    return forms;
  });

  // Update form when year changes
  const handleYearChange = (year: number) => {
    setSelectedYear(year);
    const billing = objectives.find(o => o.year === year && o.objective_type === 'billing');
    
    setBillingForm({
      title: billing?.title || `Facturación ${year}`,
      description: billing?.description || '',
      target_value: billing?.target_value || '',
      gate_percentage: billing?.gate_percentage || 90,
      cap_percentage: billing?.cap_percentage || 150,
      actual_value: billing?.actual_value || '',
    });

    const newNpsForms: Record<Quarter, NpsQuarterForm> = {} as Record<Quarter, NpsQuarterForm>;
    QUARTERS.forEach(q => {
      const existing = objectives.find(o => o.year === year && o.objective_type === 'nps' && o.quarter === q);
      newNpsForms[q] = {
        title: existing?.title || `NPS ${QUARTER_LABELS[q]} ${year}`,
        description: existing?.description || '',
        target_value: existing?.target_value || '',
        actual_value: existing?.actual_value || '',
      };
    });
    setNpsQuarterForms(newNpsForms);
  };

  const handleSaveBilling = async () => {
    setSaving('billing');
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        year: selectedYear,
        objective_type: 'billing',
        quarter: null,
        title: billingForm.title,
        description: billingForm.description || null,
        target_value: billingForm.target_value ? Number(billingForm.target_value) : null,
        gate_percentage: Number(billingForm.gate_percentage),
        cap_percentage: Number(billingForm.cap_percentage),
        actual_value: billingForm.actual_value ? Number(billingForm.actual_value) : null,
      };

      const res = await fetch('/api/admin/objectives/corporate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al guardar');
      }

      const saved = await res.json();
      
      setObjectives(prev => {
        const filtered = prev.filter(o => !(o.year === selectedYear && o.objective_type === 'billing'));
        return [...filtered, saved].sort((a, b) => b.year - a.year);
      });

      setSuccess('Objetivo de Facturación guardado correctamente');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(null);
    }
  };

  const handleSaveNpsQuarter = async (quarter: Quarter) => {
    setSaving(`nps-${quarter}`);
    setError(null);
    setSuccess(null);

    try {
      const formData = npsQuarterForms[quarter];
      const payload = {
        year: selectedYear,
        objective_type: 'nps',
        quarter,
        title: formData.title,
        description: formData.description || null,
        target_value: formData.target_value ? Number(formData.target_value) : null,
        actual_value: formData.actual_value ? Number(formData.actual_value) : null,
      };

      const res = await fetch('/api/admin/objectives/corporate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al guardar');
      }

      const saved = await res.json();
      
      setObjectives(prev => {
        const filtered = prev.filter(o => !(o.year === selectedYear && o.objective_type === 'nps' && o.quarter === quarter));
        return [...filtered, saved].sort((a, b) => b.year - a.year);
      });

      setSuccess(`NPS ${QUARTER_LABELS[quarter]} guardado correctamente`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(null);
    }
  };

  const updateNpsQuarterForm = (quarter: Quarter, field: keyof NpsQuarterForm, value: string) => {
    setNpsQuarterForms(prev => ({
      ...prev,
      [quarter]: { ...prev[quarter], [field]: value }
    }));
  };

  const years = [currentYear + 1, currentYear, currentYear - 1, currentYear - 2];
  const billingExists = objectives.some(o => o.year === selectedYear && o.objective_type === 'billing');
  const npsQuarterExists = (q: Quarter) => objectives.some(o => o.year === selectedYear && o.objective_type === 'nps' && o.quarter === q);
  const npsConfiguredCount = QUARTERS.filter(q => npsQuarterExists(q)).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Objetivos Corporativos</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Configura Facturación (anual) y NPS (trimestral) para cada año
          </p>
        </div>
        <select
          value={selectedYear}
          onChange={(e) => handleYearChange(Number(e.target.value))}
          className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-rose-500"
        >
          {years.map(year => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
      </div>

      {/* Messages */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}

      {/* Billing Card (Annual) */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
              <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">Facturación</h2>
              <p className="text-xs text-zinc-500">Objetivo anual de ingresos</p>
            </div>
          </div>
          {billingExists && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
              Configurado
            </span>
          )}
        </div>

        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-zinc-700">Título</label>
              <input
                type="text"
                value={billingForm.title}
                onChange={(e) => setBillingForm(prev => ({ ...prev, title: e.target.value }))}
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700">Descripción</label>
              <input
                type="text"
                value={billingForm.description}
                onChange={(e) => setBillingForm(prev => ({ ...prev, description: e.target.value }))}
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700">Meta ($)</label>
              <input
                type="number"
                value={billingForm.target_value}
                onChange={(e) => setBillingForm(prev => ({ ...prev, target_value: e.target.value }))}
                placeholder="1000000"
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700">Actual ($)</label>
              <input
                type="number"
                value={billingForm.actual_value}
                onChange={(e) => setBillingForm(prev => ({ ...prev, actual_value: e.target.value }))}
                placeholder="0"
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700">Gate (%)</label>
              <input
                type="number"
                value={billingForm.gate_percentage}
                onChange={(e) => setBillingForm(prev => ({ ...prev, gate_percentage: Number(e.target.value) }))}
                min={0}
                max={100}
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700">Cap (%)</label>
              <input
                type="number"
                value={billingForm.cap_percentage}
                onChange={(e) => setBillingForm(prev => ({ ...prev, cap_percentage: Number(e.target.value) }))}
                min={100}
                max={200}
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>
          </div>
          <button
            onClick={handleSaveBilling}
            disabled={saving !== null}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {saving === 'billing' ? 'Guardando...' : billingExists ? 'Actualizar Facturación' : 'Guardar Facturación'}
          </button>
        </div>
      </div>

      {/* NPS Section (Quarterly) */}
      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
              <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">NPS / Salud del cliente</h2>
              <p className="text-xs text-zinc-500">Objetivos trimestrales</p>
            </div>
          </div>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            npsConfiguredCount === 4 
              ? 'bg-blue-100 text-blue-700' 
              : npsConfiguredCount > 0 
              ? 'bg-amber-100 text-amber-700' 
              : 'bg-zinc-100 text-zinc-500'
          }`}>
            {npsConfiguredCount}/4 trimestres
          </span>
        </div>

        <div className="grid gap-4 p-6 md:grid-cols-2">
          {QUARTERS.map(quarter => {
            const form = npsQuarterForms[quarter];
            const exists = npsQuarterExists(quarter);
            
            return (
              <div key={quarter} className="rounded-lg border border-zinc-200 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-medium text-zinc-900">{QUARTER_LABELS[quarter]}</h3>
                  {exists && (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                      Configurado
                    </span>
                  )}
                </div>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-600">Título</label>
                    <input
                      type="text"
                      value={form.title}
                      onChange={(e) => updateNpsQuarterForm(quarter, 'title', e.target.value)}
                      className="mt-1 block w-full rounded border border-zinc-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-zinc-600">Objetivo</label>
                      <input
                        type="number"
                        value={form.target_value}
                        onChange={(e) => updateNpsQuarterForm(quarter, 'target_value', e.target.value)}
                        placeholder="75"
                        className="mt-1 block w-full rounded border border-zinc-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-600">Valor actual</label>
                      <input
                        type="number"
                        value={form.actual_value}
                        onChange={(e) => updateNpsQuarterForm(quarter, 'actual_value', e.target.value)}
                        placeholder="0"
                        className="mt-1 block w-full rounded border border-zinc-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handleSaveNpsQuarter(quarter)}
                    disabled={saving !== null}
                    className="w-full rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving === `nps-${quarter}` ? 'Guardando...' : exists ? 'Actualizar' : 'Guardar'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Historical objectives table */}
      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-zinc-900">Histórico de objetivos</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Año</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Tipo</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Período</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Título</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">Meta</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">Actual</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">Cumplimiento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 bg-white">
              {objectives.map((obj) => {
                const progress = obj.target_value && obj.actual_value
                  ? Math.round((obj.actual_value / obj.target_value) * 100)
                  : null;
                return (
                  <tr key={obj.id} className="hover:bg-zinc-50">
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-zinc-900">{obj.year}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-500">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        obj.objective_type === 'billing' 
                          ? 'bg-emerald-100 text-emerald-700' 
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {OBJECTIVE_TYPE_LABELS[obj.objective_type]}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-500">
                      {obj.quarter ? QUARTER_LABELS[obj.quarter] : 'Anual'}
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-900">{obj.title}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-zinc-500">
                      {obj.target_value?.toLocaleString('es-AR') || '-'}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-zinc-500">
                      {obj.actual_value?.toLocaleString('es-AR') || '-'}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                      {progress !== null ? (
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          progress >= 100 
                            ? 'bg-emerald-100 text-emerald-700' 
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {progress >= 100 ? 'Cumplido' : 'No cumplido'}
                        </span>
                      ) : (
                        <span className="text-zinc-400">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {objectives.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-sm text-zinc-500">
                    No hay objetivos corporativos configurados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ObjectivesPeriod, 
  ObjectivesPeriodType, 
  OBJECTIVES_PERIOD_TYPE_LABELS,
  OBJECTIVES_PERIOD_TYPE_DESCRIPTIONS 
} from '@/types/objective';

type PeriodsClientProps = {
  initialPeriods: ObjectivesPeriod[];
  currentYear: number;
};

export function PeriodsClient({ initialPeriods, currentYear }: PeriodsClientProps) {
  const router = useRouter();
  const [periods, setPeriods] = useState<ObjectivesPeriod[]>(initialPeriods);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const years = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];

  // Get period for specific year and type
  const getPeriod = (year: number, type: ObjectivesPeriodType): ObjectivesPeriod | null => {
    return periods.find(p => p.year === year && p.period_type === type) || null;
  };

  // Check if period is currently active (within dates)
  const isPeriodOpen = (period: ObjectivesPeriod | null): boolean => {
    if (!period || !period.is_active) return false;
    const today = new Date().toISOString().split('T')[0];
    return today >= period.start_date && today <= period.end_date;
  };

  // Form state for each period type
  const [definitionForm, setDefinitionForm] = useState(() => {
    const existing = getPeriod(selectedYear, 'definition');
    return {
      name: existing?.name || `Definición de objetivos ${selectedYear}`,
      description: existing?.description || '',
      start_date: existing?.start_date || `${selectedYear}-01-01`,
      end_date: existing?.end_date || `${selectedYear}-03-31`,
      is_active: existing?.is_active ?? true,
    };
  });

  const [evaluationForm, setEvaluationForm] = useState(() => {
    const existing = getPeriod(selectedYear, 'evaluation');
    return {
      name: existing?.name || `Evaluación de objetivos ${selectedYear}`,
      description: existing?.description || '',
      start_date: existing?.start_date || `${selectedYear}-12-01`,
      end_date: existing?.end_date || `${selectedYear}-12-31`,
      is_active: existing?.is_active ?? true,
    };
  });

  // Update forms when year changes
  const handleYearChange = (year: number) => {
    setSelectedYear(year);
    const defPeriod = getPeriod(year, 'definition');
    const evalPeriod = getPeriod(year, 'evaluation');
    
    setDefinitionForm({
      name: defPeriod?.name || `Definición de objetivos ${year}`,
      description: defPeriod?.description || '',
      start_date: defPeriod?.start_date || `${year}-01-01`,
      end_date: defPeriod?.end_date || `${year}-03-31`,
      is_active: defPeriod?.is_active ?? true,
    });

    setEvaluationForm({
      name: evalPeriod?.name || `Evaluación de objetivos ${year}`,
      description: evalPeriod?.description || '',
      start_date: evalPeriod?.start_date || `${year}-12-01`,
      end_date: evalPeriod?.end_date || `${year}-12-31`,
      is_active: evalPeriod?.is_active ?? true,
    });
  };

  const handleSave = async (periodType: ObjectivesPeriodType) => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    const form = periodType === 'definition' ? definitionForm : evaluationForm;

    try {
      const res = await fetch('/api/admin/objectives/periods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: selectedYear,
          period_type: periodType,
          ...form,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al guardar');
      }

      const saved = await res.json();
      
      // Update local state
      setPeriods(prev => {
        const others = prev.filter(p => !(p.year === selectedYear && p.period_type === periodType));
        return [...others, saved];
      });

      setSuccess(`Período de ${OBJECTIVES_PERIOD_TYPE_LABELS[periodType].toLowerCase()} guardado correctamente`);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const definitionPeriod = getPeriod(selectedYear, 'definition');
  const evaluationPeriod = getPeriod(selectedYear, 'evaluation');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Períodos de Objetivos</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Configura los períodos de definición y evaluación de objetivos
          </p>
        </div>
        <select
          value={selectedYear}
          onChange={(e) => handleYearChange(parseInt(e.target.value))}
          className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium shadow-sm focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
        >
          {years.map(year => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">{error}</div>
      )}
      {success && (
        <div className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-600">{success}</div>
      )}

      {/* Status Summary */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className={`rounded-xl border p-4 ${isPeriodOpen(definitionPeriod) ? 'border-emerald-200 bg-emerald-50' : 'border-zinc-200 bg-white'}`}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-900">Definición</span>
            {isPeriodOpen(definitionPeriod) ? (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">Abierto</span>
            ) : definitionPeriod ? (
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">Cerrado</span>
            ) : (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">No configurado</span>
            )}
          </div>
          {definitionPeriod && (
            <p className="mt-1 text-xs text-zinc-500">
              {formatDate(definitionPeriod.start_date)} - {formatDate(definitionPeriod.end_date)}
            </p>
          )}
        </div>
        <div className={`rounded-xl border p-4 ${isPeriodOpen(evaluationPeriod) ? 'border-emerald-200 bg-emerald-50' : 'border-zinc-200 bg-white'}`}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-900">Evaluación</span>
            {isPeriodOpen(evaluationPeriod) ? (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">Abierto</span>
            ) : evaluationPeriod ? (
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">Cerrado</span>
            ) : (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">No configurado</span>
            )}
          </div>
          {evaluationPeriod && (
            <p className="mt-1 text-xs text-zinc-500">
              {formatDate(evaluationPeriod.start_date)} - {formatDate(evaluationPeriod.end_date)}
            </p>
          )}
        </div>
      </div>

      {/* Definition Period Form */}
      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
              <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-zinc-900">Período de Definición</h3>
              <p className="text-sm text-zinc-500">{OBJECTIVES_PERIOD_TYPE_DESCRIPTIONS.definition}</p>
            </div>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Nombre</label>
              <input
                type="text"
                value={definitionForm.name}
                onChange={(e) => setDefinitionForm(prev => ({ ...prev, name: e.target.value }))}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Descripción</label>
              <input
                type="text"
                value={definitionForm.description}
                onChange={(e) => setDefinitionForm(prev => ({ ...prev, description: e.target.value }))}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
                placeholder="Opcional"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Fecha de inicio</label>
              <input
                type="date"
                value={definitionForm.start_date}
                onChange={(e) => setDefinitionForm(prev => ({ ...prev, start_date: e.target.value }))}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Fecha de cierre</label>
              <input
                type="date"
                value={definitionForm.end_date}
                onChange={(e) => setDefinitionForm(prev => ({ ...prev, end_date: e.target.value }))}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>
          </div>
          <div className="flex items-center justify-between pt-4 border-t border-zinc-100">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={definitionForm.is_active}
                onChange={(e) => setDefinitionForm(prev => ({ ...prev, is_active: e.target.checked }))}
                className="h-4 w-4 rounded border-zinc-300 text-rose-600 focus:ring-rose-500"
              />
              <span className="text-sm text-zinc-700">Período activo</span>
            </label>
            <button
              onClick={() => handleSave('definition')}
              disabled={saving}
              className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar período de definición'}
            </button>
          </div>
        </div>
      </div>

      {/* Evaluation Period Form */}
      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
              <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-zinc-900">Período de Evaluación</h3>
              <p className="text-sm text-zinc-500">{OBJECTIVES_PERIOD_TYPE_DESCRIPTIONS.evaluation}</p>
            </div>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Nombre</label>
              <input
                type="text"
                value={evaluationForm.name}
                onChange={(e) => setEvaluationForm(prev => ({ ...prev, name: e.target.value }))}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Descripción</label>
              <input
                type="text"
                value={evaluationForm.description}
                onChange={(e) => setEvaluationForm(prev => ({ ...prev, description: e.target.value }))}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
                placeholder="Opcional"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Fecha de inicio</label>
              <input
                type="date"
                value={evaluationForm.start_date}
                onChange={(e) => setEvaluationForm(prev => ({ ...prev, start_date: e.target.value }))}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Fecha de cierre</label>
              <input
                type="date"
                value={evaluationForm.end_date}
                onChange={(e) => setEvaluationForm(prev => ({ ...prev, end_date: e.target.value }))}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>
          </div>
          <div className="flex items-center justify-between pt-4 border-t border-zinc-100">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={evaluationForm.is_active}
                onChange={(e) => setEvaluationForm(prev => ({ ...prev, is_active: e.target.checked }))}
                className="h-4 w-4 rounded border-zinc-300 text-rose-600 focus:ring-rose-500"
              />
              <span className="text-sm text-zinc-700">Período activo</span>
            </label>
            <button
              onClick={() => handleSave('evaluation')}
              disabled={saving}
              className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar período de evaluación'}
            </button>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
        <h4 className="font-medium text-blue-900">¿Cómo funcionan los períodos?</h4>
        <ul className="mt-2 space-y-1 text-sm text-blue-700">
          <li>• <strong>Definición:</strong> Los líderes pueden crear y editar objetivos de su equipo</li>
          <li>• <strong>Evaluación:</strong> Los líderes registran el cumplimiento real de cada objetivo</li>
          <li>• Fuera de estos períodos, los objetivos quedan en modo solo lectura</li>
          <li>• Podés desactivar un período desmarcando &quot;Período activo&quot;</li>
        </ul>
      </div>
    </div>
  );
}

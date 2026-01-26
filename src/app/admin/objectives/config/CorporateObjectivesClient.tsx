'use client';

import { useState } from 'react';
import { CorporateObjective, CorporateObjectiveType, OBJECTIVE_TYPE_LABELS, Quarter, QUARTER_LABELS } from '@/types/corporate-objectives';

type CorporateObjectivesClientProps = {
  initialObjectives: CorporateObjective[];
  currentYear: number;
};

const QUARTERS: Quarter[] = ['q1', 'q2', 'q3', 'q4'];

type FormData = {
  objective_type: CorporateObjectiveType;
  year: number;
  quarter: Quarter | null;
  title: string;
  description: string;
  target_value: string;
  actual_value: string;
  gate_percentage: number;
  cap_percentage: number;
};

const emptyForm = (currentYear: number): FormData => ({
  objective_type: 'billing',
  year: currentYear,
  quarter: null,
  title: '',
  description: '',
  target_value: '',
  actual_value: '',
  gate_percentage: 90,
  cap_percentage: 150,
});

export function CorporateObjectivesClient({ initialObjectives, currentYear }: CorporateObjectivesClientProps) {
  const [objectives, setObjectives] = useState<CorporateObjective[]>(initialObjectives);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingObjective, setEditingObjective] = useState<CorporateObjective | null>(null);
  const [formData, setFormData] = useState<FormData>(emptyForm(currentYear));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const years = [currentYear + 1, currentYear, currentYear - 1, currentYear - 2, currentYear - 3];

  const openCreateModal = () => {
    setEditingObjective(null);
    setFormData(emptyForm(currentYear));
    setIsModalOpen(true);
    setError(null);
  };

  const openEditModal = (obj: CorporateObjective) => {
    setEditingObjective(obj);
    setFormData({
      objective_type: obj.objective_type,
      year: obj.year,
      quarter: obj.quarter,
      title: obj.title,
      description: obj.description || '',
      target_value: obj.target_value?.toString() || '',
      actual_value: obj.actual_value?.toString() || '',
      gate_percentage: obj.gate_percentage || 90,
      cap_percentage: obj.cap_percentage || 150,
    });
    setIsModalOpen(true);
    setError(null);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingObjective(null);
    setError(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      // Generate title if empty
      let title = formData.title;
      if (!title) {
        if (formData.objective_type === 'billing') {
          title = `Facturación ${formData.year}`;
        } else {
          title = `NPS ${formData.quarter ? QUARTER_LABELS[formData.quarter] : ''} ${formData.year}`;
        }
      }

      const payload = {
        year: formData.year,
        objective_type: formData.objective_type,
        quarter: formData.objective_type === 'nps' ? formData.quarter : null,
        title,
        description: formData.description || null,
        target_value: formData.target_value ? Number(formData.target_value) : null,
        actual_value: formData.actual_value ? Number(formData.actual_value) : null,
        gate_percentage: formData.objective_type === 'billing' ? Number(formData.gate_percentage) : null,
        cap_percentage: formData.objective_type === 'billing' ? Number(formData.cap_percentage) : null,
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
        // Remove existing if updating (same year, type, quarter)
        const filtered = prev.filter(o => !(
          o.year === saved.year && 
          o.objective_type === saved.objective_type && 
          o.quarter === saved.quarter
        ));
        return [...filtered, saved].sort((a, b) => {
          if (b.year !== a.year) return b.year - a.year;
          if (a.objective_type !== b.objective_type) return a.objective_type === 'billing' ? -1 : 1;
          if (a.quarter && b.quarter) {
            const qOrder: Record<Quarter, number> = { q1: 1, q2: 2, q3: 3, q4: 4 };
            return qOrder[a.quarter as Quarter] - qOrder[b.quarter as Quarter];
          }
          return 0;
        });
      });

      setSuccess('Objetivo guardado correctamente');
      setTimeout(() => setSuccess(null), 3000);
      closeModal();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (obj: CorporateObjective) => {
    if (!confirm(`¿Estás seguro de eliminar "${obj.title}"?`)) return;
    
    setDeleting(obj.id);
    try {
      const res = await fetch(`/api/admin/objectives/corporate?id=${obj.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al eliminar');
      }

      setObjectives(prev => prev.filter(o => o.id !== obj.id));
      setSuccess('Objetivo eliminado correctamente');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message);
      setTimeout(() => setError(null), 5000);
    } finally {
      setDeleting(null);
    }
  };

  // Group objectives by year
  const objectivesByYear = objectives.reduce((acc, obj) => {
    if (!acc[obj.year]) acc[obj.year] = [];
    acc[obj.year].push(obj);
    return acc;
  }, {} as Record<number, CorporateObjective[]>);

  const sortedYears = Object.keys(objectivesByYear).map(Number).sort((a, b) => b - a);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Objetivos Corporativos</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Gestiona los objetivos de Facturación y NPS de la empresa
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nuevo objetivo
        </button>
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

      {/* Objectives List */}
      {sortedYears.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center shadow-sm">
          <svg className="mx-auto h-12 w-12 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
          </svg>
          <h3 className="mt-4 text-base font-medium text-zinc-900">No hay objetivos corporativos</h3>
          <p className="mt-1 text-sm text-zinc-500">Crea tu primer objetivo de Facturación o NPS</p>
          <button
            onClick={openCreateModal}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Crear objetivo
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedYears.map(year => (
            <div key={year} className="rounded-xl border border-zinc-200 bg-white shadow-sm">
              <div className="border-b border-zinc-200 bg-zinc-50 px-6 py-3">
                <h2 className="text-lg font-semibold text-zinc-900">{year}</h2>
              </div>
              <div className="divide-y divide-zinc-100">
                {objectivesByYear[year].map(obj => {
                  const progress = obj.target_value && obj.actual_value
                    ? Math.round((obj.actual_value / obj.target_value) * 100)
                    : null;
                  
                  return (
                    <div key={obj.id} className="flex items-center justify-between px-6 py-4 hover:bg-zinc-50">
                      <div className="flex items-center gap-4">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                          obj.objective_type === 'billing' ? 'bg-emerald-100' : 'bg-blue-100'
                        }`}>
                          {obj.objective_type === 'billing' ? (
                            <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          ) : (
                            <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-zinc-900">{obj.title}</h3>
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              obj.objective_type === 'billing' 
                                ? 'bg-emerald-100 text-emerald-700' 
                                : 'bg-blue-100 text-blue-700'
                            }`}>
                              {OBJECTIVE_TYPE_LABELS[obj.objective_type]}
                            </span>
                            {obj.quarter && (
                              <span className="text-xs text-zinc-500">
                                {QUARTER_LABELS[obj.quarter]}
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex items-center gap-4 text-sm text-zinc-500">
                            {obj.target_value !== null && (
                              <span>Meta: {obj.objective_type === 'billing' ? '$' : ''}{obj.target_value.toLocaleString('es-AR')}</span>
                            )}
                            {obj.actual_value !== null && (
                              <span>Actual: {obj.objective_type === 'billing' ? '$' : ''}{obj.actual_value.toLocaleString('es-AR')}</span>
                            )}
                            {progress !== null && (
                              <span className={`font-medium ${progress >= 100 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                {progress}%
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditModal(obj)}
                          className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDelete(obj)}
                          disabled={deleting === obj.id}
                          className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          {deleting === obj.id ? 'Eliminando...' : 'Eliminar'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={closeModal} />
            
            <div className="relative w-full max-w-lg rounded-xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
                <h2 className="text-lg font-semibold text-zinc-900">
                  {editingObjective ? 'Editar objetivo' : 'Nuevo objetivo corporativo'}
                </h2>
                <button
                  onClick={closeModal}
                  className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-6 space-y-4">
                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                {/* Type selector */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-2">Tipo de objetivo</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, objective_type: 'billing', quarter: null }))}
                      className={`flex items-center gap-3 rounded-lg border-2 p-4 transition-all ${
                        formData.objective_type === 'billing'
                          ? 'border-emerald-500 bg-emerald-50'
                          : 'border-zinc-200 hover:border-zinc-300'
                      }`}
                    >
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                        formData.objective_type === 'billing' ? 'bg-emerald-100' : 'bg-zinc-100'
                      }`}>
                        <svg className={`h-5 w-5 ${formData.objective_type === 'billing' ? 'text-emerald-600' : 'text-zinc-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="text-left">
                        <p className={`font-medium ${formData.objective_type === 'billing' ? 'text-emerald-700' : 'text-zinc-700'}`}>Facturación</p>
                        <p className="text-xs text-zinc-500">Objetivo anual</p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, objective_type: 'nps', quarter: 'q1' }))}
                      className={`flex items-center gap-3 rounded-lg border-2 p-4 transition-all ${
                        formData.objective_type === 'nps'
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-zinc-200 hover:border-zinc-300'
                      }`}
                    >
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                        formData.objective_type === 'nps' ? 'bg-blue-100' : 'bg-zinc-100'
                      }`}>
                        <svg className={`h-5 w-5 ${formData.objective_type === 'nps' ? 'text-blue-600' : 'text-zinc-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="text-left">
                        <p className={`font-medium ${formData.objective_type === 'nps' ? 'text-blue-700' : 'text-zinc-700'}`}>NPS</p>
                        <p className="text-xs text-zinc-500">Objetivo trimestral</p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Year and Quarter */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">Año</label>
                    <select
                      value={formData.year}
                      onChange={(e) => setFormData(prev => ({ ...prev, year: Number(e.target.value) }))}
                      className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
                    >
                      {years.map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                  {formData.objective_type === 'nps' && (
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 mb-1">Trimestre</label>
                      <select
                        value={formData.quarter || 'q1'}
                        onChange={(e) => setFormData(prev => ({ ...prev, quarter: e.target.value as Quarter }))}
                        className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
                      >
                        {QUARTERS.map(q => (
                          <option key={q} value={q}>{QUARTER_LABELS[q]}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    Título <span className="text-zinc-400 font-normal">(opcional)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder={formData.objective_type === 'billing' 
                      ? `Facturación ${formData.year}` 
                      : `NPS ${formData.quarter ? QUARTER_LABELS[formData.quarter] : ''} ${formData.year}`
                    }
                    className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    Descripción <span className="text-zinc-400 font-normal">(opcional)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
                  />
                </div>

                {/* Values */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">
                      {formData.objective_type === 'billing' ? 'Meta ($)' : 'Meta (puntos)'}
                    </label>
                    <input
                      type="number"
                      value={formData.target_value}
                      onChange={(e) => setFormData(prev => ({ ...prev, target_value: e.target.value }))}
                      placeholder={formData.objective_type === 'billing' ? '1000000' : '75'}
                      className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">
                      {formData.objective_type === 'billing' ? 'Actual ($)' : 'Actual (puntos)'}
                    </label>
                    <input
                      type="number"
                      value={formData.actual_value}
                      onChange={(e) => setFormData(prev => ({ ...prev, actual_value: e.target.value }))}
                      placeholder="0"
                      className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
                    />
                  </div>
                </div>

                {/* Gate and Cap (only for billing) */}
                {formData.objective_type === 'billing' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 mb-1">Gate (%)</label>
                      <input
                        type="number"
                        value={formData.gate_percentage}
                        onChange={(e) => setFormData(prev => ({ ...prev, gate_percentage: Number(e.target.value) }))}
                        min={0}
                        max={100}
                        className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
                      />
                      <p className="mt-1 text-xs text-zinc-500">Mínimo para aplicar bono</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 mb-1">Cap (%)</label>
                      <input
                        type="number"
                        value={formData.cap_percentage}
                        onChange={(e) => setFormData(prev => ({ ...prev, cap_percentage: Number(e.target.value) }))}
                        min={100}
                        max={200}
                        className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
                      />
                      <p className="mt-1 text-xs text-zinc-500">Máximo multiplicador</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 border-t border-zinc-200 px-6 py-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : editingObjective ? 'Guardar cambios' : 'Crear objetivo'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

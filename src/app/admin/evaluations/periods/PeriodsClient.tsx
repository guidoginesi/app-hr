'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { EvaluationPeriod, PeriodStatus } from '@/types/evaluation';

type PeriodsClientProps = {
  periods: EvaluationPeriod[];
};

export function PeriodsClient({ periods: initialPeriods }: PeriodsClientProps) {
  const router = useRouter();
  const [periods, setPeriods] = useState<EvaluationPeriod[]>(initialPeriods);
  const [showForm, setShowForm] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<EvaluationPeriod | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    year: new Date().getFullYear(),
    start_date: '',
    end_date: '',
    evaluation_start_date: '',
    evaluation_end_date: '',
    is_active: false,
    status: 'draft' as PeriodStatus,
    self_evaluation_enabled: true,
    leader_evaluation_enabled: true,
    show_results_to_employee: false,
    objectives_enabled: true,
    recategorization_enabled: true,
  });

  const resetForm = () => {
    setFormData({
      name: '',
      year: new Date().getFullYear(),
      start_date: '',
      end_date: '',
      evaluation_start_date: '',
      evaluation_end_date: '',
      is_active: false,
      status: 'draft',
      self_evaluation_enabled: true,
      leader_evaluation_enabled: true,
      show_results_to_employee: false,
      objectives_enabled: true,
      recategorization_enabled: true,
    });
    setEditingPeriod(null);
    setShowForm(false);
  };

  const openEditForm = (period: EvaluationPeriod) => {
    setFormData({
      name: period.name,
      year: period.year,
      start_date: period.start_date,
      end_date: period.end_date,
      evaluation_start_date: period.evaluation_start_date || '',
      evaluation_end_date: period.evaluation_end_date || '',
      is_active: period.is_active,
      status: period.status,
      self_evaluation_enabled: period.self_evaluation_enabled,
      leader_evaluation_enabled: period.leader_evaluation_enabled,
      show_results_to_employee: period.show_results_to_employee,
      objectives_enabled: period.objectives_enabled,
      recategorization_enabled: period.recategorization_enabled,
    });
    setEditingPeriod(period);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const url = editingPeriod
        ? `/api/admin/evaluation-periods/${editingPeriod.id}`
        : '/api/admin/evaluation-periods';
      const method = editingPeriod ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        const period = await res.json();
        if (editingPeriod) {
          setPeriods(prev => prev.map(p => p.id === period.id ? period : p));
        } else {
          setPeriods(prev => [period, ...prev]);
        }
        resetForm();
        setMessage({ type: 'success', text: editingPeriod ? 'Período actualizado' : 'Período creado' });
        router.refresh();
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error al guardar el período' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este período?')) return;

    try {
      const res = await fetch(`/api/admin/evaluation-periods/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setPeriods(prev => prev.filter(p => p.id !== id));
        setMessage({ type: 'success', text: 'Período eliminado' });
        router.refresh();
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error al eliminar' });
    }
  };

  const toggleStatus = async (period: EvaluationPeriod, newStatus: PeriodStatus) => {
    try {
      const res = await fetch(`/api/admin/evaluation-periods/${period.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        const updated = await res.json();
        setPeriods(prev => prev.map(p => p.id === updated.id ? updated : p));
        router.refresh();
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error al actualizar estado' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Períodos de Evaluación</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Gestiona los ciclos de evaluación de desempeño
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
        >
          Nuevo período
        </button>
      </div>

      {message && (
        <div className={`rounded-lg p-4 text-sm ${
          message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
        }`}>
          {message.text}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50" onClick={resetForm} />
            <div className="relative w-full max-w-lg rounded-xl bg-white shadow-2xl">
              <div className="border-b border-zinc-200 px-6 py-4">
                <h2 className="text-lg font-semibold text-zinc-900">
                  {editingPeriod ? 'Editar período' : 'Nuevo período'}
                </h2>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">Nombre *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Ej: Evaluación de Desempeño 2025"
                      required
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-purple-600 focus:outline-none focus:ring-1 focus:ring-purple-600"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">Año *</label>
                    <input
                      type="number"
                      value={formData.year}
                      onChange={(e) => setFormData(prev => ({ ...prev, year: parseInt(e.target.value) }))}
                      min={2020}
                      max={2100}
                      required
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-purple-600 focus:outline-none focus:ring-1 focus:ring-purple-600"
                    />
                  </div>
                  
                  <div className="rounded-lg bg-zinc-50 p-4 space-y-3">
                    <p className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">Período evaluado</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Inicio *</label>
                        <input
                          type="date"
                          value={formData.start_date}
                          onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                          required
                          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-purple-600 focus:outline-none focus:ring-1 focus:ring-purple-600"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Fin *</label>
                        <input
                          type="date"
                          value={formData.end_date}
                          onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                          required
                          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-purple-600 focus:outline-none focus:ring-1 focus:ring-purple-600"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg bg-purple-50 p-4 space-y-3">
                    <p className="text-xs font-semibold text-purple-600 uppercase tracking-wider">Ventana para completar evaluación</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Inicio</label>
                        <input
                          type="date"
                          value={formData.evaluation_start_date}
                          onChange={(e) => setFormData(prev => ({ ...prev, evaluation_start_date: e.target.value }))}
                          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-purple-600 focus:outline-none focus:ring-1 focus:ring-purple-600"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Fin</label>
                        <input
                          type="date"
                          value={formData.evaluation_end_date}
                          onChange={(e) => setFormData(prev => ({ ...prev, evaluation_end_date: e.target.value }))}
                          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-purple-600 focus:outline-none focus:ring-1 focus:ring-purple-600"
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">Estado</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as PeriodStatus }))}
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-purple-600 focus:outline-none focus:ring-1 focus:ring-purple-600"
                    >
                      <option value="draft">Borrador</option>
                      <option value="open">Abierto</option>
                      <option value="closed">Cerrado</option>
                    </select>
                  </div>
                  <div className="space-y-3 pt-2">
                    <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Tipos de evaluación</p>
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={formData.self_evaluation_enabled}
                        onChange={(e) => setFormData(prev => ({ ...prev, self_evaluation_enabled: e.target.checked }))}
                        className="rounded border-zinc-300 text-purple-600 focus:ring-purple-600"
                      />
                      <span className="text-sm text-zinc-700">Autoevaluación habilitada</span>
                    </label>
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={formData.leader_evaluation_enabled}
                        onChange={(e) => setFormData(prev => ({ ...prev, leader_evaluation_enabled: e.target.checked }))}
                        className="rounded border-zinc-300 text-purple-600 focus:ring-purple-600"
                      />
                      <span className="text-sm text-zinc-700">Evaluación de líder habilitada</span>
                    </label>
                  </div>

                  <div className="space-y-3 pt-2">
                    <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Módulos de evaluación del líder</p>
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={formData.objectives_enabled}
                        onChange={(e) => setFormData(prev => ({ ...prev, objectives_enabled: e.target.checked }))}
                        className="rounded border-zinc-300 text-purple-600 focus:ring-purple-600"
                      />
                      <span className="text-sm text-zinc-700">Cumplimiento de objetivos</span>
                    </label>
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={formData.recategorization_enabled}
                        onChange={(e) => setFormData(prev => ({ ...prev, recategorization_enabled: e.target.checked }))}
                        className="rounded border-zinc-300 text-purple-600 focus:ring-purple-600"
                      />
                      <span className="text-sm text-zinc-700">Recategorización / Ascenso</span>
                    </label>
                  </div>

                  <div className="space-y-3 pt-2">
                    <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Configuración general</p>
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={formData.show_results_to_employee}
                        onChange={(e) => setFormData(prev => ({ ...prev, show_results_to_employee: e.target.checked }))}
                        className="rounded border-zinc-300 text-purple-600 focus:ring-purple-600"
                      />
                      <span className="text-sm text-zinc-700">Mostrar resultados al empleado</span>
                    </label>
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                        className="rounded border-zinc-300 text-purple-600 focus:ring-purple-600"
                      />
                      <span className="text-sm text-zinc-700">Período activo (solo uno puede estar activo)</span>
                    </label>
                  </div>
                </div>
                <div className="flex justify-end gap-3 border-t border-zinc-200 px-6 py-4">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                  >
                    {saving ? 'Guardando...' : editingPeriod ? 'Guardar cambios' : 'Crear período'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Periods List */}
      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
        {periods.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-zinc-500">No hay períodos de evaluación. Crea uno para comenzar.</p>
          </div>
        ) : (
          <ul className="divide-y divide-zinc-200">
            {periods.map((period) => (
              <li key={period.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-medium text-zinc-900">{period.name}</h3>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        period.status === 'open'
                          ? 'bg-green-100 text-green-700'
                          : period.status === 'closed'
                          ? 'bg-zinc-100 text-zinc-600'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {period.status === 'open' ? 'Abierto' : period.status === 'closed' ? 'Cerrado' : 'Borrador'}
                      </span>
                      {period.is_active && (
                        <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700">
                          Activo
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-zinc-500">
                      Período: {new Date(period.start_date).toLocaleDateString('es-AR')} - {new Date(period.end_date).toLocaleDateString('es-AR')}
                    </p>
                    {period.evaluation_start_date && period.evaluation_end_date && (
                      <p className="text-xs text-purple-600">
                        Ventana: {new Date(period.evaluation_start_date).toLocaleDateString('es-AR')} - {new Date(period.evaluation_end_date).toLocaleDateString('es-AR')}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {period.status === 'draft' && (
                      <button
                        onClick={() => toggleStatus(period, 'open')}
                        className="rounded-lg border border-green-200 px-3 py-1.5 text-xs font-medium text-green-600 hover:bg-green-50"
                      >
                        Abrir
                      </button>
                    )}
                    {period.status === 'open' && (
                      <button
                        onClick={() => toggleStatus(period, 'closed')}
                        className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
                      >
                        Cerrar
                      </button>
                    )}
                    <button
                      onClick={() => openEditForm(period)}
                      className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(period.id)}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

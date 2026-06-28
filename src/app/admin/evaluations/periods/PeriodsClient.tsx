'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { EvaluationPeriod, PeriodStatus } from '@/types/evaluation';

// Helper to format date without timezone issues
function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('es-AR');
}

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
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Períodos de Evaluación</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestiona los ciclos de evaluación de desempeño
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="rounded-lg bg-cat-violet px-4 py-2 text-sm font-medium text-white hover:bg-cat-violet"
        >
          Nuevo período
        </button>
      </div>

      {message && (
        <div className={`rounded-lg p-4 text-sm ${
          message.type === 'success' ? 'bg-success-subtle text-[var(--green-700)]' : 'bg-danger-subtle text-[var(--red-600)]'
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
              <div className="border-b border-[var(--border)] px-6 py-4">
                <h2 className="text-lg font-semibold text-foreground">
                  {editingPeriod ? 'Editar período' : 'Nuevo período'}
                </h2>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-secondary-foreground mb-1">Nombre *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Ej: Evaluación de Desempeño 2025"
                      required
                      className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-cat-violet focus:outline-none focus:ring-1 focus:ring-cat-violet"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-secondary-foreground mb-1">Año *</label>
                    <input
                      type="number"
                      value={formData.year}
                      onChange={(e) => setFormData(prev => ({ ...prev, year: parseInt(e.target.value) }))}
                      min={2020}
                      max={2100}
                      required
                      className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-cat-violet focus:outline-none focus:ring-1 focus:ring-cat-violet"
                    />
                  </div>
                  
                  <div className="rounded-lg bg-muted p-4 space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Período evaluado</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-secondary-foreground mb-1">Inicio *</label>
                        <input
                          type="date"
                          value={formData.start_date}
                          onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                          required
                          className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-cat-violet focus:outline-none focus:ring-1 focus:ring-cat-violet"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-secondary-foreground mb-1">Fin *</label>
                        <input
                          type="date"
                          value={formData.end_date}
                          onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                          required
                          className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-cat-violet focus:outline-none focus:ring-1 focus:ring-cat-violet"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg bg-cat-violet-subtle p-4 space-y-3">
                    <p className="text-xs font-semibold text-cat-violet uppercase tracking-wider">Ventana para completar evaluación</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-secondary-foreground mb-1">Inicio</label>
                        <input
                          type="date"
                          value={formData.evaluation_start_date}
                          onChange={(e) => setFormData(prev => ({ ...prev, evaluation_start_date: e.target.value }))}
                          className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-cat-violet focus:outline-none focus:ring-1 focus:ring-cat-violet"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-secondary-foreground mb-1">Fin</label>
                        <input
                          type="date"
                          value={formData.evaluation_end_date}
                          onChange={(e) => setFormData(prev => ({ ...prev, evaluation_end_date: e.target.value }))}
                          className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-cat-violet focus:outline-none focus:ring-1 focus:ring-cat-violet"
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-secondary-foreground mb-1">Estado</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as PeriodStatus }))}
                      className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-cat-violet focus:outline-none focus:ring-1 focus:ring-cat-violet"
                    >
                      <option value="draft">Borrador</option>
                      <option value="open">Abierto</option>
                      <option value="closed">Cerrado</option>
                    </select>
                  </div>
                  <div className="space-y-3 pt-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tipos de evaluación</p>
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={formData.self_evaluation_enabled}
                        onChange={(e) => setFormData(prev => ({ ...prev, self_evaluation_enabled: e.target.checked }))}
                        className="rounded border-[var(--border)] text-cat-violet focus:ring-cat-violet"
                      />
                      <span className="text-sm text-secondary-foreground">Autoevaluación habilitada</span>
                    </label>
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={formData.leader_evaluation_enabled}
                        onChange={(e) => setFormData(prev => ({ ...prev, leader_evaluation_enabled: e.target.checked }))}
                        className="rounded border-[var(--border)] text-cat-violet focus:ring-cat-violet"
                      />
                      <span className="text-sm text-secondary-foreground">Evaluación de líder habilitada</span>
                    </label>
                  </div>

                  <div className="space-y-3 pt-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Módulos de evaluación del líder</p>
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={formData.objectives_enabled}
                        onChange={(e) => setFormData(prev => ({ ...prev, objectives_enabled: e.target.checked }))}
                        className="rounded border-[var(--border)] text-cat-violet focus:ring-cat-violet"
                      />
                      <span className="text-sm text-secondary-foreground">Cumplimiento de objetivos</span>
                    </label>
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={formData.recategorization_enabled}
                        onChange={(e) => setFormData(prev => ({ ...prev, recategorization_enabled: e.target.checked }))}
                        className="rounded border-[var(--border)] text-cat-violet focus:ring-cat-violet"
                      />
                      <span className="text-sm text-secondary-foreground">Recategorización / Ascenso</span>
                    </label>
                  </div>

                  <div className="space-y-3 pt-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Configuración general</p>
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={formData.show_results_to_employee}
                        onChange={(e) => setFormData(prev => ({ ...prev, show_results_to_employee: e.target.checked }))}
                        className="rounded border-[var(--border)] text-cat-violet focus:ring-cat-violet"
                      />
                      <span className="text-sm text-secondary-foreground">Mostrar resultados al empleado</span>
                    </label>
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                        className="rounded border-[var(--border)] text-cat-violet focus:ring-cat-violet"
                      />
                      <span className="text-sm text-secondary-foreground">Período activo (solo uno puede estar activo)</span>
                    </label>
                  </div>
                </div>
                <div className="flex justify-end gap-3 border-t border-[var(--border)] px-6 py-4">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-muted"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-lg bg-cat-violet px-4 py-2 text-sm font-medium text-white hover:bg-cat-violet disabled:opacity-50"
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
      <div className="rounded-xl border border-[var(--border)] bg-white shadow-sm">
        {periods.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-muted-foreground">No hay períodos de evaluación. Crea uno para comenzar.</p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {periods.map((period) => (
              <li key={period.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-medium text-foreground">{period.name}</h3>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        period.status === 'open'
                          ? 'bg-success-subtle text-[var(--green-700)]'
                          : period.status === 'closed'
                          ? 'bg-secondary text-muted-foreground'
                          : 'bg-warning-subtle text-[var(--amber-600)]'
                      }`}>
                        {period.status === 'open' ? 'Abierto' : period.status === 'closed' ? 'Cerrado' : 'Borrador'}
                      </span>
                      {period.is_active && (
                        <span className="inline-flex items-center rounded-full bg-cat-violet-subtle px-2.5 py-0.5 text-xs font-medium text-cat-violet">
                          Activo
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Período: {formatDate(period.start_date)} - {formatDate(period.end_date)}
                    </p>
                    {period.evaluation_start_date && period.evaluation_end_date && (
                      <p className="text-xs text-cat-violet">
                        Ventana: {formatDate(period.evaluation_start_date)} - {formatDate(period.evaluation_end_date)}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {period.status === 'draft' && (
                      <button
                        onClick={() => toggleStatus(period, 'open')}
                        className="rounded-lg border border-success/20 px-3 py-1.5 text-xs font-medium text-[var(--green-700)] hover:bg-success-subtle"
                      >
                        Abrir
                      </button>
                    )}
                    {period.status === 'open' && (
                      <button
                        onClick={() => toggleStatus(period, 'closed')}
                        className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
                      >
                        Cerrar
                      </button>
                    )}
                    <button
                      onClick={() => openEditForm(period)}
                      className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-muted"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(period.id)}
                      className="rounded-lg border border-danger/20 px-3 py-1.5 text-xs font-medium text-[var(--red-600)] hover:bg-danger-subtle"
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

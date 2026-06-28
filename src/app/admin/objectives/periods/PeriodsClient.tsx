'use client';

import { useState } from 'react';
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

type FormData = {
  year: number;
  period_type: ObjectivesPeriodType;
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
};

const emptyForm = (currentYear: number): FormData => ({
  year: currentYear,
  period_type: 'definition',
  name: '',
  description: '',
  start_date: `${currentYear}-01-01`,
  end_date: `${currentYear}-03-31`,
  is_active: true,
});

export function PeriodsClient({ initialPeriods, currentYear }: PeriodsClientProps) {
  const [periods, setPeriods] = useState<ObjectivesPeriod[]>(initialPeriods);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<ObjectivesPeriod | null>(null);
  const [formData, setFormData] = useState<FormData>(emptyForm(currentYear));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const years = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];

  const formatDate = (dateStr: string) => {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const isPeriodOpen = (period: ObjectivesPeriod): boolean => {
    if (!period.is_active) return false;
    const today = new Date().toISOString().split('T')[0];
    return today >= period.start_date && today <= period.end_date;
  };

  const openCreateModal = () => {
    setEditingPeriod(null);
    setFormData(emptyForm(currentYear));
    setIsModalOpen(true);
    setError(null);
  };

  const openEditModal = (period: ObjectivesPeriod) => {
    setEditingPeriod(period);
    setFormData({
      year: period.year,
      period_type: period.period_type,
      name: period.name,
      description: period.description || '',
      start_date: period.start_date,
      end_date: period.end_date,
      is_active: period.is_active,
    });
    setIsModalOpen(true);
    setError(null);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingPeriod(null);
    setError(null);
  };

  // Update default dates when type changes
  const handleTypeChange = (type: ObjectivesPeriodType) => {
    const year = formData.year;
    if (type === 'definition') {
      setFormData(prev => ({
        ...prev,
        period_type: type,
        name: prev.name || `Definición de objetivos ${year}`,
        start_date: `${year}-01-01`,
        end_date: `${year}-03-31`,
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        period_type: type,
        name: prev.name || `Evaluación de objetivos ${year}`,
        start_date: `${year}-12-01`,
        end_date: `${year}-12-31`,
      }));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      // Generate title if empty
      let name = formData.name;
      if (!name) {
        name = formData.period_type === 'definition' 
          ? `Definición de objetivos ${formData.year}`
          : `Evaluación de objetivos ${formData.year}`;
      }

      const res = await fetch('/api/admin/objectives/periods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          name,
          description: formData.description || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al guardar');
      }

      const saved = await res.json();
      
      setPeriods(prev => {
        const filtered = prev.filter(p => !(
          p.year === saved.year && p.period_type === saved.period_type
        ));
        return [...filtered, saved].sort((a, b) => {
          if (b.year !== a.year) return b.year - a.year;
          return a.period_type === 'definition' ? -1 : 1;
        });
      });

      setSuccess('Período guardado correctamente');
      setTimeout(() => setSuccess(null), 3000);
      closeModal();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (period: ObjectivesPeriod) => {
    if (!confirm(`¿Estás seguro de eliminar "${period.name}"?`)) return;
    
    setDeleting(period.id);
    try {
      const res = await fetch(`/api/admin/objectives/periods?id=${period.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al eliminar');
      }

      setPeriods(prev => prev.filter(p => p.id !== period.id));
      setSuccess('Período eliminado correctamente');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message);
      setTimeout(() => setError(null), 5000);
    } finally {
      setDeleting(null);
    }
  };

  // Group periods by year
  const periodsByYear = periods.reduce((acc, period) => {
    if (!acc[period.year]) acc[period.year] = [];
    acc[period.year].push(period);
    return acc;
  }, {} as Record<number, ObjectivesPeriod[]>);

  const sortedYears = Object.keys(periodsByYear).map(Number).sort((a, b) => b - a);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Períodos de Objetivos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestiona los períodos de definición y evaluación de objetivos
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 rounded-lg bg-danger px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[var(--red-600)] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nuevo período
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div className="rounded-lg border border-danger/20 bg-danger-subtle px-4 py-3 text-sm text-[var(--red-600)]">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-success/20 bg-success-subtle px-4 py-3 text-sm text-[var(--green-700)]">
          {success}
        </div>
      )}

      {/* Periods List */}
      {sortedYears.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-white p-12 text-center shadow-sm">
          <svg className="mx-auto h-12 w-12 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <h3 className="mt-4 text-base font-medium text-foreground">No hay períodos configurados</h3>
          <p className="mt-1 text-sm text-muted-foreground">Crea tu primer período de objetivos</p>
          <button
            onClick={openCreateModal}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-danger px-4 py-2 text-sm font-medium text-white hover:bg-[var(--red-600)]"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Crear período
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedYears.map(year => (
            <div key={year} className="rounded-xl border border-[var(--border)] bg-white shadow-sm">
              <div className="border-b border-[var(--border)] bg-muted px-6 py-3">
                <h2 className="text-lg font-semibold text-foreground">{year}</h2>
              </div>
              <div className="divide-y divide-[var(--border)]">
                {periodsByYear[year]
                  .sort((a, b) => a.period_type === 'definition' ? -1 : 1)
                  .map(period => {
                    const isOpen = isPeriodOpen(period);
                    
                    return (
                      <div key={period.id} className="flex items-center justify-between px-6 py-4 hover:bg-muted">
                        <div className="flex items-center gap-4">
                          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                            period.period_type === 'definition' ? 'bg-accent' : 'bg-success-subtle'
                          }`}>
                            {period.period_type === 'definition' ? (
                              <svg className="h-5 w-5 text-accent-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            ) : (
                              <svg className="h-5 w-5 text-[var(--green-700)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium text-foreground">{period.name}</h3>
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                period.period_type === 'definition' 
                                  ? 'bg-accent text-accent-foreground' 
                                  : 'bg-success-subtle text-[var(--green-700)]'
                              }`}>
                                {OBJECTIVES_PERIOD_TYPE_LABELS[period.period_type]}
                              </span>
                              {isOpen ? (
                                <span className="inline-flex items-center rounded-full bg-success-subtle px-2 py-0.5 text-xs font-medium text-[var(--green-700)]">
                                  Abierto
                                </span>
                              ) : !period.is_active ? (
                                <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
                                  Inactivo
                                </span>
                              ) : (
                                <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
                                  Cerrado
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {formatDate(period.start_date)} — {formatDate(period.end_date)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEditModal(period)}
                            className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-muted"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleDelete(period)}
                            disabled={deleting === period.id}
                            className="rounded-lg border border-danger/20 bg-white px-3 py-1.5 text-xs font-medium text-[var(--red-600)] hover:bg-danger-subtle disabled:opacity-50"
                          >
                            {deleting === period.id ? 'Eliminando...' : 'Eliminar'}
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

      {/* Info */}
      <div className="rounded-xl border border-[var(--orange-100)] bg-accent p-4">
        <h4 className="font-medium text-accent-foreground">¿Cómo funcionan los períodos?</h4>
        <ul className="mt-2 space-y-1 text-sm text-accent-foreground">
          <li>• <strong>Definición:</strong> Los líderes pueden crear y editar objetivos de su equipo</li>
          <li>• <strong>Evaluación:</strong> Los líderes registran el cumplimiento real de cada objetivo</li>
          <li>• Fuera de estos períodos, los objetivos quedan en modo solo lectura</li>
        </ul>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={closeModal} />
            
            <div className="relative w-full max-w-lg rounded-xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
                <h2 className="text-lg font-semibold text-foreground">
                  {editingPeriod ? 'Editar período' : 'Nuevo período de objetivos'}
                </h2>
                <button
                  onClick={closeModal}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-6 space-y-4">
                {error && (
                  <div className="rounded-lg border border-danger/20 bg-danger-subtle px-4 py-3 text-sm text-[var(--red-600)]">
                    {error}
                  </div>
                )}

                {/* Type selector */}
                <div>
                  <label className="block text-sm font-medium text-secondary-foreground mb-2">Tipo de período</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => handleTypeChange('definition')}
                      className={`flex items-center gap-3 rounded-lg border-2 p-4 transition-all ${
                        formData.period_type === 'definition'
                          ? 'border-brand bg-accent'
                          : 'border-[var(--border)] hover:border-[var(--border)]'
                      }`}
                    >
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                        formData.period_type === 'definition' ? 'bg-accent' : 'bg-secondary'
                      }`}>
                        <svg className={`h-5 w-5 ${formData.period_type === 'definition' ? 'text-accent-foreground' : 'text-muted-foreground'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </div>
                      <div className="text-left">
                        <p className={`font-medium ${formData.period_type === 'definition' ? 'text-accent-foreground' : 'text-secondary-foreground'}`}>Definición</p>
                        <p className="text-xs text-muted-foreground">Crear objetivos</p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTypeChange('evaluation')}
                      className={`flex items-center gap-3 rounded-lg border-2 p-4 transition-all ${
                        formData.period_type === 'evaluation'
                          ? 'border-success/20 bg-success-subtle'
                          : 'border-[var(--border)] hover:border-[var(--border)]'
                      }`}
                    >
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                        formData.period_type === 'evaluation' ? 'bg-success-subtle' : 'bg-secondary'
                      }`}>
                        <svg className={`h-5 w-5 ${formData.period_type === 'evaluation' ? 'text-[var(--green-700)]' : 'text-muted-foreground'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="text-left">
                        <p className={`font-medium ${formData.period_type === 'evaluation' ? 'text-[var(--green-700)]' : 'text-secondary-foreground'}`}>Evaluación</p>
                        <p className="text-xs text-muted-foreground">Evaluar logros</p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Year */}
                <div>
                  <label className="block text-sm font-medium text-secondary-foreground mb-1">Año</label>
                  <select
                    value={formData.year}
                    onChange={(e) => setFormData(prev => ({ ...prev, year: Number(e.target.value) }))}
                    className="block w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-danger/20 focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {years.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>

                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-secondary-foreground mb-1">
                    Nombre <span className="text-muted-foreground font-normal">(opcional)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder={formData.period_type === 'definition' 
                      ? `Definición de objetivos ${formData.year}` 
                      : `Evaluación de objetivos ${formData.year}`
                    }
                    className="block w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-danger/20 focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-secondary-foreground mb-1">
                    Descripción <span className="text-muted-foreground font-normal">(opcional)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="block w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-danger/20 focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-secondary-foreground mb-1">Fecha inicio</label>
                    <input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                      className="block w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-danger/20 focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-secondary-foreground mb-1">Fecha fin</label>
                    <input
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                      className="block w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-danger/20 focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                </div>

                {/* Active toggle */}
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                    className="h-4 w-4 rounded border-[var(--border)] text-[var(--red-600)] focus:ring-ring"
                  />
                  <span className="text-sm text-secondary-foreground">Período activo</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 border-t border-[var(--border)] px-6 py-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-muted"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-lg bg-danger px-4 py-2 text-sm font-medium text-white hover:bg-[var(--red-600)] disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : editingPeriod ? 'Guardar cambios' : 'Crear período'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

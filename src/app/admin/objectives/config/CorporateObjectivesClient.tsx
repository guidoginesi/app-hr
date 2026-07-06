'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@pow/ui/components/ui/button';
import { SelectMenu } from '@pow/ui/components/ui/select-menu';
import { Sheet, SheetContent, SheetClose } from '@pow/ui/components/ui/sheet';
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
      {/* Toolbar */}
      <div className="flex items-center justify-end">
        <Button onClick={openCreateModal}>Nuevo objetivo</Button>
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

      {/* Objectives List */}
      {sortedYears.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-white p-12 text-center shadow-sm">
          <svg className="mx-auto h-12 w-12 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
          </svg>
          <h3 className="mt-4 text-base font-medium text-foreground">No hay objetivos corporativos</h3>
          <p className="mt-1 text-sm text-muted-foreground">Crea tu primer objetivo de Facturación o NPS</p>
          <div className="mt-4 flex justify-center">
            <Button onClick={openCreateModal}>Crear objetivo</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedYears.map(year => (
            <div key={year} className="rounded-xl border border-[var(--border)] bg-white shadow-sm">
              <div className="border-b border-[var(--border)] bg-muted px-6 py-3">
                <h2 className="text-base font-semibold text-foreground tabular-nums">{year}</h2>
              </div>
              <div className="divide-y divide-[var(--border)]">
                {objectivesByYear[year].map(obj => {
                  const progress = obj.target_value && obj.actual_value
                    ? Math.round((obj.actual_value / obj.target_value) * 100)
                    : null;
                  
                  return (
                    <div key={obj.id} className="flex items-center justify-between px-6 py-4 hover:bg-muted">
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                          {obj.objective_type === 'billing' ? (
                            <svg className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          ) : (
                            <svg className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-medium text-foreground">{obj.title}</h3>
                            <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                              {OBJECTIVE_TYPE_LABELS[obj.objective_type]}
                            </span>
                            {obj.quarter && (
                              <span className="text-xs text-muted-foreground">
                                {QUARTER_LABELS[obj.quarter]}
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex items-center gap-4 text-sm text-muted-foreground">
                            {obj.target_value !== null && (
                              <span>Meta: {obj.objective_type === 'billing' ? '$' : ''}{obj.target_value.toLocaleString('es-AR')}</span>
                            )}
                            {obj.actual_value !== null && (
                              <span>Actual: {obj.objective_type === 'billing' ? '$' : ''}{obj.actual_value.toLocaleString('es-AR')}</span>
                            )}
                            {progress !== null && (
                              <span className={`font-medium ${progress >= 100 ? 'text-[var(--green-700)]' : 'text-[var(--amber-600)]'}`}>
                                {progress}%
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEditModal(obj)}>
                          Editar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-danger/30 text-[var(--red-600)] hover:bg-danger-subtle"
                          loading={deleting === obj.id}
                          onClick={() => handleDelete(obj)}
                        >
                          Eliminar
                        </Button>
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
        <Sheet open onOpenChange={(o) => { if (!o) closeModal(); }}>
          <SheetContent
            side="right"
            flush
            title={editingObjective ? 'Editar objetivo' : 'Nuevo objetivo corporativo'}
            className="max-w-lg"
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
              <h2 className="text-base font-semibold text-foreground">
                {editingObjective ? 'Editar objetivo' : 'Nuevo objetivo corporativo'}
              </h2>
              <SheetClose
                aria-label="Cerrar"
                className="-mr-1.5 grid h-8 w-8 place-items-center rounded-[var(--radius)] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-5 w-5" />
              </SheetClose>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {error && (
                <div className="rounded-lg border border-danger/20 bg-danger-subtle px-4 py-3 text-sm text-[var(--red-600)]">
                  {error}
                </div>
              )}

                {/* Type selector */}
                <div>
                  <label className="block text-sm font-medium text-secondary-foreground mb-2">Tipo de objetivo</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, objective_type: 'billing', quarter: null }))}
                      className={`flex items-center gap-3 rounded-lg border-2 p-4 transition-all ${
                        formData.objective_type === 'billing'
                          ? 'border-brand bg-accent'
                          : 'border-[var(--border)] hover:border-[var(--border)]'
                      }`}
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                        <svg className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-medium text-foreground">Facturación</p>
                        <p className="text-xs text-muted-foreground">Objetivo anual</p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, objective_type: 'nps', quarter: 'q1' }))}
                      className={`flex items-center gap-3 rounded-lg border-2 p-4 transition-all ${
                        formData.objective_type === 'nps'
                          ? 'border-brand bg-accent'
                          : 'border-[var(--border)] hover:border-[var(--border)]'
                      }`}
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                        <svg className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-medium text-foreground">NPS</p>
                        <p className="text-xs text-muted-foreground">Objetivo trimestral</p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Year and Quarter */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-secondary-foreground mb-1">Año</label>
                    <SelectMenu
                      ariaLabel="Año"
                      className="w-full"
                      value={String(formData.year)}
                      onChange={(v) => setFormData(prev => ({ ...prev, year: Number(v) }))}
                      options={years.map((y) => ({ value: String(y), label: String(y) }))}
                    />
                  </div>
                  {formData.objective_type === 'nps' && (
                    <div>
                      <label className="block text-sm font-medium text-secondary-foreground mb-1">Trimestre</label>
                      <SelectMenu
                        ariaLabel="Trimestre"
                        className="w-full"
                        value={formData.quarter || 'q1'}
                        onChange={(v) => setFormData(prev => ({ ...prev, quarter: v as Quarter }))}
                        options={QUARTERS.map((q) => ({ value: q, label: QUARTER_LABELS[q] }))}
                      />
                    </div>
                  )}
                </div>

                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-secondary-foreground mb-1">
                    Título <span className="text-muted-foreground font-normal">(opcional)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder={formData.objective_type === 'billing' 
                      ? `Facturación ${formData.year}` 
                      : `NPS ${formData.quarter ? QUARTER_LABELS[formData.quarter] : ''} ${formData.year}`
                    }
                    className="block w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-ring"
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
                    className="block w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>

                {/* Values */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-secondary-foreground mb-1">
                      {formData.objective_type === 'billing' ? 'Meta ($)' : 'Meta (puntos)'}
                    </label>
                    <input
                      type="number"
                      value={formData.target_value}
                      onChange={(e) => setFormData(prev => ({ ...prev, target_value: e.target.value }))}
                      placeholder={formData.objective_type === 'billing' ? '1000000' : '75'}
                      className="block w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-secondary-foreground mb-1">
                      {formData.objective_type === 'billing' ? 'Actual ($)' : 'Actual (puntos)'}
                    </label>
                    <input
                      type="number"
                      value={formData.actual_value}
                      onChange={(e) => setFormData(prev => ({ ...prev, actual_value: e.target.value }))}
                      placeholder="0"
                      className="block w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                </div>

                {/* Gate and Cap (only for billing) */}
                {formData.objective_type === 'billing' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-secondary-foreground mb-1">Gate (%)</label>
                      <input
                        type="number"
                        value={formData.gate_percentage}
                        onChange={(e) => setFormData(prev => ({ ...prev, gate_percentage: Number(e.target.value) }))}
                        min={0}
                        max={100}
                        className="block w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                      <p className="mt-1 text-xs text-muted-foreground">Mínimo para aplicar bono</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-secondary-foreground mb-1">Cap (%)</label>
                      <input
                        type="number"
                        value={formData.cap_percentage}
                        onChange={(e) => setFormData(prev => ({ ...prev, cap_percentage: Number(e.target.value) }))}
                        min={100}
                        max={200}
                        className="block w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                      <p className="mt-1 text-xs text-muted-foreground">Máximo multiplicador</p>
                    </div>
                  </div>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-[var(--border)] px-6 py-4">
              <Button variant="outline" onClick={closeModal}>
                Cancelar
              </Button>
              <Button type="button" loading={saving} onClick={handleSave}>
                {editingObjective ? 'Guardar cambios' : 'Crear objetivo'}
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}

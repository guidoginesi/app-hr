'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Loader2 } from 'lucide-react';
import { Button } from '@pow/ui/components/ui/button';
import { SelectMenu } from '@pow/ui/components/ui/select-menu';
import { Sheet, SheetContent, SheetClose } from '@pow/ui/components/ui/sheet';
import type { EvaluationPeriod, EvaluationDimension, EvaluationItem } from '@/types/evaluation';

type DimensionWithItems = EvaluationDimension & { items: EvaluationItem[] };

type DimensionsClientProps = {
  periods: EvaluationPeriod[];
  initialPeriodId: string | null;
  initialDimensions: DimensionWithItems[];
};

export function DimensionsClient({ periods, initialPeriodId, initialDimensions }: DimensionsClientProps) {
  const router = useRouter();
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(initialPeriodId);
  const [dimensions, setDimensions] = useState<DimensionWithItems[]>(initialDimensions);
  const [loading, setLoading] = useState(false);
  const [showDimensionForm, setShowDimensionForm] = useState(false);
  const [editingDimension, setEditingDimension] = useState<DimensionWithItems | null>(null);
  const [showItemForm, setShowItemForm] = useState<string | null>(null); // dimension_id
  const [editingItem, setEditingItem] = useState<EvaluationItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [dimensionForm, setDimensionForm] = useState({ name: '', description: '' });
  const [itemForm, setItemForm] = useState({ statement: '' });

  const loadDimensions = async (periodId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/evaluation-dimensions?period_id=${periodId}`);
      if (res.ok) {
        const data = await res.json();
        setDimensions(data);
      }
    } catch (error) {
      console.error('Error loading dimensions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePeriodChange = (periodId: string) => {
    setSelectedPeriodId(periodId);
    loadDimensions(periodId);
  };

  // Dimension CRUD
  const openDimensionForm = (dimension?: DimensionWithItems) => {
    if (dimension) {
      setDimensionForm({ name: dimension.name, description: dimension.description || '' });
      setEditingDimension(dimension);
    } else {
      setDimensionForm({ name: '', description: '' });
      setEditingDimension(null);
    }
    setShowDimensionForm(true);
  };

  const handleSaveDimension = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPeriodId) return;
    setSaving(true);
    setMessage(null);

    try {
      const url = editingDimension
        ? `/api/admin/evaluation-dimensions/${editingDimension.id}`
        : '/api/admin/evaluation-dimensions';
      const method = editingDimension ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...dimensionForm,
          period_id: selectedPeriodId,
        }),
      });

      if (res.ok) {
        setShowDimensionForm(false);
        setEditingDimension(null);
        loadDimensions(selectedPeriodId);
        setMessage({ type: 'success', text: editingDimension ? 'Dimensión actualizada' : 'Dimensión creada' });
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error al guardar' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDimension = async (id: string) => {
    if (!confirm('¿Eliminar esta dimensión y todos sus ítems?')) return;
    if (!selectedPeriodId) return;

    try {
      const res = await fetch(`/api/admin/evaluation-dimensions/${id}`, { method: 'DELETE' });
      if (res.ok) {
        loadDimensions(selectedPeriodId);
        setMessage({ type: 'success', text: 'Dimensión eliminada' });
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error al eliminar' });
    }
  };

  // Item CRUD
  const openItemForm = (dimensionId: string, item?: EvaluationItem) => {
    if (item) {
      setItemForm({ statement: item.statement });
      setEditingItem(item);
    } else {
      setItemForm({ statement: '' });
      setEditingItem(null);
    }
    setShowItemForm(dimensionId);
  };

  const handleSaveItem = async (e: React.FormEvent, dimensionId: string) => {
    e.preventDefault();
    if (!selectedPeriodId) return;
    setSaving(true);
    setMessage(null);

    try {
      const url = editingItem
        ? `/api/admin/evaluation-items/${editingItem.id}`
        : '/api/admin/evaluation-items';
      const method = editingItem ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...itemForm,
          dimension_id: dimensionId,
        }),
      });

      if (res.ok) {
        setShowItemForm(null);
        setEditingItem(null);
        loadDimensions(selectedPeriodId);
        setMessage({ type: 'success', text: editingItem ? 'Ítem actualizado' : 'Ítem creado' });
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error al guardar' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm('¿Eliminar este ítem?')) return;
    if (!selectedPeriodId) return;

    try {
      const res = await fetch(`/api/admin/evaluation-items/${id}`, { method: 'DELETE' });
      if (res.ok) {
        loadDimensions(selectedPeriodId);
        setMessage({ type: 'success', text: 'Ítem eliminado' });
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error al eliminar' });
    }
  };

  const selectedPeriod = periods.find(p => p.id === selectedPeriodId);

  return (
    <div className="space-y-6">
      {message && (
        <div className={`rounded-lg p-4 text-sm ${
          message.type === 'success' ? 'bg-success-subtle text-[var(--green-700)]' : 'bg-danger-subtle text-[var(--red-600)]'
        }`}>
          {message.text}
        </div>
      )}

      {/* Period Selection */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-secondary-foreground">Período:</label>
          <SelectMenu
            ariaLabel="Seleccionar período"
            value={selectedPeriodId || ''}
            onChange={(v) => handlePeriodChange(v)}
            options={[
              { value: '', label: 'Seleccionar período' },
              ...periods.map((period) => ({
                value: period.id,
                label: `${period.name} ${period.is_active ? '(Activo)' : ''}`.trim(),
              })),
            ]}
          />
        </div>
        {selectedPeriodId && (
          <Button onClick={() => openDimensionForm()}>Nueva dimensión</Button>
        )}
      </div>

      {/* Dimension Form Sheet */}
      {showDimensionForm && (
        <Sheet open onOpenChange={(o) => { if (!o) setShowDimensionForm(false); }}>
          <SheetContent
            side="right"
            flush
            title={editingDimension ? 'Editar dimensión' : 'Nueva dimensión'}
            className="max-w-md"
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
              <h2 className="type-title">
                {editingDimension ? 'Editar dimensión' : 'Nueva dimensión'}
              </h2>
              <SheetClose
                aria-label="Cerrar"
                className="-mr-1.5 grid h-8 w-8 place-items-center rounded-[var(--radius)] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-5 w-5" />
              </SheetClose>
            </div>
            <form onSubmit={handleSaveDimension} className="flex flex-1 flex-col overflow-hidden">
              <div className="flex-1 space-y-4 overflow-y-auto p-6">
                <div>
                  <label className="block text-sm font-medium text-secondary-foreground mb-1">Nombre *</label>
                  <input
                    type="text"
                    value={dimensionForm.name}
                    onChange={(e) => setDimensionForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ej: Compromiso y responsabilidad"
                    required
                    className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondary-foreground mb-1">Descripción</label>
                  <textarea
                    value={dimensionForm.description}
                    onChange={(e) => setDimensionForm(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 border-t border-[var(--border)] p-4">
                <Button type="button" variant="outline" onClick={() => setShowDimensionForm(false)}>
                  Cancelar
                </Button>
                <Button type="submit" loading={saving}>
                  Guardar
                </Button>
              </div>
            </form>
          </SheetContent>
        </Sheet>
      )}

      {/* Item Form Sheet */}
      {showItemForm && (
        <Sheet open onOpenChange={(o) => { if (!o) setShowItemForm(null); }}>
          <SheetContent
            side="right"
            flush
            title={editingItem ? 'Editar ítem' : 'Nuevo ítem'}
            className="max-w-md"
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
              <h2 className="type-title">
                {editingItem ? 'Editar ítem' : 'Nuevo ítem'}
              </h2>
              <SheetClose
                aria-label="Cerrar"
                className="-mr-1.5 grid h-8 w-8 place-items-center rounded-[var(--radius)] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-5 w-5" />
              </SheetClose>
            </div>
            <form onSubmit={(e) => handleSaveItem(e, showItemForm)} className="flex flex-1 flex-col overflow-hidden">
              <div className="flex-1 space-y-4 overflow-y-auto p-6">
                <div>
                  <label className="block text-sm font-medium text-secondary-foreground mb-1">Afirmación *</label>
                  <textarea
                    value={itemForm.statement}
                    onChange={(e) => setItemForm(prev => ({ ...prev, statement: e.target.value }))}
                    placeholder="Ej: Cumple con los plazos establecidos para sus tareas"
                    required
                    rows={3}
                    className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 border-t border-[var(--border)] p-4">
                <Button type="button" variant="outline" onClick={() => setShowItemForm(null)}>
                  Cancelar
                </Button>
                <Button type="submit" loading={saving}>
                  Guardar
                </Button>
              </div>
            </form>
          </SheetContent>
        </Sheet>
      )}

      {/* Dimensions List */}
      {!selectedPeriodId ? (
        <div className="rounded-xl border border-[var(--border)] bg-white p-12 text-center">
          <p className="text-sm text-muted-foreground">Selecciona un período para ver sus dimensiones</p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center rounded-xl border border-[var(--border)] bg-white p-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : dimensions.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-white p-12 text-center">
          <p className="text-sm text-muted-foreground mb-4">No hay dimensiones configuradas para este período</p>
          <Button onClick={() => openDimensionForm()}>Crear primera dimensión</Button>
        </div>
      ) : (
        <div className="space-y-4">
          {dimensions.map((dimension, index) => (
            <div key={dimension.id} className="rounded-xl border border-[var(--border)] bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-semibold text-foreground">
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="text-base font-semibold text-foreground">{dimension.name}</h3>
                    {dimension.description && (
                      <p className="text-sm text-muted-foreground">{dimension.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => openItemForm(dimension.id)}>
                    + Ítem
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openDimensionForm(dimension)}>
                    Editar
                  </Button>
                  <Button variant="outline" size="sm" className="border-danger/30 text-[var(--red-600)] hover:bg-danger-subtle" onClick={() => handleDeleteDimension(dimension.id)}>
                    Eliminar
                  </Button>
                </div>
              </div>
              <ul className="divide-y divide-[var(--border)]">
                {dimension.items?.map((item, itemIndex) => (
                  <li key={item.id} className="flex items-center justify-between px-6 py-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">{itemIndex + 1}.</span>
                      <p className="text-sm text-secondary-foreground">{item.statement}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => openItemForm(dimension.id, item)}>
                        Editar
                      </Button>
                      <Button variant="outline" size="sm" className="border-danger/30 text-[var(--red-600)] hover:bg-danger-subtle" onClick={() => handleDeleteItem(item.id)}>
                        Eliminar
                      </Button>
                    </div>
                  </li>
                ))}
                {(!dimension.items || dimension.items.length === 0) && (
                  <li className="px-6 py-4 text-center">
                    <p className="text-sm text-muted-foreground">No hay ítems. Agrega al menos 3 afirmaciones.</p>
                  </li>
                )}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* Help text */}
      {selectedPeriodId && dimensions.length > 0 && (
        <div className="rounded-lg bg-muted border p-4">
          <p className="text-sm text-muted-foreground">
            <strong>Recomendación:</strong> Cada dimensión debe tener exactamente 3 ítems/afirmaciones para una evaluación balanceada.
          </p>
        </div>
      )}
    </div>
  );
}

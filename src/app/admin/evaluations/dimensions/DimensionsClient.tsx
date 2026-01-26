'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Dimensiones de Evaluación</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Configura las dimensiones e ítems para cada período
          </p>
        </div>
      </div>

      {message && (
        <div className={`rounded-lg p-4 text-sm ${
          message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
        }`}>
          {message.text}
        </div>
      )}

      {/* Period Selection */}
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium text-zinc-700">Período:</label>
        <select
          value={selectedPeriodId || ''}
          onChange={(e) => handlePeriodChange(e.target.value)}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-purple-600 focus:outline-none focus:ring-1 focus:ring-purple-600"
        >
          <option value="">Seleccionar período</option>
          {periods.map((period) => (
            <option key={period.id} value={period.id}>
              {period.name} {period.is_active ? '(Activo)' : ''}
            </option>
          ))}
        </select>
        {selectedPeriodId && (
          <button
            onClick={() => openDimensionForm()}
            className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
          >
            Nueva dimensión
          </button>
        )}
      </div>

      {/* Dimension Form Modal */}
      {showDimensionForm && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setShowDimensionForm(false)} />
            <div className="relative w-full max-w-md rounded-xl bg-white shadow-2xl">
              <div className="border-b border-zinc-200 px-6 py-4">
                <h2 className="text-lg font-semibold text-zinc-900">
                  {editingDimension ? 'Editar dimensión' : 'Nueva dimensión'}
                </h2>
              </div>
              <form onSubmit={handleSaveDimension}>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">Nombre *</label>
                    <input
                      type="text"
                      value={dimensionForm.name}
                      onChange={(e) => setDimensionForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Ej: Compromiso y responsabilidad"
                      required
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-purple-600 focus:outline-none focus:ring-1 focus:ring-purple-600"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">Descripción</label>
                    <textarea
                      value={dimensionForm.description}
                      onChange={(e) => setDimensionForm(prev => ({ ...prev, description: e.target.value }))}
                      rows={3}
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-purple-600 focus:outline-none focus:ring-1 focus:ring-purple-600"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 border-t border-zinc-200 px-6 py-4">
                  <button
                    type="button"
                    onClick={() => setShowDimensionForm(false)}
                    className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                  >
                    {saving ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Item Form Modal */}
      {showItemForm && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setShowItemForm(null)} />
            <div className="relative w-full max-w-md rounded-xl bg-white shadow-2xl">
              <div className="border-b border-zinc-200 px-6 py-4">
                <h2 className="text-lg font-semibold text-zinc-900">
                  {editingItem ? 'Editar ítem' : 'Nuevo ítem'}
                </h2>
              </div>
              <form onSubmit={(e) => handleSaveItem(e, showItemForm)}>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">Afirmación *</label>
                    <textarea
                      value={itemForm.statement}
                      onChange={(e) => setItemForm(prev => ({ ...prev, statement: e.target.value }))}
                      placeholder="Ej: Cumple con los plazos establecidos para sus tareas"
                      required
                      rows={3}
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-purple-600 focus:outline-none focus:ring-1 focus:ring-purple-600"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 border-t border-zinc-200 px-6 py-4">
                  <button
                    type="button"
                    onClick={() => setShowItemForm(null)}
                    className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                  >
                    {saving ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Dimensions List */}
      {!selectedPeriodId ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center">
          <p className="text-sm text-zinc-500">Selecciona un período para ver sus dimensiones</p>
        </div>
      ) : loading ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center">
          <p className="text-sm text-zinc-500">Cargando dimensiones...</p>
        </div>
      ) : dimensions.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center">
          <p className="text-sm text-zinc-500 mb-4">No hay dimensiones configuradas para este período</p>
          <button
            onClick={() => openDimensionForm()}
            className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
          >
            Crear primera dimensión
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {dimensions.map((dimension, index) => (
            <div key={dimension.id} className="rounded-xl border border-zinc-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 text-sm font-semibold text-purple-600">
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="font-medium text-zinc-900">{dimension.name}</h3>
                    {dimension.description && (
                      <p className="text-sm text-zinc-500">{dimension.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openItemForm(dimension.id)}
                    className="rounded-lg border border-purple-200 px-3 py-1.5 text-xs font-medium text-purple-600 hover:bg-purple-50"
                  >
                    + Ítem
                  </button>
                  <button
                    onClick={() => openDimensionForm(dimension)}
                    className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDeleteDimension(dimension.id)}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
              <ul className="divide-y divide-zinc-100">
                {dimension.items?.map((item, itemIndex) => (
                  <li key={item.id} className="flex items-center justify-between px-6 py-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-zinc-400">{itemIndex + 1}.</span>
                      <p className="text-sm text-zinc-700">{item.statement}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openItemForm(dimension.id, item)}
                        className="rounded px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50"
                      >
                        Eliminar
                      </button>
                    </div>
                  </li>
                ))}
                {(!dimension.items || dimension.items.length === 0) && (
                  <li className="px-6 py-4 text-center">
                    <p className="text-sm text-zinc-400">No hay ítems. Agrega al menos 3 afirmaciones.</p>
                  </li>
                )}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* Help text */}
      {selectedPeriodId && dimensions.length > 0 && (
        <div className="rounded-lg bg-purple-50 border border-purple-200 p-4">
          <p className="text-sm text-purple-800">
            <strong>Recomendación:</strong> Cada dimensión debe tener exactamente 3 ítems/afirmaciones para una evaluación balanceada.
          </p>
        </div>
      )}
    </div>
  );
}

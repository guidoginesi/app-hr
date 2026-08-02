'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@pow/ui/components/ui/button';
import { Input } from '@pow/ui/components/ui/input';
import { Checkbox } from '@pow/ui/components/ui/checkbox';
import { SelectMenu } from '@pow/ui/components/ui/select-menu';
import { Dialog } from '@pow/ui/components/ui/dialog';

type Row = {
  employee_id: string;
  employee_name: string;
  department: string;
  total_usd: number;
  committed_usd: number;
  consumed_usd: number;
  available_usd: number;
  is_override: boolean;
  note: string | null;
};
type Area = { area: string; total: number; committed: number; consumed: number; available: number; count: number };
type Global = { total: number; committed: number; consumed: number; available: number };
type Warning = { employee_name: string; total_usd: number; used_usd: number };

const usd = (n: number) => `USD ${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(n)}`;

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1];

export function BudgetView() {
  const [rows, setRows] = useState<Row[]>([]);
  const [byArea, setByArea] = useState<Area[]>([]);
  const [global, setGlobal] = useState<Global | null>(null);
  const [defaultUsd, setDefaultUsd] = useState(0);
  const [year, setYear] = useState(CURRENT_YEAR);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<Warning[]>([]);

  const [areaFilter, setAreaFilter] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [bulkAmount, setBulkAmount] = useState('');
  const [defaultDraft, setDefaultDraft] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  // El año es una entrada del usuario: si una respuesta lenta llega después de
  // que lo cambió, se descarta en vez de arrastrar la vista al año viejo.
  const yearRef = useRef(CURRENT_YEAR);

  const applyView = (
    d: { rows?: Row[]; byArea?: Area[]; global?: Global | null; default_usd?: number; year?: number; warnings?: Warning[] },
    { resetDefaultDraft = false }: { resetDefaultDraft?: boolean } = {},
  ) => {
    setRows(d.rows ?? []);
    setByArea(d.byArea ?? []);
    setGlobal(d.global ?? null);
    setDefaultUsd(d.default_usd ?? 0);
    // Sólo se pisa el campo del default cuando el cambio vino de ahí o de una
    // carga: si no, guardar una fila borraría lo que el admin estaba tipeando.
    if (resetDefaultDraft) setDefaultDraft(String(d.default_usd ?? 0));
    setWarnings(d.warnings ?? []);
  };

  const load = async (y: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/training/budget?year=${y}`);
      const data = await res.json();
      if (yearRef.current !== y) return;
      if (res.ok) applyView(data, { resetDefaultDraft: true });
      else setError(data.error ?? 'No se pudo cargar el budget.');
    } catch {
      // Sin este catch la excepción se pierde y quedan en pantalla los datos del
      // año anterior bajo la etiqueta del año nuevo, sin ningún aviso.
      if (yearRef.current !== y) return;
      setError('No se pudo cargar el budget.');
      setRows([]);
      setByArea([]);
      setGlobal(null);
    } finally {
      if (yearRef.current === y) setLoading(false);
    }
  };

  useEffect(() => {
    yearRef.current = year;
    load(year);
    setSelected(new Set());
    setEditingId(null);
    setBulkAmount('');
    setWarnings([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  /** Toda escritura devuelve la vista recalculada, así que el estado se reemplaza entero. */
  const post = async (body: Record<string, unknown>, resetDefault = false) => {
    const sentYear = year; // se captura ANTES del await: después ya puede haber cambiado
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/training/budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, year: sentYear }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'No se pudo guardar.');
        return false;
      }
      // Si mientras tanto cambió el año, la escritura fue correcta pero la vista
      // que volvió es de otro año: se descarta para no pisar la que está viendo.
      if (yearRef.current !== sentYear) return true;
      applyView(data, { resetDefaultDraft: resetDefault });
      return true;
    } catch {
      setError('No se pudo guardar.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const areas = useMemo(() => Array.from(new Set(rows.map((r) => r.department))).sort(), [rows]);
  const visible = useMemo(
    () => (areaFilter ? rows.filter((r) => r.department === areaFilter) : rows),
    [rows, areaFilter],
  );

  const visibleIds = visible.map((r) => r.employee_id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const someVisibleSelected = !allVisibleSelected && visibleIds.some((id) => selected.has(id));
  const selectedCount = selected.size;

  const toggleAllVisible = (checked: boolean) => {
    const next = new Set(selected);
    for (const id of visibleIds) {
      if (checked) next.add(id);
      else next.delete(id);
    }
    setSelected(next);
  };

  const toggleOne = (id: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(id);
    else next.delete(id);
    setSelected(next);
  };

  /** Number('') es 0, así que el campo vacío se rechaza aparte: 0 es un budget válido. */
  const parseAmount = (raw: string): number | null => {
    if (raw.trim() === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  const saveRow = async (employeeId: string) => {
    const amount = parseAmount(editValue);
    if (amount === null) {
      setError('El monto tiene que ser un número mayor o igual a 0.');
      return;
    }
    if (await post({ action: 'set_override', employee_ids: [employeeId], amount_usd: amount })) {
      setEditingId(null);
    }
  };

  const applyBulk = async () => {
    const amount = parseAmount(bulkAmount);
    if (amount === null) {
      setError('El monto tiene que ser un número mayor o igual a 0.');
      return;
    }
    if (await post({ action: 'set_override', employee_ids: Array.from(selected), amount_usd: amount })) {
      setBulkAmount('');
      setSelected(new Set());
    }
  };

  /** Cuántos de los seleccionados tienen realmente un budget propio que perder. */
  const selectedWithOverride = rows.filter((r) => selected.has(r.employee_id) && r.is_override).length;

  const clearBulk = async () => {
    if (await post({ action: 'clear_override', employee_ids: Array.from(selected) })) {
      setSelected(new Set());
      setConfirmClear(false);
    }
  };

  const saveDefault = async () => {
    const amount = parseAmount(defaultDraft);
    if (amount === null) {
      setError('El default tiene que ser un número mayor o igual a 0.');
      return;
    }
    await post({ action: 'set_default', default_amount_usd: amount }, true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--border)] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Año + default anual */}
      <div className="flex flex-wrap items-end justify-between gap-4 rounded-xl border border-[var(--border)] bg-white px-6 py-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <span id="budget-year-label" className="text-xs font-medium text-muted-foreground">Año</span>
            <SelectMenu
              ariaLabel="Año"
              className="w-32"
              value={String(year)}
              disabled={saving}
              onChange={(v) => setYear(Number(v))}
              options={YEARS.map((y) => ({ value: String(y), label: String(y) }))}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="budget-default" className="text-xs font-medium text-muted-foreground">
              Budget por persona (default)
            </label>
            <div className="flex items-center gap-2">
              <Input
                id="budget-default"
                type="number"
                min={0}
                max={100000}
                inputMode="numeric"
                className="w-32"
                value={defaultDraft}
                onChange={(e) => setDefaultDraft(e.target.value)}
              />
              <Button
                size="sm"
                variant="outline"
                loading={saving}
                disabled={defaultDraft === String(defaultUsd)}
                onClick={saveDefault}
              >
                Guardar
              </Button>
            </div>
          </div>
        </div>
        <p className="max-w-md text-xs text-muted-foreground">
          El default aplica a todas las personas que no tengan un budget propio. Cambiarlo no pisa los budgets
          individuales ya asignados.
        </p>
      </div>

      {error && (
        <div className="flex items-start justify-between gap-4 rounded-xl border border-[var(--border)] bg-danger-subtle px-5 py-3 text-sm text-[var(--red-600)]">
          <span>{error}</span>
          <button type="button" aria-label="Cerrar el aviso" className="shrink-0 font-medium" onClick={() => setError(null)}>
            ✕
          </button>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="relative rounded-xl border border-[var(--border)] bg-warning-subtle px-5 py-3 pr-10 text-sm text-[var(--amber-600)]">
          <button
            type="button"
            aria-label="Cerrar el aviso"
            className="absolute right-4 top-3 font-medium"
            onClick={() => setWarnings([])}
          >
            ✕
          </button>
          <p className="font-medium">
            {warnings.length === 1 ? 'Una persona quedó' : `${warnings.length} personas quedaron`} con el budget por
            debajo de lo que ya comprometió o gastó:
          </p>
          <ul className="mt-1 list-inside list-disc">
            {warnings.map((w) => (
              <li key={w.employee_name}>
                {w.employee_name} — budget {usd(w.total_usd)}, ya usado {usd(w.used_usd)}
              </li>
            ))}
          </ul>
          <p className="mt-1">Su disponible queda en cero; lo ya aprobado no se revierte.</p>
        </div>
      )}

      {/* Global */}
      {global && (
        <div className="grid gap-4 sm:grid-cols-4">
          <StatCard value={usd(global.total)} label={`Budget total ${year}`} />
          <StatCard value={usd(global.committed)} label="Comprometido" />
          <StatCard value={usd(global.consumed)} label="Consumido" />
          <StatCard value={usd(global.available)} label="Disponible" accent />
        </div>
      )}

      {/* Por área */}
      <div className="rounded-xl border border-[var(--border)] bg-white shadow-sm">
        <div className="border-b border-[var(--border)] px-6 py-4">
          <h2 className="text-base font-semibold text-foreground">Por área</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-muted text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-6 py-3">Área</th>
                <th className="px-6 py-3 text-center">Personas</th>
                <th className="px-6 py-3 text-right">Total</th>
                <th className="px-6 py-3 text-right">Comprometido</th>
                <th className="px-6 py-3 text-right">Consumido</th>
                <th className="px-6 py-3 text-right">Disponible</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {byArea.map((a) => (
                <tr key={a.area}>
                  <td className="px-6 py-3 font-medium text-foreground">{a.area}</td>
                  <td className="px-6 py-3 text-center text-muted-foreground nums-tabular">{a.count}</td>
                  <td className="px-6 py-3 text-right text-muted-foreground nums-tabular">{usd(a.total)}</td>
                  <td className="px-6 py-3 text-right text-muted-foreground nums-tabular">{usd(a.committed)}</td>
                  <td className="px-6 py-3 text-right text-muted-foreground nums-tabular">{usd(a.consumed)}</td>
                  <td className="px-6 py-3 text-right font-medium text-foreground nums-tabular">{usd(a.available)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Por persona */}
      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-6 py-4">
          <h2 className="text-base font-semibold text-foreground">Por persona</h2>
          <div className="flex items-center gap-2">
            <SelectMenu
              ariaLabel="Área"
              className="w-56"
              value={areaFilter}
              // La selección se limpia al cambiar de área: si no, quedarían
              // seleccionadas personas que ya no están a la vista y el botón
              // diría "Asignar a N" apuntando a gente de otra área.
              onChange={(v) => {
                setAreaFilter(v);
                setSelected(new Set());
                setEditingId(null);
                setBulkAmount('');
              }}
              options={[{ value: '', label: 'Todas las áreas' }, ...areas.map((a) => ({ value: a, label: a }))]}
            />
          </div>
        </div>

        {/* Barra de acciones masivas: sólo aparece con algo seleccionado */}
        {selectedCount > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] bg-muted px-6 py-3">
            <span className="text-sm font-medium text-foreground">
              {selectedCount} {selectedCount === 1 ? 'persona seleccionada' : 'personas seleccionadas'}
            </span>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={100000}
                inputMode="numeric"
                aria-label="Monto a asignar en USD"
                placeholder="Monto USD"
                className="w-36"
                value={bulkAmount}
                onChange={(e) => setBulkAmount(e.target.value)}
              />
              <Button size="sm" loading={saving} disabled={bulkAmount.trim() === ''} onClick={applyBulk}>
                Asignar a {selectedCount}
              </Button>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={saving || selectedWithOverride === 0}
              onClick={() => setConfirmClear(true)}
            >
              Volver al default
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setSelected(new Set()); setBulkAmount(''); setError(null); }}
            >
              Cancelar
            </Button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-muted text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="w-12 px-6 py-3">
                  <Checkbox
                    aria-label="Seleccionar todas las personas visibles"
                    className="data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:after:block data-[state=indeterminate]:after:h-0.5 data-[state=indeterminate]:after:w-2 data-[state=indeterminate]:after:rounded-full data-[state=indeterminate]:after:bg-[var(--primary-foreground)]"
                    checked={allVisibleSelected ? true : someVisibleSelected ? 'indeterminate' : false}
                    onCheckedChange={() => toggleAllVisible(!allVisibleSelected)}
                  />
                </th>
                <th scope="col" className="px-6 py-3">Colaborador</th>
                <th scope="col" className="px-6 py-3">Área</th>
                <th scope="col" className="px-6 py-3 text-right">Budget</th>
                <th scope="col" className="px-6 py-3 text-right">Comprometido</th>
                <th scope="col" className="px-6 py-3 text-right">Consumido</th>
                <th scope="col" className="px-6 py-3 text-right">Disponible</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {visible.map((r) => (
                <tr key={r.employee_id} className="transition-colors hover:bg-muted">
                  <td className="px-6 py-3">
                    <Checkbox
                      aria-label={`Seleccionar a ${r.employee_name}`}
                      checked={selected.has(r.employee_id)}
                      onCheckedChange={(c) => toggleOne(r.employee_id, c === true)}
                    />
                  </td>
                  <td className="px-6 py-3 font-medium text-foreground">{r.employee_name}</td>
                  <td className="px-6 py-3 text-muted-foreground">{r.department}</td>
                  <td className="px-6 py-3 text-right">
                    {editingId === r.employee_id ? (
                      <div className="flex items-center justify-end gap-2">
                        <Input
                          type="number"
                          min={0}
                          max={100000}
                          inputMode="numeric"
                          autoFocus
                          disabled={saving}
                          aria-label={`Budget de ${r.employee_name}`}
                          className="w-28"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !saving) saveRow(r.employee_id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                        />
                        <Button size="sm" loading={saving} onClick={() => saveRow(r.employee_id)}>
                          Guardar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                          Cancelar
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-2">
                        {r.is_override && (
                          <span
                            title={r.note ? `Budget propio: ${r.note}` : 'Budget propio, distinto del default'}
                            className="inline-flex items-center rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-[var(--brand-strong)]"
                          >
                            propio
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(r.employee_id);
                            setEditValue(String(r.total_usd));
                            setError(null);
                          }}
                          className="rounded px-1 font-medium text-foreground underline decoration-dotted underline-offset-4 nums-tabular hover:text-[var(--brand-strong)]"
                        >
                          {usd(r.total_usd)}
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-3 text-right text-muted-foreground nums-tabular">{usd(r.committed_usd)}</td>
                  <td className="px-6 py-3 text-right text-muted-foreground nums-tabular">{usd(r.consumed_usd)}</td>
                  <td className="px-6 py-3 text-right font-medium text-foreground nums-tabular">{usd(r.available_usd)}</td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-sm text-muted-foreground">
                    {areaFilter ? 'No hay personas en esta área.' : 'No hay personas activas.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Volver al default"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-secondary-foreground">
            Se van a borrar <b>{selectedWithOverride}</b>{' '}
            {selectedWithOverride === 1 ? 'budget propio' : 'budgets propios'} de{' '}
            {selectedCount === 1 ? 'la persona seleccionada' : `las ${selectedCount} personas seleccionadas`}. Esas
            personas pasan a usar el default de {usd(defaultUsd)}.
          </p>
          <p className="text-sm text-muted-foreground">
            Los montos individuales no se guardan en ningún lado: si querés volver atrás, hay que cargarlos de nuevo.
          </p>
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmClear(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" loading={saving} onClick={clearBulk}>
              Volver al default
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

function StatCard({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white p-5 shadow-sm">
      <div className={`text-xl font-bold nums-tabular ${accent ? 'text-[var(--brand-strong)]' : 'text-foreground'}`}>{value}</div>
      <div className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

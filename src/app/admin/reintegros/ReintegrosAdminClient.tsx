'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@pow/ui/components/ui/button';
import { Input } from '@pow/ui/components/ui/input';
import { Textarea } from '@pow/ui/components/ui/textarea';
import { Checkbox } from '@pow/ui/components/ui/checkbox';
import { SelectMenu } from '@pow/ui/components/ui/select-menu';
import { TabNav } from '@pow/ui/components/ui/tab-nav';
import {
  CATEGORY_LABELS,
  PAYMENT_METHOD_LABELS,
  RECEIPT_TYPE_LABELS,
  STATUS_LABELS_ADMIN,
  money,
} from '@/lib/reimbursements';
import type { ReimbursementStatus, ReimbursementWithDetails } from '@/types/reimbursement';

type Row = ReimbursementWithDetails & { payable: number };
type Totales = {
  a_validar: number;
  esperando_lider: number;
  a_pagar_ars: number;
  pagado_ars: number;
  sin_convertir: number;
};
type AccesoRow = {
  employee_id: string;
  employee_name: string;
  job_title: string | null;
  department: string;
  email: string | null;
  enabled: boolean;
};

const fecha = (iso: string) => {
  // Sin Date: 'YYYY-MM-DD' se interpreta en UTC y acá se vería un día menos.
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

const statusPill: Record<ReimbursementStatus, string> = {
  requested: 'bg-accent text-[var(--brand-strong)]',
  leader_approved: 'bg-warning-subtle text-[var(--amber-600)]',
  admin_validated: 'bg-secondary text-secondary-foreground',
  to_pay: 'bg-warning-subtle text-[var(--amber-600)]',
  paid: 'bg-success-subtle text-[var(--green-700)]',
  rejected: 'bg-danger-subtle text-[var(--red-600)]',
  cancelled: 'bg-secondary text-muted-foreground',
};

const ars = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

export function ReintegrosAdminClient({ canManageAccess }: { canManageAccess: boolean }) {
  const [tab, setTab] = useState<'cola' | 'acceso'>('cola');
  const [items, setItems] = useState<Row[]>([]);
  const [totales, setTotales] = useState<Totales | null>(null);
  const [filtro, setFiltro] = useState('abiertos');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  // Campos del paso de validación
  const [fiscalOk, setFiscalOk] = useState(false);
  const [imputOk, setImputOk] = useState(false);
  const [approved, setApproved] = useState('');
  const [fx, setFx] = useState('');
  const [comment, setComment] = useState('');
  const [reason, setReason] = useState('');
  const [method, setMethod] = useState('transfer');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/reintegros?status=${filtro}`);
      const data = await res.json();
      if (res.ok) {
        setItems(data.items ?? []);
        setTotales(data.totales ?? null);
      } else setError(data.error ?? 'No se pudieron cargar los reintegros.');
    } catch {
      setError('No se pudieron cargar los reintegros.');
    } finally {
      setLoading(false);
    }
  }, [filtro]);

  useEffect(() => {
    if (tab === 'cola') load();
  }, [tab, load]);

  const resetForm = () => {
    setFiscalOk(false);
    setImputOk(false);
    setApproved('');
    setFx('');
    setComment('');
    setReason('');
    setMethod('transfer');
  };

  const act = async (id: string, body: Record<string, unknown>, ok: string) => {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/reintegros/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'No se pudo aplicar la acción.');
        return;
      }
      setNotice(ok);
      setOpenId(null);
      resetForm();
      await load();
    } catch {
      setError('No se pudo aplicar la acción.');
    } finally {
      setBusy(null);
    }
  };

  const verArchivo = async (id: string, kind: 'comprobante' | 'comprobante_pago') => {
    const res = await fetch(`/api/reintegros/${id}/file?kind=${kind}`);
    const data = await res.json();
    if (data.url) window.open(data.url, '_blank');
    else setError(data.error ?? 'No se pudo abrir el archivo.');
  };

  const subirPago = async (id: string, file: File) => {
    setBusy(id);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/reintegros/${id}/file`, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'No se pudo subir el comprobante de pago.');
        return;
      }
      setNotice('Comprobante de pago cargado. Ya podés marcarlo como pagado.');
      await load();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <TabNav<'cola' | 'acceso'>
        aria-label="Secciones de Reintegros"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'cola', label: 'Cola' },
          ...(canManageAccess ? [{ value: 'acceso' as const, label: 'Habilitados' }] : []),
        ]}
      />

      {notice && (
        <div role="status" aria-live="polite" className="flex items-start justify-between gap-4 rounded-xl border border-[var(--border)] bg-success-subtle px-5 py-3 text-sm text-[var(--green-700)]">
          <span>{notice}</span>
          <button type="button" aria-label="Cerrar" onClick={() => setNotice(null)} className="shrink-0 font-medium">✕</button>
        </div>
      )}
      {error && (
        <div role="alert" className="flex items-start justify-between gap-4 rounded-xl border border-[var(--border)] bg-danger-subtle px-5 py-3 text-sm text-[var(--red-600)]">
          <span>{error}</span>
          <button type="button" aria-label="Cerrar" onClick={() => setError(null)} className="shrink-0 font-medium">✕</button>
        </div>
      )}

      {tab === 'acceso' ? (
        <AccesoPanel onNotice={setNotice} onError={setError} />
      ) : (
        <>
          {totales && (
            <div className="grid gap-4 sm:grid-cols-4">
              <Card value={String(totales.esperando_lider)} label="Esperando al líder" />
              <Card value={String(totales.a_validar)} label="A validar" accent />
              <Card value={ars(totales.a_pagar_ars)} label="A pagar" />
              <Card value={ars(totales.pagado_ars)} label="Pagado" />
            </div>
          )}

          {totales && totales.sin_convertir > 0 && (
            <p className="text-xs text-muted-foreground">
              Los totales suman lo ya validado. {totales.sin_convertir} reintegro(s) todavía sin validar no están
              incluidos, porque su importe en pesos se fija al validar.
            </p>
          )}

          <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-6 py-4">
              <h2 className="text-base font-semibold text-foreground">Reintegros</h2>
              <SelectMenu
                ariaLabel="Estado"
                className="w-56"
                value={filtro}
                onChange={setFiltro}
                options={[
                  { value: 'abiertos', label: 'Abiertos' },
                  { value: 'requested', label: 'Esperando al líder' },
                  { value: 'leader_approved', label: 'A validar' },
                  { value: 'admin_validated', label: 'Validados' },
                  { value: 'to_pay', label: 'A pagar' },
                  { value: 'paid', label: 'Pagados' },
                  { value: 'rejected', label: 'Rechazados' },
                ]}
              />
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--border)] border-t-transparent" />
              </div>
            ) : items.length === 0 ? (
              <div className="py-16 text-center text-sm text-muted-foreground">No hay reintegros en este estado.</div>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {items.map((r) => (
                  <li key={r.id} className="px-6 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">{r.concept}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {r.employee_name} · {CATEGORY_LABELS[r.category]} · {fecha(r.expense_date)}
                          {r.project_label_snapshot ? ` · ${r.project_label_snapshot}` : ''}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {RECEIPT_TYPE_LABELS[r.receipt_type]}
                          {r.receipt_number ? ` ${r.receipt_number}` : ''}
                          {r.supplier_cuit ? ` · CUIT ${r.supplier_cuit}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="font-medium text-foreground nums-tabular">{money(r.amount, r.currency)}</p>
                          {r.amount_ars !== null && r.currency === 'USD' && (
                            <p className="text-xs text-muted-foreground nums-tabular">≈ {ars(Number(r.amount_ars))}</p>
                          )}
                        </div>
                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${statusPill[r.status]}`}>
                          {STATUS_LABELS_ADMIN[r.status]}
                        </span>
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => verArchivo(r.id, 'comprobante')}>
                        Ver comprobante
                      </Button>
                      {r.payment_receipt_path && (
                        <Button size="sm" variant="outline" onClick={() => verArchivo(r.id, 'comprobante_pago')}>
                          Ver comprobante de pago
                        </Button>
                      )}
                      {['requested', 'leader_approved', 'admin_validated', 'to_pay'].includes(r.status) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setOpenId(openId === r.id ? null : r.id);
                            resetForm();
                            setApproved(String(r.amount));
                          }}
                        >
                          {openId === r.id ? 'Cerrar' : 'Gestionar'}
                        </Button>
                      )}
                    </div>

                    {openId === r.id && (
                      <div className="mt-3 space-y-3 rounded-lg border border-[var(--border)] bg-muted p-4">
                        {r.validations?.reason && (
                          <p className="text-sm text-secondary-foreground">
                            <b>Motivo del solicitante:</b> {r.validations.reason}
                          </p>
                        )}
                        {r.leader_comment && (
                          <p className="text-sm text-secondary-foreground">
                            <b>Comentario del líder:</b> {r.leader_comment}
                          </p>
                        )}

                        {/* Sin líder cargado la aprobación cae en People, si no el
                            reintegro quedaría trabado para siempre. */}
                        {r.status === 'requested' && (
                          <div className="space-y-2">
                            <p className="text-xs text-muted-foreground">
                              {r.leader_name
                                ? `Esperando a ${r.leader_name}. Podés aprobarlo desde People si hace falta.`
                                : 'Esta persona no tiene líder cargado, así que la aprobación queda en People.'}
                            </p>
                            <Button
                              size="sm"
                              loading={busy === r.id}
                              onClick={() => act(r.id, { action: 'approve_leader', comment: comment || undefined }, 'Aprobado. Pasa a validación.')}
                            >
                              Aprobar como líder
                            </Button>
                          </div>
                        )}

                        {r.status === 'leader_approved' && (
                          <div className="space-y-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Validación de Administración
                            </p>
                            <label className="flex cursor-pointer items-center gap-2 text-sm text-secondary-foreground">
                              <Checkbox checked={fiscalOk} onCheckedChange={(c) => setFiscalOk(c === true)} />
                              El comprobante fiscal está correcto
                            </label>
                            <label className="flex cursor-pointer items-center gap-2 text-sm text-secondary-foreground">
                              <Checkbox checked={imputOk} onCheckedChange={(c) => setImputOk(c === true)} />
                              La imputación contable está correcta
                            </label>
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-medium text-muted-foreground">
                                  Monto a reintegrar ({r.currency})
                                </label>
                                <Input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  max={Number(r.amount)}
                                  value={approved}
                                  onChange={(e) => setApproved(e.target.value)}
                                />
                              </div>
                              {r.currency === 'USD' && (
                                <div className="flex flex-col gap-1.5">
                                  <label className="text-xs font-medium text-muted-foreground">
                                    Tipo de cambio a ARS *
                                  </label>
                                  <Input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    placeholder="0,00"
                                    value={fx}
                                    onChange={(e) => setFx(e.target.value)}
                                  />
                                </div>
                              )}
                            </div>
                            <Textarea
                              rows={2}
                              placeholder={
                                Number(approved) < Number(r.amount)
                                  ? 'Motivo del monto menor (obligatorio)'
                                  : 'Comentario (opcional)'
                              }
                              value={comment}
                              onChange={(e) => setComment(e.target.value)}
                            />
                            <Button
                              size="sm"
                              loading={busy === r.id}
                              disabled={!fiscalOk || !imputOk || !(Number(approved) > 0) || (r.currency === 'USD' && !(Number(fx) > 0))}
                              onClick={() =>
                                act(
                                  r.id,
                                  {
                                    action: 'validate_admin',
                                    fiscal_receipt_ok: true,
                                    imputation_ok: true,
                                    // Sólo se manda si difiere: null significa "el total pedido".
                                    approved_amount: Number(approved) < Number(r.amount) ? Number(approved) : null,
                                    fx_rate: r.currency === 'USD' ? Number(fx) : null,
                                    comment: comment || undefined,
                                  },
                                  'Validado. Ya podés agendar el pago.',
                                )
                              }
                            >
                              Validar
                            </Button>
                          </div>
                        )}

                        {r.status === 'admin_validated' && (
                          <div className="space-y-3">
                            <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-medium text-muted-foreground">Método de pago</label>
                              <SelectMenu
                                ariaLabel="Método de pago"
                                className="w-64"
                                value={method}
                                onChange={setMethod}
                                options={[
                                  { value: 'transfer', label: PAYMENT_METHOD_LABELS.transfer },
                                  { value: 'payroll', label: PAYMENT_METHOD_LABELS.payroll },
                                ]}
                              />
                            </div>
                            <p className="text-xs text-muted-foreground">
                              La fecha estimada se calcula con el corte del día 20 y queda fija, para que la que ve el
                              solicitante no cambie sola.
                            </p>
                            <Button
                              size="sm"
                              loading={busy === r.id}
                              onClick={() => act(r.id, { action: 'schedule_payment', payment_method: method }, 'Pago agendado.')}
                            >
                              Agendar el pago
                            </Button>
                          </div>
                        )}

                        {r.status === 'to_pay' && (
                          <div className="space-y-3">
                            <p className="text-xs text-muted-foreground">
                              {PAYMENT_METHOD_LABELS[r.payment_method ?? 'transfer']}
                              {r.estimated_payment_date ? ` · estimado ${fecha(r.estimated_payment_date)}` : ''}
                            </p>
                            {!r.payment_receipt_path ? (
                              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-[var(--border)] bg-white px-4 py-2 text-sm transition-colors hover:border-[var(--brand)]">
                                <span className="font-medium text-foreground">Subir comprobante de pago</span>
                                <input
                                  type="file"
                                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                                  className="hidden"
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) subirPago(r.id, f);
                                    e.currentTarget.value = '';
                                  }}
                                />
                              </label>
                            ) : (
                              <Button
                                size="sm"
                                loading={busy === r.id}
                                onClick={() => act(r.id, { action: 'mark_paid' }, 'Reintegro marcado como pagado.')}
                              >
                                Marcar como pagado
                              </Button>
                            )}
                          </div>
                        )}

                        <Timeline id={r.id} />

                        {/* Rechazar está disponible en los tres estados abiertos. */}
                        {['requested', 'leader_approved', 'admin_validated'].includes(r.status) && (
                          <div className="space-y-2 border-t border-[var(--border)] pt-3">
                            <Textarea
                              rows={2}
                              placeholder="Motivo del rechazo (obligatorio)"
                              value={reason}
                              onChange={(e) => setReason(e.target.value)}
                            />
                            <Button
                              size="sm"
                              variant="destructive"
                              loading={busy === r.id}
                              disabled={reason.trim().length < 3}
                              onClick={() => act(r.id, { action: 'reject', reason }, 'Reintegro rechazado.')}
                            >
                              Rechazar
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Habilitación por persona, con alta en lote. Misma UX que el budget de
 * capacitaciones: se filtra por área y se tilda el encabezado para habilitar un
 * área entera.
 */
function AccesoPanel({
  onNotice,
  onError,
}: {
  onNotice: (s: string) => void;
  onError: (s: string) => void;
}) {
  const [rows, setRows] = useState<AccesoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [area, setArea] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/reintegros/acceso');
      const data = await res.json();
      if (res.ok) setRows(data.rows ?? []);
      else onError(data.error ?? 'No se pudieron cargar los habilitados.');
    } catch {
      onError('No se pudieron cargar los habilitados.');
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    load();
  }, [load]);

  const post = async (action: 'grant' | 'revoke', ids: string[]) => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/reintegros/acceso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, employee_ids: ids }),
      });
      const data = await res.json();
      if (!res.ok) {
        onError(data.error ?? 'No se pudo aplicar el cambio.');
        return;
      }
      setRows(data.rows ?? []);
      setSelected(new Set());
      onNotice(
        action === 'grant'
          ? `Módulo habilitado para ${ids.length} persona(s).`
          : `Módulo deshabilitado para ${ids.length} persona(s). Los reintegros en curso siguen su circuito.`,
      );
    } finally {
      setSaving(false);
    }
  };

  const areas = Array.from(new Set(rows.map((r) => r.department))).sort();
  const visible = area ? rows.filter((r) => r.department === area) : rows;
  const visibleIds = visible.map((r) => r.employee_id);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const someSelected = !allSelected && visibleIds.some((id) => selected.has(id));

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm">
      <div className="border-b border-[var(--border)] px-6 py-4">
        <h2 className="text-base font-semibold text-foreground">Quiénes pueden pedir reintegros</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          El módulo no es para todo el equipo. Quien no esté habilitado no ve el ítem en su portal ni puede cargar
          gastos. Quitar el acceso <b>no</b> cancela los reintegros que ya estén en curso.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-6 py-3">
        <SelectMenu
          ariaLabel="Área"
          className="w-56"
          value={area}
          onChange={(v) => {
            setArea(v);
            // Si no se limpia, quedarían seleccionadas personas fuera de la vista.
            setSelected(new Set());
          }}
          options={[{ value: '', label: 'Todas las áreas' }, ...areas.map((a) => ({ value: a, label: a }))]}
        />
        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-foreground">{selected.size} seleccionada(s)</span>
            <Button size="sm" loading={saving} onClick={() => post('grant', Array.from(selected))}>
              Habilitar
            </Button>
            <Button size="sm" variant="outline" loading={saving} onClick={() => post('revoke', Array.from(selected))}>
              Deshabilitar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              Cancelar
            </Button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--border)] border-t-transparent" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-muted text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="w-12 px-6 py-3">
                  <Checkbox
                    aria-label="Seleccionar todas las personas visibles"
                    className="data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:after:block data-[state=indeterminate]:after:h-0.5 data-[state=indeterminate]:after:w-2 data-[state=indeterminate]:after:rounded-full data-[state=indeterminate]:after:bg-[var(--primary-foreground)]"
                    checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                    onCheckedChange={() => {
                      const next = new Set(selected);
                      for (const id of visibleIds) {
                        if (allSelected) next.delete(id);
                        else next.add(id);
                      }
                      setSelected(next);
                    }}
                  />
                </th>
                <th scope="col" className="px-6 py-3">Persona</th>
                <th scope="col" className="px-6 py-3">Área</th>
                <th scope="col" className="px-6 py-3 text-center">Habilitado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {visible.map((r) => (
                <tr key={r.employee_id} className="transition-colors hover:bg-muted">
                  <td className="px-6 py-3">
                    <Checkbox
                      aria-label={`Seleccionar a ${r.employee_name}`}
                      checked={selected.has(r.employee_id)}
                      onCheckedChange={(c) => {
                        const next = new Set(selected);
                        if (c === true) next.add(r.employee_id);
                        else next.delete(r.employee_id);
                        setSelected(next);
                      }}
                    />
                  </td>
                  <td className="px-6 py-3">
                    <p className="font-medium text-foreground">{r.employee_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.email}
                      {r.job_title ? ` · ${r.job_title}` : ''}
                    </p>
                  </td>
                  <td className="px-6 py-3 text-muted-foreground">{r.department}</td>
                  <td className="px-6 py-3 text-center">
                    <Checkbox
                      aria-label={`Habilitar reintegros a ${r.employee_name}`}
                      checked={r.enabled}
                      disabled={saving}
                      onCheckedChange={(c) => post(c === true ? 'grant' : 'revoke', [r.employee_id])}
                    />
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-sm text-muted-foreground">
                    No hay personas en esta área.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const EVENT_LABELS: Record<string, string> = {
  created: 'Solicitado',
  approve_leader: 'Aprobado por el líder',
  validate_admin: 'Validado por Administración',
  schedule_payment: 'Pago agendado',
  mark_paid: 'Pagado',
  reject: 'Rechazado',
  cancel: 'Cancelado por el solicitante',
  payment_receipt_uploaded: 'Comprobante de pago cargado',
};

/**
 * Historial de un reintegro. Se carga cuando se abre el panel y no con la lista,
 * para no pedir el historial de todas las filas de entrada.
 */
function Timeline({ id }: { id: string }) {
  const [events, setEvents] = useState<
    { id: string; event_type: string; actor_name: string | null; note: string | null; created_at: string }[] | null
  >(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/reintegros/${id}/events`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d) setEvents(d.events ?? []);
      })
      .catch(() => {
        if (!cancelled) setEvents([]);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (events === null) return <p className="text-xs text-muted-foreground">Cargando el historial…</p>;
  if (events.length === 0) return null;

  return (
    <div className="border-t border-[var(--border)] pt-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Historial</p>
      <ol className="space-y-1.5">
        {events.map((e) => (
          <li key={e.id} className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{EVENT_LABELS[e.event_type] ?? e.event_type}</span>
            {' · '}
            {new Date(e.created_at).toLocaleString('es-AR', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
            {e.actor_name ? ` · ${e.actor_name}` : ''}
            {e.note ? ` — ${e.note}` : ''}
          </li>
        ))}
      </ol>
    </div>
  );
}

function Card({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white p-5 shadow-sm">
      <div className={`text-xl font-bold nums-tabular ${accent ? 'text-[var(--brand-strong)]' : 'text-foreground'}`}>
        {value}
      </div>
      <div className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import { Button } from '@pow/ui/components/ui/button';
import { Input } from '@pow/ui/components/ui/input';
import { Textarea } from '@pow/ui/components/ui/textarea';
import { SelectMenu } from '@pow/ui/components/ui/select-menu';
import type { TrainingRequestWithDetails, TrainingRequestStatus } from '@/types/training';
import { TRAINING_STATUS_LABELS } from '@/lib/training';

const money = (n: number, cur: string) => `${cur} ${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(n)}`;

const STATUS_COLORS: Record<string, string> = {
  requested: 'bg-warning-subtle text-[var(--amber-600)]',
  leader_approved: 'bg-warning-subtle text-[var(--amber-600)]',
  hr_approved: 'bg-success-subtle text-[var(--green-700)]',
  invoice_uploaded: 'bg-success-subtle text-[var(--green-700)]',
  initial_paid: 'bg-success-subtle text-[var(--green-700)]',
  certificate_uploaded: 'bg-success-subtle text-[var(--green-700)]',
  completed: 'bg-secondary text-secondary-foreground',
  rejected: 'bg-danger-subtle text-[var(--red-600)]',
  cancelled: 'bg-secondary text-muted-foreground',
};

const STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'requested', label: 'Solicitado (pend. líder)' },
  { value: 'leader_approved', label: 'Aprob. líder (pend. HR)' },
  { value: 'hr_approved', label: 'Aprobado HR' },
  { value: 'initial_paid', label: 'En curso' },
  { value: 'completed', label: 'Finalizado' },
  { value: 'rejected', label: 'Rechazado' },
  { value: 'cancelled', label: 'Cancelado' },
];

const emptyInputs = { comment: '', motivo: '', mep: '' };

export function TrainingClient() {
  const [requests, setRequests] = useState<TrainingRequestWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [inputs, setInputs] = useState({ ...emptyInputs });
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/admin/training?${params}`);
      const data = await res.json();
      if (res.ok) setRequests(data.requests ?? []);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggle = (id: string) => {
    setActionError(null);
    setInputs({ ...emptyInputs });
    setExpandedId((p) => (p === id ? null : id));
  };

  const act = async (id: string, action: string, extra: Record<string, unknown> = {}) => {
    setBusy(id); setActionError(null);
    try {
      const res = await fetch(`/api/admin/training/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) { setActionError(data.error ?? 'No se pudo ejecutar la acción.'); return; }
      setExpandedId(null); setInputs({ ...emptyInputs }); await fetchData();
    } catch { setActionError('No se pudo ejecutar la acción.'); }
    finally { setBusy(null); }
  };

  const renderActions = (r: TrainingRequestWithDetails) => {
    const isBusy = busy === r.id;
    const motivoMissing = inputs.motivo.trim().length === 0;
    const isFinal = ['completed', 'rejected', 'cancelled'].includes(r.status);
    const canReject = ['requested', 'leader_approved'].includes(r.status);

    return (
      <div className="space-y-4 rounded-lg border border-[var(--border)] bg-muted p-4">
        <div className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          {r.provider && <p><span className="text-muted-foreground">Proveedor:</span> {r.provider}</p>}
          {r.hours != null && <p><span className="text-muted-foreground">Carga:</span> {r.hours} hs</p>}
          {r.link && <p className="truncate"><span className="text-muted-foreground">Link:</span> <a href={r.link} target="_blank" rel="noreferrer" className="text-[var(--brand-strong)] hover:underline">{r.link}</a></p>}
          {r.role_relation && <p><span className="text-muted-foreground">Relación con el rol:</span> {r.role_relation}</p>}
        </div>
        {r.objective && <p className="text-sm"><span className="text-muted-foreground">Objetivo:</span> {r.objective}</p>}

        {r.status === 'requested' && (
          <Button loading={isBusy} onClick={() => act(r.id, 'approve_leader', { comment: inputs.comment || undefined })}>Aprobar (líder) → HR</Button>
        )}

        {r.status === 'leader_approved' && (
          <div className="space-y-3">
            {r.currency === 'ARS' && (
              <div className="flex flex-col gap-1.5 max-w-xs">
                <label className="text-xs font-medium text-muted-foreground">MEP para convertir a USD *</label>
                <Input type="number" min={0} value={inputs.mep} onChange={(e) => setInputs((s) => ({ ...s, mep: e.target.value }))} placeholder="Ej. 1509.87" />
                {inputs.mep && Number(inputs.mep) > 0 && <span className="text-xs text-muted-foreground">≈ USD {(Number(r.cost) / Number(inputs.mep)).toFixed(2)}</span>}
              </div>
            )}
            <Button loading={isBusy} disabled={r.currency === 'ARS' && !(Number(inputs.mep) > 0)} onClick={() => act(r.id, 'approve_hr', { comment: inputs.comment || undefined, mep: r.currency === 'ARS' ? Number(inputs.mep) : undefined })}>
              Aprobar (HR)
            </Button>
          </div>
        )}

        {isFinal && (r.rejection_reason
          ? <p className="text-sm text-muted-foreground"><span className="font-medium text-foreground">Motivo:</span> {r.rejection_reason}</p>
          : <p className="text-sm text-muted-foreground">Sin acciones (seguimiento de pagos: próxima fase).</p>)}

        {!isFinal && !['requested', 'leader_approved'].includes(r.status) && (
          <p className="text-sm text-muted-foreground">Carga de factura / certificado y pagos: próxima fase.</p>
        )}

        {canReject && (
          <div className="space-y-2 border-t border-[var(--border)] pt-3">
            <Textarea rows={2} placeholder="Motivo del rechazo (obligatorio)" value={inputs.motivo} onChange={(e) => setInputs((s) => ({ ...s, motivo: e.target.value }))} />
            <Button variant="destructive" loading={isBusy} disabled={motivoMissing} onClick={() => act(r.id, 'reject', { rejection_reason: inputs.motivo })}>Rechazar</Button>
          </div>
        )}

        {actionError && <p className="text-sm text-[var(--red-600)]">{actionError}</p>}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[var(--border)] bg-white shadow-sm">
        <div className="flex flex-wrap items-end gap-4 px-6 py-4">
          <div className="flex flex-col gap-1 min-w-[240px]">
            <label className="text-xs font-medium text-muted-foreground">Estado</label>
            <SelectMenu ariaLabel="Estado" className="w-full" value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-white shadow-sm">
        <div className="border-b border-[var(--border)] px-6 py-4">
          <h2 className="text-base font-semibold text-foreground">Solicitudes</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{loading ? 'Cargando…' : `${requests.length} solicitud${requests.length !== 1 ? 'es' : ''}`}</p>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16"><div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--border)] border-t-transparent" /></div>
        ) : requests.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Sin solicitudes para este filtro.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-muted text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-6 py-3">Colaborador</th>
                  <th className="px-6 py-3">Curso</th>
                  <th className="px-6 py-3 text-right">Costo</th>
                  <th className="px-6 py-3">Estado</th>
                  <th className="px-6 py-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {requests.map((r) => (
                  <Fragment key={r.id}>
                    <tr className="hover:bg-muted transition-colors">
                      <td className="px-6 py-3 font-medium text-foreground">{r.employee_name}</td>
                      <td className="px-6 py-3 text-muted-foreground">{r.course_name}</td>
                      <td className="px-6 py-3 text-right font-medium text-foreground nums-tabular">
                        {money(r.cost, r.currency)}
                        {r.cost_usd != null && r.currency === 'ARS' && <span className="block text-xs font-normal text-muted-foreground">≈ USD {r.cost_usd}</span>}
                      </td>
                      <td className="px-6 py-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[r.status] ?? 'bg-secondary'}`}>{TRAINING_STATUS_LABELS[r.status]}</span>
                      </td>
                      <td className="px-6 py-3 text-right">
                        <Button variant="ghost" size="sm" onClick={() => toggle(r.id)}>{expandedId === r.id ? 'Cerrar' : 'Gestionar'}</Button>
                      </td>
                    </tr>
                    {expandedId === r.id && (
                      <tr><td colSpan={5} className="px-6 pb-4">{renderActions(r)}</td></tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

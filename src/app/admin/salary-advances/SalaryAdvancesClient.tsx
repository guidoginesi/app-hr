'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import { Button } from '@pow/ui/components/ui/button';
import { Input } from '@pow/ui/components/ui/input';
import { Textarea } from '@pow/ui/components/ui/textarea';
import { Switch } from '@pow/ui/components/ui/switch';
import { SelectMenu } from '@pow/ui/components/ui/select-menu';
import type { SalaryAdvanceWithDetails, SalaryAdvanceStatus } from '@/types/salaryAdvance';
import { ADVANCE_STATUS_LABELS, ADVANCE_TYPE_LABELS } from '@/lib/salaryAdvances';

const STATUS_COLORS: Record<SalaryAdvanceStatus, string> = {
  pending_hr: 'bg-warning-subtle text-[var(--amber-600)]',
  pending_admin: 'bg-warning-subtle text-[var(--amber-600)]',
  approved: 'bg-success-subtle text-[var(--green-700)]',
  transferred: 'bg-success-subtle text-[var(--green-700)]',
  settled: 'bg-secondary text-secondary-foreground',
  rejected: 'bg-danger-subtle text-[var(--red-600)]',
  blocked: 'bg-danger-subtle text-[var(--red-600)]',
};

const ars = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(n);
const monthLabel = (y: number, m: number) => `${String(m).padStart(2, '0')}/${y}`;

const emptyInputs = { renuncia: false, motivo: '', note: '' };

export function SalaryAdvancesClient({ isAdmin }: { isAdmin: boolean }) {
  const [advances, setAdvances] = useState<SalaryAdvanceWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [inputs, setInputs] = useState({ ...emptyInputs });
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Invitación de aprobador (solo admins completos)
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/admin/salary-advances?${params}`);
      const data = await res.json();
      if (res.ok) setAdvances(data.advances ?? []);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggle = (id: string) => {
    setActionError(null);
    setInputs({ ...emptyInputs });
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const act = async (id: string, action: string, extra: Record<string, unknown> = {}) => {
    setBusy(id);
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/salary-advances/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error ?? 'No se pudo ejecutar la acción.');
        return;
      }
      setExpandedId(null);
      setInputs({ ...emptyInputs });
      await fetchData();
    } catch {
      setActionError('No se pudo ejecutar la acción.');
    } finally {
      setBusy(null);
    }
  };

  const invite = async () => {
    setInviting(true);
    setInviteMsg(null);
    try {
      const res = await fetch('/api/admin/administracion-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInviteMsg({ ok: false, text: data.error ?? 'No se pudo invitar.' });
        return;
      }
      setInviteMsg({ ok: true, text: 'Invitación enviada. La persona recibirá un email para configurar su contraseña.' });
      setInviteEmail('');
    } catch {
      setInviteMsg({ ok: false, text: 'No se pudo invitar.' });
    } finally {
      setInviting(false);
    }
  };

  const STATUS_OPTIONS = [
    { value: '', label: 'Todos' },
    { value: 'pending_hr', label: 'Pendiente RRHH' },
    { value: 'pending_admin', label: 'Pendiente Administración' },
    { value: 'approved', label: 'Aprobado' },
    { value: 'transferred', label: 'Transferido' },
    { value: 'settled', label: 'Saldado' },
    { value: 'rejected', label: 'Rechazado' },
    { value: 'blocked', label: 'Bloqueado' },
  ];

  const renderActions = (a: SalaryAdvanceWithDetails) => {
    const isBusy = busy === a.id;
    const motivoMissing = inputs.motivo.trim().length === 0;
    const isFinal = ['settled', 'rejected', 'blocked'].includes(a.status);
    // El perfil Administración (no admin) no actúa sobre solicitudes pendientes de RRHH.
    const waitingRRHH = a.status === 'pending_hr' && !isAdmin;
    // Rechazo disponible según rol/estado.
    const canReject = !isFinal && !waitingRRHH &&
      (isAdmin ? ['pending_hr', 'pending_admin', 'approved'].includes(a.status)
               : ['pending_admin', 'approved'].includes(a.status));
    const canBlock = isAdmin && ['pending_hr', 'pending_admin'].includes(a.status);

    return (
      <div className="space-y-4 rounded-lg border border-[var(--border)] bg-muted p-4">
        {a.reason && (
          <p className="text-sm text-muted-foreground"><span className="font-medium text-foreground">Motivo del colaborador:</span> {a.reason}</p>
        )}

        {waitingRRHH && (
          <p className="text-sm text-muted-foreground">Pendiente de aprobación de RRHH. Vas a poder gestionarla cuando pase a Administración.</p>
        )}

        {a.status === 'pending_hr' && isAdmin && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Switch checked={inputs.renuncia} onCheckedChange={(v) => setInputs((s) => ({ ...s, renuncia: v }))} aria-label="Sin renuncia comunicada" />
              <span className="text-sm text-foreground">Confirmo que el colaborador <b>no</b> tiene una renuncia comunicada</span>
            </div>
            <Button loading={isBusy} disabled={!inputs.renuncia} onClick={() => act(a.id, 'approve_hr', { no_resignation_confirmed: true, note: inputs.note || undefined })}>
              Aprobar → Administración
            </Button>
          </div>
        )}

        {a.status === 'pending_admin' && (
          <div className="space-y-3">
            <p className="text-xs text-[var(--amber-600)]">Validá manualmente que el monto no supere el 50% del neto del colaborador.</p>
            <Button loading={isBusy} onClick={() => act(a.id, 'approve_admin', { note: inputs.note || undefined })}>Aprobar</Button>
          </div>
        )}

        {a.status === 'approved' && (
          <div className="flex flex-wrap gap-2">
            <Button loading={isBusy} onClick={() => act(a.id, 'transfer')}>Marcar transferido</Button>
            <Button variant="secondary" loading={isBusy} onClick={() => act(a.id, 'settle')}>Marcar saldado</Button>
          </div>
        )}

        {a.status === 'transferred' && (
          <Button loading={isBusy} onClick={() => act(a.id, 'settle')}>Marcar saldado</Button>
        )}

        {isFinal && (
          a.rejection_reason
            ? <p className="text-sm text-muted-foreground"><span className="font-medium text-foreground">Motivo:</span> {a.rejection_reason}</p>
            : <p className="text-sm text-muted-foreground">Sin acciones disponibles.</p>
        )}

        {(canReject || canBlock) && (
          <div className="space-y-2 border-t border-[var(--border)] pt-3">
            <Textarea rows={2} placeholder="Motivo (para rechazar o bloquear)" value={inputs.motivo} onChange={(e) => setInputs((s) => ({ ...s, motivo: e.target.value }))} />
            <div className="flex flex-wrap gap-2">
              {canReject && (
                <Button variant="destructive" loading={isBusy} disabled={motivoMissing} onClick={() => act(a.id, 'reject', { rejection_reason: inputs.motivo })}>Rechazar</Button>
              )}
              {canBlock && (
                <Button variant="outline" loading={isBusy} disabled={motivoMissing} onClick={() => act(a.id, 'block', { rejection_reason: inputs.motivo })}>Bloquear (renuncia)</Button>
              )}
            </div>
          </div>
        )}

        {actionError && <p className="text-sm text-[var(--red-600)]">{actionError}</p>}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Filtro + invitación */}
      <div className="rounded-xl border border-[var(--border)] bg-white shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4 px-6 py-4">
          <div className="flex flex-col gap-1 min-w-[220px]">
            <label className="text-xs font-medium text-muted-foreground">Estado</label>
            <SelectMenu ariaLabel="Estado" className="w-full" value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} />
          </div>
          {isAdmin && !showInvite && (
            <Button variant="secondary" onClick={() => { setShowInvite(true); setInviteMsg(null); }}>
              Invitar aprobador
            </Button>
          )}
        </div>

        {isAdmin && showInvite && (
          <div className="border-t border-[var(--border)] px-6 py-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Invitá una persona con perfil <b className="text-foreground">Administración</b> — solo podrá aprobar/transferir adelantos, nada más del admin.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1.5 min-w-[260px]">
                <label className="text-xs font-medium text-muted-foreground">Email</label>
                <Input type="email" placeholder="persona@pow.la" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
              </div>
              <Button loading={inviting} disabled={!inviteEmail.trim()} onClick={invite}>Enviar invitación</Button>
              <Button variant="ghost" onClick={() => { setShowInvite(false); setInviteMsg(null); }}>Cancelar</Button>
            </div>
            {inviteMsg && (
              <p className={`text-sm ${inviteMsg.ok ? 'text-[var(--green-700)]' : 'text-[var(--red-600)]'}`}>{inviteMsg.text}</p>
            )}
          </div>
        )}
      </div>

      {/* Tabla */}
      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm">
        <div className="border-b border-[var(--border)] px-6 py-4">
          <h2 className="text-base font-semibold text-foreground">Solicitudes</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{loading ? 'Cargando…' : `${advances.length} solicitud${advances.length !== 1 ? 'es' : ''}`}</p>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--border)] border-t-transparent" />
          </div>
        ) : advances.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Sin solicitudes para este filtro.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-muted text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-6 py-3">Colaborador</th>
                  <th className="px-6 py-3 text-right">Monto</th>
                  <th className="px-6 py-3">Mes desc.</th>
                  <th className="px-6 py-3">Tipo</th>
                  <th className="px-6 py-3">Estado</th>
                  <th className="px-6 py-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {advances.map((a) => (
                  <Fragment key={a.id}>
                    <tr className="hover:bg-muted transition-colors">
                      <td className="px-6 py-3 font-medium text-foreground">{a.employee_name}</td>
                      <td className="px-6 py-3 text-right font-medium text-foreground nums-tabular">{ars(a.amount)}</td>
                      <td className="px-6 py-3 text-muted-foreground">{monthLabel(a.discount_year, a.discount_month)}</td>
                      <td className="px-6 py-3 text-muted-foreground">{ADVANCE_TYPE_LABELS[a.type] ?? a.type}</td>
                      <td className="px-6 py-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[a.status]}`}>
                          {ADVANCE_STATUS_LABELS[a.status]}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right">
                        <Button variant="ghost" size="sm" onClick={() => toggle(a.id)}>
                          {expandedId === a.id ? 'Cerrar' : 'Gestionar'}
                        </Button>
                      </td>
                    </tr>
                    {expandedId === a.id && (
                      <tr>
                        <td colSpan={6} className="px-6 pb-4">{renderActions(a)}</td>
                      </tr>
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

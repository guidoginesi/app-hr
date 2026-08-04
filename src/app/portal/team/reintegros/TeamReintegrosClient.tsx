'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@pow/ui/components/ui/button';
import { Textarea } from '@pow/ui/components/ui/textarea';
import { PageHeader } from '@pow/ui/components/ui/page-header';
import { CATEGORY_LABELS, STATUS_LABELS_EMPLOYEE, money } from '@/lib/reimbursements';
import type { ReimbursementStatus, ReimbursementWithDetails } from '@/types/reimbursement';

const fecha = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

const statusPill: Record<ReimbursementStatus, string> = {
  requested: 'bg-accent text-[var(--brand-strong)]',
  leader_approved: 'bg-secondary text-secondary-foreground',
  admin_validated: 'bg-secondary text-secondary-foreground',
  to_pay: 'bg-warning-subtle text-[var(--amber-600)]',
  paid: 'bg-success-subtle text-[var(--green-700)]',
  rejected: 'bg-danger-subtle text-[var(--red-600)]',
  cancelled: 'bg-secondary text-muted-foreground',
};

export function TeamReintegrosClient() {
  const [items, setItems] = useState<ReimbursementWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/portal/team/reintegros');
      const data = await res.json();
      if (res.ok) setItems(data.items ?? []);
      else setError(data.error ?? 'No se pudieron cargar los reintegros del equipo.');
    } catch {
      setError('No se pudieron cargar los reintegros del equipo.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
      setComment('');
      setReason('');
      await load();
    } catch {
      setError('No se pudo aplicar la acción.');
    } finally {
      setBusy(null);
    }
  };

  const verComprobante = async (id: string) => {
    const res = await fetch(`/api/reintegros/${id}/file?kind=comprobante`);
    const data = await res.json();
    if (data.url) window.open(data.url, '_blank');
    else setError(data.error ?? 'No se pudo abrir el comprobante.');
  };

  const pendientes = items.filter((r) => r.status === 'requested');
  const resto = items.filter((r) => r.status !== 'requested');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reintegros del equipo"
        description="Gastos que tu equipo pidió reintegrar. Vos aprobás o rechazás; después los valida Administración."
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

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--border)] border-t-transparent" />
        </div>
      ) : (
        <>
          <Seccion titulo={`Esperando tu decisión${pendientes.length ? ` (${pendientes.length})` : ''}`} vacio="No tenés reintegros por aprobar.">
            {pendientes.map((r) => (
              <li key={r.id} className="px-6 py-4">
                <Fila r={r} onVer={() => verComprobante(r.id)} />

                {openId === r.id ? (
                  <div className="mt-3 space-y-3 rounded-lg border border-[var(--border)] bg-muted p-4">
                    {r.validations?.reason && (
                      <p className="text-sm text-secondary-foreground">
                        <b>Motivo que dejó:</b> {r.validations.reason}
                      </p>
                    )}
                    <Textarea
                      rows={2}
                      placeholder="Comentario para aprobar (opcional)"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                    />
                    <Textarea
                      rows={2}
                      placeholder="Motivo, si lo vas a rechazar"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        loading={busy === r.id}
                        onClick={() => act(r.id, { action: 'approve_leader', comment: comment || undefined }, 'Reintegro aprobado. Pasa a Administración.')}
                      >
                        Aprobar
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        loading={busy === r.id}
                        disabled={reason.trim().length < 3}
                        onClick={() => act(r.id, { action: 'reject', reason }, 'Reintegro rechazado.')}
                      >
                        Rechazar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setOpenId(null)}>
                        Cerrar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3">
                    <Button size="sm" onClick={() => { setOpenId(r.id); setComment(''); setReason(''); }}>
                      Revisar
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </Seccion>

          <Seccion titulo="Histórico del equipo" vacio="Todavía no hay reintegros cerrados.">
            {resto.map((r) => (
              <li key={r.id} className="px-6 py-4">
                <Fila r={r} onVer={() => verComprobante(r.id)} />
              </li>
            ))}
          </Seccion>
        </>
      )}
    </div>
  );

  function Fila({ r, onVer }: { r: ReimbursementWithDetails; onVer: () => void }) {
    return (
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-foreground">{r.concept}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {r.employee_name} · {CATEGORY_LABELS[r.category]} · {fecha(r.expense_date)}
            {r.project_label_snapshot ? ` · ${r.project_label_snapshot}` : ''}
          </p>
          <button
            type="button"
            onClick={onVer}
            className="mt-1 text-xs font-medium text-[var(--brand-strong)] underline decoration-dotted underline-offset-4"
          >
            Ver comprobante
          </button>
        </div>
        <div className="flex items-center gap-3">
          <p className="font-medium text-foreground nums-tabular">{money(r.amount, r.currency)}</p>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${statusPill[r.status]}`}>
            {STATUS_LABELS_EMPLOYEE[r.status]}
          </span>
        </div>
      </div>
    );
  }
}

function Seccion({ titulo, vacio, children }: { titulo: string; vacio: string; children: React.ReactNode }) {
  const vacia = !children || (Array.isArray(children) && children.length === 0);
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm">
      <div className="border-b border-[var(--border)] px-6 py-4">
        <h2 className="text-base font-semibold text-foreground">{titulo}</h2>
      </div>
      {vacia ? (
        <div className="py-12 text-center text-sm text-muted-foreground">{vacio}</div>
      ) : (
        <ul className="divide-y divide-[var(--border)]">{children}</ul>
      )}
    </div>
  );
}

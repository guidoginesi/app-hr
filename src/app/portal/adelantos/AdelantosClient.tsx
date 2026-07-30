'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@pow/ui/components/ui/button';
import { Input } from '@pow/ui/components/ui/input';
import { Textarea } from '@pow/ui/components/ui/textarea';
import { Switch } from '@pow/ui/components/ui/switch';
import type { AdvanceEvaluation, SalaryAdvanceWithDetails, SalaryAdvanceStatus } from '@/types/salaryAdvance';
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

export function AdelantosClient() {
  const [advances, setAdvances] = useState<SalaryAdvanceWithDetails[]>([]);
  const [preview, setPreview] = useState<AdvanceEvaluation | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState('');
  const [emergency, setEmergency] = useState(false);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/portal/salary-advances');
      const data = await res.json();
      if (res.ok) {
        setAdvances(data.advances ?? []);
        setPreview(data.preview ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const reasonRequired = (preview?.requiresReason ?? false) || emergency;
  const amountNum = Number(amount);
  const canSubmit =
    amountNum > 0 && (!reasonRequired || reason.trim().length > 0) && !submitting;

  const hasActiveAdvance = advances.some((a) =>
    ['pending_hr', 'pending_admin', 'approved', 'transferred'].includes(a.status),
  );

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/portal/salary-advances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountNum,
          reason: reason.trim() || null,
          emergency,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'No se pudo enviar la solicitud.');
        return;
      }
      setShowForm(false);
      setAmount('');
      setReason('');
      setEmergency(false);
      await fetchData();
    } catch {
      setError('No se pudo enviar la solicitud.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Adelantos de sueldo</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Solicitá un adelanto de tu sueldo. El equipo de People y Administración lo revisan antes de la transferencia.
          </p>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)} disabled={hasActiveAdvance}>
            Solicitar adelanto
          </Button>
        )}
      </div>

      {hasActiveAdvance && !showForm && (
        <div className="rounded-xl border border-[var(--border)] bg-warning-subtle px-5 py-3 text-sm text-[var(--amber-600)]">
          Ya tenés un adelanto vigente. Vas a poder solicitar otro una vez que se salde.
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="rounded-xl border border-[var(--border)] bg-white shadow-sm p-6 space-y-5">
          <h2 className="text-base font-semibold text-foreground">Nueva solicitud</h2>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Monto solicitado</label>
              <Input
                type="number"
                min={0}
                inputMode="numeric"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">¿Es una emergencia?</label>
              <div className="flex items-center gap-2 h-9">
                <Switch checked={emergency} onCheckedChange={setEmergency} aria-label="Emergencia" />
                <span className="text-sm text-muted-foreground">
                  {emergency ? 'Sí — se tratará como extraordinaria' : 'No'}
                </span>
              </div>
            </div>
          </div>

          {reasonRequired && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Motivo {reasonRequired && <span className="text-[var(--red-600)]">*</span>}
              </label>
              <Textarea
                rows={3}
                placeholder="Contanos el motivo de la solicitud"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          )}

          {/* Validación en vivo */}
          {preview && (
            <div className="rounded-lg border border-[var(--border)] bg-muted p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                Requisitos
              </p>
              <ul className="space-y-1.5">
                {preview.rules.map((r) => (
                  <li key={r.n} className="flex items-center gap-2 text-sm">
                    {r.ok === true && <span className="text-[var(--green-600)]">✓</span>}
                    {r.ok === false && <span className="text-[var(--red-600)]">✗</span>}
                    {r.ok === null && <span className="text-muted-foreground">•</span>}
                    <span className={r.ok === false ? 'text-foreground' : 'text-muted-foreground'}>
                      {r.label}
                      {r.mode === 'manual' && r.detail ? ` — ${r.detail}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
              {preview.classification !== 'standard' && (
                <p className="mt-3 text-xs text-[var(--amber-600)]">
                  Tu solicitud sería {preview.classification === 'extraordinary' ? 'extraordinaria' : 'una excepción'}: requiere un motivo. La revisan People y Administración.
                </p>
              )}
            </div>
          )}

          {error && <p className="text-sm text-[var(--red-600)]">{error}</p>}

          <div className="flex items-center gap-3">
            <Button onClick={submit} disabled={!canSubmit} loading={submitting}>
              Enviar solicitud
            </Button>
            <Button variant="ghost" onClick={() => { setShowForm(false); setError(null); }}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Lista */}
      <div className="rounded-xl border border-[var(--border)] bg-white shadow-sm">
        <div className="border-b border-[var(--border)] px-6 py-4">
          <h2 className="text-base font-semibold text-foreground">Mis adelantos</h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--border)] border-t-transparent" />
          </div>
        ) : advances.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Todavía no solicitaste adelantos.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-muted text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-6 py-3">Fecha</th>
                  <th className="px-6 py-3 text-right">Monto</th>
                  <th className="px-6 py-3">Mes de descuento</th>
                  <th className="px-6 py-3">Tipo</th>
                  <th className="px-6 py-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {advances.map((a) => (
                  <tr key={a.id} className="hover:bg-muted transition-colors">
                    <td className="px-6 py-3 text-muted-foreground">
                      {new Date(a.requested_at).toLocaleDateString('es-AR')}
                    </td>
                    <td className="px-6 py-3 text-right font-medium text-foreground nums-tabular">{ars(a.amount)}</td>
                    <td className="px-6 py-3 text-muted-foreground">{monthLabel(a.discount_year, a.discount_month)}</td>
                    <td className="px-6 py-3 text-muted-foreground">{ADVANCE_TYPE_LABELS[a.type] ?? a.type}</td>
                    <td className="px-6 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[a.status]}`}>
                        {ADVANCE_STATUS_LABELS[a.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

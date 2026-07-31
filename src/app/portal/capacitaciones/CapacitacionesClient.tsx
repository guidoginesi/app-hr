'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@pow/ui/components/ui/button';
import { Input } from '@pow/ui/components/ui/input';
import { Textarea } from '@pow/ui/components/ui/textarea';
import { SelectMenu } from '@pow/ui/components/ui/select-menu';
import type { TrainingBudget, TrainingRequestWithDetails, TrainingRequestStatus } from '@/types/training';
import { TRAINING_STATUS_LABELS, TRAINING_STEPS, TRAINING_MODALITY_LABELS } from '@/lib/training';

const money = (n: number, cur: string) =>
  `${cur} ${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(n)}`;

const STATUS_COLORS: Partial<Record<TrainingRequestStatus, string>> = {
  rejected: 'bg-danger-subtle text-[var(--red-600)]',
  cancelled: 'bg-secondary text-muted-foreground',
  completed: 'bg-success-subtle text-[var(--green-700)]',
};

function Stepper({ status }: { status: TrainingRequestStatus }) {
  if (status === 'rejected' || status === 'cancelled') return null;
  const currentIdx = TRAINING_STEPS.findIndex((s) => s.key === status);
  return (
    <div className="mt-3 flex items-center gap-1 overflow-x-auto">
      {TRAINING_STEPS.map((s, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <div key={s.key} className="flex items-center gap-1">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`h-4 w-4 rounded-full border-2 ${
                  done ? 'border-[var(--brand)] bg-[var(--brand)]' : active ? 'border-[var(--brand)] bg-white' : 'border-[var(--gray-300)] bg-white'
                }`}
              />
              <span className={`whitespace-nowrap text-[10px] ${active ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>{s.label}</span>
            </div>
            {i < TRAINING_STEPS.length - 1 && <div className={`h-0.5 w-6 ${done ? 'bg-[var(--brand)]' : 'bg-[var(--gray-300)]'}`} />}
          </div>
        );
      })}
    </div>
  );
}

const emptyForm = {
  course_name: '', provider: '', modality: '', hours: '', start_date: '', end_date: '',
  link: '', objective: '', role_relation: '', cost: '', currency: 'USD',
};

export function CapacitacionesClient() {
  const [requests, setRequests] = useState<TrainingRequestWithDetails[]>([]);
  const [budget, setBudget] = useState<TrainingBudget | null>(null);
  const [seniorityOk, setSeniorityOk] = useState(true);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadKey, setUploadKey] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const upload = async (requestId: string, kind: string, file: File) => {
    setUploadKey(requestId + kind); setUploadError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('kind', kind);
      const res = await fetch(`/api/portal/training/${requestId}/upload`, { method: 'POST', body: fd });
      if (!res.ok) { const d = await res.json(); setUploadError(d.error ?? 'No se pudo subir el archivo.'); return; }
      await fetchData();
    } catch { setUploadError('No se pudo subir el archivo.'); }
    finally { setUploadKey(null); }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/portal/training');
      const data = await res.json();
      if (res.ok) {
        setRequests(data.requests ?? []);
        setBudget(data.budget ?? null);
        setSeniorityOk(data.preview?.seniorityOk ?? true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const cost = Number(form.cost);
  const available = budget?.available_usd ?? 0;
  const costOk =
    form.currency === 'USD'
      ? cost > 0 && cost <= available && cost <= (budget?.total_usd ?? 0)
      : cost > 0 && available > 0;
  const canSubmit = form.course_name.trim().length > 0 && cost > 0 && seniorityOk && costOk && !submitting;

  const submit = async () => {
    setSubmitting(true); setError(null);
    try {
      const res = await fetch('/api/portal/training', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          course_name: form.course_name.trim(),
          provider: form.provider.trim() || null,
          modality: form.modality || null,
          hours: form.hours ? Number(form.hours) : null,
          start_date: form.start_date || null,
          end_date: form.end_date || null,
          link: form.link.trim() || null,
          objective: form.objective.trim() || null,
          role_relation: form.role_relation.trim() || null,
          cost,
          currency: form.currency,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'No se pudo enviar la solicitud.'); return; }
      setShowForm(false); setForm({ ...emptyForm }); await fetchData();
    } catch { setError('No se pudo enviar la solicitud.'); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Fondo de Capacitaciones</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Solicitá tu capacitación y seguí el estado de tu reintegro.</p>
        </div>
        {!showForm && <Button onClick={() => setShowForm(true)} disabled={!seniorityOk || available <= 0}>Solicitar capacitación</Button>}
      </div>

      {/* Budget cards */}
      {budget && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-[var(--border)] bg-white p-5 shadow-sm">
            <div className="text-2xl font-bold text-foreground nums-tabular">{money(budget.total_usd, 'USD')}</div>
            <div className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Budget anual</div>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-white p-5 shadow-sm">
            <div className="text-2xl font-bold text-foreground nums-tabular">{money(budget.committed_usd + budget.consumed_usd, 'USD')}</div>
            <div className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Consumido / comprometido</div>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-white p-5 shadow-sm">
            <div className="text-2xl font-bold text-[var(--brand-strong)] nums-tabular">{money(budget.available_usd, 'USD')}</div>
            <div className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Disponible</div>
          </div>
        </div>
      )}

      {!seniorityOk && !showForm && (
        <div className="rounded-xl border border-[var(--border)] bg-warning-subtle px-5 py-3 text-sm text-[var(--amber-600)]">
          Vas a poder solicitar capacitaciones cuando cumplas 6 meses de antigüedad.
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm space-y-5">
          <h2 className="text-base font-semibold text-foreground">Nueva solicitud</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre del curso *"><Input value={form.course_name} onChange={(e) => set('course_name', e.target.value)} placeholder="Ej. React Avanzado" /></Field>
            <Field label="Proveedor / institución"><Input value={form.provider} onChange={(e) => set('provider', e.target.value)} placeholder="Ej. Platzi" /></Field>
            <Field label="Modalidad">
              <SelectMenu ariaLabel="Modalidad" value={form.modality} onChange={(v) => set('modality', v)} options={[{ value: '', label: '—' }, { value: 'online', label: 'Online' }, { value: 'presencial', label: 'Presencial' }]} />
            </Field>
            <Field label="Carga horaria (hs)"><Input type="number" min={0} value={form.hours} onChange={(e) => set('hours', e.target.value)} /></Field>
            <Field label="Fecha de inicio"><Input type="date" value={form.start_date} onChange={(e) => set('start_date', e.target.value)} /></Field>
            <Field label="Fecha de fin"><Input type="date" value={form.end_date} onChange={(e) => set('end_date', e.target.value)} /></Field>
            <Field label="Costo *"><Input type="number" min={0} value={form.cost} onChange={(e) => set('cost', e.target.value)} placeholder="0" /></Field>
            <Field label="Moneda">
              <SelectMenu ariaLabel="Moneda" value={form.currency} onChange={(v) => set('currency', v)} options={[{ value: 'USD', label: 'USD' }, { value: 'ARS', label: 'ARS (se convierte a USD al aprobar)' }]} />
            </Field>
            <Field label="Link del curso"><Input value={form.link} onChange={(e) => set('link', e.target.value)} placeholder="https://…" /></Field>
            <Field label="Relación con tu rol"><Input value={form.role_relation} onChange={(e) => set('role_relation', e.target.value)} /></Field>
          </div>
          <Field label="Objetivo / justificación"><Textarea rows={2} value={form.objective} onChange={(e) => set('objective', e.target.value)} /></Field>

          {form.currency === 'USD' && cost > 0 && cost > available && (
            <p className="text-sm text-[var(--red-600)]">El monto (USD {cost}) supera tu disponible ({money(available, 'USD')}).</p>
          )}
          {error && <p className="text-sm text-[var(--red-600)]">{error}</p>}

          <div className="flex items-center gap-3">
            <Button onClick={submit} disabled={!canSubmit} loading={submitting}>Enviar solicitud</Button>
            <Button variant="ghost" onClick={() => { setShowForm(false); setError(null); }}>Cancelar</Button>
          </div>
        </div>
      )}

      {/* Lista */}
      <div className="rounded-xl border border-[var(--border)] bg-white shadow-sm">
        <div className="border-b border-[var(--border)] px-6 py-4">
          <h2 className="text-base font-semibold text-foreground">Mis capacitaciones</h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16"><div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--border)] border-t-transparent" /></div>
        ) : requests.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Todavía no solicitaste capacitaciones.</div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {requests.map((r) => (
              <div key={r.id} className="px-6 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-foreground">{r.course_name}{r.provider ? ` — ${r.provider}` : ''}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString('es-AR')} · {r.modality ? TRAINING_MODALITY_LABELS[r.modality] : '—'}{r.hours ? ` · ${r.hours} hs` : ''} · {money(r.cost, r.currency)}
                    </p>
                  </div>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[r.status] ?? 'bg-warning-subtle text-[var(--amber-600)]'}`}>
                    {TRAINING_STATUS_LABELS[r.status]}
                  </span>
                </div>
                {(r.status === 'rejected' || r.status === 'cancelled') && r.rejection_reason && (
                  <p className="mt-2 text-xs text-muted-foreground"><span className="font-medium text-foreground">Motivo:</span> {r.rejection_reason}</p>
                )}
                <Stepper status={r.status} />

                {r.status === 'hr_approved' && (
                  <UploadZone label="Subí la factura para el pago del 50% inicial" busy={uploadKey === r.id + 'invoice_initial'} onFile={(f) => upload(r.id, 'invoice_initial', f)} />
                )}
                {r.status === 'initial_paid' && (
                  <UploadZone label="Subí el certificado de finalización" busy={uploadKey === r.id + 'certificate'} onFile={(f) => upload(r.id, 'certificate', f)} />
                )}
                {uploadError && uploadKey === null && <p className="mt-2 text-xs text-[var(--red-600)]">{uploadError}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function UploadZone({ label, busy, onFile }: { label: string; busy: boolean; onFile: (f: File) => void }) {
  return (
    <label className="mt-3 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-[var(--brand)] bg-accent px-4 py-5 text-center transition-colors hover:bg-[var(--orange-100)]">
      <span className="text-sm font-medium text-foreground">{busy ? 'Subiendo…' : label}</span>
      <span className="text-xs text-muted-foreground">PDF, JPG o PNG · máx. 10 MB</span>
      <input
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        className="hidden"
        disabled={busy}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.currentTarget.value = ''; }}
      />
    </label>
  );
}

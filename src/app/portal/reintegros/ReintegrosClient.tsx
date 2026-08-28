'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button, buttonVariants } from '@pow/ui/components/ui/button';
import { Sheet, SheetTrigger, SheetContent } from '@pow/ui/components/ui/sheet';
import { Input } from '@pow/ui/components/ui/input';
import { Textarea } from '@pow/ui/components/ui/textarea';
import { SelectMenu } from '@pow/ui/components/ui/select-menu';
import { PageHeader } from '@pow/ui/components/ui/page-header';
import {
  MAX_FILES,
  RECEIPT_TYPES,
  STATUS_LABELS_EMPLOYEE,
  STEPS,
  evaluateRequest,
  money,
  payableAmount,
  todayInArgentina,
} from '@/lib/reimbursements';
import type { ExpenseProject, ExpenseReason, ReimbursementStatus, ReimbursementWithDetails } from '@/types/reimbursement';

const statusPill: Record<ReimbursementStatus, string> = {
  requested: 'bg-accent text-[var(--brand-strong)]',
  leader_approved: 'bg-secondary text-secondary-foreground',
  admin_validated: 'bg-secondary text-secondary-foreground',
  to_pay: 'bg-warning-subtle text-[var(--amber-600)]',
  paid: 'bg-success-subtle text-[var(--green-700)]',
  rejected: 'bg-danger-subtle text-[var(--red-600)]',
  cancelled: 'bg-secondary text-muted-foreground',
};

const fecha = (iso: string) => {
  // Sin pasar por Date: un 'YYYY-MM-DD' se interpreta en UTC y en Argentina se
  // ve un día menos.
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

const DEFAULT_FORM = {
  expense_date: '',
  reason_id: '',
  concept: '',
  amount: '',
  currency: 'ARS',
  project_id: '',
  receipt_type: 'factura_b',
  receipt_number: '',
  supplier_cuit: '',
  justification: '',
};

export function ReintegrosClient({ enabled }: { enabled: boolean }) {
  const [items, setItems] = useState<ReimbursementWithDetails[]>([]);
  const [projects, setProjects] = useState<ExpenseProject[]>([]);
  const [reasons, setReasons] = useState<ExpenseReason[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...DEFAULT_FORM });
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/portal/reintegros');
      const data = await res.json();
      if (res.ok) {
        setItems(data.items ?? []);
        setProjects(data.projects ?? []);
        setReasons(data.reasons ?? []);
      } else setError(data.error ?? 'No se pudieron cargar tus reintegros.');
    } catch {
      setError('No se pudieron cargar tus reintegros.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) load();
    else setLoading(false);
  }, [enabled, load]);

  // Se evalúa en vivo con las MISMAS reglas que el server, para que el motivo se
  // pida mientras se escribe y no después de mandar.
  const amountNum = Number(form.amount);
  const evaluation =
    form.expense_date && amountNum > 0
      ? evaluateRequest({
          expenseDate: form.expense_date,
          amount: amountNum,
          currency: form.currency as 'ARS' | 'USD',
        })
      : null;
  const reasonRequired = evaluation?.requiresReason ?? false;

  const canSubmit =
    files.length > 0 &&
    form.reason_id &&
    form.expense_date &&
    form.concept.trim().length >= 3 &&
    amountNum > 0 &&
    (!reasonRequired || form.justification.trim().length > 0) &&
    !saving;

  const submit = async () => {
    if (files.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const fd = new FormData();
      // Un campo repetido: del otro lado se leen con getAll('receipt').
      for (const f of files) fd.append('receipt', f);
      fd.append(
        'data',
        JSON.stringify({
          expense_date: form.expense_date,
          reason_id: form.reason_id,
          concept: form.concept.trim(),
          amount: amountNum,
          currency: form.currency,
          project_id: form.project_id || null,
          receipt_type: form.receipt_type,
          receipt_number: form.receipt_number.trim() || null,
          supplier_cuit: form.supplier_cuit.trim() || null,
          justification: form.justification.trim() || null,
        }),
      );
      const res = await fetch('/api/portal/reintegros', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'No se pudo enviar el reintegro.');
        return;
      }
      setNotice('Reintegro enviado. Te avisamos cuando lo aprueben.');
      setShowForm(false);
      setForm({ ...DEFAULT_FORM });
      setFiles([]);
      await load();
    } catch {
      setError('No se pudo enviar el reintegro.');
    } finally {
      setSaving(false);
    }
  };

  const cancel = async (id: string) => {
    setError(null);
    const res = await fetch(`/api/reintegros/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel' }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error ?? 'No se pudo cancelar.');
    setNotice('Reintegro cancelado.');
    await load();
  };

  const verComprobante = async (id: string, fileId?: string) => {
    const qs = fileId ? `&fileId=${encodeURIComponent(fileId)}` : '';
    const res = await fetch(`/api/reintegros/${id}/file?kind=comprobante${qs}`);
    const data = await res.json();
    if (data.url) window.open(data.url, '_blank');
    else setError(data.error ?? 'No se pudo abrir el comprobante.');
  };

  if (!enabled) {
    return (
      <div className="space-y-6">
        <PageHeader title="Reintegros" description="Solicitud de reintegro de gastos" />
        <div className="rounded-xl border border-[var(--border)] bg-white px-6 py-12 text-center shadow-sm">
          <p className="text-sm font-medium text-foreground">No tenés habilitado el módulo de reintegros</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Se habilita persona por persona. Si necesitás cargar gastos para que te los reintegren, escribile al
            equipo de People.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reintegros"
        description="Cargá un gasto con su comprobante y seguí el estado hasta que te lo paguen."
        actions={
          <Sheet open={showForm} onOpenChange={(o) => { setShowForm(o); if (!o) setError(null); }}>
            <SheetTrigger className={buttonVariants({ variant: 'primary' })}>Nuevo reintegro</SheetTrigger>
            <SheetContent
              title="Nuevo reintegro"
              description="El comprobante es obligatorio: sin él Administración no puede validarlo"
              className="sm:max-w-xl"
            >
              <div className="space-y-4 px-1">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Fecha del gasto *</label>
                    <Input
                      type="date"
                      max={todayInArgentina()}
                      value={form.expense_date}
                      onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Motivo *</label>
                    <SelectMenu
                      ariaLabel="Motivo del gasto"
                      className="w-full"
                      value={form.reason_id}
                      onChange={(v) => setForm({ ...form, reason_id: v })}
                      options={[
                        { value: '', label: 'Elegí un motivo…' },
                        ...reasons.map((r) => ({ value: r.id, label: r.name })),
                      ]}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Descripción *</label>
                  <Textarea
                    rows={2}
                    placeholder="Ej. Taxi de la oficina a la reunión con Acme y vuelta"
                    value={form.concept}
                    onChange={(e) => setForm({ ...form, concept: e.target.value })}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <label className="text-xs font-medium text-muted-foreground">Monto *</label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Moneda</label>
                    <SelectMenu
                      ariaLabel="Moneda"
                      className="w-full"
                      value={form.currency}
                      onChange={(v) => setForm({ ...form, currency: v })}
                      options={[
                        { value: 'ARS', label: 'ARS' },
                        { value: 'USD', label: 'USD' },
                      ]}
                    />
                  </div>
                </div>

                {projects.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Cliente / proyecto</label>
                    <SelectMenu
                      ariaLabel="Cliente o proyecto"
                      className="w-full"
                      value={form.project_id}
                      onChange={(v) => setForm({ ...form, project_id: v })}
                      options={[
                        { value: '', label: 'No imputable' },
                        ...projects.map((p) => ({
                          value: p.id,
                          label: p.client_name ? `${p.client_name} · ${p.name}` : p.name,
                        })),
                      ]}
                    />
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Comprobante *</label>
                    <SelectMenu
                      ariaLabel="Tipo de comprobante"
                      className="w-full"
                      value={form.receipt_type}
                      onChange={(v) => setForm({ ...form, receipt_type: v })}
                      options={RECEIPT_TYPES}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Número</label>
                    <Input
                      placeholder="0001-00001234"
                      value={form.receipt_number}
                      onChange={(e) => setForm({ ...form, receipt_number: e.target.value })}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-muted-foreground">CUIT del proveedor</label>
                    <Input
                      inputMode="numeric"
                      placeholder="11 dígitos"
                      value={form.supplier_cuit}
                      onChange={(e) => setForm({ ...form, supplier_cuit: e.target.value.replace(/\D/g, '') })}
                    />
                  </div>
                </div>

                {/* Adjuntos: al menos uno, hasta MAX_FILES */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Archivos del comprobante *
                  </label>

                  {files.length > 0 && (
                    <ul className="flex flex-col gap-1">
                      {files.map((f, i) => (
                        <li
                          key={`${f.name}-${f.size}-${i}`}
                          className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-card px-3 py-2"
                        >
                          <span className="min-w-0 flex-1 truncate text-sm text-foreground">{f.name}</span>
                          <span className="shrink-0 text-xs text-muted-foreground nums-tabular">
                            {(f.size / 1024 / 1024).toFixed(1)} MB
                          </span>
                          <button
                            type="button"
                            aria-label={`Quitar ${f.name}`}
                            className="shrink-0 text-xs font-medium text-[var(--red-600)] hover:underline"
                            onClick={() => setFiles(files.filter((_, j) => j !== i))}
                          >
                            Quitar
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  {files.length < MAX_FILES && (
                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--border)] bg-muted px-4 py-2.5 text-center transition-colors hover:border-[var(--brand)] hover:bg-accent">
                      <span className="text-sm font-medium text-foreground">
                        {files.length === 0 ? 'Elegir archivos' : 'Agregar otro'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        PDF, JPG, PNG o WEBP · máx. 10 MB cada uno
                      </span>
                      <input
                        type="file"
                        multiple
                        accept=".pdf,.jpg,.jpeg,.png,.webp"
                        className="hidden"
                        // El input se limpia después de leerlo para poder volver a
                        // elegir el mismo archivo si alguien lo quita por error.
                        onChange={(e) => {
                          const nuevos = Array.from(e.target.files ?? []);
                          setFiles((prev) => [...prev, ...nuevos].slice(0, MAX_FILES));
                          e.target.value = '';
                        }}
                      />
                    </label>
                  )}

                  {files.length >= MAX_FILES && (
                    <p className="text-xs text-muted-foreground">
                      Llegaste al máximo de {MAX_FILES} comprobantes.
                    </p>
                  )}
                </div>

                {/* Reglas informativas: no bloquean, pero si fallan piden motivo. */}
                {evaluation && (
                  <div className="rounded-lg border border-[var(--border)] bg-muted p-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Revisá antes de enviar
                    </p>
                    <ul className="space-y-1.5">
                      {evaluation.rules.map((r) => (
                        <li key={r.label} className="flex items-start gap-2 text-sm">
                          <span className={r.ok ? 'text-[var(--green-600)]' : 'text-[var(--amber-600)]'}>
                            {r.ok ? '✓' : '!'}
                          </span>
                          <span className={r.ok ? 'text-muted-foreground' : 'text-foreground'}>
                            {r.label}
                            {r.detail ? ` — ${r.detail}` : ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {reasonRequired && (
                      <p className="mt-2 text-xs text-[var(--amber-600)]">
                        Se puede enviar igual, pero contanos el motivo para que tu líder tenga contexto.
                      </p>
                    )}
                  </div>
                )}

                {reasonRequired && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Motivo *</label>
                    <Textarea
                      rows={3}
                      placeholder="Por qué el gasto sale de lo habitual"
                      value={form.justification}
                      onChange={(e) => setForm({ ...form, justification: e.target.value })}
                    />
                  </div>
                )}

                {error && <p className="text-sm text-[var(--red-600)]">{error}</p>}

                <div className="flex items-center gap-3 pt-1">
                  <Button onClick={submit} disabled={!canSubmit} loading={saving}>
                    Enviar reintegro
                  </Button>
                  <Button variant="ghost" onClick={() => { setShowForm(false); setError(null); }}>
                    Cancelar
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        }
      />

      {notice && (
        <div role="status" aria-live="polite" className="flex items-start justify-between gap-4 rounded-xl border border-[var(--border)] bg-success-subtle px-5 py-3 text-sm text-[var(--green-700)]">
          <span>{notice}</span>
          <button type="button" aria-label="Cerrar el aviso" onClick={() => setNotice(null)} className="shrink-0 font-medium">✕</button>
        </div>
      )}
      {error && !showForm && (
        <div role="alert" className="flex items-start justify-between gap-4 rounded-xl border border-[var(--border)] bg-danger-subtle px-5 py-3 text-sm text-[var(--red-600)]">
          <span>{error}</span>
          <button type="button" aria-label="Cerrar el aviso" onClick={() => setError(null)} className="shrink-0 font-medium">✕</button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm">
        <div className="border-b border-[var(--border)] px-6 py-4">
          <h2 className="text-base font-semibold text-foreground">Mis reintegros</h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--border)] border-t-transparent" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Todavía no cargaste reintegros.</div>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {items.map((r) => {
              const stepIndex = STEPS.findIndex((s) => s.key === r.status);
              const cerrado = ['rejected', 'cancelled'].includes(r.status);
              return (
                <li key={r.id} className="px-6 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{r.concept}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {r.reason_label_snapshot ?? r.reason_name ?? '—'} · {fecha(r.expense_date)}
                        {r.project_label_snapshot ? ` · ${r.project_label_snapshot}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-medium text-foreground nums-tabular">{money(r.amount, r.currency)}</p>
                        {r.approved_amount !== null && (
                          <p className="text-xs text-[var(--amber-600)] nums-tabular">
                            Se aprobó {money(payableAmount(r), r.currency)}
                          </p>
                        )}
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${statusPill[r.status]}`}>
                        {STATUS_LABELS_EMPLOYEE[r.status]}
                      </span>
                    </div>
                  </div>

                  {/* Seguimiento: sólo tiene sentido mientras el circuito avanza. */}
                  {!cerrado && (
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      {STEPS.map((s, i) => (
                        <span
                          key={s.key}
                          className={`rounded-full px-2 py-0.5 text-[11px] ${
                            i <= stepIndex ? 'bg-accent text-[var(--brand-strong)]' : 'bg-secondary text-muted-foreground'
                          }`}
                        >
                          {s.label}
                        </span>
                      ))}
                    </div>
                  )}

                  {r.estimated_payment_date && r.status !== 'paid' && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Pago estimado: <b className="text-foreground">{fecha(r.estimated_payment_date)}</b>
                    </p>
                  )}
                  {r.rejection_reason && (
                    <p className="mt-2 text-xs text-[var(--red-600)]">Motivo del rechazo: {r.rejection_reason}</p>
                  )}
                  {r.admin_comment && (
                    <p className="mt-1 text-xs text-muted-foreground">Administración: {r.admin_comment}</p>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {/* Con un solo comprobante alcanza un botón; con varios se
                        listan por nombre, que es como los reconoce quien los subió. */}
                    {(r.receipt_files?.length ?? 0) > 1 ? (
                      (r.receipt_files ?? []).map((f, i) => (
                        <Button
                          key={f.id}
                          size="sm"
                          variant="outline"
                          onClick={() => verComprobante(r.id, f.id)}
                          title={f.filename}
                        >
                          <span className="max-w-[14rem] truncate">
                            {i + 1}. {f.filename}
                          </span>
                        </Button>
                      ))
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => verComprobante(r.id)}>
                        Ver comprobante
                      </Button>
                    )}
                    {/* Cancelar sólo antes de que Administración lo valide: después
                        ya está imputado a un período de pago. */}
                    {['requested', 'leader_approved'].includes(r.status) && (
                      <Button size="sm" variant="ghost" onClick={() => cancel(r.id)}>
                        Cancelar
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

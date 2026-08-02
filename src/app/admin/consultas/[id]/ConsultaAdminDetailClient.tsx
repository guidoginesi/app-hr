'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@pow/ui/components/ui/button';
import { Textarea } from '@pow/ui/components/ui/textarea';
import { Checkbox } from '@pow/ui/components/ui/checkbox';
import { SelectMenu } from '@pow/ui/components/ui/select-menu';
import { AttachmentPanel } from '@/components/inquiries/AttachmentPanel';
import { CATEGORY_LABELS, STATUS_LABELS_HR, type InquiryCategory, type InquiryStatus } from '@/lib/inquiries';

type Msg = {
  id: string;
  author_role: 'employee' | 'hr' | 'leader';
  body: string;
  is_internal: boolean;
  created_at: string;
};

type Inquiry = {
  id: string;
  employee_name: string;
  employee_email: string | null;
  job_title: string | null;
  manager_id: string | null;
  category: InquiryCategory;
  subject: string;
  status: InquiryStatus;
  created_at: string;
  first_response_due_at: string | null;
  first_hr_response_at: string | null;
  sla_overdue: boolean;
  reopen_count: number;
};

const when = (iso: string) =>
  new Date(iso).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function ConsultaAdminDetailClient({ inquiryId }: { inquiryId: string }) {
  const [inquiry, setInquiry] = useState<Inquiry | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [sharedWithLeader, setSharedWithLeader] = useState(false);
  const [body, setBody] = useState('');
  const [internal, setInternal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/inquiries/${inquiryId}`);
      const data = await res.json();
      if (res.ok) {
        setInquiry(data.inquiry);
        setMessages(data.messages ?? []);
        setSharedWithLeader(Boolean(data.shared_with_leader));
      }
    } finally {
      setLoading(false);
    }
  }, [inquiryId]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (payload: Record<string, unknown>, okText?: string) => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/inquiries/${inquiryId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ type: 'err', text: data.error ?? 'No se pudo completar la acción' });
        return false;
      }
      if (okText) setMsg({ type: 'ok', text: okText });
      await load();
      return true;
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="py-16 text-center text-sm text-muted-foreground">Cargando…</div>;
  if (!inquiry) return <div className="py-16 text-center text-sm text-muted-foreground">Consulta no encontrada</div>;

  const send = async () => {
    if (!body.trim()) return;
    const ok = await act(
      internal ? { action: 'internal_note', body } : { action: 'reply', body },
      internal ? 'Nota interna guardada' : 'Respuesta enviada',
    );
    if (ok) setBody('');
  };

  return (
    <div className="space-y-6">
      <Link href="/admin/consultas" className="text-sm text-muted-foreground hover:text-foreground">
        ← Volver a consultas
      </Link>

      {msg && (
        <div className={`rounded-lg px-4 py-3 text-sm ${msg.type === 'ok' ? 'bg-success-subtle text-[var(--green-700)]' : 'bg-danger-subtle text-[var(--red-600)]'}`}>
          {msg.text}
        </div>
      )}

      <div className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-foreground">{inquiry.subject}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {inquiry.employee_name}
              {inquiry.job_title ? ` · ${inquiry.job_title}` : ''} · {CATEGORY_LABELS[inquiry.category]} ·{' '}
              {new Date(inquiry.created_at).toLocaleDateString('es-AR')}
            </p>
            {inquiry.sla_overdue && (
              <p className="mt-2 text-xs font-semibold text-[var(--red-600)]">
                Sin primera respuesta — objetivo vencido
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SelectMenu
              ariaLabel="Estado"
              value={inquiry.status}
              onChange={(v) => act({ action: 'set_status', status: v }, 'Estado actualizado')}
              options={[
                { value: 'en_curso', label: STATUS_LABELS_HR.en_curso },
                { value: 'esperando_colaborador', label: STATUS_LABELS_HR.esperando_colaborador },
                { value: 'resuelta', label: STATUS_LABELS_HR.resuelta },
                { value: 'cerrada', label: STATUS_LABELS_HR.cerrada },
              ]}
            />
          </div>
        </div>

        {/* Compartir con el líder: permiso por consulta, reversible. */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-muted px-4 py-3">
          <div>
            <p className="text-sm font-medium text-secondary-foreground">Compartir con el líder</p>
            <p className="text-xs text-muted-foreground">
              {inquiry.manager_id
                ? 'Le da acceso solo a esta consulta. Ve el hilo pero no las notas internas.'
                : 'El colaborador no tiene un líder asignado.'}
            </p>
          </div>
          <Button
            variant={sharedWithLeader ? 'outline' : 'primary'}
            size="sm"
            loading={busy}
            disabled={!inquiry.manager_id}
            onClick={() =>
              act(
                { action: sharedWithLeader ? 'unshare_leader' : 'share_leader' },
                sharedWithLeader ? 'Se quitó el acceso del líder' : 'Consulta compartida con el líder',
              )
            }
          >
            {sharedWithLeader ? 'Dejar de compartir' : 'Compartir'}
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.author_role === 'employee' ? 'justify-start' : 'justify-end'}`}>
            <div
              className={`max-w-[80%] rounded-xl border px-4 py-3 ${
                m.is_internal
                  ? 'border-dashed border-[var(--amber-600)] bg-warning-subtle'
                  : m.author_role === 'employee'
                    ? 'border-[var(--border)] bg-white shadow-sm'
                    : 'border-[var(--border)] bg-secondary'
              }`}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {m.author_role === 'employee' ? inquiry.employee_name : m.author_role === 'hr' ? 'People' : 'Líder'}
                {m.is_internal && ' · nota interna'} · {when(m.created_at)}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{m.body}</p>
            </div>
          </div>
        ))}
      </div>

      <AttachmentPanel inquiryId={inquiryId} />

      <div className="space-y-3 rounded-xl border border-[var(--border)] bg-white p-5 shadow-sm">
        <Textarea
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={internal ? 'Nota interna (el colaborador no la ve)…' : 'Escribí la respuesta al colaborador…'}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={send} loading={busy} disabled={!body.trim()}>
            {internal ? 'Guardar nota interna' : 'Responder'}
          </Button>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-secondary-foreground">
            <Checkbox checked={internal} onCheckedChange={(c) => setInternal(c === true)} />
            Nota interna (no la ve el colaborador)
          </label>
        </div>
      </div>
    </div>
  );
}

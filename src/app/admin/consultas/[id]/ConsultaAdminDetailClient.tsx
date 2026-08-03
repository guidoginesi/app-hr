'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, buttonVariants } from '@pow/ui/components/ui/button';
import { Textarea } from '@pow/ui/components/ui/textarea';
import { Checkbox } from '@pow/ui/components/ui/checkbox';
import { SelectMenu } from '@pow/ui/components/ui/select-menu';
import { PageHeader } from '@pow/ui/components/ui/page-header';
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

  const send = async (resolve = false) => {
    if (!body.trim()) return;
    const ok = await act(
      internal ? { action: 'internal_note', body } : { action: 'reply', body, resolve },
      internal ? 'Nota interna guardada' : resolve ? 'Respuesta enviada y consulta resuelta' : 'Respuesta enviada',
    );
    if (ok) setBody('');
  };

  const yaCerrada = inquiry.status === 'resuelta' || inquiry.status === 'cerrada';

  return (
    <div className="space-y-6">
      {msg && (
        <div className={`rounded-lg px-4 py-3 text-sm ${msg.type === 'ok' ? 'bg-success-subtle text-[var(--green-700)]' : 'bg-danger-subtle text-[var(--red-600)]'}`}>
          {msg.text}
        </div>
      )}

      <PageHeader
        title={inquiry.subject}
        description={`${inquiry.employee_name}${inquiry.job_title ? ` · ${inquiry.job_title}` : ''} · ${CATEGORY_LABELS[inquiry.category]} · ${new Date(inquiry.created_at).toLocaleDateString('es-AR')}`}
        actions={
          <div className="flex items-end gap-2">
            <div className="flex flex-col gap-1">
              <span className="type-label text-muted-foreground">Estado</span>
              <SelectMenu
                ariaLabel="Estado de la consulta"
                // w-60: "Esperando al colaborador" es la etiqueta más larga y con
                // w-52 se cortaba justo el dato que hay que leer de un vistazo.
                className="w-60"
                value={inquiry.status}
                onChange={(v) => act({ action: 'set_status', status: v }, 'Estado actualizado')}
                // 'nueva' va como opción deshabilitada: sin ella el value no matchea
                // ninguna opción en una consulta recién creada y el selector mostraba
                // "Seleccioná…" en vez del estado real.
                options={[
                  { value: 'nueva', label: STATUS_LABELS_HR.nueva, disabled: true },
                  { value: 'en_curso', label: STATUS_LABELS_HR.en_curso },
                  { value: 'esperando_colaborador', label: STATUS_LABELS_HR.esperando_colaborador },
                  { value: 'resuelta', label: STATUS_LABELS_HR.resuelta },
                  { value: 'cerrada', label: STATUS_LABELS_HR.cerrada },
                ]}
              />
            </div>
            <Link href="/admin/consultas" className={buttonVariants({ variant: 'outline' })}>
              Volver
            </Link>
          </div>
        }
      />

      {inquiry.sla_overdue && (
        <div className="rounded-xl border border-[var(--border)] bg-danger-subtle px-5 py-3 text-sm font-medium text-[var(--red-600)]">
          Sin primera respuesta — objetivo vencido
        </div>
      )}

      {/* Compartir con el líder: permiso por consulta, reversible. */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-white px-5 py-4 shadow-sm">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Compartir con el líder</h3>
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
          <Button onClick={() => send(false)} loading={busy} disabled={!body.trim()}>
            {internal ? 'Guardar nota interna' : 'Responder'}
          </Button>
          {/* Un solo paso: antes había que responder y después cambiar el estado
              a mano, y quedaban consultas ya resueltas sin marcar. */}
          {!internal && !yaCerrada && (
            <Button variant="outline" onClick={() => send(true)} loading={busy} disabled={!body.trim()}>
              Responder y marcar resuelta
            </Button>
          )}
          <label className="flex cursor-pointer items-center gap-2 text-sm text-secondary-foreground">
            <Checkbox checked={internal} onCheckedChange={(c) => setInternal(c === true)} />
            Nota interna (no la ve el colaborador)
          </label>
        </div>
        {!internal && !yaCerrada && (
          <p className="text-xs text-muted-foreground">
            Al marcarla resuelta el colaborador recibe el aviso y la consulta se cierra sola a los 3 días hábiles.
            Si responde antes, se reabre.
          </p>
        )}
      </div>
    </div>
  );
}

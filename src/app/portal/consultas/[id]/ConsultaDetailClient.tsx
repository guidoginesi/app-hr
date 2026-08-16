'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, buttonVariants } from '@pow/ui/components/ui/button';
import { PageHeader } from '@pow/ui/components/ui/page-header';
import { Textarea } from '@pow/ui/components/ui/textarea';
import { AttachmentPanel } from '@/components/inquiries/AttachmentPanel';
import {
  CATEGORY_LABELS,
  STATUS_LABELS_EMPLOYEE,
  formatDueDate,
  type InquiryCategory,
  type InquiryStatus,
} from '@/lib/inquiries';

type Msg = { id: string; author_role: 'employee' | 'hr' | 'leader'; body: string; created_at: string; edited_at?: string | null };
type Inquiry = {
  id: string;
  category: InquiryCategory;
  subject: string;
  status: InquiryStatus;
  created_at: string;
  first_response_due_at: string | null;
  first_hr_response_at: string | null;
  closed_at: string | null;
};

const statusPill: Record<InquiryStatus, string> = {
  nueva: 'bg-accent text-[var(--brand-strong)]',
  en_curso: 'bg-secondary text-secondary-foreground',
  esperando_colaborador: 'bg-warning-subtle text-[var(--amber-600)]',
  resuelta: 'bg-success-subtle text-[var(--green-700)]',
  cerrada: 'bg-secondary text-muted-foreground',
};

const when = (iso: string) =>
  new Date(iso).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function ConsultaDetailClient({ inquiryId }: { inquiryId: string }) {
  const [inquiry, setInquiry] = useState<Inquiry | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [canReopen, setCanReopen] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/portal/inquiries/${inquiryId}`);
      const data = await res.json();
      if (res.ok) {
        setInquiry(data.inquiry);
        setMessages(data.messages ?? []);
        setCanReopen(Boolean(data.can_reopen));
      } else {
        setError(data.error ?? 'No se pudo cargar la consulta');
      }
    } finally {
      setLoading(false);
    }
  }, [inquiryId]);

  useEffect(() => {
    load();
  }, [load]);

  const send = async () => {
    if (!reply.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/portal/inquiries/${inquiryId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: reply }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'No se pudo enviar');
        return;
      }
      setReply('');
      await load();
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div className="py-16 text-center text-sm text-muted-foreground">Cargando…</div>;
  if (!inquiry) return <div className="py-16 text-center text-sm text-muted-foreground">{error ?? 'No encontrada'}</div>;

  const cerradaSinReapertura = inquiry.status === 'cerrada' && !canReopen;
  // La API reabre tanto desde 'cerrada' como desde 'resuelta'; el botón decía
  // "Enviar" en resuelta y no se entendía que respondiendo se reabría.
  const reabrible = inquiry.status === 'cerrada' || inquiry.status === 'resuelta';

  return (
    <div className="space-y-6">
      {/* Mismo patrón que Resultados de Evaluación: PageHeader con el "Volver"
          dentro de actions, en vez de un h1 a mano dentro de una card. */}
      <PageHeader
        title={inquiry.subject}
        description={`${CATEGORY_LABELS[inquiry.category]} · abierta el ${new Date(inquiry.created_at).toLocaleDateString('es-AR')}`}
        actions={
          <>
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusPill[inquiry.status]}`}>
              {STATUS_LABELS_EMPLOYEE[inquiry.status]}
            </span>
            <Link href="/portal/consultas" className={buttonVariants({ variant: 'outline' })}>
              Volver
            </Link>
          </>
        }
      />

      {!inquiry.first_hr_response_at && inquiry.first_response_due_at && inquiry.status !== 'cerrada' && (
        <div className="rounded-xl border border-[var(--border)] bg-white px-5 py-3 text-sm text-muted-foreground shadow-sm">
          Te respondemos antes del <b className="text-foreground">{formatDueDate(inquiry.first_response_due_at)}</b>.
        </div>
      )}

      <div className="space-y-3">
        {messages.map((m) => {
          const mine = m.author_role === 'employee';
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-xl border px-4 py-3 ${
                  mine ? 'border-[var(--border)] bg-secondary' : 'border-[var(--border)] bg-white shadow-sm'
                }`}
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {mine ? 'Vos' : m.author_role === 'hr' ? 'People' : 'Tu líder'} · {when(m.created_at)}
                  {/* Si se editó, se dice. Un mensaje que cambia en silencio
                      debajo de quien lo leyó es peor que no poder editarlo. */}
                  {m.edited_at && ` · editado ${when(m.edited_at)}`}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{m.body}</p>
              </div>
            </div>
          );
        })}
      </div>

      <AttachmentPanel inquiryId={inquiryId} canUpload={!cerradaSinReapertura} />

      {cerradaSinReapertura ? (
        <div className="rounded-xl border border-[var(--border)] bg-muted px-5 py-4 text-sm text-muted-foreground">
          Esta consulta está cerrada. Si necesitás retomar el tema, abrí una consulta nueva.
        </div>
      ) : (
        <div className="space-y-3 rounded-xl border border-[var(--border)] bg-white p-5 shadow-sm">
          {reabrible && (
            <p className="text-sm text-secondary-foreground">
              People marcó esta consulta como <b>{STATUS_LABELS_EMPLOYEE[inquiry.status].toLowerCase()}</b>. Si el
              tema no quedó resuelto, escribí acá y se reabre.
            </p>
          )}
          <Textarea
            rows={3}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder={reabrible ? 'Contanos qué quedó pendiente…' : 'Escribí tu respuesta…'}
          />
          {error && <p className="text-sm text-[var(--red-600)]">{error}</p>}
          <Button onClick={send} loading={sending} disabled={!reply.trim()}>
            {reabrible ? 'Reabrir consulta' : 'Enviar'}
          </Button>
        </div>
      )}
    </div>
  );
}

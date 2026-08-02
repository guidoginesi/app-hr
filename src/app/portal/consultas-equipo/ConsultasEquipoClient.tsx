'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@pow/ui/components/ui/button';
import { Textarea } from '@pow/ui/components/ui/textarea';
import { CATEGORY_LABELS, STATUS_LABELS_HR, type InquiryCategory, type InquiryStatus } from '@/lib/inquiries';

type Item = {
  id: string;
  employee_name: string;
  category: InquiryCategory;
  subject: string;
  status: InquiryStatus;
  created_at: string;
  last_activity_at: string;
};
type Msg = { id: string; author_role: 'employee' | 'hr' | 'leader'; body: string; created_at: string };

const when = (iso: string) =>
  new Date(iso).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function ConsultasEquipoClient() {
  const [items, setItems] = useState<Item[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ inquiry: Item; messages: Msg[] } | null>(null);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/portal/leader-inquiries');
      const data = await res.json();
      if (res.ok) setItems(data.items ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const open = async (id: string) => {
    setOpenId(id);
    setDetail(null);
    const res = await fetch(`/api/portal/leader-inquiries/${id}`);
    const data = await res.json();
    if (res.ok) setDetail({ inquiry: data.inquiry, messages: data.messages ?? [] });
  };

  const send = async () => {
    if (!openId || !reply.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/portal/leader-inquiries/${openId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: reply }),
      });
      if (res.ok) {
        setReply('');
        await open(openId);
        await load();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Consultas de mi equipo</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Consultas que People compartió con vos para que aportes tu mirada. Solo ves las que te compartieron.
        </p>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Cargando…</div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-white py-16 text-center text-sm text-muted-foreground shadow-sm">
          No hay consultas compartidas con vos.
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--border)] bg-white shadow-sm">
          <ul className="divide-y divide-[var(--border)]">
            {items.map((i) => (
              <li key={i.id}>
                <button
                  type="button"
                  onClick={() => (openId === i.id ? setOpenId(null) : open(i.id))}
                  className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left transition-colors hover:bg-muted"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{i.subject}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {i.employee_name} · {CATEGORY_LABELS[i.category]} ·{' '}
                      {new Date(i.created_at).toLocaleDateString('es-AR')}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
                    {STATUS_LABELS_HR[i.status]}
                  </span>
                </button>

                {openId === i.id && (
                  <div className="space-y-3 border-t border-[var(--border)] bg-muted px-6 py-4">
                    {!detail ? (
                      <p className="text-sm text-muted-foreground">Cargando…</p>
                    ) : (
                      <>
                        {detail.messages.map((m) => (
                          <div key={m.id} className="rounded-lg border border-[var(--border)] bg-white px-4 py-3">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                              {m.author_role === 'employee'
                                ? detail.inquiry.employee_name
                                : m.author_role === 'hr'
                                  ? 'People'
                                  : 'Vos'}{' '}
                              · {when(m.created_at)}
                            </p>
                            <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{m.body}</p>
                          </div>
                        ))}
                        <Textarea
                          rows={3}
                          value={reply}
                          onChange={(e) => setReply(e.target.value)}
                          placeholder="Escribí tu aporte…"
                        />
                        <Button size="sm" onClick={send} loading={busy} disabled={!reply.trim()}>
                          Responder
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

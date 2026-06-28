'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MessageBody } from '@/components/MessageBody';

type Message = {
  id: string;
  type: 'broadcast' | 'system';
  title: string;
  body: string;
  priority: 'info' | 'warning' | 'critical';
  require_confirmation: boolean;
  status: string;
  created_at: string;
  published_at: string | null;
  expires_at: string | null;
  audience: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
};

type Recipient = {
  id: string;
  user_id: string;
  delivered_at: string;
  read_at: string | null;
  confirmed_at: string | null;
  dismissed_at: string | null;
  employee: {
    first_name: string;
    last_name: string;
    job_title: string;
    work_email: string;
  } | null;
};

type Metrics = {
  recipients_total: number;
  read_count: number;
  confirmed_count: number;
};

type Filter = 'all' | 'unread' | 'read' | 'confirmed';

const priorityBadge: Record<string, string> = {
  info: 'bg-accent text-accent-foreground',
  warning: 'bg-warning-subtle text-[var(--amber-600)]',
  critical: 'bg-danger-subtle text-[var(--red-600)]',
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AdminMessageDetailClient({
  message,
  recipients: initialRecipients,
  metrics,
}: {
  message: Message;
  recipients: Recipient[];
  metrics: Metrics;
}) {
  const [filter, setFilter] = useState<Filter>('all');

  const filtered = initialRecipients.filter((r) => {
    if (filter === 'unread') return !r.read_at;
    if (filter === 'read') return !!r.read_at;
    if (filter === 'confirmed') return !!r.confirmed_at;
    return true;
  });

  const readPct =
    metrics.recipients_total > 0
      ? Math.round((metrics.read_count / metrics.recipients_total) * 100)
      : 0;
  const confirmPct =
    metrics.recipients_total > 0
      ? Math.round((metrics.confirmed_count / metrics.recipients_total) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* Message info card */}
      <div className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${priorityBadge[message.priority]}`}>
                {message.priority}
              </span>
              <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                {message.type === 'broadcast' ? 'Anuncio' : 'Sistema'}
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  message.status === 'published'
                    ? 'bg-success-subtle text-[var(--green-700)]'
                    : message.status === 'draft'
                    ? 'bg-secondary text-muted-foreground'
                    : 'bg-secondary text-muted-foreground'
                }`}
              >
                {message.status === 'draft' ? 'Borrador' : message.status === 'published' ? 'Publicado' : 'Archivado'}
              </span>
              {message.require_confirmation && (
                <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-accent-foreground">
                  Requiere confirmación
                </span>
              )}
            </div>
            <h2 className="text-xl font-semibold text-foreground">{message.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Publicado: {formatDate(message.published_at)} &middot; Creado: {formatDate(message.created_at)}
              {message.expires_at && ` · Expira: ${formatDate(message.expires_at)}`}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-[var(--border)] bg-muted px-4 py-3">
          <MessageBody body={message.body} />
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-[var(--border)] bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Enviados</p>
          <p className="mt-1 text-3xl font-bold text-foreground">{metrics.recipients_total}</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Leídos</p>
          <p className="mt-1 text-3xl font-bold text-foreground">{metrics.read_count}</p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${readPct}%` }} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{readPct}%</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Confirmados</p>
          {message.require_confirmation ? (
            <>
              <p className="mt-1 text-3xl font-bold text-foreground">{metrics.confirmed_count}</p>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-success transition-all" style={{ width: `${confirmPct}%` }} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{confirmPct}%</p>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">No requerido</p>
          )}
        </div>
      </div>

      {/* Recipients table */}
      <div className="rounded-xl border border-[var(--border)] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
          <h3 className="text-sm font-semibold text-foreground">Destinatarios</h3>
          <div className="flex gap-2">
            {(['all', 'unread', 'read', 'confirmed'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  filter === f
                    ? 'bg-cat-violet text-white'
                    : 'border border-[var(--border)] text-muted-foreground hover:bg-muted'
                }`}
              >
                {f === 'all' ? 'Todos' : f === 'unread' ? 'No leídos' : f === 'read' ? 'Leídos' : 'Confirmados'}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Sin destinatarios en este filtro</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[var(--border)]">
              <thead className="bg-muted">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Empleado</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Entregado</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Leído</th>
                  {message.require_confirmation && (
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Confirmado</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-muted">
                    <td className="px-6 py-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {r.employee
                            ? `${r.employee.first_name} ${r.employee.last_name}`
                            : <span className="text-muted-foreground italic">Usuario externo</span>}
                        </p>
                        {r.employee?.job_title && (
                          <p className="text-xs text-muted-foreground">{r.employee.job_title}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{r.employee?.work_email || '—'}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(r.delivered_at)}</td>
                    <td className="px-4 py-3">
                      {r.read_at ? (
                        <span className="text-xs text-muted-foreground">{formatDate(r.read_at)}</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                          No leído
                        </span>
                      )}
                    </td>
                    {message.require_confirmation && (
                      <td className="px-4 py-3">
                        {r.confirmed_at ? (
                          <span className="text-xs font-medium text-[var(--green-700)]">{formatDate(r.confirmed_at)}</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-accent-foreground">
                            Pendiente
                          </span>
                        )}
                      </td>
                    )}
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

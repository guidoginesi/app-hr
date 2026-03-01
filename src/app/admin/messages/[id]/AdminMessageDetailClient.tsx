'use client';

import { useState } from 'react';
import Link from 'next/link';

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
  info: 'bg-blue-100 text-blue-700',
  warning: 'bg-amber-100 text-amber-700',
  critical: 'bg-red-100 text-red-700',
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
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${priorityBadge[message.priority]}`}>
                {message.priority}
              </span>
              <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600">
                {message.type === 'broadcast' ? 'Anuncio' : 'Sistema'}
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  message.status === 'published'
                    ? 'bg-emerald-100 text-emerald-700'
                    : message.status === 'draft'
                    ? 'bg-zinc-100 text-zinc-600'
                    : 'bg-zinc-100 text-zinc-400'
                }`}
              >
                {message.status === 'draft' ? 'Borrador' : message.status === 'published' ? 'Publicado' : 'Archivado'}
              </span>
              {message.require_confirmation && (
                <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-semibold text-orange-700">
                  Requiere confirmación
                </span>
              )}
            </div>
            <h2 className="text-xl font-semibold text-zinc-900">{message.title}</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Publicado: {formatDate(message.published_at)} &middot; Creado: {formatDate(message.created_at)}
              {message.expires_at && ` · Expira: ${formatDate(message.expires_at)}`}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-zinc-100 bg-zinc-50 px-4 py-3">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">{message.body}</p>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Enviados</p>
          <p className="mt-1 text-3xl font-bold text-zinc-900">{metrics.recipients_total}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Leídos</p>
          <p className="mt-1 text-3xl font-bold text-zinc-900">{metrics.read_count}</p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
            <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${readPct}%` }} />
          </div>
          <p className="mt-1 text-xs text-zinc-400">{readPct}%</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Confirmados</p>
          {message.require_confirmation ? (
            <>
              <p className="mt-1 text-3xl font-bold text-zinc-900">{metrics.confirmed_count}</p>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${confirmPct}%` }} />
              </div>
              <p className="mt-1 text-xs text-zinc-400">{confirmPct}%</p>
            </>
          ) : (
            <p className="mt-2 text-sm text-zinc-400">No requerido</p>
          )}
        </div>
      </div>

      {/* Recipients table */}
      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <h3 className="text-sm font-semibold text-zinc-900">Destinatarios</h3>
          <div className="flex gap-2">
            {(['all', 'unread', 'read', 'confirmed'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  filter === f
                    ? 'bg-violet-600 text-white'
                    : 'border border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                }`}
              >
                {f === 'all' ? 'Todos' : f === 'unread' ? 'No leídos' : f === 'read' ? 'Leídos' : 'Confirmados'}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-zinc-400">Sin destinatarios en este filtro</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-100">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Empleado</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Entregado</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Leído</th>
                  {message.require_confirmation && (
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Confirmado</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-zinc-50">
                    <td className="px-6 py-3">
                      <div>
                        <p className="text-sm font-medium text-zinc-900">
                          {r.employee
                            ? `${r.employee.first_name} ${r.employee.last_name}`
                            : <span className="text-zinc-400 italic">Usuario externo</span>}
                        </p>
                        {r.employee?.job_title && (
                          <p className="text-xs text-zinc-400">{r.employee.job_title}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500">{r.employee?.work_email || '—'}</td>
                    <td className="px-4 py-3 text-xs text-zinc-400">{formatDate(r.delivered_at)}</td>
                    <td className="px-4 py-3">
                      {r.read_at ? (
                        <span className="text-xs text-zinc-600">{formatDate(r.read_at)}</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-500">
                          No leído
                        </span>
                      )}
                    </td>
                    {message.require_confirmation && (
                      <td className="px-4 py-3">
                        {r.confirmed_at ? (
                          <span className="text-xs font-medium text-emerald-600">{formatDate(r.confirmed_at)}</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-600">
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

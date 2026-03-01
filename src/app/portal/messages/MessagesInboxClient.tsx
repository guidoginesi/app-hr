'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type MessageItem = {
  id: string;
  message_id: string;
  delivered_at: string;
  read_at: string | null;
  confirmed_at: string | null;
  dismissed_at: string | null;
  messages: {
    id: string;
    type: 'broadcast' | 'system';
    title: string;
    body: string;
    priority: 'info' | 'warning' | 'critical';
    require_confirmation: boolean;
    published_at: string;
    expires_at: string | null;
    metadata: Record<string, unknown> | null;
    status: string;
  } | null;
};

const priorityBadge = {
  info: 'bg-blue-100 text-blue-700',
  warning: 'bg-amber-100 text-amber-700',
  critical: 'bg-red-100 text-red-700',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'ahora';
  if (minutes < 60) return `hace ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `hace ${days}d`;
  return new Date(dateStr).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
}

type Filter = 'all' | 'unread' | 'needs_confirm';

export function MessagesInboxClient({ items: initialItems }: { items: MessageItem[] }) {
  const router = useRouter();
  const [items, setItems] = useState<MessageItem[]>(initialItems);
  const [filter, setFilter] = useState<Filter>('all');

  const unreadCount = items.filter((i) => !i.read_at).length;
  const needsConfirmCount = items.filter(
    (i) => i.messages?.require_confirmation && !i.confirmed_at
  ).length;

  const filtered = items.filter((item) => {
    if (!item.messages) return false;
    if (filter === 'unread') return !item.read_at;
    if (filter === 'needs_confirm')
      return item.messages.require_confirmation && !item.confirmed_at;
    return true;
  });

  const handleClick = async (item: MessageItem) => {
    if (!item.messages) return;

    // Mark read optimistically
    if (!item.read_at) {
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, read_at: new Date().toISOString() } : i
        )
      );
      fetch(`/api/messages/${item.message_id}/read`, { method: 'POST' }).catch(() => {});
    }

    const deepLink = item.messages.metadata?.deep_link as string | undefined;
    router.push(deepLink ? deepLink : `/portal/messages/${item.message_id}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Mensajes</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Tu centro de notificaciones y anuncios
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {(
          [
            { key: 'all' as const, label: 'Todos', count: items.length },
            { key: 'unread' as const, label: 'No leídos', count: unreadCount },
            { key: 'needs_confirm' as const, label: 'Pendientes', count: needsConfirmCount },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setFilter(tab.key)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === tab.key
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${
                  filter === tab.key ? 'bg-white/20 text-white' : 'bg-zinc-100 text-zinc-600'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-zinc-200 bg-white py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100">
            <svg className="h-7 w-7 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="mt-3 text-sm font-medium text-zinc-700">No hay mensajes en este filtro</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          {filtered.map((item, idx) => {
            if (!item.messages) return null;
            const msg = item.messages;
            const isUnread = !item.read_at;
            const needsConfirm = msg.require_confirmation && !item.confirmed_at;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleClick(item)}
                className={`w-full border-b border-zinc-100 px-6 py-4 text-left transition-colors last:border-0 hover:bg-zinc-50 ${
                  isUnread ? 'bg-blue-50/40' : ''
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Unread indicator */}
                  <div className="mt-2 flex-shrink-0">
                    {isUnread ? (
                      <span className="block h-2.5 w-2.5 rounded-full bg-blue-500" />
                    ) : (
                      <span className="block h-2.5 w-2.5 rounded-full bg-zinc-200" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${priorityBadge[msg.priority]}`}
                      >
                        {msg.type === 'broadcast' ? 'Anuncio' : 'Sistema'}
                      </span>
                      {needsConfirm && (
                        <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-orange-700">
                          Requiere confirmación
                        </span>
                      )}
                      {item.confirmed_at && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                          ✓ Confirmado
                        </span>
                      )}
                    </div>

                    <p
                      className={`mt-1 text-sm leading-snug ${
                        isUnread ? 'font-semibold text-zinc-900' : 'font-medium text-zinc-700'
                      }`}
                    >
                      {msg.title}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-zinc-500">{msg.body}</p>
                  </div>

                  <div className="flex-shrink-0 text-right">
                    <p className="text-xs text-zinc-400">{timeAgo(item.delivered_at)}</p>
                    <svg
                      className="ml-auto mt-2 h-4 w-4 text-zinc-300"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

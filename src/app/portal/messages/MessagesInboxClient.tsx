'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@pow/ui/components/ui/page-header';
import { Sheet, SheetContent } from '@pow/ui/components/ui/sheet';
import { MessageView } from '@/components/messages/MessageView';
import { getMessageBodyPlainText } from '@/lib/messageBody';

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
  info: 'bg-secondary text-secondary-foreground',
  warning: 'bg-warning-subtle text-[var(--amber-600)]',
  critical: 'bg-danger-subtle text-[var(--red-600)]',
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
  const [openItem, setOpenItem] = useState<MessageItem | null>(null);

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
    if (deepLink) {
      router.push(deepLink);
      return;
    }
    // Abre el mensaje en un Sheet lateral, sin salir del inbox.
    setOpenItem(item);
  };

  const handleConfirmed = (itemId: string, confirmedAt: string) => {
    setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, confirmed_at: confirmedAt } : i)));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader title="Comunicaciones" description="Tu centro de notificaciones y anuncios" />

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
                ? 'bg-primary text-white shadow-sm'
                : 'bg-white text-muted-foreground hover:bg-secondary border border-[var(--border)]'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${
                  filter === tab.key ? 'bg-white/20 text-white' : 'bg-secondary text-muted-foreground'
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
        <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--border)] bg-white py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
            <svg className="h-7 w-7 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="mt-3 text-sm font-medium text-secondary-foreground">No hay mensajes en este filtro</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm">
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
                className={`w-full border-b border-[var(--border)] px-6 py-4 text-left transition-colors last:border-0 hover:bg-muted ${
                  isUnread ? 'bg-muted' : ''
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${priorityBadge[msg.priority]}`}
                      >
                        {msg.type === 'broadcast' ? 'Anuncio' : 'Sistema'}
                      </span>
                      {needsConfirm && (
                        <span className="rounded-full bg-warning-subtle px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--amber-600)]">
                          Requiere confirmación
                        </span>
                      )}
                      {item.confirmed_at && (
                        <span className="rounded-full bg-success-subtle px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--green-700)]">
                          ✓ Confirmado
                        </span>
                      )}
                    </div>

                    <p
                      className={`mt-1 text-sm leading-snug ${
                        isUnread ? 'font-semibold text-foreground' : 'font-medium text-secondary-foreground'
                      }`}
                    >
                      {msg.title}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{getMessageBodyPlainText(msg.body)}</p>
                  </div>

                  <div className="flex-shrink-0 text-right">
                    <p className="text-xs text-muted-foreground">{timeAgo(item.delivered_at)}</p>
                    <svg
                      className="ml-auto mt-2 h-4 w-4 text-muted-foreground"
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

      {/* Detalle en Sheet lateral */}
      <Sheet open={!!openItem} onOpenChange={(o) => !o && setOpenItem(null)}>
        <SheetContent
          title={openItem?.messages?.title}
          description={
            openItem?.messages
              ? new Date(openItem.messages.published_at).toLocaleDateString('es-AR', {
                  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
                })
              : undefined
          }
          className="sm:max-w-xl"
        >
          {openItem?.messages && (
            <div className="px-1">
              <MessageView
                message={openItem.messages}
                messageId={openItem.message_id}
                initialConfirmedAt={openItem.confirmed_at}
                bordered={false}
                showTitle={false}
                onConfirmed={(at) => handleConfirmed(openItem.id, at)}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

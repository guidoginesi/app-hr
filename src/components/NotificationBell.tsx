'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/Spinner';
import { Sheet, SheetContent, SheetClose } from '@pow/ui/components/ui/sheet';
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

type InboxResponse = {
  items: MessageItem[];
  total: number;
  unread_count: number;
  pending_confirm_count: number;
  badge_count: number;
};

const POLL_INTERVAL_MS = 30_000;

const priorityColors = {
  info: 'bg-secondary text-secondary-foreground',
  warning: 'bg-warning-subtle text-[var(--amber-600)]',
  critical: 'bg-danger-subtle text-[var(--red-600)]',
};

const typeLabel = {
  broadcast: 'Anuncio',
  system: 'Sistema',
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
  return new Date(dateStr).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

export function NotificationBell({ detailBasePath = '/portal/messages', direction = 'down', label }: { detailBasePath?: string; direction?: 'down' | 'up'; label?: string }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [inbox, setInbox] = useState<InboxResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const drawerRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchInbox = useCallback(async () => {
    try {
      const res = await fetch('/api/messages/inbox?limit=20');
      if (!res.ok) return;
      const data: InboxResponse = await res.json();
      setInbox(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + polling
  useEffect(() => {
    fetchInbox();
    pollRef.current = setInterval(fetchInbox, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchInbox]);

  // Popover (admin, sin label): cerrar en click afuera + Escape.
  // Con label el panel es un Sheet (Radix) que maneja su propio cierre/foco.
  useEffect(() => {
    if (label) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [label]);

  const markAllRead = useCallback(async () => {
    // Optimistic: zero out unread badge immediately
    setInbox((prev) => {
      if (!prev) return prev;
      const now = new Date().toISOString();
      return {
        ...prev,
        items: prev.items.map((i) => (i.read_at ? i : { ...i, read_at: now })),
        unread_count: 0,
        badge_count: prev.pending_confirm_count,
      };
    });

    try {
      await fetch('/api/messages/read-all', { method: 'POST' });
    } catch {
      // silently fail; next poll will correct the state
    }
  }, []);

  const handleOpen = () => {
    const opening = !isOpen;
    setIsOpen(opening);
    if (opening) {
      fetchInbox().then(() => {
        // After getting fresh data, mark all unread as read
        markAllRead();
      });
    }
  };

  const markRead = async (messageId: string, recipientId: string) => {
    const item = inbox?.items.find((i) => i.id === recipientId);
    if (item?.read_at) return;

    // Optimistic update
    setInbox((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map((i) =>
          i.id === recipientId ? { ...i, read_at: new Date().toISOString() } : i
        ),
        unread_count: Math.max(0, prev.unread_count - 1),
        badge_count: Math.max(0, prev.badge_count - 1),
      };
    });

    await fetch(`/api/messages/${messageId}/read`, { method: 'POST' });
  };

  const handleItemClick = async (item: MessageItem) => {
    if (!item.messages) return;
    await markRead(item.message_id, item.id);
    setIsOpen(false);

    const deepLink = item.messages.metadata?.deep_link as string | undefined;
    if (deepLink) {
      router.push(deepLink);
    } else {
      router.push(`${detailBasePath}/${item.message_id}`);
    }
  };

  const badgeCount = inbox?.badge_count ?? 0;
  const items = (inbox?.items.filter((i) => i.messages !== null) ?? []).sort((a, b) => {
    const aUnread = a.read_at ? 0 : 1;
    const bUnread = b.read_at ? 0 : 1;
    if (aUnread !== bUnread) return bUnread - aUnread;
    return new Date(b.delivered_at).getTime() - new Date(a.delivered_at).getTime();
  });

  // Lista de avisos (reutilizable en el Sheet del sidebar y en el popover del admin).
  const listItems = loading ? (
    <div className="flex items-center justify-center py-12">
      <Spinner className="h-6 w-6 text-muted-foreground" />
    </div>
  ) : items.length === 0 ? (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
        <svg className="h-6 w-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      </div>
      <p className="text-sm font-medium text-secondary-foreground">Sin notificaciones</p>
      <p className="text-xs text-muted-foreground">Todo al día</p>
    </div>
  ) : (
    items.map((item) => {
      if (!item.messages) return null;
      const msg = item.messages;
      const isUnread = !item.read_at;
      const needsConfirm = msg.require_confirmation && !item.confirmed_at;

      return (
        <button
          key={item.id}
          type="button"
          onClick={() => handleItemClick(item)}
          className={`w-full border-b border-[var(--border)] px-4 py-3 text-left transition-colors last:border-0 hover:bg-muted ${isUnread ? 'bg-muted' : ''}`}
        >
          <div className="flex items-start gap-3">
            <div className="mt-1.5 flex-shrink-0">
              <span className={`block h-2 w-2 rounded-full ${isUnread ? 'bg-primary' : 'bg-transparent'}`} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-1.5">
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${priorityColors[msg.priority]}`}>
                  {msg.priority === 'info' ? '' : msg.priority === 'warning' ? '⚠ ' : '🔴 '}
                  {typeLabel[msg.type]}
                </span>
                {needsConfirm && (
                  <span className="rounded-full bg-warning-subtle px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--amber-600)]">
                    Requiere confirmación
                  </span>
                )}
              </div>
              <p className={`text-sm leading-snug ${isUnread ? 'font-semibold text-foreground' : 'font-medium text-secondary-foreground'}`}>
                {msg.title}
              </p>
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{getMessageBodyPlainText(msg.body)}</p>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                {timeAgo(item.delivered_at)}
                {item.confirmed_at && <span className="ml-2 font-medium text-[var(--green-700)]">✓ Confirmado</span>}
              </p>
            </div>
          </div>
        </button>
      );
    })
  );

  const panelFooter =
    items.length > 0 ? (
      <div className="border-t border-[var(--border)] px-4 py-2.5">
        <Link
          href={detailBasePath}
          onClick={() => setIsOpen(false)}
          className="flex items-center justify-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          Ver todas las notificaciones
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    ) : null;

  return (
    <div className="relative" ref={drawerRef}>
      {/* Trigger: row con label (sidebar) o ícono suelto (admin) */}
      {label ? (
        <button
          type="button"
          onClick={handleOpen}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <svg className="h-5 w-5 shrink-0 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span>{label}</span>
          {!loading && badgeCount > 0 && (
            <span className="ml-auto flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-danger px-1.5 text-[10px] font-bold leading-none text-white">
              {badgeCount > 99 ? '99+' : badgeCount}
            </span>
          )}
        </button>
      ) : (
        <button
          type="button"
          onClick={handleOpen}
          aria-label="Notificaciones"
          className="relative flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          {!loading && badgeCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold leading-none text-white shadow">
              {badgeCount > 99 ? '99+' : badgeCount}
            </span>
          )}
        </button>
      )}

      {/* Panel: Sheet lateral derecho (sidebar) o popover anclado (admin) */}
      {label ? (
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetContent side="right" flush title="Notificaciones">
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground">Notificaciones</h3>
                  {badgeCount > 0 && (
                    <span className="rounded-full bg-danger-subtle px-2 py-0.5 text-xs font-semibold text-[var(--red-600)]">
                      {badgeCount} nueva{badgeCount !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <SheetClose
                  aria-label="Cerrar"
                  className="grid h-8 w-8 place-items-center rounded-[var(--radius)] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </SheetClose>
              </div>
              <div className="flex-1 overflow-y-auto">{listItems}</div>
              {panelFooter}
            </div>
          </SheetContent>
        </Sheet>
      ) : (
        isOpen && (
          <div className={`absolute z-50 w-96 max-w-[calc(100vw-5rem)] overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-xl ${direction === 'up' ? 'bottom-0 left-full ml-2' : 'right-0 top-full mt-2'}`}>
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground">Notificaciones</h3>
                {badgeCount > 0 && (
                  <span className="rounded-full bg-danger-subtle px-2 py-0.5 text-xs font-semibold text-[var(--red-600)]">
                    {badgeCount} nueva{badgeCount !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <Link href={detailBasePath} onClick={() => setIsOpen(false)} className="text-xs font-medium text-foreground hover:text-[var(--primary-hover)]">
                Ver todo
              </Link>
            </div>
            <div className="max-h-[480px] overflow-y-auto">{listItems}</div>
            {panelFooter}
          </div>
        )
      )}
    </div>
  );
}

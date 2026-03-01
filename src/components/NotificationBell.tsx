'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
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

type InboxResponse = {
  items: MessageItem[];
  total: number;
  unread_count: number;
  pending_confirm_count: number;
  badge_count: number;
};

const POLL_INTERVAL_MS = 30_000;

const priorityColors = {
  info: 'bg-blue-100 text-blue-700',
  warning: 'bg-amber-100 text-amber-700',
  critical: 'bg-red-100 text-red-700',
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

export function NotificationBell({ detailBasePath = '/portal/messages' }: { detailBasePath?: string }) {
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

  // Close drawer on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOpen = () => {
    setIsOpen((prev) => !prev);
    if (!isOpen) fetchInbox();
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
  const items = inbox?.items.filter((i) => i.messages !== null) ?? [];

  return (
    <div className="relative" ref={drawerRef}>
      {/* Bell button */}
      <button
        type="button"
        onClick={handleOpen}
        aria-label="Notificaciones"
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.8}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {/* Badge */}
        {!loading && badgeCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white shadow">
            {badgeCount > 99 ? '99+' : badgeCount}
          </span>
        )}
      </button>

      {/* Dropdown drawer */}
      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-96 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-zinc-900">Notificaciones</h3>
              {badgeCount > 0 && (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-600">
                  {badgeCount} nueva{badgeCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <Link
              href={detailBasePath}
              onClick={() => setIsOpen(false)}
              className="text-xs font-medium text-emerald-600 hover:text-emerald-700"
            >
              Ver todo
            </Link>
          </div>

          {/* List */}
          <div className="max-h-[480px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-200 border-t-emerald-600" />
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100">
                  <svg className="h-6 w-6 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-zinc-700">Sin notificaciones</p>
                <p className="text-xs text-zinc-400">Todo al día</p>
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
                    className={`w-full border-b border-zinc-50 px-4 py-3 text-left transition-colors last:border-0 hover:bg-zinc-50 ${
                      isUnread ? 'bg-blue-50/50' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Unread dot */}
                      <div className="mt-1.5 flex-shrink-0">
                        {isUnread ? (
                          <span className="block h-2 w-2 rounded-full bg-blue-500" />
                        ) : (
                          <span className="block h-2 w-2 rounded-full bg-transparent" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        {/* Tags row */}
                        <div className="mb-1 flex flex-wrap items-center gap-1.5">
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${priorityColors[msg.priority]}`}
                          >
                            {msg.priority === 'info' ? '' : msg.priority === 'warning' ? '⚠ ' : '🔴 '}
                            {typeLabel[msg.type]}
                          </span>
                          {needsConfirm && (
                            <span className="rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-orange-700">
                              Requiere confirmación
                            </span>
                          )}
                        </div>

                        {/* Title */}
                        <p className={`text-sm leading-snug ${isUnread ? 'font-semibold text-zinc-900' : 'font-medium text-zinc-700'}`}>
                          {msg.title}
                        </p>

                        {/* Body preview */}
                        <p className="mt-0.5 line-clamp-2 text-xs text-zinc-500">
                          {msg.body}
                        </p>

                        {/* Timestamp */}
                        <p className="mt-1.5 text-[11px] text-zinc-400">
                          {timeAgo(item.delivered_at)}
                          {item.confirmed_at && (
                            <span className="ml-2 font-medium text-emerald-600">✓ Confirmado</span>
                          )}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          {items.length > 0 && (
            <div className="border-t border-zinc-100 px-4 py-2.5">
              <Link
                href={detailBasePath}
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-800"
              >
                Ver todas las notificaciones
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

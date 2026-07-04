'use client';

import { useState } from 'react';
import { Button } from '@pow/ui/components/ui/button';
import { MessageBody } from '@/components/MessageBody';

export type PortalMessage = {
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
};

const priorityConfig = {
  info: {
    badge: 'bg-secondary text-secondary-foreground',
    border: 'border-[var(--border)]',
    icon: (
      <svg className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    label: 'Información',
  },
  warning: {
    badge: 'bg-warning-subtle text-[var(--amber-600)]',
    border: 'border-warning/30',
    icon: (
      <svg className="h-5 w-5 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    label: 'Advertencia',
  },
  critical: {
    badge: 'bg-danger-subtle text-[var(--red-600)]',
    border: 'border-danger/20',
    icon: (
      <svg className="h-5 w-5 text-[var(--red-600)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
    ),
    label: 'Crítico',
  },
};

// Render de un mensaje reutilizable: en la página de deep-link (bordered + título)
// y en el Sheet del inbox (sin borde ni título; el SheetContent los aporta).
export function MessageView({
  message,
  messageId,
  initialConfirmedAt,
  onConfirmed,
  bordered = true,
  showTitle = true,
}: {
  message: PortalMessage;
  messageId: string;
  initialConfirmedAt: string | null;
  onConfirmed?: (confirmedAt: string) => void;
  bordered?: boolean;
  showTitle?: boolean;
}) {
  const [confirmedAt, setConfirmedAt] = useState(initialConfirmedAt);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const config = priorityConfig[message.priority];
  const deepLink = message.metadata?.deep_link as string | undefined;
  const pad = bordered ? 'px-6' : '';

  const handleConfirm = async () => {
    setConfirming(true);
    setError(null);
    try {
      const res = await fetch(`/api/messages/${messageId}/confirm`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Error al confirmar');
        return;
      }
      const now = new Date().toISOString();
      setConfirmedAt(now);
      onConfirmed?.(now);
    } catch {
      setError('Error de red');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className={bordered ? `overflow-hidden rounded-xl border bg-white shadow-sm ${config.border}` : ''}>
      {/* Header: badges (+ título/fecha en página) */}
      <div className={`${bordered ? `border-b border-[var(--border)] py-4 ${pad}` : 'pb-4'}`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${config.badge}`}>
            {config.icon}
            {config.label}
          </span>
          <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            {message.type === 'broadcast' ? 'Anuncio' : 'Sistema'}
          </span>
          {message.require_confirmation && (
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${confirmedAt ? 'bg-success-subtle text-[var(--green-700)]' : 'bg-warning-subtle text-[var(--amber-600)]'}`}>
              {confirmedAt ? '✓ Confirmado' : 'Requiere confirmación'}
            </span>
          )}
        </div>
        {showTitle && (
          <>
            <h1 className="mt-3 text-xl font-semibold text-foreground">{message.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {new Date(message.published_at).toLocaleDateString('es-AR', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
              })}
            </p>
          </>
        )}
      </div>

      {/* Body */}
      <div className={`${bordered ? `py-5 ${pad}` : 'py-4'}`}>
        <MessageBody body={message.body} />
      </div>

      {/* Actions */}
      {(message.require_confirmation || deepLink) && (
        <div className={`${bordered ? `border-t border-[var(--border)] py-4 ${pad}` : 'border-t border-[var(--border)] pt-4'}`}>
          <div className="flex flex-wrap items-center gap-3">
            {deepLink && (
              <a
                href={deepLink}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-secondary-foreground shadow-sm transition hover:bg-muted"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Ver detalle
              </a>
            )}

            {message.require_confirmation && !confirmedAt && (
              <Button type="button" onClick={handleConfirm} loading={confirming}>
                <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Confirmar lectura
              </Button>
            )}

            {message.require_confirmation && confirmedAt && (
              <div className="flex items-center gap-1.5 text-sm font-medium text-[var(--green-700)]">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Lectura confirmada el{' '}
                {new Date(confirmedAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
          </div>
          {error && <p className="mt-2 text-xs text-[var(--red-600)]">{error}</p>}
        </div>
      )}
    </div>
  );
}

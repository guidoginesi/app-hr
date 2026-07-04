'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AdminProfileDropdown } from '@/components/AdminProfileDropdown';
import { NotificationBell } from '@/components/NotificationBell';
import { RichTextEditor } from '../RichTextEditor';
import { isMessageBodyEmpty } from '@/lib/messageBody';

type Message = {
  id: string;
  type: 'broadcast' | 'system';
  title: string;
  priority: 'info' | 'warning' | 'critical';
  require_confirmation: boolean;
  status: 'draft' | 'published' | 'archived';
  created_at: string;
  published_at: string | null;
  expires_at: string | null;
  audience: Record<string, unknown> | null;
  recipients_total: number;
  read_count: number;
  confirmed_count: number;
};

const statusBadge: Record<string, string> = {
  draft: 'bg-secondary text-muted-foreground',
  published: 'bg-success-subtle text-[var(--green-700)]',
  archived: 'bg-secondary text-muted-foreground',
};

const priorityBadge: Record<string, string> = {
  info: 'bg-accent text-accent-foreground',
  warning: 'bg-warning-subtle text-[var(--amber-600)]',
  critical: 'bg-danger-subtle text-[var(--red-600)]',
};

type CreateForm = {
  title: string;
  body: string;
  priority: 'info' | 'warning' | 'critical';
  require_confirmation: boolean;
  expires_at: string;
  audience: 'all' | 'leaders' | 'employees' | 'monotributista' | 'dependency' | 'test';
  send_to_google_chat: boolean;
};

const DEFAULT_FORM: CreateForm = {
  title: '',
  body: '',
  priority: 'info',
  require_confirmation: false,
  expires_at: '',
  audience: 'all',
  send_to_google_chat: false,
};

function audienceLabel(audience: Record<string, unknown> | null): string {
  if (!audience) return 'Todos';
  if (audience.all) return 'Todos';
  if (audience.test) return '🧪 Test';
  if (audience.employment_type === 'monotributista') return 'Monotributo';
  if (audience.employment_type === 'dependency') return 'Relación de dependencia';
  if (Array.isArray(audience.roles)) {
    if (audience.roles.length === 1 && audience.roles[0] === 'leader') return 'Solo líderes';
    if (audience.roles.length === 1 && audience.roles[0] === 'employee') return 'Solo empleados';
    return `Roles: ${audience.roles.join(', ')}`;
  }
  return 'Personalizado';
}

export function AdminMessagesClient({ messages: initialMessages }: { messages: Message[] }) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateForm>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const audiencePayload = (a: CreateForm['audience']) => {
    if (a === 'all') return { all: true };
    if (a === 'leaders') return { roles: ['leader'] };
    if (a === 'employees') return { roles: ['employee'] };
    if (a === 'monotributista') return { employment_type: 'monotributista' as const };
    if (a === 'dependency') return { employment_type: 'dependency' as const };
    if (a === 'test') return { test: true };
    return { all: true };
  };

  const handleCreate = async (publishNow: boolean) => {
    if (!form.title.trim() || isMessageBodyEmpty(form.body)) {
      setError('Título y cuerpo son requeridos');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        title: form.title.trim(),
        body: form.body,
        priority: form.priority,
        require_confirmation: form.require_confirmation,
        send_to_google_chat: form.send_to_google_chat,
        audience: audiencePayload(form.audience),
      };
      if (form.expires_at) payload.expires_at = new Date(form.expires_at).toISOString();

      const res = await fetch('/api/admin/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Error al crear');
        return;
      }

      const newMessage: Message = {
        ...data,
        recipients_total: 0,
        read_count: 0,
        confirmed_count: 0,
      };

      if (publishNow) {
        const pubRes = await fetch(`/api/admin/messages/${data.id}/publish`, { method: 'POST' });
        const pubData = await pubRes.json();
        if (!pubRes.ok) {
          setError(pubData.error ?? 'Error al publicar');
          setMessages((prev) => [{ ...newMessage, status: 'draft' }, ...prev]);
          setShowCreate(false);
          setForm(DEFAULT_FORM);
          return;
        }
        newMessage.status = 'published';
        newMessage.published_at = new Date().toISOString();
        newMessage.recipients_total = pubData.recipients_created ?? 0;
        setSuccess(`Mensaje publicado para ${pubData.recipients_created ?? 0} usuarios.`);
      } else {
        setSuccess('Borrador guardado.');
      }

      setMessages((prev) => [newMessage, ...prev]);
      setShowCreate(false);
      setForm(DEFAULT_FORM);
    } catch {
      setError('Error de red');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async (msgId: string) => {
    setPublishing(msgId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/messages/${msgId}/publish`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Error al publicar');
        return;
      }
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? {
                ...m,
                status: 'published',
                published_at: new Date().toISOString(),
                recipients_total: data.recipients_created ?? 0,
              }
            : m
        )
      );
      setSuccess(`Publicado para ${data.recipients_created ?? 0} usuarios.`);
    } catch {
      setError('Error de red');
    } finally {
      setPublishing(null);
    }
  };

  return (
    <div className="flex min-h-screen bg-muted text-foreground">
      {/* Sidebar */}
      <aside className="flex w-64 flex-shrink-0 flex-col border-r border-[var(--border)] bg-white shadow-sm">
        <div className="flex h-16 items-center border-b border-[var(--border)] px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cat-violet-subtle">
              <svg className="h-5 w-5 text-cat-violet" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Mensajes</p>
              <p className="text-xs text-muted-foreground">Centro de comunicación</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 px-3 py-4">
          <span className="flex w-full items-center justify-between rounded-lg bg-cat-violet px-3 py-2.5 text-sm font-medium text-white shadow-sm">
            <span>Todos los mensajes</span>
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
          </span>
          <div className="my-3 border-t border-[var(--border)]" />
          <Link
            href="/admin/messages/config"
            className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-secondary-foreground hover:bg-secondary hover:text-black transition-all duration-150"
          >
            <span>Configuración</span>
          </Link>
        </nav>
        <div className="border-t border-[var(--border)] px-3 py-3">
          <Link
            href="/admin"
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:bg-secondary hover:text-foreground"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Volver al inicio
          </Link>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-[var(--border)] bg-white px-8 shadow-sm">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-foreground">Centro de Mensajes</h1>
            <p className="mt-0.5 text-xs font-normal text-muted-foreground">
              Gestión de comunicaciones y anuncios
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => { setShowCreate(true); setError(null); setSuccess(null); }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-cat-violet px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-cat-violet"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Nuevo mensaje
            </button>
            <NotificationBell detailBasePath="/portal/messages" />
            <AdminProfileDropdown />
          </div>
        </header>

        <main className="flex-1 bg-muted px-8 py-8">
          {/* Feedback banners */}
          {success && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-success/20 bg-success-subtle px-4 py-3 text-sm text-[var(--green-700)]">
              <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {success}
              <button type="button" onClick={() => setSuccess(null)} className="ml-auto text-success hover:text-[var(--green-700)]">✕</button>
            </div>
          )}
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-danger/20 bg-danger-subtle px-4 py-3 text-sm text-[var(--red-600)]">
              <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
              <button type="button" onClick={() => setError(null)} className="ml-auto text-[var(--red-600)] hover:text-[var(--red-600)]">✕</button>
            </div>
          )}

          {/* Create modal */}
          {showCreate && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
                  <h2 className="text-base font-semibold text-foreground">Nuevo mensaje</h2>
                  <button type="button" onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="max-h-[70vh] space-y-4 overflow-y-auto px-6 py-5">
                  {/* Title */}
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-muted-foreground uppercase tracking-wide">Título</label>
                    <input
                      type="text"
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      placeholder="Título del mensaje..."
                      className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-cat-violet focus:outline-none focus:ring-1 focus:ring-cat-violet"
                    />
                  </div>

                  {/* Body */}
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cuerpo</label>
                    <RichTextEditor
                      content={form.body}
                      onChange={(html) => setForm({ ...form, body: html })}
                      placeholder="Redactá el contenido del mensaje..."
                    />
                  </div>

                  {/* Row: priority + audience */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-muted-foreground uppercase tracking-wide">Prioridad</label>
                      <select
                        value={form.priority}
                        onChange={(e) => setForm({ ...form, priority: e.target.value as CreateForm['priority'] })}
                        className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-cat-violet focus:outline-none focus:ring-1 focus:ring-cat-violet"
                      >
                        <option value="info">Informativo</option>
                        <option value="warning">Advertencia</option>
                        <option value="critical">Crítico</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-semibold text-muted-foreground uppercase tracking-wide">Audiencia</label>
                      <select
                        value={form.audience}
                        onChange={(e) => setForm({ ...form, audience: e.target.value as CreateForm['audience'] })}
                        className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-cat-violet focus:outline-none focus:ring-1 focus:ring-cat-violet"
                      >
                        <option value="all">Todos los empleados</option>
                        <option value="leaders">Solo líderes</option>
                        <option value="employees">Solo empleados</option>
                        <option value="monotributista">Empleados monotributo</option>
                        <option value="dependency">Empleados relación de dependencia</option>
                        <option value="test">🧪 Test (Agustina, Guido, Antonella)</option>
                      </select>
                    </div>
                  </div>

                  {/* Expires at */}
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-muted-foreground uppercase tracking-wide">Expira el (opcional)</label>
                    <input
                      type="datetime-local"
                      value={form.expires_at}
                      onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
                      className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-cat-violet focus:outline-none focus:ring-1 focus:ring-cat-violet"
                    />
                  </div>

                  {/* Require confirmation */}
                  <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-muted px-4 py-3">
                    <input
                      type="checkbox"
                      id="require_confirmation"
                      checked={form.require_confirmation}
                      onChange={(e) => setForm({ ...form, require_confirmation: e.target.checked })}
                      className="h-4 w-4 rounded border-[var(--border)] text-cat-violet focus:ring-cat-violet"
                    />
                    <label htmlFor="require_confirmation" className="text-sm font-medium text-secondary-foreground">
                      Requiere confirmación de lectura
                    </label>
                  </div>

                  {/* Google Chat */}
                  <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-muted px-4 py-3">
                    <input
                      type="checkbox"
                      id="send_to_google_chat"
                      checked={form.send_to_google_chat}
                      onChange={(e) => setForm({ ...form, send_to_google_chat: e.target.checked })}
                      className="h-4 w-4 rounded border-[var(--border)] text-cat-violet focus:ring-cat-violet"
                    />
                    <label htmlFor="send_to_google_chat" className="flex items-center gap-2 text-sm font-medium text-secondary-foreground cursor-pointer">
                      <svg className="h-4 w-4 text-muted-foreground" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
                      </svg>
                      Enviar también al chat grupal de Pow (Google Chat)
                    </label>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 border-t border-[var(--border)] px-6 py-4">
                  <button
                    type="button"
                    onClick={() => setShowCreate(false)}
                    disabled={saving}
                    className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-muted disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCreate(false)}
                    disabled={saving}
                    className="rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-muted disabled:opacity-50"
                  >
                    Guardar borrador
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCreate(true)}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-cat-violet px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-cat-violet disabled:opacity-60"
                  >
                    {saving ? (
                      <>
                        <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        Publicando...
                      </>
                    ) : (
                      'Publicar ahora'
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Messages table */}
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--border)] bg-white py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-cat-violet-subtle">
                <svg className="h-7 w-7 text-cat-violet" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <p className="mt-3 font-semibold text-secondary-foreground">No hay mensajes todavía</p>
              <p className="mt-1 text-sm text-muted-foreground">Crea el primer anuncio para tu organización</p>
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-cat-violet px-4 py-2 text-sm font-semibold text-white hover:bg-cat-violet"
              >
                Nuevo mensaje
              </button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm">
              <table className="min-w-full divide-y divide-[var(--border)]">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mensaje</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Estado</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Audiencia</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Enviados</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Leídos</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Confirmados</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fecha</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] bg-white">
                  {messages.map((msg) => (
                    <tr key={msg.id} className="hover:bg-muted">
                      <td className="px-6 py-4">
                        <div className="flex items-start gap-2">
                          <span className={`mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${priorityBadge[msg.priority]}`}>
                            {msg.priority}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate max-w-[240px]">{msg.title}</p>
                            <p className="text-xs text-muted-foreground">{msg.type === 'broadcast' ? 'Anuncio' : 'Sistema'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadge[msg.status]}`}>
                          {msg.status === 'draft' ? 'Borrador' : msg.status === 'published' ? 'Publicado' : 'Archivado'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-xs text-muted-foreground">{audienceLabel(msg.audience)}</td>
                      <td className="px-4 py-4 text-center text-sm font-semibold text-secondary-foreground">{msg.recipients_total}</td>
                      <td className="px-4 py-4 text-center">
                        <span className="text-sm font-semibold text-secondary-foreground">{msg.read_count}</span>
                        {msg.recipients_total > 0 && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({Math.round((msg.read_count / msg.recipients_total) * 100)}%)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center">
                        {msg.require_confirmation ? (
                          <>
                            <span className="text-sm font-semibold text-secondary-foreground">{msg.confirmed_count}</span>
                            {msg.recipients_total > 0 && (
                              <span className="ml-1 text-xs text-muted-foreground">
                                ({Math.round((msg.confirmed_count / msg.recipients_total) * 100)}%)
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-xs text-muted-foreground whitespace-nowrap">
                        {msg.published_at
                          ? new Date(msg.published_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
                          : new Date(msg.created_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/admin/messages/${msg.id}`}
                            className="rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
                          >
                            Ver detalle
                          </Link>
                          {msg.status === 'draft' && (
                            <button
                              type="button"
                              onClick={() => handlePublish(msg.id)}
                              disabled={publishing === msg.id}
                              className="rounded-lg bg-cat-violet px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-cat-violet disabled:opacity-60"
                            >
                              {publishing === msg.id ? 'Publicando...' : 'Publicar'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

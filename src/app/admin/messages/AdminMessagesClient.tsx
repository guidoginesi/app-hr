'use client';

import { useState } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import { Button } from '@pow/ui/components/ui/button';
import { SelectMenu } from '@pow/ui/components/ui/select-menu';
import { Sheet, SheetContent, SheetClose } from '@pow/ui/components/ui/sheet';
import { Checkbox } from '@pow/ui/components/ui/checkbox';
import { RichTextEditor } from '../RichTextEditor';
import { isMessageBodyEmpty, getMessageBodyPlainText } from '@/lib/messageBody';

type Message = {
  id: string;
  type: 'broadcast' | 'system';
  title: string;
  body: string;
  priority: 'info' | 'warning' | 'critical';
  require_confirmation: boolean;
  status: 'draft' | 'published' | 'archived';
  created_at: string;
  published_at: string | null;
  expires_at: string | null;
  audience: Record<string, unknown> | null;
  created_by: string | null;
  metadata: Record<string, unknown> | null;
  recipients_total: number;
  read_count: number;
  confirmed_count: number;
};

const isAutomatic = (m: Message) =>
  m.type === 'system' || (m.metadata as { automated?: boolean } | null)?.automated === true;

const statusBadge: Record<string, string> = {
  draft: 'bg-secondary text-muted-foreground',
  published: 'bg-success-subtle text-[var(--green-700)]',
  archived: 'bg-secondary text-muted-foreground',
};

const priorityBadge: Record<string, string> = {
  info: 'bg-secondary text-muted-foreground',
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
  send_email: boolean;
};

const DEFAULT_FORM: CreateForm = {
  title: '',
  body: '',
  priority: 'info',
  require_confirmation: false,
  expires_at: '',
  audience: 'all',
  send_to_google_chat: false,
  send_email: false,
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
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateForm>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [origin, setOrigin] = useState<'todos' | 'manuales' | 'automaticos'>('todos');

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
        send_email: form.send_email,
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

  const q = search.trim().toLowerCase();
  const filtered = messages.filter((m) => {
    if (origin === 'manuales' && isAutomatic(m)) return false;
    if (origin === 'automaticos' && !isAutomatic(m)) return false;
    if (q) {
      const hay = `${m.title} ${getMessageBodyPlainText(m.body ?? '')}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4">
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

          {/* Toolbar: búsqueda + filtro de origen + nuevo */}
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por palabra clave…"
              className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-ring sm:w-72"
            />
            <div className="inline-flex rounded-lg border border-[var(--border)] p-0.5">
              {([
                ['todos', 'Todos'],
                ['manuales', 'Manuales'],
                ['automaticos', 'Automáticos'],
              ] as const).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setOrigin(val)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    origin === val ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <Button className="ml-auto" onClick={() => { setShowCreate(true); setError(null); setSuccess(null); }}>
              Nuevo mensaje
            </Button>
          </div>

          {/* Create sheet */}
          <Sheet open={showCreate} onOpenChange={(o) => { if (!o) setShowCreate(false); }}>
            <SheetContent side="right" flush title="Nuevo mensaje" className="max-w-2xl">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
                <h2 className="type-title">Nuevo mensaje</h2>
                <SheetClose
                  aria-label="Cerrar"
                  className="-mr-1.5 grid h-8 w-8 place-items-center rounded-[var(--radius)] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="h-5 w-5" />
                </SheetClose>
              </div>

              {/* Body */}
              <div className="flex-1 space-y-4 overflow-y-auto p-6">
                {/* Title */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-secondary-foreground">Título</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="Título del mensaje..."
                    className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>

                {/* Body */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-secondary-foreground">Cuerpo</label>
                  <RichTextEditor
                    content={form.body}
                    onChange={(html) => setForm({ ...form, body: html })}
                    placeholder="Redactá el contenido del mensaje..."
                  />
                </div>

                {/* Row: priority + audience */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-secondary-foreground">Prioridad</label>
                    <SelectMenu
                      ariaLabel="Prioridad"
                      className="w-full"
                      value={form.priority}
                      onChange={(v) => setForm({ ...form, priority: v as CreateForm['priority'] })}
                      options={[
                        { value: 'info', label: 'Informativo' },
                        { value: 'warning', label: 'Advertencia' },
                        { value: 'critical', label: 'Crítico' },
                      ]}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-secondary-foreground">Audiencia</label>
                    <SelectMenu
                      ariaLabel="Audiencia"
                      className="w-full"
                      value={form.audience}
                      onChange={(v) => setForm({ ...form, audience: v as CreateForm['audience'] })}
                      options={[
                        { value: 'all', label: 'Todos los empleados' },
                        { value: 'leaders', label: 'Solo líderes' },
                        { value: 'employees', label: 'Solo empleados' },
                        { value: 'monotributista', label: 'Empleados monotributo' },
                        { value: 'dependency', label: 'Empleados relación de dependencia' },
                        { value: 'test', label: '🧪 Test (Agustina, Guido, Antonella)' },
                      ]}
                    />
                  </div>
                </div>

                {/* Expires at */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-secondary-foreground">Expira el (opcional)</label>
                  <input
                    type="datetime-local"
                    value={form.expires_at}
                    onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
                    className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>

                {/* Require confirmation */}
                <label
                  htmlFor="require_confirmation"
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-[var(--border)] bg-muted px-4 py-3"
                >
                  <Checkbox
                    id="require_confirmation"
                    checked={form.require_confirmation}
                    onCheckedChange={(c) => setForm({ ...form, require_confirmation: c === true })}
                  />
                  <span className="text-sm font-medium text-secondary-foreground">
                    Requiere confirmación de lectura
                  </span>
                </label>

                {/* Google Chat */}
                <label
                  htmlFor="send_to_google_chat"
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-[var(--border)] bg-muted px-4 py-3"
                >
                  <Checkbox
                    id="send_to_google_chat"
                    checked={form.send_to_google_chat}
                    onCheckedChange={(c) => setForm({ ...form, send_to_google_chat: c === true })}
                  />
                  <span className="flex items-center gap-2 text-sm font-medium text-secondary-foreground">
                    <svg className="h-4 w-4 text-muted-foreground" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
                    </svg>
                    Enviar también al chat grupal de Pow (Google Chat)
                  </span>
                </label>

                {/* Email */}
                <label
                  htmlFor="send_email"
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-[var(--border)] bg-muted px-4 py-3"
                >
                  <Checkbox
                    id="send_email"
                    checked={form.send_email}
                    onCheckedChange={(c) => setForm({ ...form, send_email: c === true })}
                  />
                  <span className="flex items-center gap-2 text-sm font-medium text-secondary-foreground">
                    <svg className="h-4 w-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Enviar también por mail a los destinatarios
                  </span>
                </label>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 border-t border-[var(--border)] p-4">
                <Button variant="ghost" onClick={() => setShowCreate(false)} disabled={saving}>
                  Cancelar
                </Button>
                <Button variant="outline" onClick={() => handleCreate(false)} disabled={saving}>
                  Guardar borrador
                </Button>
                <Button onClick={() => handleCreate(true)} loading={saving}>
                  Publicar ahora
                </Button>
              </div>
            </SheetContent>
          </Sheet>

          {/* Messages table */}
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--border)] bg-white py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
                <svg className="h-7 w-7 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <p className="mt-3 font-semibold text-secondary-foreground">No hay mensajes todavía</p>
              <p className="mt-1 text-sm text-muted-foreground">Crea el primer anuncio para tu organización</p>
              <Button className="mt-4" onClick={() => setShowCreate(true)}>
                Nuevo mensaje
              </Button>
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
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-sm text-muted-foreground">
                        No hay mensajes que coincidan con la búsqueda o el filtro.
                      </td>
                    </tr>
                  )}
                  {filtered.map((msg) => (
                    <tr key={msg.id} className="hover:bg-muted">
                      <td className="px-6 py-4">
                        <div className="flex items-start gap-2">
                          <span className={`mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${priorityBadge[msg.priority]}`}>
                            {msg.priority}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate max-w-[240px]">{msg.title}</p>
                            <span className={`mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${isAutomatic(msg) ? 'bg-secondary text-muted-foreground' : 'bg-accent text-[var(--brand-strong)]'}`}>
                              {isAutomatic(msg) ? 'Automático' : 'Manual'}
                            </span>
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
                            <Button
                              size="sm"
                              onClick={() => handlePublish(msg.id)}
                              loading={publishing === msg.id}
                            >
                              Publicar
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
    </div>
  );
}

'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import { Button } from '@pow/ui/components/ui/button';
import { SelectMenu } from '@pow/ui/components/ui/select-menu';
import { Sheet, SheetContent, SheetClose } from '@pow/ui/components/ui/sheet';
import { Checkbox } from '@pow/ui/components/ui/checkbox';
import { RichTextEditor } from '../RichTextEditor';
import { isMessageBodyEmpty } from '@/lib/messageBody';
import { TEMPLATE_VARS, hasTemplateTokens } from '@/lib/templateVars';

type Message = {
  id: string;
  type: 'broadcast' | 'system';
  title: string;
  body?: string;
  priority: 'info' | 'warning' | 'critical';
  require_confirmation: boolean;
  status: 'draft' | 'published' | 'archived';
  created_at: string;
  published_at: string | null;
  expires_at: string | null;
  scheduled_for: string | null;
  audience: Record<string, unknown> | null;
  created_by: string | null;
  metadata: Record<string, unknown> | null;
  recipients_total: number;
  read_count: number;
  confirmed_count: number;
};

const isAutomatic = (m: Message) =>
  m.type === 'system' || (m.metadata as { automated?: boolean } | null)?.automated === true;

const PAGE_SIZE = 50;

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

type MsgDept = { id: string; name: string };
type MsgEmp = {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  department_id: string | null;
  manager_id: string | null;
};

type MsgTemplate = { id: string; name: string; title: string; body: string };

type CreateForm = {
  title: string;
  body: string;
  priority: 'info' | 'warning' | 'critical';
  require_confirmation: boolean;
  expires_at: string;
  audience:
    | 'all'
    | 'leaders'
    | 'employees'
    | 'monotributista'
    | 'dependency'
    | 'test'
    | 'area'
    | 'lider'
    | 'individual';
  department_id: string;
  manager_id: string;
  user_ids: string[];
  periodo: string;
  send_to_google_chat: boolean;
  send_email: boolean;
  scheduled_for: string;
  // Mail completo (metadata.email): el mensaje entero con carátula, asunto y
  // respuestas propias. Sin esto, el mail es el aviso corto de siempre.
  email_full: boolean;
  email_subject: string;
  email_from_name: string;
  email_reply_to: string;
  email_cover_url: string;
  email_cover_has_title: boolean;
  email_highlights: { label: string; value: string }[];
  email_rsvp: boolean;
  email_rsvp_question: string;
  email_rsvp_yes: string;
  email_rsvp_no: string;
};

const DEFAULT_FORM: CreateForm = {
  title: '',
  body: '',
  priority: 'info',
  require_confirmation: false,
  expires_at: '',
  audience: 'all',
  department_id: '',
  manager_id: '',
  user_ids: [],
  periodo: '',
  send_to_google_chat: false,
  send_email: false,
  scheduled_for: '',
  email_full: false,
  email_subject: '',
  email_from_name: '',
  email_reply_to: '',
  email_cover_url: '',
  email_cover_has_title: false,
  email_highlights: [],
  email_rsvp: false,
  email_rsvp_question: '',
  email_rsvp_yes: 'Voy',
  email_rsvp_no: 'No voy',
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

function RecipientPicker({
  value,
  onChange,
}: {
  value: { user_id: string; name: string } | null;
  onChange: (v: { user_id: string; name: string } | null) => void;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<{ user_id: string; name: string; email: string }[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/employees/search?q=${encodeURIComponent(q.trim())}`);
        const data = await res.json();
        if (!cancelled) setResults(data.items ?? []);
      } catch {
        /* ignore */
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);

  if (value) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-secondary px-2.5 py-1.5 text-xs">
        <span>
          Recibido por: <b>{value.name}</b>
        </span>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Quitar filtro de destinatario"
        >
          ✕
        </button>
      </span>
    );
  }

  return (
    <div className="relative">
      <input
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Recibido por…"
        className="w-44 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-ring"
      />
      {open && results.length > 0 && (
        <div className="absolute z-30 mt-1 max-h-52 w-64 overflow-y-auto rounded-lg border border-[var(--border)] bg-white shadow-lg">
          {results.map((r) => (
            <button
              key={r.user_id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange({ user_id: r.user_id, name: r.name });
                setQ('');
                setOpen(false);
              }}
              className="block w-full px-3 py-1.5 text-left text-sm hover:bg-muted"
            >
              {r.name} <span className="text-xs text-muted-foreground">{r.email}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function EmployeeMultiSelect({
  employees,
  selected,
  onChange,
}: {
  employees: MsgEmp[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [q, setQ] = useState('');
  const sel = new Set(selected);
  const term = q.trim().toLowerCase();
  const filtered = term
    ? employees.filter((e) => `${e.first_name} ${e.last_name}`.toLowerCase().includes(term))
    : employees;
  const toggle = (uid: string) => {
    const next = new Set(sel);
    if (next.has(uid)) next.delete(uid);
    else next.add(uid);
    onChange([...next]);
  };
  return (
    <div className="space-y-2 rounded-lg border border-[var(--border)] p-3">
      <div className="flex items-center justify-between gap-2">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar persona…"
          className="w-full rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <span className="whitespace-nowrap text-xs text-muted-foreground">{selected.length} sel.</span>
      </div>
      <div className="max-h-48 space-y-0.5 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="px-2 py-1 text-xs text-muted-foreground">Sin resultados.</p>
        ) : (
          filtered.map((e) => (
            <label
              key={e.user_id}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted"
            >
              <Checkbox checked={sel.has(e.user_id)} onCheckedChange={() => toggle(e.user_id)} />
              <span className="text-secondary-foreground">
                {e.first_name} {e.last_name}
              </span>
            </label>
          ))
        )}
      </div>
    </div>
  );
}

export function AdminMessagesClient({
  messages: initialMessages,
  total: initialTotal,
  departments,
  employees,
  leaders,
  templates: initialTemplates,
}: {
  messages: Message[];
  total: number;
  departments: MsgDept[];
  employees: MsgEmp[];
  leaders: MsgEmp[];
  templates: MsgTemplate[];
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [templates, setTemplates] = useState<MsgTemplate[]>(initialTemplates);
  const [templateId, setTemplateId] = useState('');
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateForm>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [unscheduling, setUnscheduling] = useState<string | null>(null);
  // id del borrador en edición: null = el formulario está creando uno nuevo.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loadingEdit, setLoadingEdit] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [origin, setOrigin] = useState<'todos' | 'manuales' | 'automaticos'>('todos');
  const [priority, setPriority] = useState('');
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [dateField, setDateField] = useState<'created_at' | 'published_at'>('created_at');
  const [readState, setReadState] = useState<'todos' | 'con_no_leidos' | 'todos_leidos'>('todos');
  const [recipient, setRecipient] = useState<{ user_id: string; name: string } | null>(null);
  const [offset, setOffset] = useState(0);

  const audiencePayload = (a: CreateForm['audience']) => {
    if (a === 'all') return { all: true };
    if (a === 'leaders') return { roles: ['leader'] };
    if (a === 'employees') return { roles: ['employee'] };
    if (a === 'monotributista') return { employment_type: 'monotributista' as const };
    if (a === 'dependency') return { employment_type: 'dependency' as const };
    if (a === 'test') return { test: true };
    if (a === 'area') return { department_id: form.department_id };
    if (a === 'lider') return { manager_id: form.manager_id };
    if (a === 'individual') return { user_ids: form.user_ids };
    return { all: true };
  };

  /** Inverso de audiencePayload: de la audiencia guardada al valor del form. */
  const audienceToForm = (a: Record<string, unknown> | null): Partial<CreateForm> => {
    if (!a) return { audience: 'all' };
    if (a.all) return { audience: 'all' };
    if (a.test) return { audience: 'test' };
    if (Array.isArray(a.roles)) {
      const roles = a.roles as string[];
      if (roles.includes('leader')) return { audience: 'leaders' };
      if (roles.includes('employee')) return { audience: 'employees' };
    }
    if (a.employment_type === 'monotributista') return { audience: 'monotributista' };
    if (a.employment_type === 'dependency') return { audience: 'dependency' };
    if (a.department_id) return { audience: 'area', department_id: a.department_id as string };
    if (a.manager_id) return { audience: 'lider', manager_id: a.manager_id as string };
    if (Array.isArray(a.user_ids)) return { audience: 'individual', user_ids: a.user_ids as string[] };
    return { audience: 'all' };
  };

  const handleEdit = async (msgId: string) => {
    setLoadingEdit(msgId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/messages/${msgId}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'No se pudo abrir el mensaje.');
        return;
      }
      const m = data.message ?? data;
      const ctx = (m.metadata?.template_context ?? {}) as Record<string, string>;
      const mail = (m.metadata?.email ?? {}) as {
        full?: boolean; subject?: string; from_name?: string; reply_to?: string; cover_url?: string;
        cover_has_title?: boolean; highlights?: { label: string; value: string }[];
        rsvp?: { question?: string | null; yes?: string; no?: string } | null;
      };
      setForm({
        ...DEFAULT_FORM,
        title: m.title ?? '',
        body: m.body ?? '',
        priority: m.priority ?? 'info',
        require_confirmation: Boolean(m.require_confirmation),
        // datetime-local no acepta el sufijo Z ni los segundos.
        expires_at: m.expires_at ? String(m.expires_at).slice(0, 16) : '',
        send_to_google_chat: Boolean(m.send_to_google_chat),
        send_email: Boolean(m.send_email),
        scheduled_for: m.scheduled_for ?? '',
        periodo: ctx.periodo ?? '',
        email_full: Boolean(mail.full),
        email_subject: mail.subject ?? '',
        email_from_name: mail.from_name ?? '',
        email_reply_to: mail.reply_to ?? '',
        email_cover_url: mail.cover_url ?? '',
        email_cover_has_title: Boolean(mail.cover_has_title),
        email_highlights: mail.highlights ?? [],
        email_rsvp: Boolean(mail.rsvp),
        email_rsvp_question: mail.rsvp?.question ?? '',
        email_rsvp_yes: mail.rsvp?.yes || 'Voy',
        email_rsvp_no: mail.rsvp?.no || 'No voy',
        ...audienceToForm(m.audience ?? null),
      });
      setEditingId(msgId);
      setShowCreate(true);
    } catch {
      setError('Error de red');
    } finally {
      setLoadingEdit(null);
    }
  };

  const deptById = new Map(departments.map((d) => [d.id, d.name]));
  const empById = new Map(employees.map((e) => [e.id, `${e.first_name} ${e.last_name}`.trim()]));
  const labelForAudience = (audience: Record<string, unknown> | null): string => {
    if (audience?.department_id) return `Área: ${deptById.get(audience.department_id as string) ?? '—'}`;
    if (audience?.manager_id) return `Equipo de ${empById.get(audience.manager_id as string) ?? '—'}`;
    if (Array.isArray(audience?.user_ids)) return `${(audience.user_ids as string[]).length} persona(s)`;
    return audienceLabel(audience);
  };

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (t) setForm((f) => ({ ...f, title: t.title || f.title, body: t.body || f.body }));
  };
  const insertVar = (token: string) => setForm((f) => ({ ...f, body: `${f.body} {{${token}}}` }));
  const saveAsTemplate = async () => {
    const name = window.prompt('Nombre de la plantilla:');
    if (!name?.trim()) return;
    try {
      const res = await fetch('/api/admin/messages/manual-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), title: form.title, body: form.body }),
      });
      const data = await res.json();
      if (res.ok) {
        setTemplates((prev) => [data, ...prev]);
        setSuccess('Plantilla guardada.');
      } else {
        setError(data.error ?? 'No se pudo guardar la plantilla.');
      }
    } catch {
      setError('Error de red al guardar la plantilla.');
    }
  };

  const handleCreate = async (publishNow: boolean) => {
    if (!form.title.trim() || isMessageBodyEmpty(form.body)) {
      setError('Título y cuerpo son requeridos');
      return;
    }
    if (form.audience === 'area' && !form.department_id) {
      setError('Elegí un área.');
      return;
    }
    if (form.audience === 'lider' && !form.manager_id) {
      setError('Elegí un líder.');
      return;
    }
    if (form.audience === 'individual' && form.user_ids.length === 0) {
      setError('Elegí al menos una persona.');
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
        scheduled_for: form.scheduled_for || null,
        audience: audiencePayload(form.audience),
        email: {
          full: form.email_full,
          subject: form.email_subject.trim() || null,
          from_name: form.email_from_name.trim() || null,
          reply_to: form.email_reply_to.trim() || null,
          cover_url: form.email_full ? form.email_cover_url || null : null,
          cover_has_title: form.email_full && form.email_cover_url ? form.email_cover_has_title : null,
          highlights: form.email_full
            ? form.email_highlights.filter((h) => h.label.trim() && h.value.trim())
            : null,
          rsvp:
            form.email_full && form.email_rsvp
              ? {
                  question: form.email_rsvp_question.trim() || null,
                  yes: form.email_rsvp_yes.trim() || 'Voy',
                  no: form.email_rsvp_no.trim() || 'No voy',
                }
              : null,
        },
      };
      if (form.expires_at) payload.expires_at = new Date(form.expires_at).toISOString();
      if (form.periodo.trim()) payload.template_context = { periodo: form.periodo.trim() };

      // Editando: PATCH sobre el borrador. Creando: POST. El resto del
      // formulario y sus validaciones son los mismos.
      if (editingId) {
        const editRes = await fetch(`/api/admin/messages/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            edit: {
              title: payload.title,
              body: payload.body,
              priority: payload.priority,
              require_confirmation: payload.require_confirmation,
              send_email: payload.send_email,
              send_to_google_chat: payload.send_to_google_chat,
              expires_at: (payload.expires_at as string) ?? null,
              audience: payload.audience,
              scheduled_for: payload.scheduled_for,
              email: payload.email,
            },
          }),
        });
        const editData = await editRes.json();
        if (!editRes.ok) {
          setError(editData.error ?? 'No se pudo guardar el borrador.');
          return;
        }
        setSuccess(
          form.scheduled_for
            ? `Borrador actualizado. Se publica solo el ${fechaCorta(form.scheduled_for)} a la mañana.`
            : 'Borrador actualizado.',
        );
        setShowCreate(false);
        setEditingId(null);
        setForm(DEFAULT_FORM);
        setRefreshKey((k) => k + 1);
        return;
      }

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

      if (publishNow) {
        const pubRes = await fetch(`/api/admin/messages/${data.id}/publish`, { method: 'POST' });
        const pubData = await pubRes.json();
        if (!pubRes.ok) {
          setError(pubData.error ?? 'Error al publicar');
          setShowCreate(false);
          setForm(DEFAULT_FORM);
          setRefreshKey((k) => k + 1);
          return;
        }
        setSuccess(`Mensaje publicado para ${pubData.recipients_created ?? 0} usuarios.`);
      } else if (form.scheduled_for) {
        setSuccess(`Programado: se publica solo el ${fechaCorta(form.scheduled_for)} a la mañana.`);
      } else {
        setSuccess('Borrador guardado.');
      }

      setShowCreate(false);
      setForm(DEFAULT_FORM);
      setRefreshKey((k) => k + 1);
    } catch {
      setError('Error de red');
    } finally {
      setSaving(false);
    }
  };

  /** Muestra la fecha programada sin pasar por Date: un 'YYYY-MM-DD' parseado
      como Date se interpreta en UTC y en Argentina se ve un día menos. */
  const fechaCorta = (iso: string) => {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y.slice(2)}`;
  };

  const handleUnschedule = async (msgId: string) => {
    setUnscheduling(msgId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/messages/${msgId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduled_for: null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'No se pudo cancelar el envío programado.');
        return;
      }
      setSuccess('Envío programado cancelado. El mensaje queda como borrador.');
      setRefreshKey((k) => k + 1);
    } catch {
      setError('Error de red');
    } finally {
      setUnscheduling(null);
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
      setSuccess(`Publicado para ${data.recipients_created ?? 0} usuarios.`);
      setRefreshKey((k) => k + 1);
    } catch {
      setError('Error de red');
    } finally {
      setPublishing(null);
    }
  };

  const filterParams = () => {
    const p = new URLSearchParams();
    if (search.trim()) p.set('q', search.trim());
    if (origin !== 'todos') p.set('origin', origin);
    if (priority) p.set('priority', priority);
    if (status) p.set('status', status);
    if (dateFrom) p.set('from', dateFrom);
    if (dateTo) p.set('to', dateTo);
    if (dateFrom || dateTo) p.set('dateField', dateField);
    if (readState !== 'todos') p.set('readState', readState);
    if (recipient) p.set('recipient', recipient.user_id);
    return p;
  };

  // Al cambiar cualquier filtro, volver a la página 1.
  const firstFilterRun = useRef(true);
  useEffect(() => {
    if (firstFilterRun.current) return;
    setOffset(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, origin, priority, status, dateFrom, dateTo, dateField, readState, recipient]);

  // Fetch server-side (debounced) ante cambios de filtro / página / refresh.
  // Se saltea el primer render (usa los datos del SSR).
  const skipFirstFetch = useRef(true);
  useEffect(() => {
    if (skipFirstFetch.current) {
      skipFirstFetch.current = false;
      firstFilterRun.current = false;
      return;
    }
    let cancelled = false;
    setLoading(true);
    const p = filterParams();
    p.set('limit', String(PAGE_SIZE));
    p.set('offset', String(offset));
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/messages?${p.toString()}`);
        const data = await res.json();
        if (!cancelled && res.ok) {
          setMessages(data.items ?? []);
          setTotal(data.total ?? 0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, origin, priority, status, dateFrom, dateTo, dateField, readState, recipient, offset, refreshKey]);

  const anyFilter =
    !!search.trim() ||
    origin !== 'todos' ||
    !!priority ||
    !!status ||
    !!dateFrom ||
    !!dateTo ||
    readState !== 'todos' ||
    !!recipient;

  const clearFilters = () => {
    setSearch('');
    setOrigin('todos');
    setPriority('');
    setStatus('');
    setDateFrom('');
    setDateTo('');
    setDateField('created_at');
    setReadState('todos');
    setRecipient(null);
  };

  const exportCsv = (granularity: 'messages' | 'recipients') => {
    const p = filterParams();
    p.set('granularity', granularity);
    window.location.href = `/api/admin/messages/export?${p.toString()}`;
  };

  const pageStart = total === 0 ? 0 : offset + 1;
  const pageEnd = offset + messages.length;

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

          {/* Toolbar */}
          <div className="space-y-3">
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
              <Button className="ml-auto" onClick={() => { setEditingId(null); setForm(DEFAULT_FORM); setShowCreate(true); setError(null); setSuccess(null); }}>
                Nuevo mensaje
              </Button>
            </div>

            {/* Filtros avanzados */}
            <div className="flex flex-wrap items-center gap-2">
              <SelectMenu
                ariaLabel="Prioridad"
                className="min-w-[150px]"
                value={priority}
                onChange={setPriority}
                options={[
                  { value: '', label: 'Prioridad: todas' },
                  { value: 'info', label: 'Informativo' },
                  { value: 'warning', label: 'Advertencia' },
                  { value: 'critical', label: 'Crítico' },
                ]}
              />
              <SelectMenu
                ariaLabel="Estado"
                className="min-w-[150px]"
                value={status}
                onChange={setStatus}
                options={[
                  { value: '', label: 'Estado: todos' },
                  { value: 'draft', label: 'Borrador' },
                  { value: 'published', label: 'Publicado' },
                  { value: 'archived', label: 'Archivado' },
                ]}
              />
              <SelectMenu
                ariaLabel="Estado de lectura"
                className="min-w-[160px]"
                value={readState}
                onChange={(v) => setReadState(v as typeof readState)}
                options={[
                  { value: 'todos', label: 'Lectura: todas' },
                  { value: 'con_no_leidos', label: 'Con no leídos' },
                  { value: 'todos_leidos', label: 'Todos leídos' },
                ]}
              />
              <div className="flex items-center gap-1.5">
                <SelectMenu
                  ariaLabel="Campo de fecha"
                  value={dateField}
                  onChange={(v) => setDateField(v as typeof dateField)}
                  options={[
                    { value: 'created_at', label: 'Creación' },
                    { value: 'published_at', label: 'Publicación' },
                  ]}
                />
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  aria-label="Desde"
                  className="rounded-lg border border-[var(--border)] px-2 py-1.5 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <span className="text-xs text-muted-foreground">→</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  aria-label="Hasta"
                  className="rounded-lg border border-[var(--border)] px-2 py-1.5 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <RecipientPicker value={recipient} onChange={setRecipient} />
              {anyFilter && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-xs font-medium text-[var(--brand-strong)] hover:underline"
                >
                  Limpiar
                </button>
              )}
              <div className="ml-auto flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => exportCsv('messages')}>
                  Exportar CSV
                </Button>
                <button
                  type="button"
                  onClick={() => exportCsv('recipients')}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
                  title="Exporta una fila por destinatario (auditoría de lectura)"
                >
                  Detalle
                </button>
              </div>
            </div>
          </div>

          {/* Create sheet */}
          <Sheet open={showCreate} onOpenChange={(o) => { if (!o) { setShowCreate(false); setEditingId(null); } }}>
            <SheetContent side="right" flush title={editingId ? 'Editar borrador' : 'Nuevo mensaje'} className="max-w-2xl">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
                <h2 className="type-title">{editingId ? 'Editar borrador' : 'Nuevo mensaje'}</h2>
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

                {/* Plantillas y variables */}
                <div className="space-y-2.5 rounded-lg border border-[var(--border)] bg-muted p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-secondary-foreground">Plantilla:</span>
                    <SelectMenu
                      ariaLabel="Plantilla"
                      className="min-w-[180px]"
                      value={templateId}
                      onChange={applyTemplate}
                      options={[
                        { value: '', label: 'Ninguna' },
                        ...templates.map((t) => ({ value: t.id, label: t.name })),
                      ]}
                    />
                    <button
                      type="button"
                      onClick={saveAsTemplate}
                      className="text-xs font-medium text-[var(--brand-strong)] hover:underline"
                    >
                      Guardar como plantilla
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">Insertar variable:</span>
                    {TEMPLATE_VARS.map((v) => (
                      <button
                        key={v.token}
                        type="button"
                        onClick={() => insertVar(v.token)}
                        className="rounded border border-[var(--border)] bg-white px-1.5 py-0.5 text-[11px] font-medium text-secondary-foreground hover:bg-secondary"
                        title={`Insertar {{${v.token}}}`}
                      >
                        {`{{${v.token}}}`}
                      </button>
                    ))}
                  </div>
                  {hasTemplateTokens(form.title, form.body) && (
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="text-xs font-medium text-secondary-foreground">Período</label>
                      <input
                        type="text"
                        value={form.periodo}
                        onChange={(e) => setForm({ ...form, periodo: e.target.value })}
                        placeholder="Ej. Julio 2026"
                        className="rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                      <span className="text-[11px] text-muted-foreground">
                        Las variables se personalizan por destinatario al enviar.
                      </span>
                    </div>
                  )}
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
                        { value: 'area', label: 'Por área' },
                        { value: 'lider', label: 'Por líder (su equipo directo)' },
                        { value: 'individual', label: 'Personas específicas' },
                      ]}
                    />
                  </div>
                </div>

                {/* Picker condicional según audiencia */}
                {form.audience === 'area' && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-secondary-foreground">Área</label>
                    <SelectMenu
                      ariaLabel="Área"
                      className="w-full"
                      value={form.department_id}
                      onChange={(v) => setForm({ ...form, department_id: v })}
                      options={[
                        { value: '', label: 'Elegí un área…' },
                        ...departments.map((d) => ({ value: d.id, label: d.name })),
                      ]}
                    />
                  </div>
                )}
                {form.audience === 'lider' && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-secondary-foreground">
                      Líder (se envía a su equipo directo)
                    </label>
                    <SelectMenu
                      ariaLabel="Líder"
                      className="w-full"
                      value={form.manager_id}
                      onChange={(v) => setForm({ ...form, manager_id: v })}
                      options={[
                        { value: '', label: 'Elegí un líder…' },
                        ...leaders.map((l) => ({ value: l.id, label: `${l.first_name} ${l.last_name}` })),
                      ]}
                    />
                  </div>
                )}
                {form.audience === 'individual' && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-secondary-foreground">Personas</label>
                    <EmployeeMultiSelect
                      employees={employees}
                      selected={form.user_ids}
                      onChange={(ids) => setForm({ ...form, user_ids: ids })}
                    />
                  </div>
                )}

                {/* Programar el envío. Por día y no por hora: sale en el lote de
                    la mañana, junto con los cumpleaños y el digest. */}
                <div>
                  <label htmlFor="scheduled_for" className="mb-1 block text-xs font-medium text-secondary-foreground">
                    Programar el envío (opcional)
                  </label>
                  <input
                    id="scheduled_for"
                    type="date"
                    value={form.scheduled_for}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setForm({ ...form, scheduled_for: e.target.value })}
                    className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Si elegís una fecha, el mensaje queda como borrador y se publica solo esa mañana. Si la dejás
                    vacía, se guarda como borrador y lo publicás vos cuando quieras.
                  </p>
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

                {form.send_email && (
                  <MailOptions
                    form={form}
                    setForm={setForm}
                    editingId={editingId}
                    onError={setError}
                    onSuccess={setSuccess}
                  />
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 border-t border-[var(--border)] p-4">
                <Button variant="ghost" onClick={() => { setShowCreate(false); setEditingId(null); }} disabled={saving}>
                  Cancelar
                </Button>
                {editingId ? (
                  <Button onClick={() => handleCreate(false)} loading={saving}>
                    Guardar cambios
                  </Button>
                ) : (
                  <>
                    <Button variant="outline" onClick={() => handleCreate(false)} disabled={saving}>
                      Guardar borrador
                    </Button>
                    <Button onClick={() => handleCreate(true)} loading={saving}>
                      Publicar ahora
                    </Button>
                  </>
                )}
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
              <p className="mt-3 font-semibold text-secondary-foreground">
                {anyFilter ? 'No hay mensajes que coincidan' : 'No hay mensajes todavía'}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {anyFilter ? 'Probá ajustar o limpiar los filtros.' : 'Crea el primer anuncio para tu organización'}
              </p>
              {anyFilter ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-4 text-sm font-medium text-[var(--brand-strong)] hover:underline"
                >
                  Limpiar filtros
                </button>
              ) : (
                <Button className="mt-4" onClick={() => { setEditingId(null); setForm(DEFAULT_FORM); setShowCreate(true); }}>
                  Nuevo mensaje
                </Button>
              )}
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
                            <span className={`mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${isAutomatic(msg) ? 'bg-secondary text-muted-foreground' : 'bg-accent text-[var(--brand-strong)]'}`}>
                              {isAutomatic(msg) ? 'Automático' : 'Manual'}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {/* Un borrador programado no es un borrador suelto: sin
                            distinguirlos, la lista no dice que va a salir solo. */}
                        {msg.status === 'draft' && msg.scheduled_for ? (
                          <span
                            className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-[var(--brand-strong)]"
                            title={`Se publica solo el ${fechaCorta(msg.scheduled_for)} a la mañana`}
                          >
                            Programado · {fechaCorta(msg.scheduled_for)}
                          </span>
                        ) : (
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadge[msg.status]}`}>
                            {msg.status === 'draft' ? 'Borrador' : msg.status === 'published' ? 'Publicado' : 'Archivado'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-xs text-muted-foreground">{labelForAudience(msg.audience)}</td>
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
                              {msg.scheduled_for ? 'Publicar ahora' : 'Publicar'}
                            </Button>
                          )}
                          {msg.status === 'draft' && (
                            <Button
                              size="sm"
                              variant="outline"
                              loading={loadingEdit === msg.id}
                              onClick={() => handleEdit(msg.id)}
                            >
                              Editar
                            </Button>
                          )}
                          {msg.status === 'draft' && msg.scheduled_for && (
                            <Button
                              size="sm"
                              variant="outline"
                              loading={unscheduling === msg.id}
                              onClick={() => handleUnschedule(msg.id)}
                            >
                              Cancelar envío
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex items-center justify-between border-t border-[var(--border)] px-6 py-3 text-xs text-muted-foreground">
                <span>
                  {pageStart}–{pageEnd} de {total}
                  {loading && ' · cargando…'}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={offset === 0 || loading}
                    onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                    className="rounded-lg border border-[var(--border)] px-2.5 py-1.5 font-medium text-muted-foreground hover:bg-muted disabled:opacity-40"
                  >
                    ← Anterior
                  </button>
                  <button
                    type="button"
                    disabled={pageEnd >= total || loading}
                    onClick={() => setOffset(offset + PAGE_SIZE)}
                    className="rounded-lg border border-[var(--border)] px-2.5 py-1.5 font-medium text-muted-foreground hover:bg-muted disabled:opacity-40"
                  >
                    Siguiente →
                  </button>
                </div>
              </div>
            </div>
          )}
    </div>
  );
}

const INPUT_CLS =
  'w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-ring';
const LABEL_CLS = 'mb-1 block text-xs font-medium text-secondary-foreground';

/**
 * Opciones del mail de un mensaje: asunto, remitente y respuestas siempre; la
 * carátula y el cuerpo entero sólo con "mail completo". La prueba se manda a
 * quien está logueado y necesita el borrador guardado (sale de lo guardado, no
 * de lo que está en pantalla).
 */
function MailOptions({
  form,
  setForm,
  editingId,
  onError,
  onSuccess,
}: {
  form: CreateForm;
  setForm: React.Dispatch<React.SetStateAction<CreateForm>>;
  editingId: string | null;
  onError: (msg: string | null) => void;
  onSuccess: (msg: string | null) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [testing, setTesting] = useState(false);

  const [coverKicker, setCoverKicker] = useState('');
  const [coverTitle, setCoverTitle] = useState('');
  const [coverSource, setCoverSource] = useState<File | null>(null);

  const uploadCover = async (source: File) => {
    setUploading(true);
    onError(null);
    try {
      setCoverSource(source);
      const withTitle = Boolean(coverTitle.trim() || coverKicker.trim());
      const file = withTitle ? await composeCover(source, coverKicker, coverTitle) : source;
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/admin/messages/cover', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) {
        onError(data.error ?? 'No se pudo subir la carátula.');
        return;
      }
      setForm((f) => ({ ...f, email_cover_url: data.url, email_cover_has_title: withTitle }));
    } catch {
      onError('Error de red al subir la carátula.');
    } finally {
      setUploading(false);
    }
  };

  const sendTest = async () => {
    if (!editingId) return;
    setTesting(true);
    onError(null);
    try {
      const res = await fetch(`/api/admin/messages/${editingId}/test-email`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        onError(data.error ?? 'No se pudo mandar la prueba.');
        return;
      }
      onSuccess(`Te mandé la prueba a ${data.to}. Sale de lo último que guardaste.`);
    } catch {
      onError('Error de red al mandar la prueba.');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-4 rounded-lg border border-[var(--border)] px-4 py-4">
      <label htmlFor="email_full" className="flex cursor-pointer items-start gap-3">
        <Checkbox
          id="email_full"
          checked={form.email_full}
          onCheckedChange={(c) => setForm((f) => ({ ...f, email_full: c === true }))}
        />
        <span className="text-sm">
          <span className="font-medium text-secondary-foreground">Mandar el mensaje completo por mail</span>
          <span className="block text-xs text-muted-foreground">
            Con carátula y todo el texto. Sin esto, el mail es un aviso corto con el botón al portal.
          </span>
        </span>
      </label>

      {form.email_full && (
        <div className="space-y-3">
          <span className={LABEL_CLS}>Carátula (opcional)</span>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="cover_kicker" className={LABEL_CLS}>Texto chico sobre la foto</label>
              <input
                id="cover_kicker"
                type="text"
                value={coverKicker}
                onChange={(e) => setCoverKicker(e.target.value)}
                placeholder="Viernes 4/12 · 14 h · Terraza"
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label htmlFor="cover_title" className={LABEL_CLS}>Título sobre la foto</label>
              <input
                id="cover_title"
                type="text"
                value={coverTitle}
                onChange={(e) => setCoverTitle(e.target.value)}
                placeholder="Despidamos el año *juntos*"
                className={INPUT_CLS}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Lo que va entre asteriscos sale en naranja. Si escribís un título sobre la foto, el mail no lo repite abajo.
            Completalos antes de elegir la imagen; si los cambiás después, tocá «Volver a armar».
          </p>
          {form.email_cover_url ? (
            <div className="space-y-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={form.email_cover_url}
                alt="Carátula del mail"
                className="w-full rounded-lg border border-[var(--border)]"
              />
              <div className="flex flex-wrap gap-2">
                {coverSource && (
                  <Button variant="outline" size="sm" loading={uploading} onClick={() => void uploadCover(coverSource)}>
                    Volver a armar
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setCoverSource(null);
                    setForm((f) => ({ ...f, email_cover_url: '', email_cover_has_title: false }));
                  }}
                >
                  Sacar la carátula
                </Button>
              </div>
            </div>
          ) : (
            <label className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-[var(--border)] px-4 py-6 text-sm text-muted-foreground hover:bg-muted">
              {uploading ? 'Armando y subiendo…' : 'Elegí una imagen (JPG, PNG o WebP)'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadCover(file);
                  e.target.value = '';
                }}
              />
            </label>
          )}

          <div>
            <span className={LABEL_CLS}>Datos destacados (opcional, hasta 3)</span>
            <p className="mb-2 text-xs text-muted-foreground">
              Salen en recuadros naranja claro después del primer párrafo. Por ejemplo, Cuándo / Viernes 4/12, 14 h.
            </p>
            <div className="space-y-2">
              {[0, 1, 2].map((i) => {
                const h = form.email_highlights[i] ?? { label: '', value: '' };
                const setH = (patch: Partial<{ label: string; value: string }>) =>
                  setForm((f) => {
                    const next = [0, 1, 2].map((j) => f.email_highlights[j] ?? { label: '', value: '' });
                    next[i] = { ...next[i], ...patch };
                    // Se guardan sin huecos al final, así no quedan filas vacías.
                    while (next.length && !next[next.length - 1].label && !next[next.length - 1].value) next.pop();
                    return { ...f, email_highlights: next };
                  });
                return (
                  <div key={i} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-2">
                    <input
                      type="text"
                      aria-label={`Rótulo ${i + 1}`}
                      value={h.label}
                      maxLength={30}
                      onChange={(e) => setH({ label: e.target.value })}
                      placeholder={['Cuándo', 'Dónde', 'Confirmá'][i]}
                      className={INPUT_CLS}
                    />
                    <input
                      type="text"
                      aria-label={`Dato ${i + 1}`}
                      value={h.value}
                      maxLength={80}
                      onChange={(e) => setH({ value: e.target.value })}
                      placeholder={['Viernes 4/12, 14 h', 'Terraza de Pow', 'Antes del jueves 26/11'][i]}
                      className={INPUT_CLS}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-3 border-t border-[var(--border)] pt-3">
            <label htmlFor="email_rsvp" className="flex cursor-pointer items-start gap-3">
              <Checkbox
                id="email_rsvp"
                checked={form.email_rsvp}
                onCheckedChange={(c) => setForm((f) => ({ ...f, email_rsvp: c === true }))}
              />
              <span className="text-sm">
                <span className="font-medium text-secondary-foreground">Pedir respuesta con botones</span>
                <span className="block text-xs text-muted-foreground">
                  Cada persona responde desde el mail, sin entrar al portal. Las respuestas se ven en el detalle del mensaje.
                </span>
              </span>
            </label>
            {form.email_rsvp && (
              <div className="grid gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
                <input
                  type="text"
                  aria-label="Pregunta"
                  value={form.email_rsvp_question}
                  maxLength={120}
                  onChange={(e) => setForm((f) => ({ ...f, email_rsvp_question: e.target.value }))}
                  placeholder="Venís al asado?"
                  className={INPUT_CLS}
                />
                <input
                  type="text"
                  aria-label="Botón de sí"
                  value={form.email_rsvp_yes}
                  maxLength={30}
                  onChange={(e) => setForm((f) => ({ ...f, email_rsvp_yes: e.target.value }))}
                  placeholder="Voy"
                  className={INPUT_CLS}
                />
                <input
                  type="text"
                  aria-label="Botón de no"
                  value={form.email_rsvp_no}
                  maxLength={30}
                  onChange={(e) => setForm((f) => ({ ...f, email_rsvp_no: e.target.value }))}
                  placeholder="No voy"
                  className={INPUT_CLS}
                />
              </div>
            )}
          </div>
        </div>
      )}

      <div>
        <label htmlFor="email_subject" className={LABEL_CLS}>Asunto</label>
        <input
          id="email_subject"
          type="text"
          value={form.email_subject}
          onChange={(e) => setForm((f) => ({ ...f, email_subject: e.target.value }))}
          placeholder={form.email_full ? form.title || 'Igual al título' : `Nuevo mensaje: ${form.title || '…'}`}
          className={INPUT_CLS}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="email_from_name" className={LABEL_CLS}>Nombre del remitente</label>
          <input
            id="email_from_name"
            type="text"
            value={form.email_from_name}
            onChange={(e) => setForm((f) => ({ ...f, email_from_name: e.target.value }))}
            placeholder="Pow People"
            className={INPUT_CLS}
          />
        </div>
        <div>
          <label htmlFor="email_reply_to" className={LABEL_CLS}>Las respuestas van a</label>
          <input
            id="email_reply_to"
            type="email"
            value={form.email_reply_to}
            onChange={(e) => setForm((f) => ({ ...f, email_reply_to: e.target.value }))}
            placeholder="La casilla de People"
            className={INPUT_CLS}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-3">
        <Button variant="outline" size="sm" onClick={sendTest} loading={testing} disabled={!editingId}>
          Mandarme una prueba
        </Button>
        <span className="text-xs text-muted-foreground">
          {editingId
            ? 'Te llega sólo a vos. Guardá los cambios antes, la prueba sale del borrador guardado.'
            : 'Guardá el borrador y abrilo para mandarte una prueba.'}
        </span>
      </div>
    </div>
  );
}

const COVER_W = 1200;
const COVER_H = 660; // 600 × 330 a 2x, la proporción de la carátula del mail
const COVER_FONT = '"Plus Jakarta Sans"';

async function loadCoverFont(): Promise<void> {
  if (typeof document === 'undefined') return;
  const id = 'pow-jakarta-font';
  if (!document.getElementById(id)) {
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@700;800&display=swap';
    document.head.appendChild(link);
    await new Promise((r) => {
      link.onload = r;
      link.onerror = r;
    });
  }
  try {
    await Promise.all([
      document.fonts.load(`800 64px ${COVER_FONT}`),
      document.fonts.load(`700 22px ${COVER_FONT}`),
    ]);
  } catch {
    // Sin la fuente se dibuja con la de sistema; la carátula sale igual.
  }
}

/**
 * Arma la carátula como en los artifacts de Pow: la foto recortada a 600×330,
 * un degradé oscuro abajo y encima el texto chico en amarillo y el título en
 * blanco, con lo que va entre asteriscos en naranja. Se arma como imagen porque
 * un texto encima de una foto no se puede hacer de forma confiable en un mail.
 */
async function composeCover(source: File, kicker: string, title: string): Promise<File> {
  await loadCoverFont();
  const url = URL.createObjectURL(source);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('No se pudo leer la imagen.'));
      el.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = COVER_W;
    canvas.height = COVER_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return source;

    // Recorte tipo object-fit: cover, centrado.
    const scale = Math.max(COVER_W / img.width, COVER_H / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.drawImage(img, (COVER_W - w) / 2, (COVER_H - h) / 2, w, h);

    const grad = ctx.createLinearGradient(0, 0, 0, COVER_H);
    grad.addColorStop(0.35, 'rgba(23,22,20,0)');
    grad.addColorStop(1, 'rgba(23,22,20,0.82)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, COVER_W, COVER_H);

    const left = 48;
    const maxW = COVER_W - left * 2;
    let bottom = COVER_H - 40;

    // Título: los tramos entre *asteriscos* van en naranja.
    const parts = title
      .trim()
      .split(/(\*[^*]+\*)/)
      .filter(Boolean)
      .map((t) => (t.startsWith('*') && t.endsWith('*') ? { t: t.slice(1, -1), o: true } : { t, o: false }));
    if (parts.length) {
      let size = 64;
      const measure = () => {
        ctx.font = `800 ${size}px ${COVER_FONT}, system-ui, sans-serif`;
        if ('letterSpacing' in ctx) (ctx as unknown as { letterSpacing: string }).letterSpacing = `${-0.025 * size}px`;
        return parts.reduce((acc, p) => acc + ctx.measureText(p.t).width, 0);
      };
      while (measure() > maxW && size > 36) size -= 2;
      ctx.textBaseline = 'alphabetic';
      let x = left;
      for (const p of parts) {
        ctx.fillStyle = p.o ? '#FE722B' : '#FFFFFF';
        ctx.fillText(p.t, x, bottom);
        x += ctx.measureText(p.t).width;
      }
      bottom -= size * 1.05 + 4;
    }

    if (kicker.trim()) {
      ctx.font = `700 22px ${COVER_FONT}, system-ui, sans-serif`;
      if ('letterSpacing' in ctx) (ctx as unknown as { letterSpacing: string }).letterSpacing = '3px';
      ctx.fillStyle = '#FFEB82';
      ctx.fillText(kicker.trim().toUpperCase(), left, bottom);
    }

    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.86));
    if (!blob) return source;
    return new File([blob], 'caratula.jpg', { type: 'image/jpeg' });
  } finally {
    URL.revokeObjectURL(url);
  }
}

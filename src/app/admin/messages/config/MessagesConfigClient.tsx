'use client';

import { useState } from 'react';
import { RichTextEditor } from '../../RichTextEditor';

type Template = {
  id: string;
  template_key: string;
  subject: string;
  body: string;
  description: string;
  variables: string[] | null;
  is_active: boolean;
  category: string;
  send_internal_message: boolean;
  internal_message_text: string | null;
  send_to_google_chat: boolean;
};

const CATEGORY_LABELS: Record<string, string> = {
  automation: '🤖 Automatizaciones',
  time_off: '🏖️ Licencias',
  payroll: '💰 Liquidaciones',
};

const TEMPLATE_NAMES: Record<string, string> = {
  birthday_greeting: 'Saludo de Cumpleaños',
  work_anniversary: 'Aniversario de Trabajo',
  time_off_request_submitted: 'Solicitud enviada (al empleado)',
  time_off_leader_notification: 'Nueva solicitud (al líder)',
  time_off_hr_notification: 'Requiere aprobación final (a HR)',
  time_off_approved_leader: 'Aprobada por líder',
  time_off_approved_hr: 'Aprobada por HR',
  time_off_rejected: 'Rechazada',
  time_off_modified: 'Cancelada / Modificada',
};

function convertToHtml(text: string): string {
  if (text.includes('<p>') || text.includes('<br') || text.includes('<ul>')) return text;
  return text.split('\n').filter(l => l.trim()).map(l => `<p>${l}</p>`).join('');
}

function htmlToText(html: string): string {
  return html
    .replace(/<p>/g, '').replace(/<\/p>/g, '\n')
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<strong>(.*?)<\/strong>/g, '**$1**')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .trim();
}

type Props = { initialTemplates: Template[] };

export function MessagesConfigClient({ initialTemplates }: Props) {
  const [templates, setTemplates] = useState<Template[]>(initialTemplates);
  const [selected, setSelected] = useState<Template | null>(initialTemplates[0] ?? null);
  const [editSubject, setEditSubject] = useState(initialTemplates[0]?.subject ?? '');
  const [editBody, setEditBody] = useState(initialTemplates[0] ? convertToHtml(initialTemplates[0].body) : '');
  const [editActive, setEditActive] = useState(initialTemplates[0]?.is_active ?? true);
  const [editSendMessage, setEditSendMessage] = useState(initialTemplates[0]?.send_internal_message ?? false);
  const [editMessageText, setEditMessageText] = useState(initialTemplates[0]?.internal_message_text ?? '');
  const [editSendGoogleChat, setEditSendGoogleChat] = useState(initialTemplates[0]?.send_to_google_chat ?? false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  function selectTemplate(t: Template) {
    setSelected(t);
    setEditSubject(t.subject);
    setEditBody(convertToHtml(t.body));
    setEditActive(t.is_active);
    setEditSendMessage(t.send_internal_message);
    setEditMessageText(t.internal_message_text ?? '');
    setEditSendGoogleChat(t.send_to_google_chat ?? false);
    setFeedback(null);
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/messages/templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_key: selected.template_key,
          subject: editSubject,
          body: htmlToText(editBody),
          is_active: editActive,
          send_internal_message: editSendMessage,
          internal_message_text: editSendMessage ? editMessageText : null,
          send_to_google_chat: editSendGoogleChat,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setTemplates(prev => prev.map(t => t.template_key === updated.template_key ? { ...t, ...updated } : t));
        setSelected(prev => prev ? { ...prev, ...updated } : prev);
        setFeedback({ type: 'success', text: 'Plantilla guardada correctamente' });
      } else {
        const err = await res.json();
        setFeedback({ type: 'error', text: err.error || 'Error al guardar' });
      }
    } catch {
      setFeedback({ type: 'error', text: 'Error de red' });
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    if (selected) selectTemplate(selected);
  }

  // Group by category maintaining order: automation first
  const categoryOrder = ['automation', 'time_off', 'payroll'];
  const grouped = categoryOrder.reduce<Record<string, Template[]>>((acc, cat) => {
    const items = templates.filter(t => t.category === cat);
    if (items.length) acc[cat] = items;
    return acc;
  }, {});

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-zinc-900">Configuración de Mensajes</h2>
        <p className="mt-1 text-sm text-zinc-500">Administrá las automatizaciones y plantillas de email enviadas a empleados</p>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Left: template list */}
        <div className="col-span-4">
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-zinc-900 mb-3">Plantillas</h3>
            <div className="space-y-4">
              {Object.entries(grouped).map(([cat, tpls]) => (
                <div key={cat}>
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider px-1 mb-1.5">
                    {CATEGORY_LABELS[cat] ?? cat}
                  </p>
                  <div className="space-y-1">
                    {tpls.map(t => (
                      <button
                        key={t.template_key}
                        onClick={() => selectTemplate(t)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                          selected?.template_key === t.template_key
                            ? 'bg-violet-600 text-white'
                            : 'text-zinc-700 hover:bg-zinc-100'
                        }`}
                      >
                        <div className="font-medium">
                          {TEMPLATE_NAMES[t.template_key] ?? t.template_key}
                        </div>
                        {t.description && (
                          <div className={`text-xs mt-0.5 line-clamp-2 ${selected?.template_key === t.template_key ? 'text-violet-200' : 'text-zinc-500'}`}>
                            {t.description}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: editor */}
        <div className="col-span-8">
          {selected ? (
            <div className="rounded-xl border border-zinc-200 bg-white p-6 space-y-6">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900">
                    {TEMPLATE_NAMES[selected.template_key] ?? selected.template_key}
                  </h2>
                  <p className="text-sm text-zinc-500 mt-1">{selected.description}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-medium ${editActive ? 'text-violet-700' : 'text-zinc-500'}`}>
                    {editActive ? 'Activo' : 'Desactivado'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditActive(v => !v)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${editActive ? 'bg-violet-600' : 'bg-zinc-300'}`}
                  >
                    <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${editActive ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>

              {/* Variables */}
              {selected.variables && selected.variables.length > 0 && (
                <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
                  <h3 className="text-sm font-semibold text-blue-900 mb-2">Variables disponibles</h3>
                  <div className="flex flex-wrap gap-2">
                    {selected.variables.map((v: string) => (
                      <code key={v} className="px-2 py-1 bg-white rounded text-xs font-mono text-blue-700 border border-blue-300">
                        {`{{${v}}}`}
                      </code>
                    ))}
                  </div>
                </div>
              )}

              {/* Canales (solo para automation) */}
              {selected.category === 'automation' && (
                <div>
                  <label className="block text-sm font-medium text-zinc-900 mb-2">Canales de envío</label>
                  <div className="flex flex-wrap gap-5">
                    <label className="flex items-center gap-2 cursor-pointer text-sm text-zinc-700">
                      <input type="checkbox" checked readOnly className="accent-violet-600 w-4 h-4" />
                      📧 Email
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-sm text-zinc-700">
                      <input type="checkbox" checked={editSendMessage} onChange={e => setEditSendMessage(e.target.checked)} className="accent-violet-600 w-4 h-4" />
                      💬 Mensaje interno en el portal
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-sm text-zinc-700">
                      <input type="checkbox" checked={editSendGoogleChat} onChange={e => setEditSendGoogleChat(e.target.checked)} className="accent-violet-600 w-4 h-4" />
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/></svg>
                      Chat grupal de Pow (Google Chat)
                    </label>
                  </div>
                </div>
              )}

              {/* Subject */}
              <div>
                <label className="block text-sm font-medium text-zinc-900 mb-2">Asunto</label>
                <input
                  type="text"
                  value={editSubject}
                  onChange={e => setEditSubject(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              </div>

              {/* Body */}
              <div>
                <label className="block text-sm font-medium text-zinc-900 mb-2">Cuerpo del Email</label>
                <RichTextEditor content={editBody} onChange={setEditBody} />
              </div>

              {/* Internal message text */}
              {selected.category === 'automation' && editSendMessage && (
                <div>
                  <label className="block text-sm font-medium text-zinc-900 mb-2">
                    Texto del mensaje interno <span className="font-normal text-zinc-400">(portal del empleado)</span>
                  </label>
                  <textarea
                    rows={3}
                    value={editMessageText}
                    onChange={e => setEditMessageText(e.target.value)}
                    placeholder="Texto corto que aparecerá como notificación en el portal..."
                    className="w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                  />
                </div>
              )}

              {feedback && (
                <div className={`rounded-lg px-4 py-3 text-sm ${feedback.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                  {feedback.text}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-lg bg-violet-600 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : 'Guardar Cambios'}
                </button>
                <button
                  onClick={handleReset}
                  disabled={saving}
                  className="rounded-lg border border-zinc-300 bg-white px-5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                >
                  Restablecer
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center text-sm text-zinc-400">
              Seleccioná un template para editarlo
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

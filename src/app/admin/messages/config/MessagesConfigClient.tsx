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
};

const CATEGORY_LABELS: Record<string, string> = {
  automation: '🤖 Automatizaciones',
  time_off: '🏖️ Licencias',
  payroll: '💰 Liquidaciones',
};

const TEMPLATE_NAMES: Record<string, string> = {
  birthday_greeting: 'Saludo de Cumpleaños',
  work_anniversary: 'Aniversario de Trabajo',
  time_off_request_submitted: 'Solicitud de Licencia Enviada',
  time_off_leader_notification: 'Notificación al Líder (nueva solicitud)',
  time_off_hr_notification: 'Notificación a HR (aprobación final)',
  time_off_approved_leader: 'Licencia Aprobada por Líder',
  time_off_approved_hr: 'Licencia Aprobada por HR',
  time_off_rejected: 'Licencia Rechazada',
  time_off_modified: 'Licencia Cancelada/Modificada',
};

const VARIABLE_DESCRIPTIONS: Record<string, string> = {
  firstName: 'Nombre del empleado',
  employeeName: 'Nombre completo',
  years: 'Años de antigüedad',
  yearsSuffix: '"s" o vacío (pluralización)',
  hireDate: 'Fecha de ingreso',
  employee_name: 'Nombre completo del empleado',
  leave_type: 'Tipo de licencia',
  start_date: 'Fecha de inicio',
  end_date: 'Fecha de fin',
  days_count: 'Cantidad de días',
  unidad_tiempo: 'días o semanas',
  leader_name: 'Nombre del líder',
  employee_email: 'Email del empleado',
  rejection_reason: 'Motivo de rechazo',
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
  const [editSendEmail, setEditSendEmail] = useState(true);
  const [editSendMessage, setEditSendMessage] = useState(initialTemplates[0]?.send_internal_message ?? false);
  const [editMessageText, setEditMessageText] = useState(initialTemplates[0]?.internal_message_text ?? '');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  function selectTemplate(t: Template) {
    setSelected(t);
    setEditSubject(t.subject);
    setEditBody(convertToHtml(t.body));
    setEditActive(t.is_active);
    setEditSendEmail(true);
    setEditSendMessage(t.send_internal_message);
    setEditMessageText(t.internal_message_text ?? '');
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
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setTemplates(prev => prev.map(t => t.template_key === updated.template_key ? { ...t, ...updated } : t));
        setSelected(prev => prev ? { ...prev, ...updated } : prev);
        setFeedback({ type: 'success', text: 'Cambios guardados correctamente' });
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
    if (!selected) return;
    selectTemplate(selected);
    setFeedback(null);
  }

  // Group by category
  const grouped = templates.reduce<Record<string, Template[]>>((acc, t) => {
    acc[t.category] = acc[t.category] || [];
    acc[t.category].push(t);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Configuración de Mensajes</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Administrá las automatizaciones y plantillas de email enviadas a empleados
        </p>
      </div>

      <div className="flex gap-6 items-start">
        {/* Left: template list */}
        <div className="w-72 shrink-0 rounded-xl border border-zinc-200 bg-white overflow-hidden">
          {Object.entries(grouped).map(([cat, tpls]) => (
            <div key={cat}>
              <div className="px-4 py-2.5 bg-zinc-50 border-b border-zinc-200">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  {CATEGORY_LABELS[cat] ?? cat}
                </p>
              </div>
              {tpls.map(t => (
                <button
                  key={t.template_key}
                  onClick={() => selectTemplate(t)}
                  className={`w-full text-left px-4 py-3.5 border-b border-zinc-100 last:border-0 transition-colors ${
                    selected?.template_key === t.template_key
                      ? 'bg-black text-white'
                      : 'hover:bg-zinc-50 text-zinc-900'
                  }`}
                >
                  <p className={`text-sm font-medium leading-tight ${selected?.template_key === t.template_key ? 'text-white' : 'text-zinc-900'}`}>
                    {TEMPLATE_NAMES[t.template_key] ?? t.template_key}
                  </p>
                  <p className={`text-xs mt-0.5 leading-snug line-clamp-2 ${selected?.template_key === t.template_key ? 'text-zinc-300' : 'text-zinc-500'}`}>
                    {t.description}
                  </p>
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Right: editor */}
        {selected ? (
          <div className="flex-1 rounded-xl border border-zinc-200 bg-white p-6 space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">
                  {TEMPLATE_NAMES[selected.template_key] ?? selected.template_key}
                </h2>
                <p className="text-sm text-zinc-500 mt-0.5">{selected.description}</p>
              </div>
              {/* Active toggle */}
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-sm font-medium text-zinc-700">{editActive ? 'Activo' : 'Inactivo'}</span>
                <button
                  onClick={() => setEditActive(v => !v)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${editActive ? 'bg-emerald-500' : 'bg-zinc-300'}`}
                >
                  <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${editActive ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </label>
            </div>

            {/* Variables */}
            {selected.variables && selected.variables.length > 0 && (
              <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
                <p className="text-xs font-semibold text-blue-700 mb-1.5">Variables disponibles</p>
                <div className="flex flex-wrap gap-1.5">
                  {selected.variables.map((v: string) => (
                    <span key={v} title={VARIABLE_DESCRIPTIONS[v]} className="cursor-help rounded bg-blue-100 px-2 py-0.5 font-mono text-xs text-blue-800">
                      {`{{${v}}}`}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Channels */}
            <div>
              <p className="text-sm font-medium text-zinc-700 mb-2">Canales de envío</p>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={editSendEmail} onChange={e => setEditSendEmail(e.target.checked)} className="accent-black w-4 h-4" />
                  <span className="text-sm text-zinc-700">📧 Email</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={editSendMessage} onChange={e => setEditSendMessage(e.target.checked)} className="accent-black w-4 h-4" />
                  <span className="text-sm text-zinc-700">💬 Mensaje interno en el portal</span>
                </label>
              </div>
            </div>

            {/* Subject */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">Asunto</label>
              <input
                type="text"
                value={editSubject}
                onChange={e => setEditSubject(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
              />
            </div>

            {/* Body */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">Cuerpo del Email</label>
              <RichTextEditor content={editBody} onChange={setEditBody} />
            </div>

            {/* Internal message text */}
            {editSendMessage && (
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                  Texto del mensaje interno <span className="font-normal text-zinc-400">(portal)</span>
                </label>
                <textarea
                  rows={3}
                  value={editMessageText}
                  onChange={e => setEditMessageText(e.target.value)}
                  placeholder="Texto corto que aparecerá como mensaje en el portal del empleado..."
                  className="w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                />
              </div>
            )}

            {feedback && (
              <div className={`rounded-lg px-4 py-3 text-sm ${feedback.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                {feedback.text}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-black px-5 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
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
          <div className="flex-1 rounded-xl border border-zinc-200 bg-white p-12 text-center text-sm text-zinc-400">
            Seleccioná un template para editarlo
          </div>
        )}
      </div>
    </div>
  );
}

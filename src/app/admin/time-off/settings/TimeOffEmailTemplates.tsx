'use client';

import { useState, useEffect } from 'react';
import { RichTextEditor } from '../../RichTextEditor';

type EmailTemplate = {
  id: string;
  template_key: string;
  subject: string;
  body: string;
  description: string;
  variables: string[];
  is_active: boolean;
};

const TIME_OFF_TEMPLATE_KEYS = [
  'time_off_request_submitted',
  'time_off_approved_leader',
  'time_off_approved_hr',
  'time_off_rejected',
  'time_off_modified',
  'time_off_leader_notification',
  'time_off_hr_notification',
];

const TEMPLATE_NAMES: Record<string, string> = {
  'time_off_request_submitted': '📌 Solicitud Recibida',
  'time_off_approved_leader': '✅ Aprobada por Líder',
  'time_off_approved_hr': '✅ Aprobada (Final)',
  'time_off_rejected': '❌ Rechazada',
  'time_off_modified': '🔄 Modificada/Cancelada',
  'time_off_leader_notification': '📩 Notificación a Líder',
  'time_off_hr_notification': '📩 Notificación a HR',
};

export function TimeOffEmailTemplates() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editedSubject, setEditedSubject] = useState('');
  const [editedBody, setEditedBody] = useState('');
  const [editedIsActive, setEditedIsActive] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    try {
      const res = await fetch('/api/admin/email-templates');
      if (res.ok) {
        const data = await res.json();
        // Filter only time-off templates
        const timeOffTemplates = (data.templates || []).filter((t: EmailTemplate) =>
          TIME_OFF_TEMPLATE_KEYS.includes(t.template_key)
        );
        setTemplates(timeOffTemplates);
        if (timeOffTemplates.length > 0) {
          selectTemplate(timeOffTemplates[0]);
        }
      }
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoading(false);
    }
  }

  function convertPlainTextToHTML(text: string): string {
    if (text.includes('<p>') || text.includes('<br') || text.includes('<ul>') || text.includes('<ol>')) {
      return text;
    }
    const lines = text.split('\n').filter(line => line.trim());
    return lines.map(line => `<p>${line}</p>`).join('');
  }

  function selectTemplate(template: EmailTemplate) {
    setSelectedTemplate(template);
    setEditedSubject(template.subject);
    setEditedBody(convertPlainTextToHTML(template.body));
    setEditedIsActive(template.is_active);
    setMessage(null);
  }

  async function handleSave() {
    if (!selectedTemplate) return;

    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/admin/email-templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateKey: selectedTemplate.template_key,
          subject: editedSubject,
          body: editedBody,
          is_active: editedIsActive
        })
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Plantilla guardada correctamente' });
        await loadTemplates();
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error || 'Error al guardar' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error al guardar la plantilla' });
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    if (selectedTemplate) {
      setEditedSubject(selectedTemplate.subject);
      setEditedBody(convertPlainTextToHTML(selectedTemplate.body));
      setEditedIsActive(selectedTemplate.is_active);
      setMessage(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-600 border-t-transparent" />
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center">
        <p className="text-sm text-amber-800">
          No se encontraron plantillas de email para Time-Off.
        </p>
        <p className="mt-2 text-xs text-amber-600">
          Ejecuta la migración <code className="rounded bg-amber-100 px-1">migration-time-off-emails.sql</code> para crearlas.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* Template List */}
      <div className="col-span-4">
        <div className="space-y-2">
          {templates.map((template) => (
            <button
              key={template.id}
              onClick={() => selectTemplate(template)}
              className={`w-full text-left px-4 py-3 rounded-lg text-sm transition-colors ${
                selectedTemplate?.id === template.id
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50'
              }`}
            >
              <div className="font-medium">
                {TEMPLATE_NAMES[template.template_key] || template.template_key}
              </div>
              <div className={`text-xs mt-1 flex items-center gap-2 ${
                selectedTemplate?.id === template.id ? 'text-amber-100' : 'text-zinc-500'
              }`}>
                <span className={`inline-flex h-2 w-2 rounded-full ${
                  template.is_active 
                    ? selectedTemplate?.id === template.id ? 'bg-green-300' : 'bg-green-500'
                    : selectedTemplate?.id === template.id ? 'bg-zinc-300' : 'bg-zinc-400'
                }`} />
                {template.is_active ? 'Activo' : 'Inactivo'}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Editor */}
      <div className="col-span-8">
        {selectedTemplate ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-6 space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-zinc-900">
                  {TEMPLATE_NAMES[selectedTemplate.template_key] || selectedTemplate.template_key}
                </h3>
                <p className="text-sm text-zinc-500 mt-1">{selectedTemplate.description}</p>
              </div>
              
              <div className="flex items-center gap-3">
                <span className={`text-sm font-medium ${editedIsActive ? 'text-green-700' : 'text-zinc-500'}`}>
                  {editedIsActive ? 'Activo' : 'Desactivado'}
                </span>
                <button
                  type="button"
                  onClick={() => setEditedIsActive(!editedIsActive)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    editedIsActive ? 'bg-green-600' : 'bg-zinc-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      editedIsActive ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            {selectedTemplate.variables && selectedTemplate.variables.length > 0 && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
                <h4 className="text-sm font-semibold text-amber-900 mb-2">Variables disponibles</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedTemplate.variables.map((variable) => (
                    <code
                      key={variable}
                      className="px-2 py-1 bg-white rounded text-xs font-mono text-amber-700 border border-amber-300"
                    >
                      {`{{${variable}}}`}
                    </code>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label htmlFor="subject" className="block text-sm font-medium text-zinc-900 mb-2">
                Asunto
              </label>
              <input
                id="subject"
                type="text"
                value={editedSubject}
                onChange={(e) => setEditedSubject(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-900 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div>
              <label htmlFor="body" className="block text-sm font-medium text-zinc-900 mb-2">
                Cuerpo del Email
              </label>
              <RichTextEditor
                content={editedBody}
                onChange={setEditedBody}
                placeholder="Escribe el contenido del email..."
              />
            </div>

            {message && (
              <div
                className={`rounded-lg border p-4 ${
                  message.type === 'success'
                    ? 'bg-green-50 border-green-200 text-green-800'
                    : 'bg-red-50 border-red-200 text-red-800'
                }`}
              >
                <p className="text-sm font-medium">{message.text}</p>
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-amber-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-amber-700 disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Guardar Cambios'}
              </button>
              <button
                onClick={handleReset}
                disabled={saving}
                className="rounded-lg border border-zinc-300 bg-white px-6 py-2.5 text-sm font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 disabled:opacity-50"
              >
                Restablecer
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center">
            <p className="text-sm text-zinc-500">Selecciona una plantilla para editar</p>
          </div>
        )}
      </div>
    </div>
  );
}

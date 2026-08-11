'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RichTextEditor } from '../../RichTextEditor';
import { Button } from '@pow/ui/components/ui/button';
import { Switch } from '@pow/ui/components/ui/switch';
import { SkeletonRows } from '@pow/ui/components/ui/skeleton';

type EmailTemplate = {
  id: string;
  template_key: string;
  subject: string;
  body: string;
  description: string;
  variables: string[];
  is_active: boolean;
};

const TEMPLATE_NAMES: Record<string, string> = {
  'application_confirmation': 'Email Confirmación de Aplicación',
  'candidate_rejected': 'Email Candidato Descartado (General)',
  'candidate_rejected_location': 'Email Candidato Descartado (Provincia OTRA)',
  'candidate_rejected_salary': 'Email Candidato Descartado (Sueldo)',
  'interview_coordination': 'Email Coordinación Entrevista',
  'interview_leader': 'Email Entrevista con Líder',
  'talent_pool_confirmation': 'Email Confirmación Banco de Talentos',
};

// Templates de time-off se gestionan en /admin/time-off/settings
const TIME_OFF_TEMPLATE_KEYS = [
  'time_off_request_submitted',
  'time_off_approved_leader',
  'time_off_approved_hr',
  'time_off_rejected',
  'time_off_modified',
  'time_off_leader_notification',
  'time_off_hr_notification',
];

export function EmailTemplatesClient() {
  const router = useRouter();
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
        // Filter out time-off templates (managed in /admin/time-off/settings)
        const recruitingTemplates = (data.templates || []).filter(
          (t: EmailTemplate) => !TIME_OFF_TEMPLATE_KEYS.includes(t.template_key)
        );
        setTemplates(recruitingTemplates);
        if (recruitingTemplates.length > 0) {
          selectTemplate(recruitingTemplates[0]);
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
        router.refresh();
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
      setEditedBody(selectedTemplate.body);
      setEditedIsActive(selectedTemplate.is_active);
      setMessage(null);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-white p-6">
        <SkeletonRows rows={5} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-4">
        <div className="rounded-xl border border-[var(--border)] bg-white p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">Plantillas de Email</h2>
          <div className="space-y-2">
            {templates.map((template) => (
              <button
                key={template.id}
                onClick={() => selectTemplate(template)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  selectedTemplate?.id === template.id
                    ? 'bg-secondary text-foreground'
                    : 'text-secondary-foreground hover:bg-secondary'
                }`}
              >
                <div className="font-medium">
                  {TEMPLATE_NAMES[template.template_key] || template.template_key}
                </div>
                {template.description && (
                  <div className="text-xs mt-1 text-muted-foreground">
                    {template.description}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="col-span-8">
        {selectedTemplate ? (
          <div className="rounded-xl border border-[var(--border)] bg-white p-6 space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  {TEMPLATE_NAMES[selectedTemplate.template_key] || selectedTemplate.template_key}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">{selectedTemplate.description}</p>
              </div>
              
              <div className="flex items-center gap-3">
                <span className={`text-sm font-medium ${editedIsActive ? 'text-[var(--green-700)]' : 'text-muted-foreground'}`}>
                  {editedIsActive ? 'Activo' : 'Desactivado'}
                </span>
                <Switch
                  checked={editedIsActive}
                  onCheckedChange={setEditedIsActive}
                  aria-label="Activar plantilla"
                />
              </div>
            </div>

            {selectedTemplate.variables && selectedTemplate.variables.length > 0 && (
              <div className="rounded-lg bg-muted border border-[var(--border)] p-4">
                <h3 className="text-sm font-semibold text-foreground mb-2">Variables disponibles</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedTemplate.variables.map((variable) => (
                    <code
                      key={variable}
                      className="px-2 py-1 bg-white rounded text-xs font-mono text-secondary-foreground border border-[var(--border)]"
                    >
                      {`{{${variable}}}`}
                    </code>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label htmlFor="subject" className="block text-sm font-medium text-foreground mb-2">
                Asunto
              </label>
              <input
                id="subject"
                type="text"
                value={editedSubject}
                onChange={(e) => setEditedSubject(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-white px-4 py-2.5 text-sm text-foreground focus:border-brand focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <div>
              <label htmlFor="body" className="block text-sm font-medium text-foreground mb-2">
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
                    ? 'bg-success-subtle border-success/20 text-[var(--green-700)]'
                    : 'bg-danger-subtle border-danger/20 text-[var(--red-600)]'
                }`}
              >
                <p className="text-sm font-medium">{message.text}</p>
              </div>
            )}

            <div className="flex items-center gap-3">
              <Button onClick={handleSave} loading={saving}>
                Guardar cambios
              </Button>
              <Button variant="outline" onClick={handleReset} disabled={saving}>
                Restablecer
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-[var(--border)] bg-white p-12 text-center">
            <p className="text-sm text-muted-foreground">Selecciona una plantilla para editar</p>
          </div>
        )}
      </div>
    </div>
  );
}

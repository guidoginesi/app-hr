'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { Alert } from '@pow/ui/components/ui/alert';
import { Button } from '@pow/ui/components/ui/button';
import { Input } from '@pow/ui/components/ui/input';
import { Select } from '@pow/ui/components/ui/select';
import { Textarea } from '@pow/ui/components/ui/textarea';
import {
  MAX_MESSAGE_LENGTH,
  MAX_NAME_LENGTH,
  MAX_RESUME_BYTES,
  SENIORITY_OPTIONS,
} from '@/lib/talentPool';

/**
 * "¿No encontrás lo que buscás?" — Banco de Talentos.
 *
 * Va desplegable dentro del listado y no en una página aparte: quien llega y no
 * encuentra una búsqueda que le sirva se va del sitio, y un clic más es un clic
 * donde se pierde.
 */

/**
 * Chip de área. Es toda la tarjeta la que actúa de checkbox, y no un cuadradito
 * metido adentro de un `<label>`: el Checkbox del DS renderiza un `<button>`, y
 * un label no le reenvía el clic, así que de toda la tarjeta respondían sólo
 * 16px. El cuadradito de acá es decorativo; el control accesible es el botón.
 */
function AreaChip({
  area,
  checked,
  onToggle,
}: {
  area: string;
  checked: boolean;
  onToggle: (area: string, checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onToggle(area, !checked)}
      className={`flex items-center gap-2 rounded-[var(--radius)] border px-3 py-2 text-left text-sm text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        checked ? 'border-primary bg-muted' : 'border-input hover:bg-muted'
      }`}
    >
      <span
        aria-hidden
        className={`grid h-4 w-4 shrink-0 place-items-center rounded-[calc(var(--radius)-3px)] border transition-colors ${
          checked ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-card'
        }`}
      >
        {checked && <Check className="h-3 w-3" strokeWidth={3} />}
      </span>
      {area}
    </button>
  );
}

export function TalentPoolSection({ areas }: { areas: string[] }) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [messageLength, setMessageLength] = useState(0);
  // Los checkboxes del DS son de Radix y no emiten un campo de formulario:
  // las áreas se mandan a mano al armar el FormData.
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);

  function toggleArea(area: string, checked: boolean) {
    setSelectedAreas((prev) => (checked ? [...prev, area] : prev.filter((a) => a !== area)));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    selectedAreas.forEach((a) => formData.append('areas', a));

    const file = formData.get('resume');
    if (!(file instanceof File) || file.size === 0) {
      setError('Adjuntá tu CV para que podamos tenerte en cuenta.');
      return;
    }
    // Se avisa acá además del server: subir 10MB para que te lo rechacen del
    // otro lado es esperar al pedo.
    if (file.size > MAX_RESUME_BYTES) {
      setError('El archivo supera el límite de 10MB.');
      return;
    }
    if (selectedAreas.length === 0) {
      setError('Elegí al menos un área de interés.');
      return;
    }

    setSending(true);
    try {
      const res = await fetch('/api/talent-pool', { method: 'POST', body: formData });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? 'No pudimos guardar tus datos. Probá de nuevo en un rato.');
        return;
      }
      setDone(true);
    } catch {
      setError('No pudimos guardar tus datos. Revisá tu conexión y probá de nuevo.');
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <section className="mt-6 rounded-[var(--radius)] border border-[var(--border)] bg-card p-8 text-center">
        <h2 className="text-base font-semibold text-foreground">¡Listo, ya te sumamos!</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
          Tus datos quedaron en nuestro Banco de Talentos y te mandamos un mail de confirmación.
          Cuando abramos una búsqueda que tenga que ver con lo tuyo, te escribimos.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-6 rounded-[var(--radius)] border border-[var(--border)] bg-card p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">¿No encontrás lo que buscás?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Dejanos tus datos y te tenemos en cuenta para las próximas búsquedas.
          </p>
        </div>
        {!open && (
          <Button size="lg" className="shrink-0" onClick={() => setOpen(true)}>
            Dejar mis datos
          </Button>
        )}
      </div>

      {open && (
        <form onSubmit={handleSubmit} className="mt-6 space-y-6 border-t border-[var(--border)] pt-6">
          {/* Campo trampa: invisible para una persona, irresistible para un bot. */}
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="hidden"
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              id="tp-name"
              name="name"
              label="Nombre completo"
              required
              maxLength={MAX_NAME_LENGTH}
              placeholder="Nombre y apellido"
            />
            <Input
              id="tp-email"
              name="email"
              type="email"
              label="Mail"
              required
              placeholder="tu@mail.com"
            />
            <Input
              id="tp-linkedin"
              name="linkedinUrl"
              label="LinkedIn o portfolio"
              placeholder="linkedin.com/in/tuperfil"
            />
            <Select
              id="tp-seniority"
              name="seniority"
              label="Nivel de experiencia"
              required
              defaultValue=""
              placeholder="Elegí una opción"
              options={SENIORITY_OPTIONS.map((s) => ({ value: s, label: s }))}
            />
          </div>

          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium text-secondary-foreground">
              Áreas de interés
              <span className="ml-0.5 text-danger" aria-hidden="true">*</span>
              <span className="ml-1.5 font-normal text-muted-foreground">
                (podés elegir más de una)
              </span>
            </legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {areas.map((area) => (
                <AreaChip
                  key={area}
                  area={area}
                  checked={selectedAreas.includes(area)}
                  onToggle={toggleArea}
                />
              ))}
            </div>
          </fieldset>

          <div>
            <Textarea
              id="tp-message"
              name="message"
              label="¿Por qué te gustaría trabajar en Pow?"
              rows={4}
              maxLength={MAX_MESSAGE_LENGTH}
              onChange={(e) => setMessageLength(e.target.value.length)}
              placeholder="Contanos en pocas líneas qué te interesa y qué venís haciendo."
            />
            <p className="mt-1 text-right text-xs text-muted-foreground">
              {messageLength}/{MAX_MESSAGE_LENGTH}
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="tp-resume" className="block text-sm font-medium text-secondary-foreground">
              CV
              <span className="ml-0.5 text-danger" aria-hidden="true">*</span>
            </label>
            <input
              id="tp-resume"
              name="resume"
              type="file"
              required
              accept=".pdf,.doc,.docx"
              className="w-full rounded-[var(--radius)] border border-input bg-card px-3 py-2 text-sm text-foreground transition-colors hover:border-[var(--gray-300)] file:mr-3 file:rounded-[var(--radius)] file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-secondary-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="text-xs text-muted-foreground">PDF o Word, hasta 10MB.</p>
          </div>

          {error && <Alert variant="danger">{error}</Alert>}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">Los campos con * son obligatorios.</p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="lg" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" size="lg" loading={sending}>
                Enviar
              </Button>
            </div>
          </div>
        </form>
      )}
    </section>
  );
}

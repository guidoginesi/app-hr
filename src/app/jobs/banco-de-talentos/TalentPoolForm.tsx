'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { X } from 'lucide-react';
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
 * Selector de áreas.
 *
 * Es el Select del DS, el mismo control que "Nivel de experiencia": se elige de
 * a una y el área se suma abajo. Así admite varias sin inventar un desplegable
 * propio, que era lo que se sentía ajeno al resto del formulario.
 *
 * El área elegida sale de la lista: no tiene sentido ofrecer algo que la
 * persona ya sumó.
 */
function AreasSelect({
  areas,
  selected,
  onToggle,
}: {
  areas: string[];
  selected: string[];
  onToggle: (area: string, checked: boolean) => void;
}) {
  const disponibles = areas.filter((a) => !selected.includes(a));
  const sinOpciones = disponibles.length === 0;

  return (
    <div className="space-y-2">
      <Select
        aria-label="Áreas de interés"
        // Vuelve siempre al placeholder: el select es para SUMAR, lo elegido
        // se ve en los chips de abajo.
        value=""
        disabled={sinOpciones}
        onChange={(e) => {
          if (e.target.value) onToggle(e.target.value, true);
        }}
        placeholder={sinOpciones ? 'Ya elegiste todas' : 'Agregá un área'}
        options={disponibles.map((a) => ({ value: a, label: a }))}
      />

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((area) => (
            <button
              key={area}
              type="button"
              onClick={() => onToggle(area, false)}
              aria-label={`Quitar ${area}`}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-muted py-1 pl-2.5 pr-1.5 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary"
            >
              {area}
              <X className="h-3 w-3" aria-hidden />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function TalentPoolForm({ areas }: { areas: string[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messageLength, setMessageLength] = useState(0);
  // Las áreas viven en estado y no en inputs: el chip es un <button>, no un
  // checkbox nativo, así que no aparece solo en el FormData.
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);

  function toggleArea(area: string, checked: boolean) {
    setSelectedAreas((prev) => (checked ? [...prev, area] : prev.filter((a) => a !== area)));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    selectedAreas.forEach((a) => formData.append('areas', a));

    if (selectedAreas.length === 0) {
      setError('Elegí al menos un área de interés.');
      return;
    }
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

    setSending(true);
    try {
      const res = await fetch('/api/talent-pool', { method: 'POST', body: formData });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? 'No pudimos guardar tus datos. Probá de nuevo en un rato.');
        return;
      }
      // Mismo cierre que la postulación a una búsqueda: vuelve al listado con
      // el aviso arriba, en vez de dejar a la persona en un formulario vacío.
      startTransition(() => router.push('/jobs?talento=1'));
    } catch {
      setError('No pudimos guardar tus datos. Revisá tu conexión y probá de nuevo.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="rounded-[var(--radius)] border border-[var(--border)] bg-card p-6">
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Campo trampa: invisible para una persona, irresistible para un bot. */}
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="hidden"
        />

        <section className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">Mi información</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Completá la información a continuación.
            </p>
          </div>

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
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">Qué te interesa</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Nos sirve para avisarte cuando abramos algo de lo tuyo.
            </p>
          </div>

          <div className="space-y-1.5 sm:max-w-sm">
            <p className="text-sm font-medium text-secondary-foreground">
              Áreas de interés
              <span className="ml-0.5 text-danger" aria-hidden="true">*</span>
              <span className="ml-1.5 font-normal text-muted-foreground">
                (podés elegir más de una)
              </span>
            </p>
            <AreasSelect areas={areas} selected={selectedAreas} onToggle={toggleArea} />
          </div>

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
        </section>

        <section className="space-y-1.5">
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
        </section>

        {error && <Alert variant="danger">{error}</Alert>}

        <div className="flex flex-col gap-3 border-t border-[var(--border)] pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">Los campos con * son obligatorios.</p>
          <Button
            type="submit"
            variant="brand"
            size="lg"
            loading={sending || isPending}
            className="w-full sm:w-auto"
          >
            Enviar mis datos
          </Button>
        </div>
      </form>
    </div>
  );
}

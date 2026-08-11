'use client';

import { useState } from 'react';
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
 *
 * El estilo sigue al del portal público (blanco, borde suave, botón negro), que
 * es anterior al design system de la app. Mezclar los dos acá se vería peor que
 * ser consistente con lo que el candidato ya está mirando.
 */

const inputClass =
  'w-full rounded-lg border border-[var(--border)] bg-white px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-black focus:outline-none focus:ring-1 focus:ring-black';

const labelClass = 'mb-1.5 block text-sm font-medium text-foreground';

export function TalentPoolSection({ areas }: { areas: string[] }) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [messageLength, setMessageLength] = useState(0);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = event.currentTarget;
    const formData = new FormData(form);

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
    if (formData.getAll('areas').length === 0) {
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
      <section className="mt-8 rounded-xl border border-[var(--border)] bg-white p-8 text-center shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">¡Listo, ya te sumamos!</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
          Tus datos quedaron en nuestro Banco de Talentos y te mandamos un mail de confirmación.
          Cuando abramos una búsqueda que tenga que ver con lo tuyo, te escribimos.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-8 rounded-xl border border-[var(--border)] bg-white p-8 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">¿No encontrás lo que buscás?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Dejanos tus datos y te tenemos en cuenta para las próximas búsquedas.
          </p>
        </div>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="shrink-0 rounded-md bg-black px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-secondary"
          >
            Dejar mis datos
          </button>
        )}
      </div>

      {open && (
        <form onSubmit={handleSubmit} className="mt-8 space-y-6 border-t border-[var(--border)] pt-8">
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
            <div>
              <label htmlFor="tp-name" className={labelClass}>
                Nombre completo *
              </label>
              <input
                id="tp-name"
                name="name"
                type="text"
                required
                maxLength={MAX_NAME_LENGTH}
                placeholder="Nombre y apellido"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="tp-email" className={labelClass}>
                Mail *
              </label>
              <input
                id="tp-email"
                name="email"
                type="email"
                required
                placeholder="tu@mail.com"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="tp-linkedin" className={labelClass}>
                LinkedIn o portfolio
              </label>
              <input
                id="tp-linkedin"
                name="linkedinUrl"
                type="text"
                placeholder="linkedin.com/in/tuperfil"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="tp-seniority" className={labelClass}>
                Nivel de experiencia *
              </label>
              <select id="tp-seniority" name="seniority" required defaultValue="" className={inputClass}>
                <option value="" disabled>
                  Elegí una opción
                </option>
                {SENIORITY_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <fieldset>
            <legend className={labelClass}>Áreas de interés * (podés elegir más de una)</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {areas.map((area) => (
                <label
                  key={area}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-muted"
                >
                  <input
                    type="checkbox"
                    name="areas"
                    value={area}
                    className="h-4 w-4 rounded border-[var(--border)] accent-black"
                  />
                  {area}
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor="tp-message" className={labelClass}>
              ¿Por qué te gustaría trabajar en Pow?
            </label>
            <textarea
              id="tp-message"
              name="message"
              rows={4}
              maxLength={MAX_MESSAGE_LENGTH}
              onChange={(e) => setMessageLength(e.target.value.length)}
              placeholder="Contanos en pocas líneas qué te interesa y qué venís haciendo."
              className={inputClass}
            />
            <p className="mt-1 text-right text-xs text-muted-foreground">
              {messageLength}/{MAX_MESSAGE_LENGTH}
            </p>
          </div>

          <div>
            <label htmlFor="tp-resume" className={labelClass}>
              CV *
            </label>
            <input
              id="tp-resume"
              name="resume"
              type="file"
              required
              accept=".pdf,.doc,.docx"
              className="w-full rounded-lg border border-[var(--border)] bg-white px-4 py-2.5 text-sm text-foreground file:mr-4 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-secondary-foreground focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
            />
            <p className="mt-1 text-xs text-muted-foreground">PDF o Word, hasta 10MB.</p>
          </div>

          {error && (
            <div className="rounded-lg border border-danger/20 bg-danger-subtle p-4">
              <p className="text-sm font-medium text-[var(--red-600)]">{error}</p>
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">Los campos con * son obligatorios.</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-[var(--border)] px-6 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={sending}
                className="rounded-md bg-black px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? 'Enviando...' : 'Enviar'}
              </button>
            </div>
          </div>
        </form>
      )}
    </section>
  );
}

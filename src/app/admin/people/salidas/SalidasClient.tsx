'use client';

import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { formatDateLocal } from '@/lib/dateUtils';
import { OFFBOARDING_QUESTIONS, type OffboardingQuestion } from '@/config/offboardingQuestions';
import { Sheet, SheetContent, SheetClose } from '@pow/ui/components/ui/sheet';

export type SalidaConRespuesta = {
  id: string;
  nombre: string;
  puesto: string | null;
  fechaDeBaja: string | null;
  motivo: string | null;
  encuestaHabilitada: boolean;
  contestada: boolean;
  enviadaEl: string | null;
  respuestas: Record<string, unknown>;
};

const MOTIVOS: Record<string, string> = {
  resignation: 'Renuncia',
  dismissal: 'Despido',
};

const ESCALAS = OFFBOARDING_QUESTIONS.filter((q) => q.type === 'scale_4');
const ABIERTAS = OFFBOARDING_QUESTIONS.filter((q) => q.type === 'textarea');

/** Para promediar una escala ordinal: mejor = 4. */
const PUNTAJE: Record<string, number> = { excelente: 4, bueno: 3, regular: 2, malo: 1 };

const COLOR: Record<string, string> = {
  excelente: 'bg-[var(--green-700)]',
  bueno: 'bg-[var(--green-700)]/50',
  regular: 'bg-[var(--amber-600)]',
  malo: 'bg-[var(--red-600)]',
};

/** El texto que le tocó a ese nivel en esta pregunta ("Buena" / "Buenos" / …). */
function etiqueta(pregunta: OffboardingQuestion, value: string): string {
  return pregunta.options?.find((o) => o.value === value)?.label ?? value;
}

function Resumen({ contestadas }: { contestadas: SalidaConRespuesta[] }) {
  const filas = useMemo(
    () =>
      ESCALAS.map((q) => {
        const valores = contestadas
          .map((s) => s.respuestas[q.id])
          .filter((v): v is string => typeof v === 'string' && v in PUNTAJE);
        const total = valores.length;
        const conteo = Object.fromEntries(
          Object.keys(PUNTAJE).map((nivel) => [nivel, valores.filter((v) => v === nivel).length]),
        ) as Record<string, number>;
        const promedio = total ? valores.reduce((a, v) => a + PUNTAJE[v], 0) / total : null;
        return { q, total, conteo, promedio };
      }),
    [contestadas],
  );

  // De peor a mejor: lo que hay que mirar primero es lo que peor puntúa.
  const ordenadas = [...filas].sort((a, b) => (a.promedio ?? 9) - (b.promedio ?? 9));

  return (
    <div className="rounded-xl border border-[var(--border)] bg-white">
      <div className="border-b border-[var(--border)] px-6 py-4">
        <h2 className="type-title">Cómo puntúan</h2>
        <p className="text-sm text-muted-foreground">
          Sobre {contestadas.length} {contestadas.length === 1 ? 'entrevista contestada' : 'entrevistas contestadas'}, de peor a mejor.
        </p>
      </div>
      <div className="divide-y divide-[var(--border)]">
        {ordenadas.map(({ q, total, conteo, promedio }) => (
          <div key={q.id} className="px-6 py-4">
            <div className="flex items-baseline justify-between gap-4">
              <p className="text-sm font-medium text-foreground">{q.label}</p>
              <p className="flex-shrink-0 text-sm tabular-nums text-muted-foreground">
                {promedio === null ? '—' : `${promedio.toFixed(1)} / 4`}
              </p>
            </div>
            {total > 0 && (
              <>
                <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-muted">
                  {Object.keys(PUNTAJE).map((nivel) =>
                    conteo[nivel] ? (
                      <div
                        key={nivel}
                        className={COLOR[nivel]}
                        style={{ width: `${(conteo[nivel] / total) * 100}%` }}
                        title={`${etiqueta(q, nivel)}: ${conteo[nivel]}`}
                      />
                    ) : null,
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                  {Object.keys(PUNTAJE).map((nivel) =>
                    conteo[nivel] ? (
                      <span key={nivel} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className={`h-2 w-2 flex-shrink-0 rounded-full ${COLOR[nivel]}`} />
                        {etiqueta(q, nivel)} · {conteo[nivel]}
                      </span>
                    ) : null,
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Detalle({ salida, onClose }: { salida: SalidaConRespuesta; onClose: () => void }) {
  return (
    <Sheet open onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" flush title="Entrevista de salida" className="max-w-2xl">
        <div className="border-b border-[var(--border)] px-6 py-4">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <h2 className="type-title">{salida.nombre}</h2>
              <p className="text-sm text-muted-foreground">
                {[salida.puesto, salida.motivo ? MOTIVOS[salida.motivo] : null, salida.fechaDeBaja ? formatDateLocal(salida.fechaDeBaja) : null]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
            <SheetClose
              aria-label="Cerrar"
              className="-mr-1.5 grid h-8 w-8 place-items-center rounded-[var(--radius)] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </SheetClose>
          </div>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {ABIERTAS.map((q) => {
            const texto = salida.respuestas[q.id];
            return (
              <div key={q.id}>
                <p className="text-sm font-medium text-secondary-foreground">{q.label}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                  {typeof texto === 'string' && texto.trim() ? texto : <span className="text-muted-foreground">Sin respuesta</span>}
                </p>
              </div>
            );
          })}

          <div className="rounded-lg border border-[var(--border)] bg-muted p-4">
            <div className="space-y-2">
              {ESCALAS.map((q) => {
                const v = salida.respuestas[q.id];
                return (
                  <div key={q.id} className="flex items-baseline justify-between gap-4">
                    <span className="text-sm text-secondary-foreground">{q.label}</span>
                    <span className="flex-shrink-0 text-sm font-medium text-foreground">
                      {typeof v === 'string' ? etiqueta(q, v) : '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {salida.enviadaEl && (
            <p className="text-xs text-muted-foreground">
              Contestada el {formatDateLocal(salida.enviadaEl.split('T')[0])}
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function SalidasClient({ salidas }: { salidas: SalidaConRespuesta[] }) {
  const [abierta, setAbierta] = useState<SalidaConRespuesta | null>(null);

  const contestadas = salidas.filter((s) => s.contestada);
  const pendientes = salidas.filter((s) => s.encuestaHabilitada && !s.contestada);

  if (salidas.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-white px-6 py-12 text-center">
        <p className="text-sm font-medium text-muted-foreground">Todavía no hay bajas registradas</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Bajas', valor: salidas.length },
          { label: 'Entrevistas contestadas', valor: contestadas.length },
          { label: 'Pendientes de contestar', valor: pendientes.length },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-[var(--border)] bg-white px-5 py-4">
            <p className="text-2xl font-semibold tabular-nums text-foreground">{k.valor}</p>
            <p className="text-sm text-muted-foreground">{k.label}</p>
          </div>
        ))}
      </div>

      {contestadas.length > 0 && <Resumen contestadas={contestadas} />}

      <div className="rounded-xl border border-[var(--border)] bg-white">
        <div className="border-b border-[var(--border)] px-6 py-4">
          <h2 className="type-title">Bajas</h2>
        </div>
        <ul className="divide-y divide-[var(--border)]">
          {salidas.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-4 px-6 py-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{s.nombre}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {[
                    s.puesto,
                    s.motivo ? MOTIVOS[s.motivo] : null,
                    s.fechaDeBaja ? formatDateLocal(s.fechaDeBaja) : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <div className="flex flex-shrink-0 items-center gap-3">
                {s.contestada ? (
                  <>
                    <span className="inline-flex items-center rounded-full bg-success-subtle px-2 py-0.5 text-xs font-medium text-[var(--green-700)]">
                      Contestada
                    </span>
                    <button
                      type="button"
                      onClick={() => setAbierta(s)}
                      className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-medium text-secondary-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      Ver respuestas
                    </button>
                  </>
                ) : s.encuestaHabilitada ? (
                  <span className="inline-flex items-center rounded-full bg-warning-subtle px-2 py-0.5 text-xs font-medium text-[var(--amber-600)]">
                    Pendiente
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    Sin entrevista
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {abierta && <Detalle salida={abierta} onClose={() => setAbierta(null)} />}
    </div>
  );
}

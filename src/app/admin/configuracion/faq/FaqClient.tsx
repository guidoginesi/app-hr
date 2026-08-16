'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@pow/ui/components/ui/card';
import { Button } from '@pow/ui/components/ui/button';
import { Textarea } from '@pow/ui/components/ui/textarea';

/**
 * Los agujeros del manual, y las FAQ que salen de taparlos.
 *
 * La pantalla tiene un orden a propósito: arriba lo que hay que hacer
 * (candidatos), abajo lo hecho. Una lista de FAQ ya aprobadas no le pide nada a
 * nadie; los agujeros sin tapar sí.
 */

type Faq = {
  id: string;
  pregunta: string;
  respuesta: string;
  categoria: string | null;
  estado: 'BORRADOR' | 'APROBADA' | 'ARCHIVADA';
  pendiente_de_manual: boolean;
  origen_inquiry_id: string | null;
  creado_at: string;
};

type Candidato = {
  inquiry_id: string;
  asunto: string;
  categoria: string;
  estado_consulta: string;
  motivo: string;
  nota_para_hr: string | null;
  respuesta: string;
};

const TONO: Record<Faq['estado'], string> = {
  APROBADA: 'bg-success-subtle text-[var(--green-700)]',
  BORRADOR: 'bg-warning-subtle text-[var(--amber-600)]',
  ARCHIVADA: 'bg-secondary text-secondary-foreground',
};

const ETIQUETA: Record<Faq['estado'], string> = {
  APROBADA: 'La cita el agente',
  BORRADOR: 'Sin aprobar',
  ARCHIVADA: 'Archivada',
};

export function FaqClient() {
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enVuelo, setEnVuelo] = useState<string | null>(null);
  // Edición en curso, por id. Se guarda al apretar; no hay autosave para que
  // aprobar sea siempre un acto deliberado.
  const [borradores, setBorradores] = useState<Record<string, { pregunta: string; respuesta: string }>>({});

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await fetch('/api/admin/manual/faqs');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'No se pudo cargar.');
      setFaqs(data.faqs ?? []);
      setCandidatos(data.candidatos ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const enviar = async (cuerpo: Record<string, unknown>, clave: string, ok?: string) => {
    setEnVuelo(clave);
    setError(null);
    setAviso(null);
    try {
      const res = await fetch('/api/admin/manual/faqs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'No se pudo completar la acción.');
      if (data.sirve === false) {
        setAviso(`No sale una FAQ de ahí: ${data.motivo}`);
      } else if (ok) {
        setAviso(ok);
      }
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo completar la acción.');
    } finally {
      setEnVuelo(null);
    }
  };

  const editar = (f: Faq) =>
    borradores[f.id] ?? { pregunta: f.pregunta, respuesta: f.respuesta };

  const sinAprobar = faqs.filter((f) => f.estado === 'BORRADOR');
  const aprobadas = faqs.filter((f) => f.estado === 'APROBADA');
  const archivadas = faqs.filter((f) => f.estado === 'ARCHIVADA');
  const pendientesDeManual = aprobadas.filter((f) => f.pendiente_de_manual);

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--border)] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div role="alert" className="flex items-start justify-between gap-4 rounded-xl border border-[var(--border)] bg-danger-subtle px-5 py-3 text-sm text-[var(--red-600)]">
          <span>{error}</span>
          <button type="button" aria-label="Cerrar" className="shrink-0 font-medium" onClick={() => setError(null)}>✕</button>
        </div>
      )}
      {aviso && (
        <div role="status" aria-live="polite" className="flex items-start justify-between gap-4 rounded-xl border border-[var(--border)] bg-success-subtle px-5 py-3 text-sm text-[var(--green-700)]">
          <span>{aviso}</span>
          <button type="button" aria-label="Cerrar" className="shrink-0 font-medium" onClick={() => setAviso(null)}>✕</button>
        </div>
      )}

      {/* ── Los agujeros ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Agujeros del manual</CardTitle>
          <CardDescription>
            Consultas donde el manual no alcanzó y People contestó igual. Esa respuesta es
            conocimiento de la empresa que no está escrito en ningún lado — y se pierde si nadie
            lo captura.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {candidatos.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Ningún agujero pendiente. Aparecen solos cuando el agente no encuentra la respuesta
              en el manual, o cuando alguien edita el borrador antes de mandarlo.
            </p>
          ) : (
            <div className="space-y-3">
              {candidatos.map((c) => (
                <div key={c.inquiry_id} className="rounded-xl border border-[var(--border)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground">{c.asunto}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.categoria} · {c.motivo}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      disabled={enVuelo === c.inquiry_id}
                      onClick={() =>
                        enviar({ accion: 'crear', inquiry_id: c.inquiry_id }, c.inquiry_id, 'FAQ propuesta. Revisala antes de aprobarla.')
                      }
                    >
                      {enVuelo === c.inquiry_id ? 'Redactando…' : 'Proponer FAQ'}
                    </Button>
                  </div>

                  {c.nota_para_hr && (
                    <p className="mt-3 rounded-lg bg-secondary px-3 py-2 text-xs text-secondary-foreground">
                      {c.nota_para_hr}
                    </p>
                  )}
                  <p className="mt-2 whitespace-pre-wrap text-sm text-secondary-foreground">
                    <span className="font-medium">Se respondió:</span> {c.respuesta}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Las FAQ ──────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Preguntas frecuentes</CardTitle>
          <CardDescription>
            Sólo las aprobadas las cita el agente, con la misma autoridad que el manual. Una FAQ mal
            cargada le contesta mal a mucha gente: por eso nacen sin aprobar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              ['Sin aprobar', sinAprobar.length],
              ['Las cita el agente', aprobadas.length],
              ['Faltan en el Doc', pendientesDeManual.length],
              ['Archivadas', archivadas.length],
            ].map(([etiqueta, n]) => (
              <div key={etiqueta as string} className="rounded-xl border border-[var(--border)] p-4">
                <p className="text-2xl font-semibold text-foreground">{n as number}</p>
                <p className="text-sm text-secondary-foreground">{etiqueta as string}</p>
              </div>
            ))}
          </div>

          {pendientesDeManual.length > 0 && (
            <p className="rounded-xl border border-[var(--border)] bg-warning-subtle px-4 py-3 text-sm text-[var(--amber-600)]">
              Hay {pendientesDeManual.length} {pendientesDeManual.length === 1 ? 'respuesta' : 'respuestas'} que
              todavía no están en el Google Doc. El destino de una FAQ es dejar de ser FAQ: subila al manual
              y la sabe cualquiera que lo lea, no sólo el agente.
            </p>
          )}

          {faqs.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Todavía no hay ninguna.</p>
          ) : (
            <div className="space-y-3">
              {faqs.map((f) => {
                const ed = editar(f);
                const cambiada = ed.pregunta !== f.pregunta || ed.respuesta !== f.respuesta;
                const trabajando = enVuelo === f.id;
                return (
                  <div key={f.id} className="space-y-3 rounded-xl border border-[var(--border)] p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TONO[f.estado]}`}>
                        {ETIQUETA[f.estado]}
                      </span>
                      {f.categoria && (
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                          {f.categoria}
                        </span>
                      )}
                      {f.estado === 'APROBADA' && f.pendiente_de_manual && (
                        <span className="rounded-full bg-warning-subtle px-2 py-0.5 text-xs font-medium text-[var(--amber-600)]">
                          Falta en el Doc
                        </span>
                      )}
                    </div>

                    <Textarea
                      rows={2}
                      aria-label="Pregunta"
                      value={ed.pregunta}
                      onChange={(e) =>
                        setBorradores((p) => ({ ...p, [f.id]: { ...ed, pregunta: e.target.value } }))
                      }
                    />
                    <Textarea
                      rows={4}
                      aria-label="Respuesta"
                      value={ed.respuesta}
                      onChange={(e) =>
                        setBorradores((p) => ({ ...p, [f.id]: { ...ed, respuesta: e.target.value } }))
                      }
                    />

                    <div className="flex flex-wrap gap-2">
                      {cambiada && (
                        <Button
                          size="sm"
                          disabled={trabajando}
                          onClick={() =>
                            enviar({ accion: 'guardar', id: f.id, ...ed }, f.id, 'Cambios guardados.')
                          }
                        >
                          Guardar cambios
                        </Button>
                      )}
                      {f.estado !== 'APROBADA' && (
                        <Button
                          size="sm"
                          variant={cambiada ? 'outline' : 'primary'}
                          disabled={trabajando}
                          onClick={() =>
                            enviar(
                              { accion: 'guardar', id: f.id, ...ed, estado: 'APROBADA' },
                              f.id,
                              'Aprobada. El agente ya la puede citar.',
                            )
                          }
                        >
                          Aprobar
                        </Button>
                      )}
                      {f.estado === 'APROBADA' && f.pendiente_de_manual && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={trabajando}
                          onClick={() =>
                            enviar(
                              { accion: 'guardar', id: f.id, pendiente_de_manual: false },
                              f.id,
                              'Marcada como ya subida al Doc.',
                            )
                          }
                        >
                          Ya la subí al Doc
                        </Button>
                      )}
                      {f.estado !== 'ARCHIVADA' && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={trabajando}
                          onClick={() =>
                            enviar({ accion: 'guardar', id: f.id, estado: 'ARCHIVADA' }, f.id, 'Archivada.')
                          }
                        >
                          Archivar
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

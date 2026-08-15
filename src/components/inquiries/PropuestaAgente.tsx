'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@pow/ui/components/ui/button';

/**
 * Propuesta de respuesta armada con el Manual RRHH.
 *
 * Nunca se manda sola: se copia al cuadro de respuesta para que People la edite
 * y la envíe. La calificación no se pide acá — sale de lo que HR haga después
 * con el borrador, comparando lo enviado contra lo propuesto.
 */

type Cita = { slug: string; ruta: string[] };

type Propuesta = {
  id: string;
  borrador: string | null;
  hay_respuesta: boolean;
  necesita_datos_personales: boolean;
  secciones_ofrecidas: number;
  modelo: string;
  error: string | null;
  resultado: 'USADA' | 'EDITADA' | 'DESCARTADA' | null;
  creado_at: string;
  citas: Cita[];
};

const RESULTADO: Record<string, string> = {
  USADA: 'Se usó tal cual',
  EDITADA: 'Se usó editada',
  DESCARTADA: 'Se descartó',
};

export function PropuestaAgente({
  inquiryId,
  onUsar,
  disabled,
}: {
  inquiryId: string;
  onUsar: (texto: string) => void;
  disabled?: boolean;
}) {
  const [propuesta, setPropuesta] = useState<Propuesta | null>(null);
  const [generando, setGenerando] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/inquiries/${inquiryId}/propuesta`);
      const data = await res.json();
      if (res.ok) setPropuesta(data.propuesta ?? null);
    } finally {
      setCargando(false);
    }
  }, [inquiryId]);

  useEffect(() => { cargar(); }, [cargar]);

  const generar = async () => {
    setGenerando(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/inquiries/${inquiryId}/propuesta`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'No se pudo generar la propuesta.');
        return;
      }
      setPropuesta(data.propuesta ?? null);
    } catch {
      setError('No se pudo generar la propuesta.');
    } finally {
      setGenerando(false);
    }
  };

  const descartar = async () => {
    await fetch(`/api/admin/inquiries/${inquiryId}/propuesta`, { method: 'PATCH' });
    await cargar();
  };

  if (cargando) return null;

  const yaCalificada = Boolean(propuesta?.resultado);
  const sinPropuestaUtil = propuesta && !propuesta.borrador;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-muted p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">Propuesta desde el manual</p>
          <p className="text-xs text-muted-foreground">
            Un borrador armado con las secciones del Manual RRHH habilitadas para colaboradores.
            Siempre lo revisás vos antes de enviarlo.
          </p>
        </div>
        {!propuesta || yaCalificada ? (
          <Button size="sm" variant="outline" onClick={generar} disabled={generando || disabled}>
            {generando ? 'Buscando en el manual…' : propuesta ? 'Proponer de nuevo' : 'Proponer una respuesta'}
          </Button>
        ) : null}
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-danger-subtle px-3 py-2 text-sm text-[var(--red-600)]">
          {error}
        </p>
      )}

      {propuesta && (
        <div className="mt-4 space-y-3">
          {yaCalificada && (
            <p className="text-xs text-muted-foreground">
              {RESULTADO[propuesta.resultado!]} · {new Date(propuesta.creado_at).toLocaleString('es-AR')}
            </p>
          )}

          {propuesta.error && (
            <p className="rounded-lg bg-warning-subtle px-3 py-2 text-sm text-[var(--amber-600)]">
              {propuesta.error}
            </p>
          )}

          {sinPropuestaUtil && !propuesta.error && (
            <p className="rounded-lg bg-secondary px-3 py-2 text-sm text-secondary-foreground">
              El manual no cubre esta consulta. Prefiere decirlo antes que inventar una respuesta.
            </p>
          )}

          {propuesta.necesita_datos_personales && (
            <p className="rounded-lg bg-warning-subtle px-3 py-2 text-sm text-[var(--amber-600)]">
              Esta consulta pide un dato de la persona (su saldo, sus fechas, su sueldo). El agente
              sólo conoce la política: el dato puntual hay que mirarlo y completarlo a mano.
            </p>
          )}

          {propuesta.borrador && (
            <>
              <div className="whitespace-pre-wrap rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm text-foreground">
                {propuesta.borrador}
              </div>

              {propuesta.citas.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium">Salió de:</span>
                  <ul className="mt-1 space-y-0.5">
                    {propuesta.citas.map((c) => (
                      <li key={c.slug}>· {c.ruta.join(' › ')}</li>
                    ))}
                  </ul>
                </div>
              )}

              {!yaCalificada && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => onUsar(propuesta.borrador!)} disabled={disabled}>
                    Usar este borrador
                  </Button>
                  <Button size="sm" variant="outline" onClick={descartar} disabled={disabled}>
                    Descartar
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

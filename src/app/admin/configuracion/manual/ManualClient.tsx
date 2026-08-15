'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@pow/ui/components/ui/card';
import { Button } from '@pow/ui/components/ui/button';
import { Input } from '@pow/ui/components/ui/input';

type Audiencia = 'EMPLEADO' | 'SOLO_HR' | 'SIN_DEFINIR';

type Seccion = {
  slug: string;
  ruta: string[];
  titulo: string;
  nivel: number;
  anchor: string | null;
  audiencia: Audiencia;
  audiencia_sugerida: Exclude<Audiencia, 'SIN_DEFINIR'> | null;
  porque: string | null;
  vigente: boolean;
  caracteres: number;
  revision_vencida: boolean;
};

type Importacion = {
  origen: string;
  recibidas: number;
  nuevas: number;
  modificadas: number;
  sin_cambios: number;
  jubiladas: number;
  creado_at: string;
};

type Filtro = 'todas' | 'SIN_DEFINIR' | 'EMPLEADO' | 'SOLO_HR';

const ETIQUETA: Record<Audiencia, string> = {
  EMPLEADO: 'Colaborador',
  SOLO_HR: 'Solo HR',
  SIN_DEFINIR: 'Sin revisar',
};

const TONO: Record<Audiencia, string> = {
  EMPLEADO: 'bg-success-subtle text-[var(--green-700)]',
  SOLO_HR: 'bg-warning-subtle text-[var(--amber-600)]',
  SIN_DEFINIR: 'bg-secondary text-secondary-foreground',
};

const OPCIONES: Audiencia[] = ['EMPLEADO', 'SOLO_HR', 'SIN_DEFINIR'];

export function ManualClient() {
  const [secciones, setSecciones] = useState<Seccion[]>([]);
  const [importacion, setImportacion] = useState<Importacion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todas');
  // Slugs en vuelo, para no bloquear la pantalla entera mientras se graba una fila.
  const [enVuelo, setEnVuelo] = useState<Set<string>>(new Set());

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/manual/sections');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'No se pudo cargar el manual.');
      setSecciones(data.secciones ?? []);
      setImportacion(data.ultima_importacion ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el manual.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  /**
   * Graba uno o varios grupos. Va en grupos y no en llamadas sueltas porque
   * aceptar la propuesta de un capítulo con excepciones —renuncia adentro de
   * Bajas— son dos audiencias distintas en una sola acción del usuario, y dos
   * fetch en paralelo se pisan el estado de "en vuelo".
   */
  const guardar = async (grupos: { slugs: string[]; audiencia: Audiencia }[]) => {
    const conContenido = grupos.filter((g) => g.slugs.length > 0);
    if (conContenido.length === 0) return;

    setEnVuelo(new Set(conContenido.flatMap((g) => g.slugs)));
    setError(null);
    setAviso(null);
    let tocadas = 0;
    try {
      for (const grupo of conContenido) {
        const res = await fetch('/api/admin/manual/sections', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(grupo),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'No se pudo guardar.');
        // Se aplica sobre la lista en memoria: recargar reordena y hace saltar
        // la fila que acabás de tocar.
        const marca = new Set(grupo.slugs);
        setSecciones((prev) =>
          prev.map((s) =>
            marca.has(s.slug) ? { ...s, audiencia: grupo.audiencia, revision_vencida: false } : s,
          ),
        );
        tocadas += grupo.slugs.length;
      }
      setAviso(tocadas === 1 ? 'Sección actualizada.' : `${tocadas} secciones actualizadas.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setEnVuelo(new Set());
    }
  };

  const conteo = useMemo(() => {
    const c = { EMPLEADO: 0, SOLO_HR: 0, SIN_DEFINIR: 0, vencidas: 0 };
    for (const s of secciones) {
      if (!s.vigente) continue;
      c[s.audiencia]++;
      if (s.revision_vencida) c.vencidas++;
    }
    return c;
  }, [secciones]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return secciones.filter((s) => {
      if (!s.vigente) return false;
      if (filtro !== 'todas' && s.audiencia !== filtro) return false;
      if (!q) return true;
      return s.ruta.join(' ').toLowerCase().includes(q);
    });
  }, [secciones, busqueda, filtro]);

  const capitulos = useMemo(() => {
    const mapa = new Map<string, Seccion[]>();
    for (const s of visibles) {
      const capitulo = s.ruta[0] ?? '(sin capítulo)';
      if (!mapa.has(capitulo)) mapa.set(capitulo, []);
      mapa.get(capitulo)!.push(s);
    }
    return [...mapa.entries()];
  }, [visibles]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Estado de la revisión</CardTitle>
          <CardDescription>
            Una sección sin revisar no se le cita a nadie. Es lo que separa que el agente cite el manual
            de que le mande a un colaborador algo que no debería ver.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            {(['SIN_DEFINIR', 'EMPLEADO', 'SOLO_HR'] as Audiencia[]).map((a) => (
              <div key={a} className="rounded-xl border border-[var(--border)] p-4">
                <p className="text-2xl font-semibold text-foreground">{conteo[a]}</p>
                <p className="text-sm text-secondary-foreground">{ETIQUETA[a]}</p>
              </div>
            ))}
            <div className="rounded-xl border border-[var(--border)] p-4">
              <p className="text-2xl font-semibold text-foreground">{conteo.vencidas}</p>
              <p className="text-sm text-secondary-foreground">Cambiaron tras revisarse</p>
            </div>
          </div>

          {importacion && (
            <p className="text-sm text-muted-foreground">
              Última sincronización desde el Doc: {new Date(importacion.creado_at).toLocaleString('es-AR')} ·{' '}
              {importacion.recibidas} secciones ({importacion.nuevas} nuevas, {importacion.modificadas} modificadas,{' '}
              {importacion.jubiladas} jubiladas) · origen <code>{importacion.origen}</code>
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            La app no puede traer el manual sola: lo empuja el Apps Script pegado al Google Doc,
            desde el menú <b>Pow RRHH → Sincronizar con app-hr</b>.
          </p>
        </CardContent>
      </Card>

      {error && (
        <div role="alert" className="flex items-start justify-between gap-4 rounded-xl border border-[var(--border)] bg-danger-subtle px-5 py-3 text-sm text-[var(--red-600)]">
          <span>{error}</span>
          <button type="button" aria-label="Cerrar el aviso" className="shrink-0 font-medium" onClick={() => setError(null)}>✕</button>
        </div>
      )}
      {aviso && (
        <div role="status" aria-live="polite" className="flex items-start justify-between gap-4 rounded-xl border border-[var(--border)] bg-success-subtle px-5 py-3 text-sm text-[var(--green-700)]">
          <span>{aviso}</span>
          <button type="button" aria-label="Cerrar el aviso" className="shrink-0 font-medium" onClick={() => setAviso(null)}>✕</button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Secciones del manual</CardTitle>
          <CardDescription>
            La forma rápida de revisarlo es por capítulo: aceptás la propuesta de todo el capítulo y
            después corregís las excepciones sueltas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <Input
              aria-label="Buscar una sección"
              placeholder="Buscar por título o capítulo…"
              className="max-w-md"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            <div className="flex gap-1">
              {(['todas', 'SIN_DEFINIR', 'EMPLEADO', 'SOLO_HR'] as Filtro[]).map((f) => (
                <Button
                  key={f}
                  size="sm"
                  variant={filtro === f ? 'primary' : 'outline'}
                  onClick={() => setFiltro(f)}
                >
                  {f === 'todas' ? 'Todas' : ETIQUETA[f]}
                </Button>
              ))}
            </div>
          </div>

          {cargando ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--border)] border-t-transparent" />
            </div>
          ) : capitulos.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No hay secciones que coincidan con el filtro.
            </p>
          ) : (
            <div className="space-y-4">
              {capitulos.map(([capitulo, filas]) => {
                const conPropuesta = filas.filter((f) => f.audiencia_sugerida && f.audiencia !== f.audiencia_sugerida);
                const trabajando = filas.some((f) => enVuelo.has(f.slug));
                return (
                  <div key={capitulo} className="overflow-hidden rounded-xl border border-[var(--border)]">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] bg-muted px-5 py-3">
                      <div>
                        <p className="font-medium text-foreground">{capitulo}</p>
                        <p className="text-xs text-muted-foreground">
                          {filas.length} {filas.length === 1 ? 'sección' : 'secciones'}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          disabled={trabajando || conPropuesta.length === 0}
                          onClick={() =>
                            guardar([
                              { slugs: conPropuesta.filter((f) => f.audiencia_sugerida === 'EMPLEADO').map((f) => f.slug), audiencia: 'EMPLEADO' },
                              { slugs: conPropuesta.filter((f) => f.audiencia_sugerida === 'SOLO_HR').map((f) => f.slug), audiencia: 'SOLO_HR' },
                            ])
                          }
                        >
                          Aceptar la propuesta
                          {conPropuesta.length > 0 ? ` (${conPropuesta.length})` : ''}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={trabajando}
                          onClick={() => guardar([{ slugs: filas.map((f) => f.slug), audiencia: 'SOLO_HR' }])}
                        >
                          Todo solo HR
                        </Button>
                      </div>
                    </div>

                    <div className="divide-y divide-[var(--border)]">
                      {filas.map((s) => (
                        <div key={s.slug} className="flex flex-wrap items-start justify-between gap-4 px-5 py-3 transition-colors hover:bg-muted">
                          <div className="min-w-0 flex-1" style={{ paddingLeft: `${(s.nivel - 1) * 16}px` }}>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium text-foreground">{s.titulo}</p>
                              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TONO[s.audiencia]}`}>
                                {ETIQUETA[s.audiencia]}
                              </span>
                              {s.revision_vencida && (
                                <span className="rounded-full bg-warning-subtle px-2 py-0.5 text-xs font-medium text-[var(--amber-600)]">
                                  Cambió tras revisarse
                                </span>
                              )}
                            </div>
                            {s.ruta.length > 1 && (
                              <p className="truncate text-xs text-muted-foreground">{s.ruta.join(' › ')}</p>
                            )}
                            <p className="mt-1 text-xs text-muted-foreground">
                              {s.caracteres.toLocaleString('es-AR')} caracteres
                              {s.audiencia_sugerida && (
                                <> · propuesta: <b>{ETIQUETA[s.audiencia_sugerida]}</b>{s.porque ? ` — ${s.porque}` : ''}</>
                              )}
                              {!s.audiencia_sugerida && <> · sin propuesta</>}
                            </p>
                          </div>

                          <div className="flex shrink-0 gap-1">
                            {OPCIONES.map((a) => (
                              <Button
                                key={a}
                                size="sm"
                                variant={s.audiencia === a ? 'primary' : 'outline'}
                                disabled={enVuelo.has(s.slug)}
                                onClick={() => guardar([{ slugs: [s.slug], audiencia: a }])}
                              >
                                {ETIQUETA[a]}
                              </Button>
                            ))}
                          </div>
                        </div>
                      ))}
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

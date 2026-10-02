'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Checkbox } from '@pow/ui/components/ui/checkbox';
import { AUDIENCIAS, agruparPorSeccion, type AyudaContenido } from '@/lib/ayudaContenidos';
import { nombreDeIconoDe, nombreDeIconoDeTema } from '@/components/ayuda/iconos';
import { IconoDeAyuda } from '@/components/ayuda/IconoDeAyuda';

/** El ícono con que se ve en el portal, para que no sea una sorpresa al publicar. */
function iconoDeFila(c: AyudaContenido) {
  const conTexto = c.cuerpo_html.replace(/<[^>]+>/g, '').trim().length > 0;
  return nombreDeIconoDe({ ...c, tipo: conTexto ? 'contenido' : 'link', link: c.link_url });
}

/**
 * Los contenidos de Ayuda, agrupados como los ve el portal.
 *
 * Publicar se hace desde acá con un tilde: es lo que más se toca, y obligar a
 * entrar al editor para prender o apagar uno es un paso de más.
 */
export function ListaDeContenidos({ inicial }: { inicial: AyudaContenido[] }) {
  const [contenidos, setContenidos] = useState(inicial);
  const [guardando, setGuardando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const publicar = async (c: AyudaContenido, publicado: boolean) => {
    setGuardando(c.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/ayuda-contenidos/${c.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicado }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'No se pudo guardar.');
      setContenidos((prev) => prev.map((x) => (x.id === c.id ? data.contenido : x)));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(null);
    }
  };

  if (contenidos.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--border)] bg-white px-6 py-12 text-center">
        <p className="text-sm font-medium text-foreground">Todavía no hay contenidos</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Lo que cargues acá aparece en la Ayuda del portal, ordenado por temas, junto a los manuales.
        </p>
        <Link
          href="/admin/configuracion/ayuda/nuevo"
          className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Cargar el primero
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && <div className="rounded-lg bg-danger-subtle p-3 text-sm text-[var(--red-600)]">{error}</div>}
      {agruparPorSeccion(contenidos).map(({ seccion, items }) => {
        return (
          <section key={seccion} className="rounded-xl border border-[var(--border)] bg-white shadow-sm">
            <h2 className="flex items-center gap-2 border-b border-[var(--border)] px-6 py-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              <IconoDeAyuda nombre={nombreDeIconoDeTema({ nombre: seccion })} className="h-4 w-4" aria-hidden />
              {seccion}
            </h2>
            <ul className="divide-y divide-[var(--border)]">
              {items.map((c) => {
                return (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-secondary text-secondary-foreground">
                      <IconoDeAyuda nombre={iconoDeFila(c)} className="h-4 w-4" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/admin/configuracion/ayuda/${c.id}`}
                          className="font-medium text-foreground hover:text-[var(--brand-strong)]"
                        >
                          {c.titulo}
                        </Link>
                        {c.audiencia !== 'todos' && (
                          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                            {AUDIENCIAS[c.audiencia]}
                          </span>
                        )}
                        {!c.publicado && (
                          <span className="rounded-full bg-warning-subtle px-2 py-0.5 text-xs font-medium text-[var(--amber-600)]">
                            Borrador
                          </span>
                        )}
                      </div>
                      {c.resumen && <p className="mt-0.5 truncate text-sm text-muted-foreground">{c.resumen}</p>}
                    </div>
                    <div className="flex items-center gap-5">
                      <label className="flex cursor-pointer items-center gap-2 text-sm text-secondary-foreground">
                        <Checkbox
                          aria-label={`Publicar ${c.titulo}`}
                          checked={c.publicado}
                          disabled={guardando === c.id}
                          onCheckedChange={(v) => publicar(c, v === true)}
                        />
                        Publicado
                      </label>
                      <Link
                        href={`/admin/configuracion/ayuda/${c.id}`}
                        className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-medium text-secondary-foreground transition-colors hover:bg-muted"
                      >
                        Editar
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

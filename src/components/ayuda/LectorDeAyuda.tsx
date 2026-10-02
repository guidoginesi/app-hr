'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, ExternalLink, Link2, X } from 'lucide-react';
import { Sheet, SheetClose, SheetContent } from '@pow/ui/components/ui/sheet';
import { Button, buttonVariants } from '@pow/ui/components/ui/button';
import { tipoDeLink, type ContenidoDeAyuda, type TemaDeAyuda } from '@/lib/ayudaContenidos';
import { formatDateLocal } from '@/lib/dateUtils';
import { CuerpoDeAyuda } from './CuerpoDeAyuda';
import { nombreDeIconoDeItem, nombreDeIconoDeTema } from './iconos';
import { IconoDeAyuda } from './IconoDeAyuda';

export type Lectura = { tema: TemaDeAyuda; item: ContenidoDeAyuda };

/**
 * Un contenido de Ayuda en el panel lateral, como los mensajes en
 * Comunicaciones: se lee sin perder el índice ni la búsqueda.
 *
 * Al pie, lo que se hace con él: abrir el formulario o el documento si tiene
 * uno, y copiar el link a su página para mandárselo a alguien. Al final del
 * texto, el siguiente del mismo tema, para leer un tema de corrido.
 */
export function LectorDeAyuda({
  abierto,
  lectura,
  onCerrar,
  onAbrir,
}: {
  abierto: boolean;
  /** Queda puesta al cerrar, para que el panel no se vacíe mientras sale. */
  lectura: Lectura | null;
  onCerrar: () => void;
  onAbrir: (tema: TemaDeAyuda, item: ContenidoDeAyuda) => void;
}) {
  const cuerpo = useRef<HTMLDivElement>(null);
  const pie = useRef<HTMLElement>(null);
  // Atado al contenido: al pasar al siguiente, el "Link copiado" del anterior no lo sigue.
  const [copiado, setCopiado] = useState<{ id: string; ok: boolean } | null>(null);
  const itemId = lectura?.item.id;

  // Al pasar al siguiente se lee desde arriba, no desde donde quedó el anterior.
  useEffect(() => {
    cuerpo.current?.scrollTo({ top: 0 });
  }, [itemId]);

  useEffect(() => {
    if (!copiado) return;
    const t = setTimeout(() => setCopiado(null), 2000);
    return () => clearTimeout(t);
  }, [copiado]);

  if (!lectura) return null;
  const { tema, item } = lectura;
  const legibles = tema.items.filter((i): i is ContenidoDeAyuda => i.tipo === 'contenido');
  const siguiente = legibles[legibles.findIndex((i) => i.id === item.id) + 1] ?? null;
  const link = item.link ? tipoDeLink(item.link) : null;
  const copia = copiado?.id === item.id ? (copiado.ok ? 'si' : 'no') : null;

  const copiarLink = async () => {
    const url = new URL(`/portal/ayuda/recursos/${item.slug}`, window.location.origin).toString();
    try {
      await navigator.clipboard.writeText(url);
      setCopiado({ id: item.id, ok: true });
    } catch {
      // Hay navegadores que no le dejan escribir el portapapeles a la página;
      // el camino viejo, copiar lo seleccionado, suele andar igual. El campo va
      // dentro del panel: afuera, el foco del panel se lo saca y no copia nada.
      const campo = document.createElement('textarea');
      campo.value = url;
      campo.setAttribute('readonly', '');
      campo.style.position = 'fixed';
      campo.style.opacity = '0';
      (pie.current ?? document.body).appendChild(campo);
      campo.select();
      let ok = false;
      try {
        ok = document.execCommand('copy');
      } catch {
        // Sin portapapeles de ningún tipo: se avisa abajo.
      }
      campo.remove();
      setCopiado({ id: item.id, ok });
    }
  };

  return (
    <Sheet open={abierto} onOpenChange={(o) => !o && onCerrar()}>
      <SheetContent side="right" flush title={item.titulo} className="sm:max-w-xl">
        <header className="flex shrink-0 items-start gap-4 border-b border-[var(--border)] px-6 py-5">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-accent">
            <IconoDeAyuda nombre={nombreDeIconoDeItem(item)} className="h-6 w-6 text-brand" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <IconoDeAyuda nombre={nombreDeIconoDeTema(tema)} className="h-3.5 w-3.5" aria-hidden />
              {tema.nombre}
            </p>
            <h2 className="mt-1 text-lg font-semibold leading-snug text-foreground">{item.titulo}</h2>
            {item.resumen && <p className="mt-1 text-sm text-muted-foreground">{item.resumen}</p>}
          </div>
          <SheetClose
            aria-label="Cerrar"
            className="-mr-1.5 -mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-[var(--radius)] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-5 w-5" />
          </SheetClose>
        </header>

        <div ref={cuerpo} className="flex-1 overflow-y-auto px-6 py-6">
          <div key={item.id} className="motion-safe:animate-[pow-fade-in_180ms_var(--ease-out)]">
            <CuerpoDeAyuda html={item.html} />
          </div>

          {siguiente && (
            <button
              type="button"
              onClick={() => onAbrir(tema, siguiente)}
              className="group mt-10 flex w-full items-center justify-between gap-4 rounded-xl border border-[var(--border)] px-4 py-3 text-left transition-colors hover:border-[var(--gray-300)] hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="min-w-0">
                <span className="block text-xs text-muted-foreground">Siguiente en {tema.nombre}</span>
                <span className="mt-0.5 block truncate text-sm font-semibold text-foreground group-hover:text-[var(--brand-strong)]">
                  {siguiente.titulo}
                </span>
              </span>
              <ArrowRight
                className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </button>
          )}
        </div>

        <footer ref={pie} className="flex shrink-0 flex-wrap items-center gap-2 border-t border-[var(--border)] px-6 py-4">
          {item.link && link && (
            <a href={item.link} target="_blank" rel="noopener noreferrer" className={buttonVariants({ size: 'lg' })}>
              {link.abrir}
              <ExternalLink className="ml-2 h-4 w-4" aria-hidden />
            </a>
          )}
          {/* Ancho mínimo: los tres textos no miden lo mismo y el botón no tiene que saltar. */}
          <Button variant="outline" size="lg" onClick={copiarLink} className="min-w-[160px]" aria-live="polite">
            {copia === 'si' ? (
              <>
                <Check className="mr-2 h-4 w-4 text-[var(--green-700)]" aria-hidden />
                Link copiado
              </>
            ) : copia === 'no' ? (
              <>
                <X className="mr-2 h-4 w-4 text-[var(--red-600)]" aria-hidden />
                No se pudo copiar
              </>
            ) : (
              <>
                <Link2 className="mr-2 h-4 w-4" aria-hidden />
                Copiar link
              </>
            )}
          </Button>
          <span className="ml-auto text-xs text-muted-foreground">
            Actualizado el {formatDateLocal(item.actualizado.slice(0, 10))}
          </span>
        </footer>
      </SheetContent>
    </Sheet>
  );
}

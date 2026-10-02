'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, ChevronRight, ExternalLink, MessagesSquare, Search, SearchX, X } from 'lucide-react';
import { Button, buttonVariants } from '@pow/ui/components/ui/button';
import { buscar, palabrasDe, rangosDe, type Resultado } from '@/lib/ayudaBusqueda';
import { tipoDeLink, type ContenidoDeAyuda, type ItemDeAyuda, type TemaDeAyuda } from '@/lib/ayudaContenidos';
import { nombreDeIconoDeItem, nombreDeIconoDeTema } from './iconos';
import { IconoDeAyuda } from './IconoDeAyuda';
import { LectorDeAyuda, type Lectura } from './LectorDeAyuda';

function clases(...lista: Array<string | false | null | undefined>): string {
  return lista.filter(Boolean).join(' ');
}

type AlAbrir = (tema: TemaDeAyuda, item: ContenidoDeAyuda) => void;

/**
 * La Ayuda del portal: un buscador, los temas a la izquierda y lo de cada tema
 * a la derecha. Reemplaza a la página de Recursos Humanos del Pow Site.
 *
 * Lo que se lee abre en un panel lateral; los manuales, que son pantallas
 * largas con su propio índice, siguen abriendo su página.
 */
export function CentroDeAyuda({ temas }: { temas: TemaDeAyuda[] }) {
  const params = useSearchParams();
  const [temaId, setTemaId] = useState(() => {
    const pedido = params.get('tema');
    return pedido && temas.some((t) => t.id === pedido) ? pedido : (temas[0]?.id ?? '');
  });
  const [consulta, setConsulta] = useState('');
  const [lectura, setLectura] = useState<Lectura | null>(null);
  const [lectorAbierto, setLectorAbierto] = useState(false);
  const buscador = useRef<HTMLInputElement>(null);

  const buscando = consulta.trim().length > 0;
  const palabras = useMemo(() => palabrasDe(consulta), [consulta]);
  const resultados = useMemo(() => (buscando ? buscar(temas, consulta) : []), [temas, consulta, buscando]);
  const porTema = useMemo(() => {
    const cuenta = new Map<string, number>();
    for (const r of resultados) cuenta.set(r.tema.id, (cuenta.get(r.tema.id) ?? 0) + 1);
    return cuenta;
  }, [resultados]);

  // "/" lleva al buscador desde cualquier parte de la página.
  useEffect(() => {
    const alApretar = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey || lectorAbierto) return;
      const destino = e.target as HTMLElement | null;
      if (destino?.closest('input, textarea, select, [contenteditable="true"]')) return;
      e.preventDefault();
      buscador.current?.focus();
    };
    window.addEventListener('keydown', alApretar);
    return () => window.removeEventListener('keydown', alApretar);
  }, [lectorAbierto]);

  const elegirTema = (id: string) => {
    setTemaId(id);
    setConsulta('');
    // En la URL, para que volver desde un manual caiga en el mismo tema.
    window.history.replaceState(null, '', `${window.location.pathname}?tema=${encodeURIComponent(id)}`);
  };

  const abrir: AlAbrir = (tema, item) => {
    setLectura({ tema, item });
    setLectorAbierto(true);
  };

  const tema = temas.find((t) => t.id === temaId) ?? temas[0];
  if (!tema) return null;
  // Sin contenidos de People queda un solo tema, y una columna de temas con uno solo no orienta nada.
  const conTemas = temas.length > 1;

  return (
    <div className="space-y-6">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          ref={buscador}
          type="search"
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setConsulta('');
          }}
          placeholder="Buscá un beneficio, una política o cómo hacer algo en el portal"
          aria-label="Buscar en la Ayuda"
          className="h-11 w-full rounded-xl border border-[var(--border)] bg-white pl-11 pr-14 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground hover:border-[var(--gray-300)] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring [&::-webkit-search-cancel-button]:appearance-none"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          {consulta ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Borrar la búsqueda"
              onClick={() => {
                setConsulta('');
                buscador.current?.focus();
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          ) : (
            <kbd
              className="mr-2 hidden rounded border border-[var(--border)] bg-muted px-1.5 py-0.5 font-sans text-xs text-muted-foreground sm:inline-block"
              title="Apretá / para buscar"
            >
              /
            </kbd>
          )}
        </div>
      </div>

      <div className={clases('grid gap-6', conTemas && 'lg:grid-cols-[248px_minmax(0,1fr)]')}>
        {conTemas && (
          <ListaDeTemas
            temas={temas}
            elegido={buscando ? null : tema.id}
            conteos={buscando ? porTema : null}
            onElegir={elegirTema}
          />
        )}
        <div className="min-w-0">
          {buscando ? (
            <Resultados consulta={consulta.trim()} resultados={resultados} palabras={palabras} onAbrir={abrir} />
          ) : (
            // La clave hace que cambiar de tema vuelva a montar la tarjeta, y con eso la entrada suave.
            <Tema key={tema.id} tema={tema} onAbrir={abrir} />
          )}
          <ContactoConPeople className={clases('mt-6', conTemas && 'lg:hidden')} />
        </div>
      </div>

      <LectorDeAyuda
        abierto={lectorAbierto}
        lectura={lectura}
        onCerrar={() => setLectorAbierto(false)}
        onAbrir={abrir}
      />
    </div>
  );
}

/**
 * Los temas, con el mismo lenguaje que el menú del portal: el elegido en
 * naranja claro. En pantallas angostas se vuelven una fila de chips.
 *
 * Mientras se busca, cada tema muestra cuántos resultados tiene, y los que no
 * tienen ninguno se apagan.
 */
function ListaDeTemas({
  temas,
  elegido,
  conteos,
  onElegir,
}: {
  temas: TemaDeAyuda[];
  elegido: string | null;
  conteos: Map<string, number> | null;
  onElegir: (id: string) => void;
}) {
  return (
    <nav aria-label="Temas de la Ayuda" className="min-w-0 lg:sticky lg:top-6 lg:self-start">
      <div className="lg:rounded-xl lg:border lg:border-[var(--border)] lg:bg-white lg:p-2 lg:shadow-sm">
        <p className="hidden px-2.5 pb-1.5 pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:block">
          Temas
        </p>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:px-0 lg:pb-0">
          {temas.map((t) => {
            const activo = t.id === elegido;
            const cantidad = conteos ? (conteos.get(t.id) ?? 0) : t.items.length;
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={activo}
                onClick={() => onElegir(t.id)}
                className={clases(
                  'flex shrink-0 items-center gap-2.5 rounded-[var(--radius)] border px-3 py-2 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:border-transparent lg:px-2.5',
                  activo
                    ? 'border-[var(--brand)] bg-accent text-accent-foreground'
                    : 'border-[var(--border)] bg-white text-muted-foreground hover:bg-secondary hover:text-foreground lg:bg-transparent lg:hover:bg-secondary',
                  conteos && cantidad === 0 && 'opacity-50',
                )}
              >
                <IconoDeAyuda
                  nombre={nombreDeIconoDeTema(t)}
                  className={clases('h-4 w-4 shrink-0', activo && 'text-brand')}
                  aria-hidden
                />
                <span className="whitespace-nowrap lg:min-w-0 lg:flex-1 lg:truncate">{t.nombre}</span>
                <span className="ml-auto pl-1 text-xs nums-tabular">{cantidad}</span>
              </button>
            );
          })}
        </div>
      </div>
      <ContactoConPeople className="mt-4 hidden lg:block" />
    </nav>
  );
}

/** Un tema: su encabezado con el ícono y la lista de lo que tiene. */
function Tema({ tema, onAbrir }: { tema: TemaDeAyuda; onAbrir: AlAbrir }) {
  return (
    <section
      aria-labelledby={`tema-${tema.id}`}
      className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm motion-safe:animate-[pow-fade-in_180ms_var(--ease-out)]"
    >
      <header className="flex items-center gap-4 border-b border-[var(--border)] px-6 py-5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-accent">
          <IconoDeAyuda nombre={nombreDeIconoDeTema(tema)} className="h-5 w-5 text-brand" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 id={`tema-${tema.id}`} className="text-base font-semibold text-foreground">
            {tema.nombre}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{tema.descripcion}</p>
        </div>
      </header>
      <ul className="divide-y divide-[var(--border)]">
        {tema.items.map((item) => (
          <li key={item.id}>
            <Fila item={item} tema={tema} onAbrir={onAbrir} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function Resultados({
  consulta,
  resultados,
  palabras,
  onAbrir,
}: {
  consulta: string;
  resultados: Resultado[];
  palabras: string[];
  onAbrir: AlAbrir;
}) {
  if (resultados.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--border)] bg-white px-6 py-14 text-center" aria-live="polite">
        <SearchX className="mx-auto h-8 w-8 text-[var(--gray-300)]" aria-hidden />
        <p className="mt-3 text-sm font-semibold text-foreground">No encontramos nada para “{consulta}”</p>
        <p className="mt-1 text-sm text-muted-foreground">Probá con otra palabra, o preguntale directamente a People.</p>
        <Link href="/portal/consultas" className={clases(buttonVariants({ variant: 'outline' }), 'mt-5')}>
          Hacer una consulta
        </Link>
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm">
      <header className="border-b border-[var(--border)] px-6 py-4">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {resultados.length} {resultados.length === 1 ? 'resultado' : 'resultados'} para{' '}
          <span className="font-medium text-foreground">“{consulta}”</span>
        </p>
      </header>
      <ul className="divide-y divide-[var(--border)]">
        {resultados.map((r) => (
          <li key={`${r.tema.id}:${r.item.id}`}>
            <Fila item={r.item} tema={r.tema} palabras={palabras} fragmento={r.fragmento} conTema onAbrir={onAbrir} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Los tipos de link que vale la pena anunciar en la fila de un contenido que además tiene texto. */
const ANUNCIABLES = new Set(['Formulario', 'Documento', 'Planilla', 'Presentación']);

function Fila({
  item,
  tema,
  palabras = [],
  fragmento = null,
  conTema = false,
  onAbrir,
}: {
  item: ItemDeAyuda;
  tema: TemaDeAyuda;
  palabras?: string[];
  fragmento?: string | null;
  /** En los resultados de búsqueda, que mezclan temas. */
  conTema?: boolean;
  onAbrir: AlAbrir;
}) {
  const texto = (
    <>
      {/* Al pasar el mouse, el ícono toma el naranja del tema elegido: dice "esto se abre". */}
      <span className="grid h-9 w-9 shrink-0 place-items-center self-start rounded-lg bg-secondary text-secondary-foreground transition-colors group-hover:bg-accent group-hover:text-brand">
        <IconoDeAyuda nombre={nombreDeIconoDeItem(item)} className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        {conTema && (
          <p className="mb-0.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <IconoDeAyuda nombre={nombreDeIconoDeTema(tema)} className="h-3.5 w-3.5" aria-hidden />
            {tema.nombre}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="text-sm font-semibold text-foreground transition-colors group-hover:text-[var(--brand-strong)]">
            <Resaltado texto={item.titulo} palabras={palabras} />
          </h3>
          {item.tipo === 'manual' && item.nuevo && (
            <span className="inline-flex items-center rounded-full bg-success-subtle px-2 py-0.5 text-xs font-medium text-[var(--green-700)]">
              Nuevo
            </span>
          )}
        </div>
        {item.resumen && (
          <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
            <Resaltado texto={item.resumen} palabras={palabras} />
          </p>
        )}
        {fragmento && (
          <p className="mt-2 border-l-2 border-[var(--border)] pl-3 text-[13px] leading-relaxed text-muted-foreground">
            <Resaltado texto={fragmento} palabras={palabras} />
          </p>
        )}
      </div>
    </>
  );
  const clase =
    'group flex w-full items-center gap-4 px-6 py-4 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring';

  if (item.tipo === 'link') {
    return (
      <a href={item.href} target="_blank" rel="noopener noreferrer" className={clase}>
        {texto}
        <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors group-hover:text-foreground">
          {tipoDeLink(item.href).nombre}
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </span>
      </a>
    );
  }

  const flecha = (
    <ChevronRight
      className="h-4 w-4 shrink-0 text-[var(--gray-300)] transition-[color,transform] group-hover:translate-x-0.5 group-hover:text-muted-foreground"
      aria-hidden
    />
  );

  if (item.tipo === 'manual') {
    return (
      <Link href={item.href} className={clase}>
        {texto}
        {flecha}
      </Link>
    );
  }

  const adjunto = item.link ? tipoDeLink(item.link).nombre : null;
  return (
    <button type="button" onClick={() => onAbrir(tema, item)} className={clase}>
      {texto}
      {adjunto && (
        <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
          {ANUNCIABLES.has(adjunto) ? `Con ${adjunto.toLowerCase()}` : 'Con link'}
        </span>
      )}
      {flecha}
    </button>
  );
}

/** El texto con lo buscado resaltado, sin importar tildes ni mayúsculas. */
function Resaltado({ texto, palabras }: { texto: string; palabras: string[] }) {
  const rangos = rangosDe(texto, palabras);
  if (rangos.length === 0) return <>{texto}</>;
  const partes: ReactNode[] = [];
  let cursor = 0;
  rangos.forEach(([desde, hasta], i) => {
    if (desde > cursor) partes.push(texto.slice(cursor, desde));
    partes.push(
      <mark key={i} className="rounded-sm bg-[var(--orange-100)] px-px text-foreground">
        {texto.slice(desde, hasta)}
      </mark>,
    );
    cursor = hasta;
  });
  if (cursor < texto.length) partes.push(texto.slice(cursor));
  return <>{partes}</>;
}

function ContactoConPeople({ className }: { className?: string }) {
  return (
    <div className={clases('rounded-xl border border-[var(--border)] bg-white p-4 shadow-sm', className)}>
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-secondary">
        <MessagesSquare className="h-4 w-4 text-secondary-foreground" aria-hidden />
      </span>
      <p className="mt-3 text-sm font-semibold text-foreground">¿No encontrás lo que buscás?</p>
      <p className="mt-1 text-[13px] leading-snug text-muted-foreground">
        Escribile a People desde Consultas y te responden ahí mismo.
      </p>
      <Link
        href="/portal/consultas"
        className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[var(--brand-strong)] hover:underline"
      >
        Hacer una consulta
        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </Link>
    </div>
  );
}

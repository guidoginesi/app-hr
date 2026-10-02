'use client';

import { ICONOS } from '@/components/ayuda/iconos';
import { IconoDeAyuda } from '@/components/ayuda/IconoDeAyuda';
import { NOMBRES_DE_ICONOS, type NombreDeIcono } from '@/lib/ayudaContenidos';

/**
 * Los íconos a la vista, para elegir uno con un clic.
 *
 * El primero es "Automático": el que el portal sugiere según el título. Se
 * actualiza mientras se escribe, así que casi nunca hace falta tocar el resto.
 */
export function SelectorDeIcono({
  valor,
  sugerido,
  onCambiar,
}: {
  valor: NombreDeIcono | null;
  sugerido: NombreDeIcono;
  onCambiar: (valor: NombreDeIcono | null) => void;
}) {
  const casilla = (elegida: boolean) =>
    `grid h-9 place-items-center rounded-[var(--radius)] border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
      elegida
        ? 'border-[var(--brand)] bg-accent text-brand'
        : 'border-[var(--border)] bg-white text-secondary-foreground hover:border-[var(--gray-300)] hover:bg-muted'
    }`;

  return (
    <div role="group" aria-label="Ícono" className="flex flex-wrap gap-1.5">
      <button
        type="button"
        aria-pressed={valor === null}
        onClick={() => onCambiar(null)}
        title={`Según el título: ${ICONOS[sugerido].nombre}`}
        className={`${casilla(valor === null)} grid-flow-col gap-1.5 px-2.5`}
      >
        <IconoDeAyuda nombre={sugerido} className="h-4 w-4" aria-hidden />
        <span className="text-xs font-medium">Automático</span>
      </button>
      {NOMBRES_DE_ICONOS.map((nombre) => {
        const etiqueta = ICONOS[nombre].nombre;
        return (
          <button
            key={nombre}
            type="button"
            aria-pressed={valor === nombre}
            aria-label={etiqueta}
            title={etiqueta}
            onClick={() => onCambiar(nombre)}
            className={`${casilla(valor === nombre)} w-9`}
          >
            <IconoDeAyuda nombre={nombre} className="h-4 w-4" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}

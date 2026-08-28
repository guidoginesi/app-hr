import type { CountType } from '@/types/time-off';

/**
 * La unidad en la que se cuenta cada tipo de licencia.
 *
 * Existe porque el circuito de ajustes se escribió pensando sólo en días —el
 * formulario decía "Cantidad de días", el mail "3 día(s)", la tabla una columna
 * "Días"— y Trabajo Remoto se cuenta en semanas completas de lunes a domingo.
 * Sumarle 2 y que la pantalla dijera "2 días" no es un detalle de redacción:
 * quien lo lee entiende otra cosa de la que pasó.
 *
 * Módulo puro a propósito: lo usan las rutas y también los componentes cliente.
 */

export function esPorSemanas(countType: CountType | string | null | undefined): boolean {
  return countType === 'weeks';
}

/** "día" / "días" / "semana" / "semanas", según el tipo y la cantidad. */
export function unidadDeLicencia(countType: CountType | string | null | undefined, cantidad: number): string {
  const singular = esPorSemanas(countType) ? 'semana' : 'día';
  return Math.abs(cantidad) === 1 ? singular : `${singular}s`;
}

/** "2 semanas", "1 día", "1.5 días". */
export function conUnidad(countType: CountType | string | null | undefined, cantidad: number): string {
  return `${cantidad} ${unidadDeLicencia(countType, cantidad)}`;
}

/**
 * Los límites de un ajuste manual.
 *
 * No son política: son un tope contra el dedo pesado. Nadie le suma 30 semanas a
 * nadie, y 30 días —el tope viejo, que aplicaba a todo— habría dejado pasar
 * "30 semanas" sin chistar. Para semanas el tope es 8, del mismo orden que lo
 * que corresponde por año.
 *
 * Media semana no existe: el trabajo remoto se toma de lunes a domingo.
 */
export function limitesDeAjuste(countType: CountType | string | null | undefined): {
  min: number;
  max: number;
  paso: number;
  soloEnteros: boolean;
} {
  return esPorSemanas(countType)
    ? { min: 1, max: 8, paso: 1, soloEnteros: true }
    : { min: 0.5, max: 30, paso: 0.5, soloEnteros: false };
}

/**
 * Cuánto le queda a alguien de un saldo, y cuánto puede pedir para una fecha
 * cuando el pedido cae en el año siguiente.
 *
 * Los saldos se guardan por año calendario (una solicitud descuenta de la fila
 * del año de su fecha de inicio), pero vacaciones y Días Pow son de un período
 * que abre el 1/10: lo que se acredita en octubre se usa entre octubre y el
 * septiembre siguiente. Hasta que el traspaso de año (ver traspasoDeAnio.ts)
 * pasa lo que sobró a la fila nueva, los días del año en curso y los del
 * siguiente salen de la misma bolsa. Si no se los mira juntos, un pedido para
 * enero no le resta a lo que se ve en diciembre y los mismos días se pueden
 * pedir dos veces.
 *
 * Funciones puras: no leen la base.
 */

export type SaldoDeUnAnio = {
  entitled_days: number | string;
  carried_over: number | string;
  bonus_days?: number | string | null;
  used_days: number | string;
  pending_days: number | string;
};

/** Los tipos que arrastran de un año al otro. */
export const TIPOS_ACUMULABLES = ['vacation', 'pow_days'] as const;

export function esAcumulable(codigo: string): boolean {
  return (TIPOS_ACUMULABLES as readonly string[]).includes(codigo);
}

/** Derecho + arrastre + extra − usados − pendientes. Puede dar negativo. */
export function disponibleDe(s: SaldoDeUnAnio): number {
  return (
    Number(s.entitled_days) +
    Number(s.carried_over) +
    Number(s.bonus_days ?? 0) -
    Number(s.used_days) -
    Number(s.pending_days)
  );
}

/**
 * Lo que se puede pedir para una fecha del año `anioPedido`.
 *
 * - Vacaciones y Días Pow, para el año vigente o el que le sigue: la bolsa es
 *   lo que queda del vigente, menos lo que el siguiente ya consumió por encima
 *   de sus propios créditos. Para un pedido del siguiente se suma lo que ese
 *   año tenga de propio (por ejemplo días extra cargados). El año vigente es
 *   el actual, o el anterior si a esta persona todavía no le corrió el
 *   traspaso (la madrugada del 1/1, antes del cron).
 * - Lo demás (y cualquier otro año): lo que queda en la fila de ese año.
 *
 * Si falta una fila, `derechoDe(anio)` dice lo que le correspondería: antes se
 * salteaba el control y se podía pedir cualquier cantidad.
 */
export function disponibleParaPedido(p: {
  codigo: string;
  anioVigente: number;
  anioPedido: number;
  saldos: Partial<Record<number, SaldoDeUnAnio | null>>;
  derechoDe: (anio: number) => number;
}): number {
  const disp = (anio: number) => {
    const s = p.saldos[anio];
    return s ? disponibleDe(s) : p.derechoDe(anio);
  };

  const enLaBolsa = p.anioPedido === p.anioVigente || p.anioPedido === p.anioVigente + 1;
  if (!esAcumulable(p.codigo) || !enLaBolsa) return disp(p.anioPedido);

  const siguiente = p.saldos[p.anioVigente + 1];
  const propioDelSiguiente = siguiente ? disponibleDe(siguiente) : 0;
  const bolsa = disp(p.anioVigente) - Math.max(0, -propioDelSiguiente);

  return p.anioPedido === p.anioVigente ? bolsa : bolsa + Math.max(0, propioDelSiguiente);
}

/** Lo que pasa de un año al siguiente: lo que quedó, sin pendientes y nunca negativo. */
export function arrastreDe(s: SaldoDeUnAnio | null | undefined): number {
  return s ? Math.max(0, disponibleDe(s)) : 0;
}

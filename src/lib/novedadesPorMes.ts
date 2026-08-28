/**
 * Recorte de una licencia al mes que se está liquidando.
 *
 * Las novedades alimentan la liquidación, y una liquidación es de un mes. Una
 * licencia del 24/8 al 6/9 no son 14 días de agosto ni 14 de septiembre: son 8
 * de agosto y 6 de septiembre. Hasta ahora la pantalla mostraba la licencia
 * entera en los dos meses, así que quien liquidaba tenía que hacer la cuenta a
 * mano —o pagarla dos veces.
 *
 * Acá se recorta al mes y se recuenta la duración del pedazo. Módulo puro y sin
 * dependencias: es la parte que no puede estar mal, así que tiene que poder
 * probarse sola.
 */

/** Los días de un mes, en UTC para que no se corra por zona horaria. */
function ultimoDiaDelMes(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function aFecha(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`);
}

const MS_DIA = 86_400_000;

/** Días corridos entre dos fechas, contando las dos puntas. */
export function diasCorridos(desde: string, hasta: string): number {
  const d = aFecha(desde).getTime();
  const h = aFecha(hasta).getTime();
  if (h < d) return 0;
  return Math.round((h - d) / MS_DIA) + 1;
}

/**
 * Días hábiles entre dos fechas, contando las dos puntas.
 *
 * Lunes a viernes. Todavía no hay calendario de feriados en la app —igual que en
 * businessDays.ts— así que un feriado cuenta como hábil. Cuando exista, hay dos
 * lugares para tocar y este es uno.
 */
export function diasHabiles(desde: string, hasta: string): number {
  const fin = aFecha(hasta).getTime();
  let cursor = aFecha(desde).getTime();
  let count = 0;
  while (cursor <= fin) {
    const dia = new Date(cursor).getUTCDay();
    if (dia !== 0 && dia !== 6) count++;
    cursor += MS_DIA;
  }
  return count;
}

export type LicenciaARecortar = {
  start_date: string;
  end_date: string;
  days_requested: number;
  count_type: string | null;
};

export type TramoDelMes = {
  /** Inicio dentro del mes (YYYY-MM-DD). */
  desde: string;
  /** Fin dentro del mes (YYYY-MM-DD). */
  hasta: string;
  /** Cuánto corresponde a ESTE mes. */
  duracion: number;
  /** En qué se cuenta esa duración. */
  unidad: 'dias' | 'semanas';
  /** La licencia empezó antes de este mes. */
  vieneDelMesAnterior: boolean;
  /** La licencia sigue después de este mes. */
  sigueElMesSiguiente: boolean;
  /** True si la licencia entra entera en el mes: no hay nada que repartir. */
  completa: boolean;
};

/**
 * Recorta una licencia al mes pedido y recuenta su duración.
 *
 * La duración se recuenta con la misma regla del tipo: los que se cuentan en
 * días corridos, corridos; los de días hábiles, hábiles. Los que se cuentan en
 * semanas —trabajo remoto— se informan en semanas sólo si el tramo es la
 * licencia entera; si quedó partido al medio se informa en días, porque "media
 * semana" no le dice nada a quien liquida.
 *
 * Devuelve null si la licencia no toca el mes.
 */
export function recortarAlMes(
  licencia: LicenciaARecortar,
  year: number,
  month: number,
): TramoDelMes | null {
  const inicioDelMes = `${year}-${String(month).padStart(2, '0')}-01`;
  const finDelMes = `${year}-${String(month).padStart(2, '0')}-${String(ultimoDiaDelMes(year, month)).padStart(2, '0')}`;

  const inicio = licencia.start_date.slice(0, 10);
  const fin = licencia.end_date.slice(0, 10);

  // Sin superposición no hay tramo.
  if (fin < inicioDelMes || inicio > finDelMes) return null;

  const desde = inicio > inicioDelMes ? inicio : inicioDelMes;
  const hasta = fin < finDelMes ? fin : finDelMes;

  const vieneDelMesAnterior = inicio < inicioDelMes;
  const sigueElMesSiguiente = fin > finDelMes;
  const completa = !vieneDelMesAnterior && !sigueElMesSiguiente;

  if (licencia.count_type === 'weeks') {
    return completa
      ? { desde, hasta, duracion: licencia.days_requested, unidad: 'semanas', vieneDelMesAnterior, sigueElMesSiguiente, completa }
      : { desde, hasta, duracion: diasCorridos(desde, hasta), unidad: 'dias', vieneDelMesAnterior, sigueElMesSiguiente, completa };
  }

  // Si entra entera, se respeta lo que ya tenía calculado la solicitud: es el
  // número que vio y aprobó todo el mundo, y recalcularlo podría discrepar por
  // un feriado que la app todavía no conoce.
  if (completa) {
    return { desde, hasta, duracion: licencia.days_requested, unidad: 'dias', vieneDelMesAnterior, sigueElMesSiguiente, completa };
  }

  const duracion =
    licencia.count_type === 'business_days' ? diasHabiles(desde, hasta) : diasCorridos(desde, hasta);

  return { desde, hasta, duracion, unidad: 'dias', vieneDelMesAnterior, sigueElMesSiguiente, completa };
}

/** "8 días" / "1 día" / "2 semanas". */
export function duracionEnTexto(tramo: Pick<TramoDelMes, 'duracion' | 'unidad'>): string {
  const singular = tramo.unidad === 'semanas' ? 'semana' : 'día';
  return `${tramo.duracion} ${tramo.duracion === 1 ? singular : `${singular}s`}`;
}

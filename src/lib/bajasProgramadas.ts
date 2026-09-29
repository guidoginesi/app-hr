/**
 * Bajas con fecha futura.
 *
 * Registrar la baja de alguien cuyo último día todavía no llegó lo dejaba sin
 * portal desde ese mismo momento: el corte mira el estado del legajo, no la
 * fecha. Así que RRHH tenía que acordarse de cargarla el día exacto, y
 * mientras tanto la persona seguía trabajando sin poder pedir una licencia ni
 * ver sus recibos.
 *
 * Ahora se puede cargar antes. Hasta el día de la baja no cambia nada: el
 * legajo sigue activo y la persona no se entera. Ese día el cron la aplica —
 * estado, encuesta de salida y mail— exactamente como si se hubiera cargado a
 * mano.
 *
 * **Cómo se reconoce una baja programada:** el legajo tiene `termination_date`
 * pero su estado todavía no es `terminated`. No hace falta una columna nueva:
 * un legajo que no está desvinculado no tiene por qué tener fecha de baja, y de
 * hecho ninguno la tenía cuando esto se escribió.
 */

import type { getSupabaseServer } from '@/lib/supabaseServer';
import { invitarAEncuestaDeSalida, type Invitacion } from '@/lib/offboardingSurveyInvite';

/** El día de hoy en ISO corto, que es como se guardan las fechas de baja. */
export function hoyISO(): string {
  return new Date().toISOString().split('T')[0];
}

export type LegajoConBaja = {
  status?: string | null;
  termination_date?: string | null;
};

/** Tiene fecha de baja cargada pero todavía no está desvinculado. */
export function esBajaProgramada(e: LegajoConBaja): boolean {
  return e.status !== 'terminated' && !!e.termination_date;
}

/** La fecha ya llegó: hay que aplicarla. */
export function hayQueAplicarla(e: LegajoConBaja, hoy = hoyISO()): boolean {
  return esBajaProgramada(e) && (e.termination_date as string) <= hoy;
}

export type ResultadoDeAplicacion = {
  aplicadas: number;
  invitadas: number;
  fallidas: number;
  detalle: string[];
};

/**
 * Aplica las bajas programadas cuya fecha ya llegó.
 *
 * Hace lo mismo que registrar la baja a mano: pasa el legajo a desvinculado,
 * crea la encuesta si estaba habilitada y manda la invitación. Comparte el
 * módulo del mail con el camino manual a propósito: si fueran dos textos, se
 * irían separando.
 *
 * Nunca lanza. La corre el cron diario junto con todo lo demás, y que una baja
 * falle no tiene que voltear el resto de las automatizaciones.
 */
export async function aplicarBajasProgramadas(
  supabase: ReturnType<typeof getSupabaseServer>,
  hoy = hoyISO(),
): Promise<ResultadoDeAplicacion> {
  const resultado: ResultadoDeAplicacion = { aplicadas: 0, invitadas: 0, fallidas: 0, detalle: [] };

  const { data: pendientes, error } = await supabase
    .from('employees')
    .select('id, first_name, last_name, personal_email, work_email, status, termination_date, offboarding_enabled')
    .neq('status', 'terminated')
    .not('termination_date', 'is', null)
    .lte('termination_date', hoy);

  if (error) {
    resultado.detalle.push(`no se pudieron leer las bajas programadas: ${error.message}`);
    return resultado;
  }
  if (!pendientes?.length) return resultado;

  for (const e of pendientes) {
    const quien = `${e.first_name ?? ''} ${e.last_name ?? ''}`.trim();

    const { error: errorAlDarDeBaja } = await supabase
      .from('employees')
      .update({ status: 'terminated' })
      .eq('id', e.id);

    if (errorAlDarDeBaja) {
      resultado.fallidas++;
      resultado.detalle.push(`${quien}: ${errorAlDarDeBaja.message}`);
      continue;
    }
    resultado.aplicadas++;

    if (!e.offboarding_enabled) {
      resultado.detalle.push(`${quien}: baja aplicada, sin encuesta`);
      continue;
    }

    // Si ya contestó, no se toca ni se le escribe. Mismo cuidado que en el
    // camino manual: el upsert reemplaza la fila entera.
    const { data: yaContestada } = await supabase
      .from('offboarding_responses')
      .select('status')
      .eq('employee_id', e.id)
      .maybeSingle();

    if (yaContestada?.status === 'submitted') {
      resultado.detalle.push(`${quien}: baja aplicada, ya había contestado`);
      continue;
    }

    await supabase
      .from('offboarding_responses')
      .upsert({ employee_id: e.id, status: 'pending', responses: {} }, { onConflict: 'employee_id' });

    const invitacion: Invitacion = await invitarAEncuestaDeSalida({
      first_name: e.first_name,
      personal_email: e.personal_email,
      work_email: e.work_email,
      termination_date: e.termination_date,
    });

    if (invitacion.enviada) {
      resultado.invitadas++;
      resultado.detalle.push(`${quien}: baja aplicada, encuesta enviada a ${invitacion.a.join(' y ')}`);
    } else {
      resultado.detalle.push(`${quien}: baja aplicada, PERO el mail no salió (${invitacion.motivo})`);
    }
  }

  return resultado;
}

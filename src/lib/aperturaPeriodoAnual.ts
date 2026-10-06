/**
 * Apertura del período anual de vacaciones y Días Pow.
 *
 * El período abre el 1° de octubre (ver isAnnualLeavePeriodOpen). Hasta esa
 * fecha la fila del año tiene entitled_days en 0, y desde ahí le corresponden
 * los días por antigüedad. Pero esas filas se crean una sola vez —en general
 * mucho antes de octubre— y nada las volvía a mirar al abrirse el período: en
 * 2026 nadie recibió sus vacaciones ni sus Días Pow el 1/10.
 *
 * Esto completa entitled_days con calculateEntitledDays, la misma cuenta que
 * usa la app al crear un saldo. Corre todos los días desde el cron y es
 * idempotente:
 *
 * - Sólo completa filas que existen y están en 0. Si alguien ya cargó un
 *   valor, no lo pisa.
 * - Nunca toca carried_over ni bonus_days: ahí viven los arrastres y los
 *   ajustes manuales (por ejemplo los de febrero de 2026).
 * - No crea filas. A quien no tiene saldos del año se los arma completos la
 *   API de saldos del portal, y lo hace sólo si no tiene ninguna: si esto le
 *   creara una sola, el resto no se crearía nunca.
 * - Deja afuera a quien tiene una baja cargada (termination_date).
 *
 * Nunca lanza: si algo falla, lo deja en `errores` y el cron sigue.
 */

import type { getSupabaseServer } from '@/lib/supabaseServer';
import { argentinaDay } from '@/lib/leaveCertificates';
import { parseLocalDate } from '@/lib/dateUtils';
import { calculateEntitledDays, isAnnualLeavePeriodOpen } from '@/lib/leaveBalanceCalculation';

/** Los tipos que se acreditan al abrir el período. Trabajo remoto va por año calendario y estudio no depende de la fecha. */
export const TIPOS_DEL_PERIODO = ['vacation', 'pow_days'] as const;

export type Acreditacion = {
  employee_id: string;
  nombre: string;
  tipo: (typeof TIPOS_DEL_PERIODO)[number];
  dias: number;
};

export type ResultadoDeApertura = {
  anio: number;
  abierto: boolean;
  acreditaciones: Acreditacion[];
  errores: string[];
  /** id de cada tipo, para no volver a leerlos al aplicar. */
  idDeTipo?: Record<string, string>;
};

type Supabase = ReturnType<typeof getSupabaseServer>;

/**
 * Qué habría que acreditar hoy. No escribe nada: sirve para mirar antes de
 * aplicar, y es lo que usa `acreditarPeriodoAnual` por dentro.
 */
export async function planDeApertura(supabase: Supabase, hoy: string = argentinaDay()): Promise<ResultadoDeApertura> {
  const anio = Number(hoy.slice(0, 4));
  const fecha = parseLocalDate(hoy);
  const resultado: ResultadoDeApertura = { anio, abierto: isAnnualLeavePeriodOpen(anio, fecha), acreditaciones: [], errores: [] };
  if (!resultado.abierto) return resultado;

  const [empleados, tipos] = await Promise.all([
    supabase
      .from('employees')
      .select('id, first_name, last_name, hire_date, is_studying')
      .eq('status', 'active')
      .is('termination_date', null),
    supabase.from('leave_types').select('id, code').in('code', [...TIPOS_DEL_PERIODO]),
  ]);
  if (empleados.error || tipos.error) {
    resultado.errores.push(`no se pudieron leer empleados o tipos: ${(empleados.error ?? tipos.error)?.message}`);
    return resultado;
  }

  const idDeTipo = new Map((tipos.data ?? []).map((t) => [t.code as string, t.id as string]));
  resultado.idDeTipo = Object.fromEntries(idDeTipo);
  const { data: saldos, error } = await supabase
    .from('leave_balances')
    .select('employee_id, leave_type_id, entitled_days')
    .eq('year', anio)
    .in('leave_type_id', [...idDeTipo.values()]);
  if (error) {
    resultado.errores.push(`no se pudieron leer los saldos de ${anio}: ${error.message}`);
    return resultado;
  }
  const saldo = new Map((saldos ?? []).map((s) => [`${s.employee_id}:${s.leave_type_id}`, Number(s.entitled_days)]));

  for (const e of empleados.data ?? []) {
    for (const tipo of TIPOS_DEL_PERIODO) {
      const tipoId = idDeTipo.get(tipo);
      if (!tipoId) continue;
      const dias = calculateEntitledDays(tipo, e, anio, fecha);
      if (dias <= 0) continue;
      if (saldo.get(`${e.id}:${tipoId}`) === 0) {
        resultado.acreditaciones.push({
          employee_id: e.id,
          nombre: `${e.first_name ?? ''} ${e.last_name ?? ''}`.trim(),
          tipo,
          dias,
        });
      }
    }
  }
  return resultado;
}

/**
 * Aplica el plan del día. Lo llama el cron diario; sin nada pendiente, no
 * escribe. `excluir` deja afuera a personas puntuales (por ejemplo, alguien con
 * la fecha de ingreso en duda).
 */
export async function acreditarPeriodoAnual(
  supabase: Supabase,
  hoy: string = argentinaDay(),
  excluir: ReadonlySet<string> = new Set(),
): Promise<ResultadoDeApertura> {
  const plan = await planDeApertura(supabase, hoy);
  plan.acreditaciones = plan.acreditaciones.filter((a) => !excluir.has(a.employee_id));
  if (!plan.abierto || plan.acreditaciones.length === 0) return plan;

  const hechas: Acreditacion[] = [];
  for (const a of plan.acreditaciones) {
    const leave_type_id = plan.idDeTipo?.[a.tipo];
    if (!leave_type_id) continue;
    // El filtro en 0 hace que dos corridas a la vez, o un valor cargado a mano
    // entre el plan y acá, no se pisen.
    const { data, error } = await supabase
      .from('leave_balances')
      .update({ entitled_days: a.dias })
      .eq('employee_id', a.employee_id)
      .eq('leave_type_id', leave_type_id)
      .eq('year', plan.anio)
      .eq('entitled_days', 0)
      .select('employee_id');
    if (error) plan.errores.push(`${a.nombre} (${a.tipo}): ${error.message}`);
    else if (data && data.length > 0) hechas.push(a);
  }

  return { ...plan, acreditaciones: hechas };
}

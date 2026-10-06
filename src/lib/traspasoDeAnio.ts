/**
 * Traspaso de año de los saldos de licencias.
 *
 * Los saldos se guardan por año calendario, pero vacaciones y Días Pow son de
 * un período que abre el 1/10 y se usa hasta el septiembre siguiente. El 1/1
 * las pantallas pasan a leer la fila del año nuevo, y sin esto esa fila
 * arrancaba sin lo que había sobrado: los días seguían en la del año anterior,
 * donde ya nadie los mira. El arrastre a 2026 se hizo a mano; esto corre desde
 * 2027.
 *
 * Desde el primer cron del año, por persona:
 *
 * - Vacaciones y Días Pow: el carried_over del año nuevo pasa a ser su base
 *   (lo que la fila ya tenía antes del primer traspaso, casi siempre 0) más lo
 *   que quedó del año anterior, con los pendientes descontados y nunca
 *   negativo. Si la fila ya existía (porque alguien pidió días de enero antes
 *   de tiempo), lo usado se respeta.
 * - Todos los tipos: si a la persona le falta la fila del año, se crea con lo
 *   que le corresponde. Así nadie queda con un juego incompleto: la API de
 *   saldos del portal sólo los crea si no hay ninguno.
 *
 * La base de cada tipo queda en automation_log (una fila por persona y año),
 * escrita ANTES de tocar nada. Después todo se fija en valores absolutos
 * (base + arrastre), así que reintentar después de una falla a la mitad no
 * duplica nada. Los días siguientes se vuelve a calcular: si lo que quedó del
 * año anterior cambió —un pedido de diciembre rechazado en enero, una
 * licencia cancelada, días extra cargados—, el arrastre lo sigue y esos días
 * no se pierden en una fila que ya nadie mira. Por lo mismo, un ajuste manual
 * del año nuevo va en días extra (bonus_days), no en el arrastre.
 *
 * Nunca toca used_days, pending_days, bonus_days ni el entitled_days de filas
 * que ya tienen un valor. Entra quien está activo, incluida una baja
 * programada para este año. Nunca lanza: los errores vuelven en el resultado.
 */

import type { getSupabaseServer } from '@/lib/supabaseServer';
import { argentinaDay } from '@/lib/leaveCertificates';
import { parseLocalDate } from '@/lib/dateUtils';
import { calculateEntitledDays } from '@/lib/leaveBalanceCalculation';
import { arrastreDe, esAcumulable, type SaldoDeUnAnio } from '@/lib/saldoEntreAnios';

/** El arrastre a 2026 se hizo a mano (enero y febrero de 2026). */
export const PRIMER_TRASPASO_AUTOMATICO = 2027;
export const MARCA_DE_TRASPASO = 'traspaso_de_anio';

type Supabase = ReturnType<typeof getSupabaseServer>;

export type CambioDeTraspaso = {
  tipo: string;
  leave_type_id: string;
  /**
   * arrastre: carried_over de una fila existente pasa a `carried_over`.
   * crear: fila nueva. completar: entitled_days de 0 a lo que corresponde.
   */
  accion: 'arrastre' | 'crear' | 'completar';
  carried_over?: number;
  entitled_days?: number;
};

export type TraspasoDePersona = {
  employee_id: string;
  nombre: string;
  /** null si es el primer traspaso del año para esta persona. */
  marcaId: string | null;
  /** carried_over que cada fila tenía antes del primer traspaso. */
  bases: Record<string, number>;
  /** Lo que quedó del año anterior, por tipo. */
  arrastres: Record<string, number>;
  cambios: CambioDeTraspaso[];
};

export type ResultadoDeTraspaso = {
  anio: number;
  corresponde: boolean;
  personas: TraspasoDePersona[];
  errores: string[];
};

type Fila = SaldoDeUnAnio & { employee_id: string; leave_type_id: string; year: number };

/** Lee todas las filas de una consulta, de a 1000 (el tope de PostgREST). */
async function todas<T>(consulta: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const filas: T[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await consulta(desde, desde + 999);
    if (error) return { data: null, error };
    filas.push(...(data ?? []));
    if (!data || data.length < 1000) return { data: filas, error: null };
  }
}

/** Qué haría el traspaso hoy. No escribe nada. */
export async function planDeTraspaso(supabase: Supabase, hoy: string = argentinaDay()): Promise<ResultadoDeTraspaso> {
  const anio = Number(hoy.slice(0, 4));
  const resultado: ResultadoDeTraspaso = { anio, corresponde: anio >= PRIMER_TRASPASO_AUTOMATICO, personas: [], errores: [] };
  if (!resultado.corresponde) return resultado;

  const [empleados, tipos, marcas] = await Promise.all([
    supabase
      .from('employees')
      .select('id, first_name, last_name, hire_date, is_studying')
      .eq('status', 'active')
      .or(`termination_date.is.null,termination_date.gte.${anio}-01-01`),
    supabase.from('leave_types').select('id, code').eq('is_active', true),
    supabase.from('automation_log').select('id, employee_id, metadata').eq('template_key', MARCA_DE_TRASPASO).eq('triggered_year', anio),
  ]);
  if (empleados.error || tipos.error || marcas.error) {
    resultado.errores.push(`no se pudo leer: ${(empleados.error ?? tipos.error ?? marcas.error)?.message}`);
    return resultado;
  }

  const personas = empleados.data ?? [];
  if (personas.length === 0) return resultado;
  const marcaDe = new Map((marcas.data ?? []).map((m) => [m.employee_id as string, m]));
  const acumulables = (tipos.data ?? []).filter((t) => esAcumulable(t.code));

  const ids = personas.map((e) => e.id);
  const [anteriores, actuales] = await Promise.all([
    todas<Fila>((d, h) =>
      supabase
        .from('leave_balances')
        .select('employee_id, leave_type_id, year, entitled_days, carried_over, bonus_days, used_days, pending_days')
        .in('employee_id', ids)
        .in('leave_type_id', acumulables.map((t) => t.id))
        .eq('year', anio - 1)
        .order('employee_id')
        .order('leave_type_id')
        .range(d, h),
    ),
    todas<Fila>((d, h) =>
      supabase
        .from('leave_balances')
        .select('employee_id, leave_type_id, year, entitled_days, carried_over, bonus_days, used_days, pending_days')
        .in('employee_id', ids)
        .eq('year', anio)
        .order('employee_id')
        .order('leave_type_id')
        .range(d, h),
    ),
  ]);
  if (anteriores.error || actuales.error) {
    resultado.errores.push(`no se pudieron leer los saldos: ${(anteriores.error ?? actuales.error)?.message}`);
    return resultado;
  }
  const fila = new Map([...anteriores.data!, ...actuales.data!].map((s) => [`${s.employee_id}:${s.leave_type_id}:${s.year}`, s]));
  const fecha = parseLocalDate(hoy);

  for (const e of personas) {
    const marca = marcaDe.get(e.id);
    const guardado = (marca?.metadata ?? null) as { bases?: Record<string, number> } | null;
    const bases: Record<string, number> = guardado?.bases ?? {};
    const arrastres: Record<string, number> = {};
    const cambios: CambioDeTraspaso[] = [];

    for (const t of tipos.data ?? []) {
      const actual = fila.get(`${e.id}:${t.id}:${anio}`);

      if (esAcumulable(t.code)) {
        if (!(t.code in bases)) bases[t.code] = actual ? Number(actual.carried_over) : 0;
        arrastres[t.code] = arrastreDe(fila.get(`${e.id}:${t.id}:${anio - 1}`));
        const objetivo = bases[t.code] + arrastres[t.code];
        if (!actual) {
          cambios.push({
            tipo: t.code,
            leave_type_id: t.id,
            accion: 'crear',
            carried_over: objetivo,
            entitled_days: calculateEntitledDays(t.code, e, anio, fecha),
          });
        } else if (Number(actual.carried_over) !== objetivo) {
          cambios.push({ tipo: t.code, leave_type_id: t.id, accion: 'arrastre', carried_over: objetivo });
        }
      } else if (!marca) {
        // Los no acumulables sólo se arman el primer día: después cada flujo
        // (cumpleaños, estudio, el portal) cuida su fila.
        const derecho = calculateEntitledDays(t.code, e, anio, fecha);
        if (!actual) {
          cambios.push({ tipo: t.code, leave_type_id: t.id, accion: 'crear', carried_over: 0, entitled_days: derecho });
        } else if (Number(actual.entitled_days) === 0 && derecho > 0) {
          cambios.push({ tipo: t.code, leave_type_id: t.id, accion: 'completar', entitled_days: derecho });
        }
      }
    }

    if (!marca || cambios.length > 0) {
      resultado.personas.push({
        employee_id: e.id,
        nombre: `${e.first_name ?? ''} ${e.last_name ?? ''}`.trim(),
        marcaId: (marca?.id as string | undefined) ?? null,
        bases,
        arrastres,
        cambios,
      });
    }
  }
  return resultado;
}

/**
 * Aplica el traspaso. Lo llama el cron diario: el primer día del año hace el
 * traspaso de todos, y después sólo corrige a quien le cambió lo que quedó del
 * año anterior.
 */
export async function traspasarAnio(supabase: Supabase, hoy: string = argentinaDay()): Promise<ResultadoDeTraspaso> {
  const plan = await planDeTraspaso(supabase, hoy);
  if (!plan.corresponde || plan.personas.length === 0) return plan;

  const hechas: TraspasoDePersona[] = [];
  for (const p of plan.personas) {
    // La base se guarda antes de tocar nada: si algo falla a la mitad, el
    // reintento calcula los mismos valores absolutos y no duplica.
    let marcaId = p.marcaId;
    if (!marcaId) {
      const { data, error } = await supabase
        .from('automation_log')
        .insert({
          employee_id: p.employee_id,
          template_key: MARCA_DE_TRASPASO,
          triggered_year: plan.anio,
          metadata: { bases: p.bases, arrastres: {}, ultimo: null },
        })
        .select('id')
        .single();
      if (error || !data) {
        plan.errores.push(`${p.nombre}: no se pudo registrar el traspaso: ${error?.message}`);
        continue;
      }
      marcaId = data.id as string;
    }

    let ok = true;
    for (const c of p.cambios) {
      const donde = { employee_id: p.employee_id, leave_type_id: c.leave_type_id, year: plan.anio };
      let error: { message: string } | null = null;
      if (c.accion === 'arrastre') {
        ({ error } = await supabase.from('leave_balances').update({ carried_over: c.carried_over }).match(donde));
      } else if (c.accion === 'completar') {
        ({ error } = await supabase
          .from('leave_balances')
          .update({ entitled_days: c.entitled_days })
          .match(donde)
          .eq('entitled_days', 0));
      } else {
        ({ error } = await supabase.from('leave_balances').insert({
          ...donde,
          entitled_days: c.entitled_days ?? 0,
          carried_over: c.carried_over ?? 0,
          used_days: 0,
          pending_days: 0,
        }));
      }
      if (error) {
        ok = false;
        plan.errores.push(`${p.nombre} (${c.tipo}): ${error.message}`);
      }
    }
    if (!ok) continue;

    const { error } = await supabase
      .from('automation_log')
      .update({
        metadata: {
          bases: p.bases,
          arrastres: p.arrastres,
          ultimo: hoy,
          cambios: p.cambios.map(({ tipo, accion, carried_over, entitled_days }) => ({ tipo, accion, carried_over, entitled_days })),
        },
      })
      .eq('id', marcaId);
    if (error) plan.errores.push(`${p.nombre}: no se pudo actualizar el registro del traspaso: ${error.message}`);
    hechas.push(p);
  }
  return { ...plan, personas: hechas };
}

// Integración Adelantos ↔ Liquidación (Fase 3).
// - applyAdvancesToPeriod: al crear/actualizar un período MENSUAL, trae los
//   adelantos pendientes de ese mes y los aplica. Monotributo: descuento
//   computado en adelanto_sueldo (+ recálculo del total). Dependencia:
//   descuento informado (el recibo es PDF; se registra el vínculo y se muestra).
// - settlePeriodAdvances: al cerrar el período, marca esos adelantos saldados.

import type { SupabaseClient } from '@supabase/supabase-js';

type PeriodLite = { id: string; year: number; month: number; period_type?: string | null };

const GROSS_FIELDS = [
  'sueldo',
  'monotributo',
  'reintegro_internet',
  'reintegro_extraordinario',
  'plus_vacacional',
  'bonificacion_anual',
  'aguinaldo',
] as const;

/**
 * Aplica los adelantos pendientes del mes al período. Idempotente.
 * Devuelve cuántos adelantos quedaron vinculados.
 */
export async function applyAdvancesToPeriod(
  supabase: SupabaseClient,
  period: PeriodLite,
): Promise<{ applied: number }> {
  // Solo períodos mensuales (los adelantos se descuentan del sueldo del mes).
  if (period.period_type && period.period_type !== 'MONTHLY') return { applied: 0 };

  const { data: advances } = await supabase
    .from('salary_advances')
    .select('id, employee_id, amount')
    .in('status', ['approved', 'transferred'])
    .is('settled_at', null)
    .eq('discount_year', period.year)
    .eq('discount_month', period.month);

  if (!advances || advances.length === 0) return { applied: 0 };

  const { data: settlements } = await supabase
    .from('payroll_employee_settlements')
    .select('id, employee_id, contract_type_snapshot')
    .eq('period_id', period.id);

  const byEmp = new Map<string, { id: string; contract_type_snapshot: string }>();
  for (const s of settlements ?? []) byEmp.set(s.employee_id as string, s as any);

  // Sumar adelantos por empleado (por si hubiera más de uno)
  const sumByEmp = new Map<string, number>();
  const linkedIds: string[] = [];
  for (const a of advances) {
    if (!byEmp.has(a.employee_id as string)) continue; // empleado no está en el período
    sumByEmp.set(
      a.employee_id as string,
      (sumByEmp.get(a.employee_id as string) ?? 0) + Number(a.amount),
    );
    linkedIds.push(a.id as string);
  }

  // Aplicar descuento computado a monotributistas
  for (const [empId, total] of sumByEmp) {
    const s = byEmp.get(empId)!;
    if (s.contract_type_snapshot !== 'MONOTRIBUTO') continue; // dependencia: informado
    const { data: bd } = await supabase
      .from('payroll_monotributo_breakdown')
      .select(GROSS_FIELDS.join(','))
      .eq('settlement_id', s.id)
      .single();
    const gross = GROSS_FIELDS.reduce((acc, f) => acc + Number((bd as any)?.[f] ?? 0), 0);
    await supabase
      .from('payroll_monotributo_breakdown')
      .update({ adelanto_sueldo: total, total_a_facturar: gross - total })
      .eq('settlement_id', s.id);
  }

  if (linkedIds.length > 0) {
    await supabase.from('salary_advances').update({ applied_period_id: period.id }).in('id', linkedIds);
  }

  return { applied: linkedIds.length };
}

/**
 * Marca saldados los adelantos vinculados a un período (al cerrarlo).
 */
export async function settlePeriodAdvances(
  supabase: SupabaseClient,
  periodId: string,
): Promise<{ settled: number }> {
  const { data: advances } = await supabase
    .from('salary_advances')
    .select('id')
    .eq('applied_period_id', periodId)
    .in('status', ['approved', 'transferred']);

  if (!advances || advances.length === 0) return { settled: 0 };

  const ids = advances.map((a) => a.id as string);
  const nowIso = new Date().toISOString();

  await supabase
    .from('salary_advances')
    .update({ status: 'settled', settled_at: nowIso, balance_pending: 0, updated_at: nowIso })
    .in('id', ids);

  await supabase.from('salary_advance_events').insert(
    ids.map((id) => ({
      advance_id: id,
      event_type: 'settled',
      to_status: 'settled',
      note: 'Descontado en la liquidación',
    })),
  );

  return { settled: ids.length };
}

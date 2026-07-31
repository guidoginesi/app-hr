// Integración Capacitaciones ↔ Liquidación.
// Al registrar un pago (50% inicial o final), el reintegro en ARS se inyecta en
// el período de liquidación MENSUAL abierto: reusa "reintegro extraordinario"
// (SUMA al valor existente). Monotributo: computado (resta al total). Relación de
// dependencia: informado (el recibo es PDF).

import type { SupabaseClient } from '@supabase/supabase-js';

const GROSS_FIELDS = [
  'sueldo',
  'monotributo',
  'reintegro_internet',
  'reintegro_extraordinario',
  'plus_vacacional',
  'bonificacion_anual',
  'aguinaldo',
] as const;

export type ReintegroResult = {
  periodId: string | null;
  mode: 'computado' | 'informado' | 'no_period';
};

/**
 * Inyecta un reintegro (ARS) al período mensual abierto (DRAFT/IN_REVIEW) del
 * colaborador. Devuelve el período usado y el modo. Si no hay período abierto o
 * el colaborador no tiene settlement en él, devuelve no_period (el caller decide).
 */
export async function injectTrainingReintegro(
  supabase: SupabaseClient,
  employeeId: string,
  amountArs: number,
): Promise<ReintegroResult> {
  const { data: period } = await supabase
    .from('payroll_periods')
    .select('id')
    .eq('period_type', 'MONTHLY')
    .in('status', ['DRAFT', 'IN_REVIEW'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!period) return { periodId: null, mode: 'no_period' };

  const { data: s } = await supabase
    .from('payroll_employee_settlements')
    .select('id, contract_type_snapshot')
    .eq('period_id', period.id)
    .eq('employee_id', employeeId)
    .maybeSingle();
  if (!s) return { periodId: period.id, mode: 'no_period' };

  if (s.contract_type_snapshot === 'MONOTRIBUTO') {
    const { data: bd } = await supabase
      .from('payroll_monotributo_breakdown')
      .select([...GROSS_FIELDS, 'adelanto_sueldo'].join(','))
      .eq('settlement_id', s.id)
      .single();
    const currentExtra = Number((bd as any)?.reintegro_extraordinario ?? 0);
    const newExtra = currentExtra + amountArs;
    // recomputar total: bruto (con el nuevo extra) − adelanto
    let gross = 0;
    for (const f of GROSS_FIELDS) {
      gross += f === 'reintegro_extraordinario' ? newExtra : Number((bd as any)?.[f] ?? 0);
    }
    const total = gross - Number((bd as any)?.adelanto_sueldo ?? 0);
    await supabase
      .from('payroll_monotributo_breakdown')
      .update({ reintegro_extraordinario: newExtra, total_a_facturar: total })
      .eq('settlement_id', s.id);
    return { periodId: period.id, mode: 'computado' };
  }

  // Relación de dependencia: informado (el recibo es PDF, no se computa)
  return { periodId: period.id, mode: 'informado' };
}

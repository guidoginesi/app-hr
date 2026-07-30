// Motor de validación + helpers del módulo de Adelanto de Sueldos.
// Función pura reutilizable en el portal (validación en vivo) y en la API
// (re-validación server-side). El límite del 50% (regla 3) y la renuncia
// comunicada (regla 8) son manuales y no se evalúan acá.

import type {
  AdvanceEvaluation,
  AdvanceRuleResult,
  AdvanceClassification,
  SalaryAdvanceStatus,
} from '@/types/salaryAdvance';

// Estados que cuentan como "adelanto vigente" (regla 4)
export const ACTIVE_ADVANCE_STATUSES: SalaryAdvanceStatus[] = [
  'pending_hr',
  'pending_admin',
  'approved',
  'transferred',
];

// Cuenta para frecuencia (reglas 5/7): todo salvo rechazado/bloqueado
const countsForFrequency = (s: SalaryAdvanceStatus) => s !== 'rejected' && s !== 'blocked';

export type ExistingAdvanceLite = { status: SalaryAdvanceStatus; requested_at: string };

/** Meses completos entre dos fechas. */
function monthsBetween(from: Date, to: Date): number {
  return (
    (to.getFullYear() - from.getFullYear()) * 12 +
    (to.getMonth() - from.getMonth()) -
    (to.getDate() < from.getDate() ? 1 : 0)
  );
}

/**
 * Evalúa las 6 reglas automáticas + clasifica la solicitud.
 * - Falla de elegibilidad/timing (1, 2, 4) → excepción (pide motivo, avanza).
 * - Falla de límites/frecuencia (5, 6, 7) → extraordinaria (pide motivo; mismo flujo RRHH → Administración).
 * - Reglas 3 y 8: manuales (se muestran informativas).
 */
export function evaluateAdvanceRules(input: {
  hireDate: string | null;
  now: Date;
  existing: ExistingAdvanceLite[];
}): AdvanceEvaluation {
  const { hireDate, now, existing } = input;
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12
  const day = now.getDate();

  const seniorityOk = hireDate ? monthsBetween(new Date(hireDate), now) >= 6 : false;
  const beforeDeadlineOk = day <= 15;
  const noActiveOk = !existing.some((a) => ACTIVE_ADVANCE_STATUSES.includes(a.status));
  const countThisYear = existing.filter(
    (a) => countsForFrequency(a.status) && new Date(a.requested_at).getFullYear() === year,
  ).length;
  const underYearlyCapOk = countThisYear < 3;
  const notBonusMonthOk = month !== 6 && month !== 12;

  // Mes anterior al de la solicitud
  const prev = new Date(year, month - 2, 1);
  const prevY = prev.getFullYear();
  const prevM = prev.getMonth() + 1;
  const consecutive = existing.some((a) => {
    if (!countsForFrequency(a.status)) return false;
    const d = new Date(a.requested_at);
    return d.getFullYear() === prevY && d.getMonth() + 1 === prevM;
  });
  const notConsecutiveOk = !consecutive;

  const rules: AdvanceRuleResult[] = [
    { n: 1, label: 'Antigüedad ≥ 6 meses', mode: 'auto', severity: 'eligibility', ok: seniorityOk },
    { n: 2, label: 'Solicitud hasta el día 15', mode: 'auto', severity: 'eligibility', ok: beforeDeadlineOk },
    { n: 3, label: 'Monto ≤ 50% del neto', mode: 'manual', severity: 'limit', ok: null, detail: 'Lo valida Administración' },
    { n: 4, label: 'Sin adelanto vigente pendiente', mode: 'auto', severity: 'eligibility', ok: noActiveOk },
    { n: 5, label: 'Máx. 3 adelantos por año', mode: 'auto', severity: 'limit', ok: underYearlyCapOk },
    { n: 6, label: 'No en mes de aguinaldo (jun/dic)', mode: 'auto', severity: 'limit', ok: notBonusMonthOk },
    { n: 7, label: 'No consecutivo al anterior', mode: 'auto', severity: 'limit', ok: notConsecutiveOk },
    { n: 8, label: 'Sin renuncia comunicada', mode: 'manual', severity: 'block', ok: null, detail: 'Lo confirma RRHH' },
  ];

  const failedAuto = rules.filter((r) => r.mode === 'auto' && r.ok === false).map((r) => r.n);
  const failedEligibility = failedAuto.some((n) => [1, 2, 4].includes(n));
  const failedLimit = failedAuto.some((n) => [5, 6, 7].includes(n));

  let classification: AdvanceClassification = 'standard';
  if (failedLimit) classification = 'extraordinary';
  else if (failedEligibility) classification = 'exception';

  return { rules, classification, requiresReason: classification !== 'standard', failedAuto };
}

/** Mes de descuento por defecto = próximo mes calendario. */
export function defaultDiscountPeriod(now: Date): { year: number; month: number } {
  const d = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export const ADVANCE_STATUS_LABELS: Record<SalaryAdvanceStatus, string> = {
  pending_hr: 'Pendiente RRHH',
  pending_admin: 'Pendiente Administración',
  approved: 'Aprobado',
  transferred: 'Transferido',
  settled: 'Saldado',
  rejected: 'Rechazado',
  blocked: 'Bloqueado',
};

export const ADVANCE_TYPE_LABELS: Record<string, string> = {
  standard: 'Estándar',
  exception: 'Excepción',
  emergency: 'Emergencia',
};

export type PayrollPeriodType = 'MONTHLY' | 'SAC_1' | 'SAC_2';

export const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
] as const;

/** Opciones para crear nuevos períodos (SAC 1 ya no se usa). */
export const PAYROLL_PERIOD_TYPE_OPTIONS: {
  value: Exclude<PayrollPeriodType, 'SAC_1'>;
  label: string;
  description: string;
}[] = [
  {
    value: 'MONTHLY',
    label: 'Liquidación mensual',
    description: 'Sueldo habitual del mes',
  },
  {
    value: 'SAC_2',
    label: 'SAC 2',
    description: 'Sueldo Anual Complementario — 2do semestre (Jul–Dic)',
  },
];

export function resolvePeriodMonth(periodType: PayrollPeriodType, month?: number): number {
  if (periodType === 'SAC_1') return 6;
  if (periodType === 'SAC_2') return 12;
  return month ?? 1;
}

export function buildPeriodKey(year: number, periodType: PayrollPeriodType, month?: number): string {
  if (periodType === 'SAC_1') return `${year}-SAC1`;
  if (periodType === 'SAC_2') return `${year}-SAC2`;
  const m = resolvePeriodMonth('MONTHLY', month);
  return `${year}-${String(m).padStart(2, '0')}`;
}

export function formatPayrollPeriodLabel(
  year: number,
  month: number,
  periodType: PayrollPeriodType = 'MONTHLY'
): string {
  const monthName = MONTH_NAMES[month - 1] ?? String(month);
  if (periodType === 'SAC_1') return `SAC 1 — ${monthName} ${year}`;
  if (periodType === 'SAC_2') return `SAC 2 — ${monthName} ${year}`;
  return `${monthName} ${year}`;
}

export function formatPayrollPeriodLabelFromKey(period: {
  year: number;
  month: number;
  period_type?: PayrollPeriodType | null;
}): string {
  return formatPayrollPeriodLabel(
    period.year,
    period.month,
    period.period_type ?? 'MONTHLY'
  );
}

export function periodTypeBadge(periodType: PayrollPeriodType): string | null {
  if (periodType === 'SAC_1') return 'SAC 1';
  if (periodType === 'SAC_2') return 'SAC 2';
  return null;
}

/**
 * Shared leave balance calculation (LCT + reglas Pow).
 * Vacaciones y Pow: período anual desde el 1° de octubre.
 * Trabajo remoto: 8 semanas prorrateadas por días en el año calendario (disponibles desde el ingreso).
 */

export type LeaveBalanceEmployee = {
  hire_date: string | null;
  is_studying?: boolean | null;
};

function countBusinessDays(startDate: Date, endDate: Date): number {
  let count = 0;
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  while (current <= end) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}

export function calculateVacationDays(hireDate: Date, year: number): number {
  const startOfYear = new Date(year, 0, 1);
  const endOfYear = new Date(year, 11, 31);

  const seniorityMs = endOfYear.getTime() - hireDate.getTime();
  const seniorityYears = Math.floor(seniorityMs / (1000 * 60 * 60 * 24 * 365.25));

  let daysByScale: number;
  if (seniorityYears >= 20) daysByScale = 35;
  else if (seniorityYears >= 10) daysByScale = 28;
  else if (seniorityYears >= 5) daysByScale = 21;
  else daysByScale = 14;

  const totalBusinessDays = countBusinessDays(startOfYear, endOfYear);
  const workStartDate = hireDate > startOfYear ? hireDate : startOfYear;
  const businessDaysWorked = countBusinessDays(workStartDate, endOfYear);
  const halfBusinessDays = Math.floor(totalBusinessDays / 2);

  if (businessDaysWorked >= halfBusinessDays) return daysByScale;
  return Math.floor(businessDaysWorked / 20);
}

/** Período anual abierto desde el 1° de octubre (vacaciones, Pow y semanas remotas). */
export function isAnnualLeavePeriodOpen(year: number, today: Date = new Date()): boolean {
  const periodStart = new Date(year, 9, 1);
  periodStart.setHours(0, 0, 0, 0);
  return today >= periodStart;
}

export function calculateMonthsWorked(hireDate: Date, referenceDate: Date): number {
  const years = referenceDate.getFullYear() - hireDate.getFullYear();
  const months = referenceDate.getMonth() - hireDate.getMonth();
  const days = referenceDate.getDate() - hireDate.getDate();

  let totalMonths = years * 12 + months;
  if (days < 0) totalMonths--;
  return Math.max(0, totalMonths);
}

function daysInYear(year: number): number {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365;
}

/** 8 semanas anuales prorrateadas por días trabajados en el año calendario (desde ingreso o 1/1). */
export function calculateRemoteWorkWeeks(hireDate: Date, year: number): number {
  const startOfYear = new Date(year, 0, 1);
  startOfYear.setHours(0, 0, 0, 0);
  const endOfYear = new Date(year, 11, 31);
  endOfYear.setHours(0, 0, 0, 0);

  const hire = new Date(hireDate);
  hire.setHours(0, 0, 0, 0);

  if (hire > endOfYear) return 0;

  const workStart = hire > startOfYear ? hire : startOfYear;
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysWorked = Math.floor((endOfYear.getTime() - workStart.getTime()) / msPerDay) + 1;

  return Math.floor((8 * daysWorked) / daysInYear(year));
}

export function calculateEntitledDays(
  leaveTypeCode: string,
  employee: LeaveBalanceEmployee,
  year: number,
  today: Date = new Date()
): number {
  const hireDate = employee.hire_date ? new Date(employee.hire_date) : null;
  const endOfYear = new Date(year, 11, 31);

  if (!hireDate || hireDate > endOfYear) return 0;

  const periodOpen = isAnnualLeavePeriodOpen(year, today);
  const monthsWorked = calculateMonthsWorked(hireDate, endOfYear);

  switch (leaveTypeCode) {
    case 'vacation':
      return periodOpen ? calculateVacationDays(hireDate, year) : 0;

    case 'pow_days':
      return periodOpen && monthsWorked >= 6 ? 5 : 0;

    case 'study':
      return employee.is_studying ? 10 : 0;

    case 'remote_work':
      return calculateRemoteWorkWeeks(hireDate, year);

    // El día de cumpleaños lo acredita y lo vence el cron, no este cálculo: sólo
    // está disponible dentro de su ventana. Devolver 1 acá haría que el saldo
    // mostrara un día disponible todo el año que no se puede tomar.
    case 'birthday':
      return 0;

    default:
      return 0;
  }
}

export function buildLeaveBalanceRows(
  employeeId: string,
  employee: LeaveBalanceEmployee,
  leaveTypes: Array<{ id: string; code: string }>,
  year: number,
  today: Date = new Date()
) {
  return leaveTypes.map((leaveType) => ({
    employee_id: employeeId,
    leave_type_id: leaveType.id,
    year,
    entitled_days: calculateEntitledDays(leaveType.code, employee, year, today),
    used_days: 0,
    pending_days: 0,
    carried_over: 0,
  }));
}

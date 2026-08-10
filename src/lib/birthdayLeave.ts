// Día de cumpleaños: cuándo se puede tomar.
//
// El beneficio es 1 día por año. Lo particular es la VENTANA: va del día del
// cumpleaños hasta 7 días corridos después, y no de cualquier momento del año.
//
// Si el cumpleaños cae en un día en que la persona no trabaja —fin de semana, o
// está de licencia— la ventana no arranca ahí: se corre al próximo día hábil en
// que efectivamente esté trabajando. Sin eso, a quien cumple un sábado o está de
// vacaciones se le consumiría la ventana sin poder usarla.

import { isBusinessDay } from '@/lib/businessDays';

/** Días corridos de ventana desde que arranca. */
export const BIRTHDAY_WINDOW_DAYS = 7;
export const BIRTHDAY_LEAVE_CODE = 'birthday';

function toUtc(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** El cumpleaños de esa persona en un año dado (YYYY-MM-DD). */
export function birthdayInYear(birthDate: string, year: number): string {
  const [, m, d] = birthDate.split('-');
  // 29/02 en año no bisiesto cae al 28: Date lo normalizaría al 1/3, que ya es
  // otro mes y rompería el "cumple este mes".
  if (m === '02' && d === '29') {
    const bisiesto = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return `${year}-02-${bisiesto ? '29' : '28'}`;
  }
  return `${year}-${m}-${d}`;
}

export type BirthdayWindow = { start: string; end: string };

/**
 * Ventana para tomar el día.
 *
 * `busyDays` son fechas en las que la persona ya está ausente (licencia
 * aprobada): cuentan como no disponibles igual que un fin de semana.
 */
export function birthdayWindow(input: {
  birthDate: string;
  year: number;
  busyDays?: Set<string>;
}): BirthdayWindow {
  const busy = input.busyDays ?? new Set<string>();
  const d = toUtc(birthdayInYear(input.birthDate, input.year));

  // Tope de seguridad: sin esto, un set de ausencias mal armado colgaría el loop.
  for (let i = 0; i < 60; i++) {
    if (isBusinessDay(d) && !busy.has(iso(d))) break;
    d.setUTCDate(d.getUTCDate() + 1);
  }

  const start = iso(d);
  d.setUTCDate(d.getUTCDate() + BIRTHDAY_WINDOW_DAYS);
  return { start, end: iso(d) };
}

/** ¿La fecha pedida cae dentro de la ventana? */
export function isWithinBirthdayWindow(date: string, window: BirthdayWindow): boolean {
  return date >= window.start && date <= window.end;
}

/**
 * ¿Le corresponde el día ese año?
 *
 * No corresponde si la persona ingresó DESPUÉS de su cumpleaños de ese año: el
 * beneficio arranca en su primer cumpleaños dentro de Pow.
 */
export function qualifiesForBirthdayLeave(input: {
  birthDate: string | null;
  hireDate: string | null;
  year: number;
}): boolean {
  if (!input.birthDate || !input.hireDate) return false;
  return input.hireDate <= birthdayInYear(input.birthDate, input.year);
}

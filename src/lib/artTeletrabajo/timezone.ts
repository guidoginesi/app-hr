const AR_TIMEZONE = 'America/Argentina/Buenos_Aires';

/** Fecha YYYY-MM-DD en hora Argentina. */
export function getArgentinaDateString(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: AR_TIMEZONE }).format(date);
}

/** Suma días a una fecha YYYY-MM-DD. */
export function addDaysToDateString(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0));
  return utc.toISOString().slice(0, 10);
}

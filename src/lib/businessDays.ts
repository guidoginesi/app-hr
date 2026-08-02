// Días hábiles (lunes a viernes).
// NOTA: todavía no hay calendario de feriados en la app, así que un feriado
// cuenta como hábil. Cuando exista la tabla, este módulo es el único lugar a tocar.

const MS_DAY = 86_400_000;

export function isBusinessDay(d: Date): boolean {
  const day = d.getUTCDay();
  return day !== 0 && day !== 6;
}

/** Suma N días hábiles a una fecha. Si arranca en día no hábil, cuenta desde el próximo hábil. */
export function addBusinessDays(from: Date, days: number): Date {
  const d = new Date(from.getTime());
  let remaining = days;
  while (remaining > 0) {
    d.setTime(d.getTime() + MS_DAY);
    if (isBusinessDay(d)) remaining--;
  }
  return d;
}

/** Días hábiles transcurridos entre dos fechas. */
export function countBusinessDaysBetween(from: Date, to: Date): number {
  if (to <= from) return 0;
  let count = 0;
  const d = new Date(from.getTime());
  while (d < to) {
    d.setTime(d.getTime() + MS_DAY);
    if (d <= to && isBusinessDay(d)) count++;
  }
  return count;
}

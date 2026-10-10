/**
 * Cuentas de una licencia que valen igual en el navegador y en el servidor.
 *
 * Las usa el registro de licencias del admin (RRHH carga una licencia ya
 * tomada, o que no se pudo pedir desde el portal). Sin imports de servidor: el
 * formulario las usa para mostrar la duración antes de enviar.
 */

import { parseLocalDate } from '@/lib/dateUtils';

/**
 * Duración de una licencia según cómo se cuenta su tipo: semanas, días hábiles
 * (lunes a viernes; los feriados todavía cuentan, ver businessDays.ts) o días
 * corridos. Es la misma cuenta que el formulario del portal.
 */
export function duracionDeLicencia(countType: string, desde: string, hasta: string): number {
  const inicio = parseLocalDate(desde);
  const fin = parseLocalDate(hasta);
  if (fin < inicio) return 0;
  const corridos = Math.round((fin.getTime() - inicio.getTime()) / 86_400_000) + 1;

  if (countType === 'weeks') return Math.ceil(corridos / 7);
  if (countType === 'business_days') {
    let habiles = 0;
    for (const d = new Date(inicio); d <= fin; d.setDate(d.getDate() + 1)) {
      if (d.getDay() !== 0 && d.getDay() !== 6) habiles++;
    }
    return habiles;
  }
  return corridos;
}

/** YYYY-MM-DD de una fecha local, sin pasar por UTC. */
export function fechaIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Semana ISO (1-53) de una fecha, como la guarda remote_work_weeks. */
export function semanaIso(fecha: Date): number {
  const d = new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()));
  const dia = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dia);
  const inicioDelAnio = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - inicioDelAnio.getTime()) / 86_400_000 + 1) / 7);
}

// Reglas propias de la licencia por enfermedad.
//
// A diferencia del resto de las licencias, la de enfermedad:
//  - no pasa por aprobación (ni del líder ni de HR): el colaborador la reporta y
//    queda vigente. Al líder se le NOTIFICA, no se le pide aprobar.
//  - no consume cupo (es ilimitada).
//  - exige un certificado médico, que se sube DESPUÉS del registro porque la
//    persona reporta la ausencia el día que se enferma y el papel lo consigue
//    más tarde. El certificado es dato de salud: sólo lo ven HR y la propia
//    persona, nunca el líder.

import { addBusinessDays } from '@/lib/businessDays';

export const SICK_LEAVE_CODE = 'sick';

/** Días hábiles desde el inicio de la licencia para presentar el certificado. */
export const SICK_CERT_DEADLINE_BUSINESS_DAYS = 3;

export type SickCertStatus = 'presentado' | 'pendiente' | 'vencido';

/** Fecha (YYYY-MM-DD) en la que vence el plazo para presentar el certificado. */
export function sickCertDeadline(startDate: string): string {
  const [y, m, d] = startDate.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, d));
  return addBusinessDays(start, SICK_CERT_DEADLINE_BUSINESS_DAYS).toISOString().slice(0, 10);
}

/** El día como se lo vive en Argentina, no en UTC ni en la zona del navegador. */
export function argentinaDay(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/**
 * Estado del certificado de una licencia por enfermedad, derivado —no se
 * persiste un estado aparte que pueda quedar desincronizado—. `vencido` es
 * `pendiente` pasado el plazo: no invalida la licencia, la marca para
 * seguimiento de HR (el criterio es apoyo, no sanción).
 *
 * La comparación es por DÍA de calendario, no por timestamp: el día del
 * vencimiento cuenta entero. Comparando fechas con hora, a las 00:01 de ese día
 * ya figuraba vencido y se perdía la última jornada de plazo.
 */
export function sickCertStatus(input: {
  certificateUploadedAt: string | null;
  startDate: string;
  now?: Date;
}): SickCertStatus {
  if (input.certificateUploadedAt) return 'presentado';
  return argentinaDay(input.now) > sickCertDeadline(input.startDate) ? 'vencido' : 'pendiente';
}

export const SICK_CERT_STATUS_LABELS: Record<SickCertStatus, string> = {
  presentado: 'Certificado presentado',
  pendiente: 'Certificado pendiente',
  vencido: 'Certificado vencido',
};

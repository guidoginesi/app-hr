// Certificados adjuntos a una licencia (médico y de examen).
//
// Los dos tipos siguen el mismo circuito: la licencia se carga primero y el
// comprobante se sube después, dentro de un plazo. Se agrupan acá para que la
// regla viva en un solo lugar; lo único que cambia entre ellos es DESDE CUÁNDO
// se cuenta el plazo, y eso es una diferencia real del negocio:
//
//  · enfermedad → desde el INICIO. La persona avisa el día que falta y consigue
//    el papel en los días siguientes.
//  · estudio    → desde el FIN. El certificado acredita que rendiste, así que
//    recién existe después del examen; contarlo desde el inicio te dejaría
//    vencido antes de haberlo dado.

import { addBusinessDays } from '@/lib/businessDays';

export const SICK_LEAVE_CODE = 'sick';
export const STUDY_LEAVE_CODE = 'study';

type CertRule = {
  /** Desde qué fecha de la licencia se cuenta el plazo. */
  anchor: 'start' | 'end';
  businessDays: number;
  /** Cómo se llama el documento en la UI. */
  label: string;
};

export const LEAVE_CERT_RULES: Record<string, CertRule> = {
  [SICK_LEAVE_CODE]: { anchor: 'start', businessDays: 3, label: 'certificado médico' },
  [STUDY_LEAVE_CODE]: { anchor: 'end', businessDays: 3, label: 'certificado del examen' },
};

/** ¿Este tipo de licencia se acredita con un certificado adjunto? */
export function requiresLeaveCertificate(code: string | null | undefined): boolean {
  return Boolean(code && code in LEAVE_CERT_RULES);
}

export function leaveCertRule(code: string): CertRule | null {
  return LEAVE_CERT_RULES[code] ?? null;
}

export type LeaveCertStatus = 'presentado' | 'pendiente' | 'vencido';

/** El día como se lo vive en Argentina, no en UTC ni en la zona del navegador. */
export function argentinaDay(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Fecha (YYYY-MM-DD) en la que vence el plazo. `null` si el tipo no lleva certificado. */
export function leaveCertDeadline(input: {
  leaveTypeCode: string;
  startDate: string;
  endDate: string;
}): string | null {
  const rule = leaveCertRule(input.leaveTypeCode);
  if (!rule) return null;
  const base = rule.anchor === 'end' ? input.endDate : input.startDate;
  const [y, m, d] = base.split('-').map(Number);
  return addBusinessDays(new Date(Date.UTC(y, m - 1, d)), rule.businessDays).toISOString().slice(0, 10);
}

/**
 * Estado del certificado, derivado —no se persiste un estado aparte que pueda
 * quedar desincronizado—. `vencido` es `pendiente` pasado el plazo: no invalida
 * la licencia, la marca para seguimiento de HR (el criterio es apoyo, no sanción).
 *
 * La comparación es por DÍA de calendario, no por timestamp: el día del
 * vencimiento cuenta entero. Comparando fechas con hora, a las 00:01 de ese día
 * ya figuraba vencido y se perdía la última jornada de plazo.
 */
export function leaveCertStatus(input: {
  leaveTypeCode: string;
  certificateUploadedAt: string | null;
  startDate: string;
  endDate: string;
  now?: Date;
}): LeaveCertStatus | null {
  if (!requiresLeaveCertificate(input.leaveTypeCode)) return null;
  if (input.certificateUploadedAt) return 'presentado';
  const deadline = leaveCertDeadline(input)!;
  return argentinaDay(input.now) > deadline ? 'vencido' : 'pendiente';
}

export const LEAVE_CERT_STATUS_LABELS: Record<LeaveCertStatus, string> = {
  presentado: 'Certificado presentado',
  pendiente: 'Certificado pendiente',
  vencido: 'Certificado vencido',
};

import { addBusinessDays } from './businessDays';

export type InquiryCategory =
  | 'sueldo'
  | 'licencias'
  | 'beneficios'
  | 'adelantos'
  | 'capacitaciones'
  | 'certificados'
  | 'otros';

export type InquiryStatus = 'nueva' | 'en_curso' | 'esperando_colaborador' | 'resuelta' | 'cerrada';

export const INQUIRY_CATEGORIES: { value: InquiryCategory; label: string }[] = [
  { value: 'sueldo', label: 'Sueldo y liquidación' },
  { value: 'licencias', label: 'Licencias y vacaciones' },
  { value: 'beneficios', label: 'Beneficios' },
  { value: 'adelantos', label: 'Adelantos' },
  { value: 'capacitaciones', label: 'Capacitaciones' },
  { value: 'certificados', label: 'Certificados y constancias' },
  { value: 'otros', label: 'Otros' },
];

export const CATEGORY_LABELS: Record<InquiryCategory, string> = Object.fromEntries(
  INQUIRY_CATEGORIES.map((c) => [c.value, c.label]),
) as Record<InquiryCategory, string>;

/** Lo que ve el colaborador. "esperando_colaborador" se le muestra en segunda persona. */
export const STATUS_LABELS_EMPLOYEE: Record<InquiryStatus, string> = {
  nueva: 'Nueva',
  en_curso: 'En curso',
  esperando_colaborador: 'Esperando tu respuesta',
  resuelta: 'Resuelta',
  cerrada: 'Cerrada',
};

/** Lo que ve HR. */
export const STATUS_LABELS_HR: Record<InquiryStatus, string> = {
  nueva: 'Nueva',
  en_curso: 'En curso',
  esperando_colaborador: 'Esperando al colaborador',
  resuelta: 'Resuelta',
  cerrada: 'Cerrada',
};

/** Objetivo de PRIMERA respuesta de HR. Reloj corrido: no se pausa. */
export const FIRST_RESPONSE_BUSINESS_DAYS = 3;

/** Días hábiles en "resuelta" sin respuesta del colaborador antes del cierre automático. */
export const AUTO_CLOSE_BUSINESS_DAYS = 3;

/** Días corridos desde el cierre en los que se puede reabrir. */
export const REOPEN_WINDOW_DAYS = 7;

export function firstResponseDueAt(from: Date = new Date()): Date {
  return addBusinessDays(from, FIRST_RESPONSE_BUSINESS_DAYS);
}

export function canReopen(closedAt: string | null, status: InquiryStatus): boolean {
  if (status !== 'cerrada' || !closedAt) return false;
  const limit = new Date(closedAt).getTime() + REOPEN_WINDOW_DAYS * 86_400_000;
  return Date.now() <= limit;
}

export function isOpen(status: InquiryStatus): boolean {
  return status === 'nueva' || status === 'en_curso' || status === 'esperando_colaborador';
}

/** Fecha objetivo en positivo para mostrarle al colaborador. */
export function formatDueDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
}

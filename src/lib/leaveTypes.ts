import type { LeaveTypeCode } from '@/types/time-off';

/** Leave types that don't consume balance — notification-only (e.g. ART/seguro). */
export const UNLIMITED_LEAVE_TYPE_CODES: LeaveTypeCode[] = ['remote_work_trip', 'sick'];

/** Leave types that skip leader approval and go directly to HR. */
export const HR_ONLY_APPROVAL_LEAVE_TYPE_CODES: LeaveTypeCode[] = ['remote_work_trip'];

/**
 * Leave types that skip approval entirely: the employee registers them and they
 * are valid on the spot. The leader is NOTIFIED, not asked to approve. Sick
 * leave works this way. Unlike HR-only types, these don't sit in a pending
 * queue — there is no gate.
 */
export const SELF_REGISTERED_LEAVE_TYPE_CODES: LeaveTypeCode[] = ['sick'];

/**
 * Tipos que NO son una ausencia: la persona está trabajando, sólo que desde otro
 * lado. Es la misma idea que habilita superponer enfermedad con trabajo remoto,
 * y sirve para todo lo que pregunte "¿está o no está?" — por ejemplo, para
 * decidir desde qué día se puede tomar el día de cumpleaños.
 */
const TIPOS_QUE_NO_SON_AUSENCIA: LeaveTypeCode[] = ['remote_work', 'remote_work_trip'];

/** ¿Esta licencia deja a la persona fuera del trabajo? */
export function esAusencia(code: string | null | undefined): boolean {
  if (!code) return false;
  return !TIPOS_QUE_NO_SON_AUSENCIA.includes(code as LeaveTypeCode);
}

/**
 * Pares de licencias que SÍ pueden convivir en las mismas fechas.
 *
 * La regla general es que dos licencias no se superponen: si ya pediste algo
 * para esos días, pedir otra cosa encima casi siempre es un error de carga.
 *
 * La excepción es el trabajo remoto, porque no es una ausencia: dice desde
 * DÓNDE trabajás, no si estás. Enfermarte durante una semana remota es
 * perfectamente posible, y el parte de enfermedad hay que poder cargarlo igual
 * —no es algo que se pueda posponer hasta que termine la semana—.
 *
 * Se guarda como pares y no como "remoto se superpone con todo" a propósito: el
 * trabajo remoto tiene cupo anual, y dejar que cualquier licencia se le monte
 * encima haría que una semana remota se consuma aunque la persona no la haya
 * usado. Cada par se habilita cuando alguien decide que corresponde.
 */
const SUPERPOSICIONES_PERMITIDAS: [LeaveTypeCode, LeaveTypeCode][] = [
  ['pow_days', 'remote_work'],
  ['remote_work_trip', 'remote_work'],
  // Enfermarse no se planifica ni se pospone: se carga cuando pasa.
  ['sick', 'remote_work'],
];

/** ¿Estas dos licencias pueden compartir fechas? El orden no importa. */
export function puedenSuperponerse(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return SUPERPOSICIONES_PERMITIDAS.some(
    ([x, y]) => (a === x && b === y) || (a === y && b === x),
  );
}

export function isUnlimitedLeaveType(code: string): boolean {
  return UNLIMITED_LEAVE_TYPE_CODES.includes(code as LeaveTypeCode);
}

export function isHrOnlyApprovalType(code: string): boolean {
  return HR_ONLY_APPROVAL_LEAVE_TYPE_CODES.includes(code as LeaveTypeCode);
}

export function isSelfRegisteredType(code: string): boolean {
  return SELF_REGISTERED_LEAVE_TYPE_CODES.includes(code as LeaveTypeCode);
}

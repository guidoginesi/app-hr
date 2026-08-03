// Quién puede usar el módulo de reintegros, y qué papel juega cada persona
// frente a un reintegro concreto.
//
// El módulo NO es para todo el equipo: la habilitación es una lista explícita
// (expense_reimbursement_access). Se resuelve siempre en el server. Esconder el
// ítem del menú no es una barrera: sin este chequeo, cualquiera con el link
// entraría igual.

import { getSupabaseServer } from '@/lib/supabaseServer';
import type { ActorRole } from '@/lib/reimbursements';

/** ¿Este empleado está habilitado a cargar reintegros? */
export async function hasReimbursementAccess(employeeId: string): Promise<boolean> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('expense_reimbursement_access')
    .select('employee_id')
    .eq('employee_id', employeeId)
    .maybeSingle();

  // Un error de lectura no puede resolverse como "sí puede": es un permiso.
  if (error) {
    console.error('[reintegros] no se pudo verificar la habilitación:', error.message);
    return false;
  }
  return Boolean(data);
}

export type ReimbursementActor = {
  role: ActorRole | 'none';
  /** El employee_id de quien mira, si es empleado. */
  viewerEmployeeId: string | null;
};

/**
 * Resuelve el papel de quien mira frente a un reintegro puntual.
 *
 * El orden importa: primero los roles del panel, porque alguien de People que
 * además es empleado tiene que poder validar el reintegro de otra persona. Si se
 * evaluara primero "owner", su propio reintegro lo dejaría como employee y no
 * podría operar sobre los ajenos.
 */
export async function resolveActor(input: {
  reimbursementId: string;
  userId: string;
  isAdmin: boolean;
  isAdministracion: boolean;
  viewerEmployeeId: string | null;
}): Promise<ReimbursementActor & { ownerEmployeeId: string | null }> {
  const supabase = getSupabaseServer();
  const { data: r } = await supabase
    .from('expense_reimbursements')
    .select('employee_id, leader_id')
    .eq('id', input.reimbursementId)
    .maybeSingle();

  const ownerEmployeeId = (r?.employee_id as string) ?? null;

  if (input.isAdmin) return { role: 'admin', viewerEmployeeId: input.viewerEmployeeId, ownerEmployeeId };
  if (input.isAdministracion) {
    return { role: 'administracion', viewerEmployeeId: input.viewerEmployeeId, ownerEmployeeId };
  }

  if (!r || !input.viewerEmployeeId) {
    return { role: 'none', viewerEmployeeId: input.viewerEmployeeId, ownerEmployeeId };
  }

  // El líder se compara contra el leader_id CONGELADO en la fila, no contra el
  // manager_id actual: si la persona cambió de líder a mitad del circuito, el que
  // tiene que decidir es el que estaba cuando se pidió.
  if (r.leader_id === input.viewerEmployeeId) {
    return { role: 'leader', viewerEmployeeId: input.viewerEmployeeId, ownerEmployeeId };
  }
  if (r.employee_id === input.viewerEmployeeId) {
    return { role: 'employee', viewerEmployeeId: input.viewerEmployeeId, ownerEmployeeId };
  }

  return { role: 'none', viewerEmployeeId: input.viewerEmployeeId, ownerEmployeeId };
}

/**
 * Registra un evento de trazabilidad.
 *
 * `actor_name` se guarda denormalizado porque el join contra employees.user_id se
 * rompe cuando la persona se da de baja, y el timeline tiene que seguir diciendo
 * quién hizo qué.
 */
export async function logEvent(input: {
  reimbursementId: string;
  eventType: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  actorUserId: string | null;
  actorName: string | null;
  note?: string | null;
}) {
  const supabase = getSupabaseServer();
  const { error } = await supabase.from('expense_reimbursement_events').insert({
    reimbursement_id: input.reimbursementId,
    event_type: input.eventType,
    from_status: input.fromStatus ?? null,
    to_status: input.toStatus ?? null,
    actor_user_id: input.actorUserId,
    actor_name: input.actorName,
    note: input.note ?? null,
  });
  // El evento es trazabilidad, no parte de la transacción: si falla, se loguea
  // pero no se tira abajo un cambio de estado que ya se aplicó.
  if (error) console.error('[reintegros] no se pudo registrar el evento:', error.message);
}

/** Nombre legible de quien actúa, para el timeline. */
export async function actorDisplayName(userId: string, fallbackEmail?: string | null): Promise<string> {
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from('employees')
    .select('first_name, last_name')
    .eq('user_id', userId)
    .maybeSingle();

  const nombre = data ? `${data.first_name ?? ''} ${data.last_name ?? ''}`.trim() : '';
  return nombre || fallbackEmail || 'Sistema';
}

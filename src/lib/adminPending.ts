// Novedades por módulo para el bullet del sidebar del admin.
//
// Un módulo tiene novedades cuando entró algo que sigue pendiente DESPUÉS de la
// última vez que esa persona abrió el módulo. No es "todo lo que está abierto":
// con ese criterio Reclutamiento quedaría prendido para siempre por su backlog
// histórico, y un punto que nunca se apaga se vuelve invisible.

import { getSupabaseServer } from '@/lib/supabaseServer';
import type { AdminModule, PendingCounts } from '@/lib/adminModules';

/**
 * Primera vez que alguien entra al admin no tiene visitas registradas. Si se
 * tomara "desde el principio de los tiempos" se prenderían todos los puntos de
 * golpe; si se tomara "desde ahora", ninguno. Una semana es el punto medio:
 * muestra lo reciente sin volcarle encima el histórico.
 */
const VENTANA_SIN_VISITA_DIAS = 7;

export async function getPendingByModule(userId: string): Promise<PendingCounts> {
  const supabase = getSupabaseServer();

  const { data: visitas } = await supabase
    .from('admin_module_visits')
    .select('module_key, last_seen_at')
    .eq('user_id', userId);

  const porDefecto = new Date(
    Date.now() - VENTANA_SIN_VISITA_DIAS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const desde = (m: AdminModule) =>
    (visitas ?? []).find((v) => v.module_key === m)?.last_seen_at ?? porDefecto;

  /** Cuenta filas pendientes creadas después del corte. `head` no trae datos. */
  const contar = async (
    tabla: string,
    desdeISO: string,
    filtro: (q: any) => any,
  ): Promise<number> => {
    const q = filtro(
      supabase.from(tabla).select('id', { count: 'exact', head: true }).gt('created_at', desdeISO),
    );
    const { count, error } = await q;
    if (error) {
      console.error(`getPendingByModule(${tabla}):`, error.message);
      return 0;
    }
    return count ?? 0;
  };

  // Reclutamiento cuenta sólo lo de búsquedas publicadas: los CVs que quedaron
  // en búsquedas cerradas no son trabajo pendiente de nadie.
  const { data: publicadas } = await supabase.from('jobs').select('id').eq('is_published', true);
  const idsPublicadas = (publicadas ?? []).map((j) => j.id as string);

  const [
    timeOff,
    reintegros,
    adelantos,
    capacitaciones,
    consultas,
    postulaciones,
    banco,
    referidos,
    recibos,
  ] = await Promise.all([
    contar('leave_requests', desde('time-off'), (q) => q.eq('status', 'pending_hr')),
    contar('expense_reimbursements', desde('reintegros'), (q) =>
      q.in('status', ['requested', 'leader_approved', 'admin_validated', 'to_pay']),
    ),
    contar('salary_advances', desde('adelantos'), (q) =>
      q.in('status', ['pending_hr', 'pending_admin']),
    ),
    contar('training_requests', desde('capacitaciones'), (q) =>
      q.in('status', ['requested', 'leader_approved']),
    ),
    contar('employee_inquiries', desde('consultas'), (q) =>
      q.in('status', ['nueva', 'en_curso', 'esperando_colaborador']),
    ),
    idsPublicadas.length
      ? contar('applications', desde('reclutamiento'), (q) =>
          q
            .eq('current_stage', 'HR_REVIEW')
            .eq('current_stage_status', 'PENDING')
            .in('job_id', idsPublicadas),
        )
      : Promise.resolve(0),
    contar('talent_pool_entries', desde('reclutamiento'), (q) => q.eq('status', 'NEW')),
    contar('referrals', desde('referidos'), (q) => q.eq('status', 'pending')),
    // Recepción de recibos no guarda filas "pendientes": la fila nace cuando
    // alguien confirma. Así que acá la novedad son las confirmaciones que
    // llegaron desde la última visita.
    contar('payroll_receipt_acknowledgements', desde('recibos'), (q) => q),
  ]);

  return {
    'time-off': timeOff,
    reintegros,
    adelantos,
    capacitaciones,
    consultas,
    // Las dos colas de Reclutamiento comparten el punto: es un solo ítem del nav.
    reclutamiento: postulaciones + banco,
    referidos,
    recibos,
  };
}

export async function markModuleSeen(userId: string, module: AdminModule): Promise<void> {
  const supabase = getSupabaseServer();
  const { error } = await supabase
    .from('admin_module_visits')
    .upsert(
      { user_id: userId, module_key: module, last_seen_at: new Date().toISOString() },
      { onConflict: 'user_id,module_key' },
    );
  if (error) console.error('markModuleSeen:', error.message);
}

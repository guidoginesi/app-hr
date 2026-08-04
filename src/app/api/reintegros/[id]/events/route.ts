import { NextRequest, NextResponse } from 'next/server';
import { getAuthResult } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { resolveActor } from '@/lib/reimbursementAccess';

export const dynamic = 'force-dynamic';

/**
 * GET /api/reintegros/[id]/events — el historial de un reintegro.
 *
 * La tarea pide "fecha y responsable de cada cambio de estado", así que esta
 * tabla se lee y no sólo se escribe. En adelantos y capacitaciones la equivalente
 * es write-only y el historial no se ve por ningún lado.
 *
 * Lo ve también el solicitante: es su gasto y tiene derecho a saber quién lo
 * movió y cuándo.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthResult();
    if (!auth.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const actor = await resolveActor({
      reimbursementId: id,
      userId: auth.user.id,
      isAdmin: auth.isAdmin,
      isAdministracion: auth.isAdministracion,
      viewerEmployeeId: auth.employee?.id ?? null,
    });
    if (actor.role === 'none') return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('expense_reimbursement_events')
      .select('id, event_type, from_status, to_status, actor_name, note, created_at')
      .eq('reimbursement_id', id)
      .order('created_at', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ events: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error inesperado';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

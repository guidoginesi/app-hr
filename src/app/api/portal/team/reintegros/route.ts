import { NextResponse } from 'next/server';
import { requirePortalAccess } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

/**
 * GET /api/portal/team/reintegros — los reintegros que este líder tiene que
 * decidir, más el histórico de su equipo.
 *
 * Filtra por `leader_id`, que es el líder CONGELADO en la fila al crearse, y no
 * por el manager_id actual: si alguien cambió de líder a mitad del circuito, el
 * que tiene que decidir es el que estaba cuando se pidió.
 */
export async function GET() {
  try {
    const auth = await requirePortalAccess();
    if (!auth?.employee) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!auth.isLeader) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('expense_reimbursements_with_details')
      .select('*')
      .eq('leader_id', auth.employee.id)
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const items = data ?? [];
    return NextResponse.json({
      items,
      pendientes: items.filter((r) => r.status === 'requested').length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error inesperado';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getAuthResult } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { OPEN_STATUSES, payableAmount } from '@/lib/reimbursements';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/reintegros — la cola de People y Administración.
 *
 * Abierto a `admin` y a `administracion`: el paso de validar el comprobante
 * fiscal y la imputación es de Administración, así que no puede quedar detrás de
 * requireAdmin.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthResult();
    if (!auth.user || (!auth.isAdmin && !auth.isAdministracion)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sp = new URL(req.url).searchParams;
    const status = sp.get('status');
    const supabase = getSupabaseServer();

    let query = supabase
      .from('expense_reimbursements_with_details')
      .select('*')
      .order('created_at', { ascending: false });

    if (status === 'abiertos') query = query.in('status', OPEN_STATUSES);
    else if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const items = data ?? [];

    // Totales para las cards. Se suma amount_ars —la conversión que hizo
    // Administración al validar— y no amount, para no mezclar monedas. Lo que
    // todavía no se validó no tiene amount_ars, así que se cuenta aparte.
    const totales = {
      a_validar: items.filter((r) => r.status === 'leader_approved').length,
      esperando_lider: items.filter((r) => r.status === 'requested').length,
      a_pagar_ars: items
        .filter((r) => r.status === 'to_pay')
        .reduce((acc, r) => acc + Number(r.amount_ars ?? 0), 0),
      pagado_ars: items
        .filter((r) => r.status === 'paid')
        .reduce((acc, r) => acc + Number(r.amount_ars ?? 0), 0),
      sin_convertir: items.filter((r) => OPEN_STATUSES.includes(r.status) && r.amount_ars === null).length,
    };

    return NextResponse.json({
      items: items.map((r) => ({ ...r, payable: payableAmount(r) })),
      totales,
      canValidate: auth.isAdmin || auth.isAdministracion,
      canManageAccess: auth.isAdmin,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error inesperado';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

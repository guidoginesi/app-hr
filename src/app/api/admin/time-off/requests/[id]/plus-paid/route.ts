import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

type RouteContext = { params: Promise<{ id: string }> };

// PATCH /api/admin/time-off/requests/[id]/plus-paid
// Marca/desmarca una solicitud de vacaciones como "ya liquidada" (plus ya pagado).
export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const plusPaid = Boolean(body?.plus_paid);

    const supabase = getSupabaseServer();
    const { error } = await supabase
      .from('leave_requests')
      .update({ plus_paid: plusPaid, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Error updating plus_paid:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, plus_paid: plusPaid });
  } catch (error: any) {
    console.error('Error in PATCH /api/admin/time-off/requests/[id]/plus-paid:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

type RouteContext = { params: Promise<{ id: string }> };

const VALID_STATUSES = ['pending', 'in_process', 'hired', 'rejected', 'closed'];

// PATCH /api/admin/referidos/[id] — update status / bonus_paid / hr_notes
export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await context.params;
    const body = await req.json();
    const { status, bonus_paid, hr_notes } = body;

    if (status && !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Estado inválido' }, { status: 400 });
    }

    const supabase = getSupabaseServer();

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (status !== undefined) update.status = status;
    if (bonus_paid !== undefined) update.bonus_paid = bonus_paid;
    if (hr_notes !== undefined) update.hr_notes = hr_notes;

    const { data, error } = await supabase
      .from('referrals')
      .update(update)
      .eq('id', id)
      .select(`*, job:jobs!job_id(id, title, department), referrer:employees!referrer_employee_id(id, first_name, last_name, job_title)`)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

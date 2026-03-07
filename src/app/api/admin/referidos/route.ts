import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

// GET /api/admin/referidos — list all referrals
export async function GET(req: NextRequest) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const job_id = searchParams.get('job_id');

    const supabase = getSupabaseServer();

    let query = supabase
      .from('referrals')
      .select(`
        *,
        job:jobs!job_id(id, title, department),
        referrer:employees!referrer_employee_id(id, first_name, last_name, job_title)
      `)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (job_id) query = query.eq('job_id', job_id);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(data || []);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

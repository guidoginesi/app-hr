import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

// GET /api/admin/time-off/bonus-adjustments - List all bonus adjustments
export async function GET(req: NextRequest) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseServer();
    const { searchParams } = new URL(req.url);

    const year = searchParams.get('year');
    const status = searchParams.get('status');
    const employee_id = searchParams.get('employee_id');
    const leave_type_id = searchParams.get('leave_type_id');

    let query = supabase
      .from('bonus_adjustments_with_details')
      .select('*')
      .order('created_at', { ascending: false });

    if (year) {
      query = query.eq('year', parseInt(year));
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (employee_id) {
      query = query.eq('employee_id', employee_id);
    }

    if (leave_type_id) {
      query = query.eq('leave_type_id', leave_type_id);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching bonus adjustments:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in GET /api/admin/time-off/bonus-adjustments:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

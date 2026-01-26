import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

// GET /api/admin/time-off/balances - List all balances
export async function GET(req: NextRequest) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseServer();
    const { searchParams } = new URL(req.url);

    const year = searchParams.get('year') || new Date().getFullYear().toString();
    const employee_id = searchParams.get('employee_id');
    const leave_type_id = searchParams.get('leave_type_id');

    let query = supabase
      .from('leave_balances_with_details')
      .select('*')
      .eq('year', parseInt(year))
      .order('employee_name', { ascending: true });

    if (employee_id) {
      query = query.eq('employee_id', employee_id);
    }

    if (leave_type_id) {
      query = query.eq('leave_type_id', leave_type_id);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching leave balances:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in GET /api/admin/time-off/balances:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

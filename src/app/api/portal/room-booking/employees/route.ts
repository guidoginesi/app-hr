import { NextRequest, NextResponse } from 'next/server';
import { getAuthResult } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

// GET /api/portal/room-booking/employees?q=search
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthResult();
    if (!auth.user || !auth.employee) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q')?.trim() || '';

    if (q.length < 2) {
      return NextResponse.json({ employees: [] });
    }

    const supabase = getSupabaseServer();

    const { data, error } = await supabase
      .from('employees')
      .select('id, first_name, last_name, work_email')
      .eq('status', 'active')
      .neq('id', auth.employee.id)
      .or(
        `first_name.ilike.%${q}%,last_name.ilike.%${q}%,work_email.ilike.%${q}%`
      )
      .order('first_name')
      .limit(10);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const employees = (data || []).map((e) => ({
      id: e.id,
      name: `${e.first_name} ${e.last_name}`,
      email: e.work_email || '',
    }));

    return NextResponse.json({ employees });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

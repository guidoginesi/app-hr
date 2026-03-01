import { NextRequest, NextResponse } from 'next/server';
import { getAuthResult } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

// GET /api/portal/payroll/settlements - Get logged-in employee's settlements
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthResult();
    if (!auth.user || !auth.employee) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const supabase = getSupabaseServer();

    const { data: settlements, error } = await supabase
      .from('payroll_settlements_with_details')
      .select('*')
      .eq('employee_id', auth.employee.id)
      .eq('status', 'SENT')
      .order('period_year', { ascending: false })
      .order('period_month', { ascending: false });

    if (error) {
      console.error('Error fetching settlements:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ settlements: settlements || [] });
  } catch (error: any) {
    console.error('Error in GET /api/portal/payroll/settlements:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

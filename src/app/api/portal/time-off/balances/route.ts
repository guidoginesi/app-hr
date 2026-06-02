import { NextRequest, NextResponse } from 'next/server';
import { requirePortalAccess } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { buildLeaveBalanceRows } from '@/lib/leaveBalanceCalculation';

// GET /api/portal/time-off/balances - Get my leave balances
export async function GET(req: NextRequest) {
  try {
    const auth = await requirePortalAccess();
    if (!auth?.employee) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseServer();
    const { searchParams } = new URL(req.url);
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString(), 10);

    const { data: balances, error } = await supabase
      .from('leave_balances_with_details')
      .select('*')
      .eq('employee_id', auth.employee.id)
      .eq('year', year);

    if (error) {
      console.error('Error fetching leave balances:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!balances || balances.length === 0) {
      const { data: leaveTypes } = await supabase
        .from('leave_types')
        .select('id, code')
        .eq('is_active', true);

      if (leaveTypes && leaveTypes.length > 0) {
        const insertData = buildLeaveBalanceRows(
          auth.employee.id,
          {
            hire_date: auth.employee.hire_date,
            is_studying: auth.employee.is_studying,
          },
          leaveTypes,
          year
        );

        await supabase.from('leave_balances').upsert(insertData, {
          onConflict: 'employee_id,leave_type_id,year',
        });

        const { data: newBalances } = await supabase
          .from('leave_balances_with_details')
          .select('*')
          .eq('employee_id', auth.employee.id)
          .eq('year', year);

        return NextResponse.json(newBalances || []);
      }
    }

    return NextResponse.json(balances || []);
  } catch (error: any) {
    console.error('Error in GET /api/portal/time-off/balances:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

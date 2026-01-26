import { NextRequest, NextResponse } from 'next/server';
import { requirePortalAccess } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

// GET /api/portal/time-off/balances - Get my leave balances
export async function GET(req: NextRequest) {
  try {
    const auth = await requirePortalAccess();
    if (!auth?.employee) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseServer();
    const { searchParams } = new URL(req.url);
    const year = searchParams.get('year') || new Date().getFullYear().toString();

    // Get all balances for the employee
    const { data: balances, error } = await supabase
      .from('leave_balances_with_details')
      .select('*')
      .eq('employee_id', auth.employee.id)
      .eq('year', parseInt(year));

    if (error) {
      console.error('Error fetching leave balances:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // If no balances exist, we might need to initialize them
    if (!balances || balances.length === 0) {
      // Get leave types
      const { data: leaveTypes } = await supabase
        .from('leave_types')
        .select('*')
        .eq('is_active', true);

      if (leaveTypes && leaveTypes.length > 0) {
        // Initialize balances
        const hireDate = auth.employee.hire_date ? new Date(auth.employee.hire_date) : null;
        const referenceDate = new Date(parseInt(year), 11, 31);
        const insertData = [];

        for (const leaveType of leaveTypes) {
          let entitledDays = 0;

          if (hireDate) {
            const monthsWorked = Math.floor(
              (referenceDate.getTime() - hireDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
            );
            const yearsWorked = Math.floor(monthsWorked / 12);

            switch (leaveType.code) {
              case 'vacation':
                if (monthsWorked < 6) {
                  const daysWorked = Math.floor(
                    (referenceDate.getTime() - hireDate.getTime()) / (1000 * 60 * 60 * 24)
                  );
                  entitledDays = Math.floor(daysWorked / 20);
                } else if (yearsWorked >= 20) {
                  entitledDays = 35;
                } else if (yearsWorked >= 10) {
                  entitledDays = 28;
                } else if (yearsWorked >= 5) {
                  entitledDays = 21;
                } else {
                  entitledDays = 14;
                }
                break;
              case 'pow_days':
                entitledDays = monthsWorked >= 6 ? 5 : 0;
                break;
              case 'study':
                entitledDays = auth.employee.is_studying ? 10 : 0;
                break;
              case 'remote_work':
                entitledDays = 8;
                break;
            }
          }

          insertData.push({
            employee_id: auth.employee.id,
            leave_type_id: leaveType.id,
            year: parseInt(year),
            entitled_days: entitledDays,
            used_days: 0,
            pending_days: 0,
            carried_over: 0,
          });
        }

        if (insertData.length > 0) {
          await supabase.from('leave_balances').upsert(insertData, {
            onConflict: 'employee_id,leave_type_id,year',
          });

          // Fetch again
          const { data: newBalances } = await supabase
            .from('leave_balances_with_details')
            .select('*')
            .eq('employee_id', auth.employee.id)
            .eq('year', parseInt(year));

          return NextResponse.json(newBalances || []);
        }
      }
    }

    return NextResponse.json(balances || []);
  } catch (error: any) {
    console.error('Error in GET /api/portal/time-off/balances:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

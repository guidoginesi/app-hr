import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { calculateEntitledDays } from '@/lib/leaveBalanceCalculation';

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const RecalculateSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  employee_id: z.string().regex(uuidRegex).optional(),
});

// POST /api/admin/time-off/balances/recalculate - Recalculate balances for a year
export async function POST(req: NextRequest) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = RecalculateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((e) => e.message).join(', ') },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();
    const { year, employee_id } = parsed.data;

    const { data: leaveTypes, error: typesError } = await supabase
      .from('leave_types')
      .select('*')
      .eq('is_active', true);

    if (typesError || !leaveTypes) {
      return NextResponse.json({ error: 'Error obteniendo tipos de licencia' }, { status: 500 });
    }

    let employeesQuery = supabase
      .from('employees')
      .select('id, hire_date, is_studying')
      .eq('status', 'active');

    if (employee_id) {
      employeesQuery = employeesQuery.eq('id', employee_id);
    }

    const { data: employees, error: empError } = await employeesQuery;

    if (empError || !employees) {
      return NextResponse.json({ error: 'Error obteniendo empleados' }, { status: 500 });
    }

    const endOfYear = new Date(year, 11, 31);
    const results: { employee_id: string; balances: Record<string, number> }[] = [];

    for (const employee of employees) {
      const hireDate = employee.hire_date ? new Date(employee.hire_date) : null;
      const balances: Record<string, number> = {};

      for (const leaveType of leaveTypes) {
        let entitledDays = 0;

        if (hireDate && hireDate <= endOfYear) {
          entitledDays = calculateEntitledDays(leaveType.code, employee, year);
        }

        let carriedOver = 0;
        if (leaveType.is_accumulative && year > 2020) {
          const { data: prevBalance } = await supabase
            .from('leave_balances')
            .select('entitled_days, used_days, carried_over, bonus_days')
            .eq('employee_id', employee.id)
            .eq('leave_type_id', leaveType.id)
            .eq('year', year - 1)
            .single();

          if (prevBalance) {
            carriedOver = Math.max(
              0,
              Number(prevBalance.entitled_days) +
                Number(prevBalance.carried_over) +
                Number(prevBalance.bonus_days || 0) -
                Number(prevBalance.used_days)
            );
          }
        }

        const { error: upsertError } = await supabase.from('leave_balances').upsert(
          {
            employee_id: employee.id,
            leave_type_id: leaveType.id,
            year,
            entitled_days: entitledDays,
            carried_over: carriedOver,
          },
          {
            onConflict: 'employee_id,leave_type_id,year',
            ignoreDuplicates: false,
          }
        );

        if (upsertError) {
          console.error('Error upserting balance:', upsertError);
        }

        balances[leaveType.code] = entitledDays + carriedOver;
      }

      results.push({ employee_id: employee.id, balances });
    }

    return NextResponse.json({
      success: true,
      year,
      employees_processed: results.length,
      results,
    });
  } catch (error: any) {
    console.error('Error in POST /api/admin/time-off/balances/recalculate:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

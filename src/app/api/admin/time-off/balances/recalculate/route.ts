import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

// Regex for UUID format (more permissive than RFC 4122)
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const RecalculateSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  employee_id: z.string().regex(uuidRegex).optional(), // If not provided, recalculate for all active employees
});

/**
 * Count business days (Monday-Friday) between two dates
 * Based on LCT art. 151 - counts working days
 */
function countBusinessDays(startDate: Date, endDate: Date): number {
  let count = 0;
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  while (current <= end) {
    const dayOfWeek = current.getDay();
    // Monday = 1, Friday = 5, Saturday = 6, Sunday = 0
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
}

/**
 * Calculate vacation days according to Argentine Labor Law (LCT)
 * Art. 150: Days by seniority (at Dec 31)
 * Art. 151: Must work at least half of business days to get full vacation
 * Art. 153: Proportional = 1 day per 20 worked days
 * 
 * IMPORTANT: Vacation period opens on October 1st each year.
 * Vacations for year X are calculated with seniority at Dec 31 of year X,
 * but only "unlock" starting October 1st of year X.
 */
function calculateVacationDays(hireDate: Date, year: number): number {
  const startOfYear = new Date(year, 0, 1);
  const endOfYear = new Date(year, 11, 31);

  // 1. Calculate seniority in years at Dec 31
  const seniorityMs = endOfYear.getTime() - hireDate.getTime();
  const seniorityYears = Math.floor(seniorityMs / (1000 * 60 * 60 * 24 * 365.25));

  // 2. Determine days by seniority scale (Art. 150)
  let daysByScale: number;
  if (seniorityYears >= 20) {
    daysByScale = 35;
  } else if (seniorityYears >= 10) {
    daysByScale = 28;
  } else if (seniorityYears >= 5) {
    daysByScale = 21;
  } else {
    daysByScale = 14;
  }

  // 3. Calculate business days in the year
  const totalBusinessDays = countBusinessDays(startOfYear, endOfYear);

  // 4. Calculate business days worked (from hire date or Jan 1, whichever is later)
  const workStartDate = hireDate > startOfYear ? hireDate : startOfYear;
  const businessDaysWorked = countBusinessDays(workStartDate, endOfYear);

  // 5. Check if employee worked at least half the business days (Art. 151)
  const halfBusinessDays = Math.floor(totalBusinessDays / 2);

  if (businessDaysWorked >= halfBusinessDays) {
    // Full vacation by scale
    return daysByScale;
  } else {
    // Proportional: 1 day per 20 worked days (Art. 153)
    return Math.floor(businessDaysWorked / 20);
  }
}

/**
 * Check if vacation period for a given year has started.
 * Vacation period opens on October 1st of each year.
 */
function isVacationPeriodOpen(year: number): boolean {
  const today = new Date();
  const periodStart = new Date(year, 9, 1); // October 1st
  return today >= periodStart;
}

/**
 * Calculate months of seniority
 */
function calculateMonthsWorked(hireDate: Date, referenceDate: Date): number {
  const years = referenceDate.getFullYear() - hireDate.getFullYear();
  const months = referenceDate.getMonth() - hireDate.getMonth();
  const days = referenceDate.getDate() - hireDate.getDate();
  
  let totalMonths = years * 12 + months;
  if (days < 0) totalMonths--;
  
  return Math.max(0, totalMonths);
}

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

    // Get leave types
    const { data: leaveTypes, error: typesError } = await supabase
      .from('leave_types')
      .select('*')
      .eq('is_active', true);

    if (typesError || !leaveTypes) {
      return NextResponse.json({ error: 'Error obteniendo tipos de licencia' }, { status: 500 });
    }

    // Get employees
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
          const monthsWorked = calculateMonthsWorked(hireDate, endOfYear);

          switch (leaveType.code) {
            case 'vacation':
              // Calculate according to LCT (Arts. 150, 151, 153)
              // Vacation period opens October 1st - only calculate if period is open
              if (isVacationPeriodOpen(year)) {
                entitledDays = calculateVacationDays(hireDate, year);
              } else {
                // Period not open yet - entitled_days stays 0
                // Employee can still use carried_over from previous years
                entitledDays = 0;
              }
              break;

            case 'pow_days':
              // 5 days if more than 6 months of seniority at end of year
              // Same as vacation: only unlocks in October
              if (isVacationPeriodOpen(year)) {
                entitledDays = monthsWorked >= 6 ? 5 : 0;
              } else {
                entitledDays = 0;
              }
              break;

            case 'study':
              // 10 days max per year if employee is studying
              entitledDays = employee.is_studying ? 10 : 0;
              break;

            case 'remote_work':
              // 8 weeks per year
              entitledDays = 8;
              break;
          }
        }

        // Get previous year balance for carry over (only if accumulative)
        // Include bonus_days in the carryover calculation so they persist across years
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
            // Include bonus_days in what gets carried over
            carriedOver = Math.max(
              0,
              Number(prevBalance.entitled_days) + Number(prevBalance.carried_over) + Number(prevBalance.bonus_days || 0) - Number(prevBalance.used_days)
            );
          }
        }

        // Upsert balance
        const { error: upsertError } = await supabase
          .from('leave_balances')
          .upsert(
            {
              employee_id: employee.id,
              leave_type_id: leaveType.id,
              year,
              entitled_days: entitledDays,
              carried_over: carriedOver,
              // Keep existing used_days and pending_days
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

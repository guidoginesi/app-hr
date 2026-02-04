import { NextRequest, NextResponse } from 'next/server';
import { requirePortalAccess, getDirectReports } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import type { LeaveBalanceWithDetails, LeaveRequestWithDetails } from '@/types/time-off';

type RouteContext = { params: Promise<{ memberId: string }> };

// GET /api/portal/team/[memberId]/time-off - Get time off data for a team member
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const auth = await requirePortalAccess();
    if (!auth?.employee || !auth.isLeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { memberId } = await context.params;
    const supabase = getSupabaseServer();

    // Verify this member is a direct report
    const directReports = await getDirectReports(auth.employee.id);
    const isDirectReport = directReports.some(e => e.id === memberId);

    if (!isDirectReport) {
      return NextResponse.json({ error: 'Not authorized to view this employee' }, { status: 403 });
    }

    const currentYear = new Date().getFullYear();

    // Get balances for current year
    const { data: balances, error: balancesError } = await supabase
      .from('leave_balances_with_details')
      .select('*')
      .eq('employee_id', memberId)
      .eq('year', currentYear);

    if (balancesError) {
      console.error('Error fetching balances:', balancesError);
    }

    // Get leave requests (all time, ordered by date)
    const { data: requests, error: requestsError } = await supabase
      .from('leave_requests_with_details')
      .select('*')
      .eq('employee_id', memberId)
      .order('start_date', { ascending: false });

    if (requestsError) {
      console.error('Error fetching requests:', requestsError);
    }

    // Format balances by type for easier consumption
    const balancesByType: Record<string, LeaveBalanceWithDetails | null> = {
      vacation: null,
      pow_days: null,
      study: null,
      remote_work: null,
    };

    if (balances) {
      for (const balance of balances as LeaveBalanceWithDetails[]) {
        balancesByType[balance.leave_type_code] = balance;
      }
    }

    return NextResponse.json({
      year: currentYear,
      balances: balancesByType,
      requests: (requests as LeaveRequestWithDetails[]) || [],
    });
  } catch (error: any) {
    console.error('Error in GET /api/portal/team/[memberId]/time-off:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

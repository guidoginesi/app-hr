import { NextRequest, NextResponse } from 'next/server';
import { requirePortalAccess, getDirectReports } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

// GET /api/portal/team/time-off/requests - Get leave requests from my team
export async function GET(req: NextRequest) {
  try {
    const auth = await requirePortalAccess();
    if (!auth?.employee || !auth.isLeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseServer();
    const { searchParams } = new URL(req.url);

    const status = searchParams.get('status');
    const employee_id = searchParams.get('employee_id');

    // Get direct reports
    const directReports = await getDirectReports(auth.employee.id);
    const directReportIds = directReports.map((e) => e.id);

    if (directReportIds.length === 0) {
      return NextResponse.json([]);
    }

    let query = supabase
      .from('leave_requests_with_details')
      .select('*')
      .in('employee_id', directReportIds)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (employee_id && directReportIds.includes(employee_id)) {
      query = query.eq('employee_id', employee_id);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching team leave requests:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in GET /api/portal/team/time-off/requests:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

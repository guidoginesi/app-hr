import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

// GET /api/admin/time-off/stats - Get time-off dashboard stats
export async function GET() {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseServer();
    const today = new Date().toISOString().split('T')[0];
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .split('T')[0];
    const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)
      .toISOString()
      .split('T')[0];

    // Pending requests count
    const { count: pendingRequests } = await supabase
      .from('leave_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    // Approved this month
    const { count: approvedThisMonth } = await supabase
      .from('leave_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved')
      .gte('approved_at', startOfMonth)
      .lte('approved_at', endOfMonth);

    // Employees on leave today
    const { count: employeesOnLeaveToday } = await supabase
      .from('leave_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved')
      .lte('start_date', today)
      .gte('end_date', today);

    // Upcoming leaves (approved, starting in next 30 days)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const thirtyDaysStr = thirtyDaysFromNow.toISOString().split('T')[0];

    const { count: upcomingLeaves } = await supabase
      .from('leave_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved')
      .gt('start_date', today)
      .lte('start_date', thirtyDaysStr);

    return NextResponse.json({
      pendingRequests: pendingRequests || 0,
      approvedThisMonth: approvedThisMonth || 0,
      employeesOnLeaveToday: employeesOnLeaveToday || 0,
      upcomingLeaves: upcomingLeaves || 0,
    });
  } catch (error: any) {
    console.error('Error in GET /api/admin/time-off/stats:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

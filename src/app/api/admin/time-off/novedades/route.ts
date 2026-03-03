import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

// GET /api/admin/time-off/novedades?year=2026&month=3&employee_id=...&status=...
export async function GET(req: NextRequest) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()));
    const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1));
    const employeeId = searchParams.get('employee_id') ?? null;
    const statusFilter = searchParams.get('status') ?? null;

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return NextResponse.json({ error: 'Parámetros de período inválidos' }, { status: 400 });
    }

    // Period boundaries: all requests that overlap with the selected month
    const periodStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const periodEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const supabase = getSupabaseServer();

    let query = supabase
      .from('leave_requests_with_details')
      .select('*')
      // Include requests that overlap with the selected month
      .lte('start_date', periodEnd)
      .gte('end_date', periodStart)
      .not('status', 'in', '("cancelled")');

    if (employeeId) {
      query = query.eq('employee_id', employeeId);
    }

    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }

    query = query.order('start_date', { ascending: true });

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching novedades:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fetch all active employees for the filter dropdown
    const { data: employees } = await supabase
      .from('employees')
      .select('id, first_name, last_name')
      .eq('status', 'active')
      .order('last_name')
      .order('first_name');

    return NextResponse.json({ novedades: data ?? [], employees: employees ?? [] });
  } catch (error: any) {
    console.error('Error in GET /api/admin/time-off/novedades:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

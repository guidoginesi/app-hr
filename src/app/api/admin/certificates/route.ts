import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

// GET /api/admin/certificates — list all certificates with employee info
export async function GET(req: NextRequest) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const employeeSearch = searchParams.get('employee');

    const supabase = getSupabaseServer();

    let query = supabase
      .from('employee_certificates')
      .select(`
        *,
        employee:employees!employee_id(
          id, first_name, last_name, job_title,
          department:departments(id, name)
        )
      `)
      .order('uploaded_at', { ascending: false });

    if (type) {
      query = query.eq('type', type);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let results = data || [];

    // Filter by employee name (client-side on the fetched data for simplicity)
    if (employeeSearch) {
      const search = employeeSearch.toLowerCase();
      results = results.filter((c: any) => {
        const name = `${c.employee?.first_name || ''} ${c.employee?.last_name || ''}`.toLowerCase();
        return name.includes(search);
      });
    }

    return NextResponse.json(results);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET /api/admin/certificates/[id]/download — generate signed URL (admin version)

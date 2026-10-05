import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

// Sólo listado. Antes había un POST para que el admin cargara licencias a
// nombre de otro, pero ninguna pantalla lo usaba y tenía dos bugs: buscaba
// superposiciones con un OR que traía todo el historial de la persona y movía
// el saldo con una función de la base que no existe. Si RRHH necesita cargar
// licencias, que sea una pantalla con las mismas reglas que el portal.

// GET /api/admin/time-off/requests - List all leave requests
export async function GET(req: NextRequest) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseServer();
    const { searchParams } = new URL(req.url);

    const status = searchParams.get('status');
    const employee_id = searchParams.get('employee_id');
    const leave_type_id = searchParams.get('leave_type_id');
    const year = searchParams.get('year');
    const from_date = searchParams.get('from_date');
    const to_date = searchParams.get('to_date');

    let query = supabase
      .from('leave_requests_with_details')
      .select('*')
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (employee_id) {
      query = query.eq('employee_id', employee_id);
    }

    if (leave_type_id) {
      query = query.eq('leave_type_id', leave_type_id);
    }

    if (year) {
      const startOfYear = `${year}-01-01`;
      const endOfYear = `${year}-12-31`;
      query = query.gte('start_date', startOfYear).lte('end_date', endOfYear);
    }

    if (from_date) {
      // Requests that overlap the range: end_date >= from_date
      query = query.gte('end_date', from_date);
    }

    if (to_date) {
      // Requests that overlap the range: start_date <= to_date
      query = query.lte('start_date', to_date);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching leave requests:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in GET /api/admin/time-off/requests:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

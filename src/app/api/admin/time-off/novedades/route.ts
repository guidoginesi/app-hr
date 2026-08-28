import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { recortarAlMes, type LicenciaARecortar } from '@/lib/novedadesPorMes';

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
    const leaveType = searchParams.get('leave_type') ?? null;

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

    if (leaveType) {
      query = query.eq('leave_type_code', leaveType);
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

    // Fetch leave types for the filter dropdown
    const { data: leaveTypes } = await supabase
      .from('leave_types')
      .select('code, name')
      .order('sort_order').order('name');

    /**
     * Cada licencia se recorta al mes que se está liquidando.
     *
     * Una licencia del 24/8 al 6/9 no son 14 días de agosto ni 14 de
     * septiembre: son 8 y 6. Antes se devolvía entera en los dos meses y la
     * cuenta la hacía a mano quien liquidaba.
     *
     * Las fechas originales viajan aparte para no perderlas: en la pantalla
     * sirven para decir "viene de agosto" en vez de dejar una fecha suelta que
     * no coincide con lo que la persona pidió.
     */
    const novedades = (data ?? []).flatMap((n) => {
      const tramo = recortarAlMes(n as unknown as LicenciaARecortar, year, month);
      if (!tramo) return [];
      return [{
        ...n,
        start_date: tramo.desde,
        end_date: tramo.hasta,
        days_requested: tramo.duracion,
        duracion_unidad: tramo.unidad,
        tramo_parcial: !tramo.completa,
        viene_del_mes_anterior: tramo.vieneDelMesAnterior,
        sigue_el_mes_siguiente: tramo.sigueElMesSiguiente,
        licencia_desde: (n.start_date as string).slice(0, 10),
        licencia_hasta: (n.end_date as string).slice(0, 10),
        licencia_duracion: n.days_requested,
      }];
    });

    return NextResponse.json({
      novedades,
      employees: employees ?? [],
      leaveTypes: leaveTypes ?? [],
    });
  } catch (error: any) {
    console.error('Error in GET /api/admin/time-off/novedades:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

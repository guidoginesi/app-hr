import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { isBusinessDay } from '@/lib/businessDays';
import { computeSickKpi, type SickLeaveRow, type KpiEmployee } from '@/lib/sickKpi';
import { SICK_LEAVE_CODE } from '@/lib/sickLeave';

export const dynamic = 'force-dynamic';

function todayInArgentina(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** Días hábiles en [start, end] inclusive. Sin feriados (no hay calendario aún). */
function countBusinessDaysInclusive(start: string, end: string): number {
  const [sy, sm, sd] = start.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);
  const d = new Date(Date.UTC(sy, sm - 1, sd));
  const last = new Date(Date.UTC(ey, em - 1, ed));
  let count = 0;
  while (d <= last) {
    if (isBusinessDay(d)) count++;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return count;
}

/**
 * GET /api/admin/time-off/sick-kpi?year=YYYY&area=&modalidad=
 *
 * KPI de ausentismo por enfermedad. Sólo admin (reporting = People). Agrega
 * sobre los datos existentes; no toca la base.
 */
export async function GET(req: NextRequest) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const sp = new URL(req.url).searchParams;
    const today = todayInArgentina();
    const currentYear = Number(today.slice(0, 4));
    const year = Number(sp.get('year')) || currentYear;
    if (year < 2020 || year > 2100) return NextResponse.json({ error: 'Año inválido.' }, { status: 400 });
    const areaFilter = sp.get('area') ?? '';
    const modalidadFilter = sp.get('modalidad') ?? '';

    const periodStart = `${year}-01-01`;
    // Para el año en curso el denominador llega hasta hoy: sumar días hábiles
    // futuros que todavía no ocurrieron infla artificialmente los "disponibles".
    const periodEnd = year === currentYear ? today : `${year}-12-31`;
    const businessDaysInPeriod = countBusinessDaysInclusive(periodStart, periodEnd);

    const supabase = getSupabaseServer();

    const [empRes, deptRes, leavesRes] = await Promise.all([
      supabase
        .from('employees')
        .select('id, first_name, last_name, department_id, employment_type, hire_date')
        .eq('status', 'active'),
      supabase.from('departments').select('id, name'),
      supabase
        .from('leave_requests_with_details')
        .select('employee_id, days_requested, start_date, status')
        .eq('leave_type_code', SICK_LEAVE_CODE)
        .gte('start_date', periodStart)
        .lte('start_date', periodEnd),
    ]);

    const firstError = [empRes, deptRes, leavesRes].find((r) => r.error);
    if (firstError?.error) return NextResponse.json({ error: firstError.error.message }, { status: 500 });

    const deptName = new Map<string, string>((deptRes.data ?? []).map((d) => [d.id as string, d.name as string]));

    const allEmployees: KpiEmployee[] = (empRes.data ?? []).map((e) => ({
      id: e.id as string,
      name: `${e.first_name ?? ''} ${e.last_name ?? ''}`.trim(),
      area: e.department_id ? deptName.get(e.department_id as string) ?? 'Sin área' : 'Sin área',
      modalidad: (e.employment_type as KpiEmployee['modalidad']) ?? null,
      hire_date: (e.hire_date as string) ?? null,
    }));

    // Lista de áreas para el filtro (todas las presentes, sin importar el corte).
    const areas = Array.from(new Set(allEmployees.map((e) => e.area))).sort((a, b) => a.localeCompare(b));

    const employees = allEmployees.filter(
      (e) => (!areaFilter || e.area === areaFilter) && (!modalidadFilter || e.modalidad === modalidadFilter),
    );

    const rows: SickLeaveRow[] = (leavesRes.data ?? []).map((r) => ({
      employee_id: r.employee_id as string,
      days_requested: Number(r.days_requested ?? 0),
      start_date: r.start_date as string,
      status: r.status as string,
    }));

    const kpi = computeSickKpi({ rows, employees, businessDaysInPeriod, today });

    return NextResponse.json({
      year,
      filters: { area: areaFilter, modalidad: modalidadFilter },
      areas,
      periodEnd,
      ...kpi,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error inesperado';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

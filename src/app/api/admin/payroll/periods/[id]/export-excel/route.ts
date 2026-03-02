import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import * as XLSX from 'xlsx';

type RouteContext = { params: Promise<{ id: string }> };

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

// GET /api/admin/payroll/periods/[id]/export-excel - Export settlements as xlsx
export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const supabase = getSupabaseServer();

    const { data: period, error: periodError } = await supabase
      .from('payroll_periods')
      .select('year, month')
      .eq('id', id)
      .single();

    if (periodError || !period) {
      return NextResponse.json({ error: 'Período no encontrado' }, { status: 404 });
    }

    const { data: settlements, error: settError } = await supabase
      .from('payroll_settlements_with_details')
      .select('*')
      .eq('period_id', id)
      .order('first_name', { ascending: true });

    if (settError) {
      return NextResponse.json({ error: settError.message }, { status: 500 });
    }

    const rows = (settlements || []).map((s: any) => ({
      'ID (no editar)': s.id,
      'Empleado': `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim(),
      'Tipo': s.contract_type_snapshot === 'MONOTRIBUTO' ? 'Monotributo' : 'Rel. Dependencia',
      'Sueldo': s.sueldo ?? 0,
      'Monotributo': s.monotributo ?? 0,
      'Reintegro Internet': s.reintegro_internet ?? 0,
      'Reintegro Extra': s.reintegro_extraordinario ?? 0,
      'Plus Vacacional': s.plus_vacacional ?? 0,
      'Total a Facturar': s.total_a_facturar ?? 0,
      'Estado': s.status,
      'Email': s.email_to ?? '',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 38 }, { wch: 28 }, { wch: 20 },
      { wch: 14 }, { wch: 14 }, { wch: 18 },
      { wch: 16 }, { wch: 16 }, { wch: 18 },
      { wch: 14 }, { wch: 30 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Liquidaciones');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const periodLabel = `${MONTH_NAMES[period.month - 1]}_${period.year}`;

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="liquidaciones_${periodLabel}.xlsx"`,
        'Cache-Control': 'private, no-cache',
      },
    });
  } catch (error: any) {
    console.error('Error in GET /api/admin/payroll/periods/[id]/export-excel:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

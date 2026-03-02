import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import * as XLSX from 'xlsx';

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/admin/payroll/periods/[id]/import-excel - Parse xlsx and bulk update settlements
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: periodId } = await context.params;

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

    const updates = rows
      .filter((row) => row['Tipo'] === 'Monotributo' && row['ID (no editar)'])
      .map((row) => ({
        id: String(row['ID (no editar)']),
        base_salary: Number(row['Sueldo']) || 0,
        monotributo: Number(row['Monotributo']) || 0,
        internet_reimbursement: Number(row['Reintegro Internet']) || 0,
        extra_reimbursement: Number(row['Reintegro Extra']) || 0,
        vacation_bonus: Number(row['Plus Vacacional']) || 0,
      }));

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No se encontraron filas Monotributo para actualizar' }, { status: 400 });
    }

    const supabase = getSupabaseServer();

    // Verify all settlement IDs belong to this period
    const ids = updates.map((u) => u.id);
    const { data: existing } = await supabase
      .from('payroll_employee_settlements')
      .select('id')
      .eq('period_id', periodId)
      .in('id', ids);

    const validIds = new Set((existing ?? []).map((s) => s.id));
    const validUpdates = updates.filter((u) => validIds.has(u.id));

    if (validUpdates.length === 0) {
      return NextResponse.json({ error: 'Ningún ID pertenece a este período' }, { status: 400 });
    }

    let updatedCount = 0;
    const errors: string[] = [];

    for (const u of validUpdates) {
      const total =
        (u.base_salary || 0) +
        (u.monotributo || 0) +
        (u.internet_reimbursement || 0) +
        (u.extra_reimbursement || 0) +
        (u.vacation_bonus || 0);

      const { error } = await supabase
        .from('payroll_monotributo_breakdown')
        .update({
          sueldo: u.base_salary,
          monotributo: u.monotributo,
          reintegro_internet: u.internet_reimbursement,
          reintegro_extraordinario: u.extra_reimbursement,
          plus_vacacional: u.vacation_bonus,
          total_a_facturar: total,
          updated_at: new Date().toISOString(),
        })
        .eq('settlement_id', u.id);

      if (error) {
        errors.push(`${u.id}: ${error.message}`);
      } else {
        updatedCount++;
      }
    }

    return NextResponse.json({
      updated_count: updatedCount,
      errors,
      message: `${updatedCount} liquidación${updatedCount !== 1 ? 'es' : ''} actualizada${updatedCount !== 1 ? 's' : ''} correctamente`,
    });
  } catch (error: any) {
    console.error('Error in POST /api/admin/payroll/periods/[id]/import-excel:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

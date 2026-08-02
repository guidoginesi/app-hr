import { NextRequest, NextResponse } from 'next/server';
import { requirePayrollReceiptsViewer } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { receiptStatus } from '@/lib/payrollReceipts';

/**
 * GET /api/admin/receipts[?period_id=]
 * Estado de recepción de recibos. NO devuelve montos: esta vista la puede ver
 * el perfil Administración, que no tiene acceso a los datos de liquidación.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requirePayrollReceiptsViewer();
    if (!auth?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseServer();
    const periodId = new URL(req.url).searchParams.get('period_id');

    let query = supabase
      .from('payroll_settlements_with_details')
      .select(
        'id, period_id, period_key, period_year, period_month, period_type, period_status, first_name, last_name, employee_email, status, sent_at, requires_acknowledgement, acknowledged_at, pdf_storage_path, pdf2_storage_path, contract_type_snapshot',
      )
      .eq('contract_type_snapshot', 'RELACION_DEPENDENCIA')
      .order('period_year', { ascending: false })
      .order('period_month', { ascending: false })
      .order('first_name', { ascending: true });

    if (periodId) query = query.eq('period_id', periodId);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const items = (data ?? []).map((s: any) => ({
      id: s.id,
      period_id: s.period_id,
      period_key: s.period_key,
      period_year: s.period_year,
      period_month: s.period_month,
      period_type: s.period_type,
      employee_name: `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim() || 'Sin nombre',
      employee_email: s.employee_email ?? null,
      status: s.status,
      sent_at: s.sent_at ?? null,
      requires_acknowledgement: s.requires_acknowledgement,
      acknowledged_at: s.acknowledged_at ?? null,
      receipt_status: receiptStatus(s),
      // Se exponen solo para calcular el estado en el cliente, no son datos sensibles.
      payslip_url: s.pdf_storage_path ? 'ok' : null,
      payslip2_url: s.pdf2_storage_path ? 'ok' : null,
      contract_type: s.contract_type_snapshot,
    }));

    // Agregado por período
    const byPeriod = new Map<string, any>();
    for (const it of items) {
      const p = byPeriod.get(it.period_id) ?? {
        period_id: it.period_id,
        period_key: it.period_key,
        period_year: it.period_year,
        period_month: it.period_month,
        period_type: it.period_type,
        publicados: 0,
        confirmados: 0,
        pendientes: 0,
        exentos: 0,
      };
      if (it.receipt_status !== 'no_publicado') {
        p.publicados++;
        if (it.receipt_status === 'recibido') p.confirmados++;
        else if (it.receipt_status === 'pendiente') p.pendientes++;
        else p.exentos++;
      }
      byPeriod.set(it.period_id, p);
    }

    return NextResponse.json({ items, periods: [...byPeriod.values()] });
  } catch (error: any) {
    console.error('Error in GET /api/admin/receipts:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

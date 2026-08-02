import { NextRequest, NextResponse } from 'next/server';
import { requirePayrollReceiptsViewer } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { receiptStatus, RECEIPT_STATUS_LABELS } from '@/lib/payrollReceipts';
import { formatPayrollPeriodLabelFromKey, type PayrollPeriodType } from '@/lib/payrollPeriods';

function cell(v: unknown): string {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // anti inyección de fórmulas
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const toCsv = (headers: string[], rows: unknown[][]) =>
  '﻿' + [headers, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');

/**
 * GET /api/admin/receipts/export[?period_id=]
 * Respaldo de constancias de recepción (retención / evidencia).
 */
export async function GET(req: NextRequest) {
  const auth = await requirePayrollReceiptsViewer();
  if (!auth?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = getSupabaseServer();
  const periodId = new URL(req.url).searchParams.get('period_id');

  let query = supabase
    .from('payroll_settlements_with_details')
    .select(
      'id, period_year, period_month, period_type, first_name, last_name, employee_email, status, sent_at, requires_acknowledgement, acknowledged_at, pdf_storage_path, pdf2_storage_path',
    )
    .eq('contract_type_snapshot', 'RELACION_DEPENDENCIA')
    .order('period_year', { ascending: false })
    .order('period_month', { ascending: false });

  if (periodId) query = query.eq('period_id', periodId);

  const { data: settlements, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (settlements ?? []).map((s: any) => s.id);
  const ackByStlm = new Map<string, any>();
  if (ids.length > 0) {
    const { data: acks } = await supabase
      .from('payroll_receipt_acknowledgements')
      .select('settlement_id, acknowledged_at, user_id, document_version, document_path_snapshot, ip, user_agent, superseded_at')
      .in('settlement_id', ids)
      .is('superseded_at', null);
    for (const a of acks ?? []) ackByStlm.set(a.settlement_id, a);
  }

  const headers = [
    'periodo', 'colaborador', 'email', 'estado', 'publicado_el', 'confirmado_el',
    'version_documento', 'archivo_confirmado', 'ip', 'user_agent',
  ];
  const rows = (settlements ?? []).map((s: any) => {
    const ack = ackByStlm.get(s.id);
    return [
      formatPayrollPeriodLabelFromKey({
        year: s.period_year,
        month: s.period_month,
        period_type: (s.period_type as PayrollPeriodType | null) ?? 'MONTHLY',
      }),
      `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim(),
      s.employee_email ?? '',
      RECEIPT_STATUS_LABELS[receiptStatus(s)],
      s.sent_at ?? '',
      s.acknowledged_at ?? '',
      ack?.document_version ?? '',
      ack?.document_path_snapshot ?? '',
      ack?.ip ?? '',
      ack?.user_agent ?? '',
    ];
  });

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(toCsv(headers, rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="constancias_recibos_${stamp}.csv"`,
    },
  });
}

import { NextRequest, NextResponse } from 'next/server';
import { getAuthResult } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { hasPdf } from '@/lib/payrollReceipts';

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/portal/payroll/settlements/[id]/acknowledge
// Registra la RECEPCIÓN del recibo por parte del colaborador (no es conformidad).
// Idempotente: si ya está confirmado devuelve already_confirmed.
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const auth = await getAuthResult();
    if (!auth.user || !auth.employee) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    // El dueño se deriva SIEMPRE de la sesión, nunca del body.
    const employeeId = auth.employee.id;
    const userId = auth.user.id;

    const { id } = await context.params;
    const supabase = getSupabaseServer();

    const { data: settlement, error } = await supabase
      .from('payroll_settlements_with_details')
      .select(
        'id, employee_id, status, contract_type_snapshot, requires_acknowledgement, pdf_storage_path, pdf2_storage_path, pdf_uploaded_at',
      )
      .eq('id', id)
      .eq('employee_id', employeeId)
      .single();

    if (error || !settlement) {
      return NextResponse.json({ error: 'Liquidación no encontrada' }, { status: 404 });
    }
    if (settlement.status !== 'SENT') {
      return NextResponse.json({ error: 'El recibo todavía no fue publicado.' }, { status: 400 });
    }
    if (settlement.contract_type_snapshot !== 'RELACION_DEPENDENCIA') {
      return NextResponse.json({ error: 'Este tipo de liquidación no lleva recibo.' }, { status: 400 });
    }
    if (!hasPdf(settlement)) {
      return NextResponse.json({ error: 'El recibo no tiene un archivo disponible.' }, { status: 400 });
    }

    // Versionado real llega en la fase de "recibo corregido"; por ahora siempre v1.
    const documentVersion = 1;

    const { data: existing } = await supabase
      .from('payroll_receipt_acknowledgements')
      .select('id, acknowledged_at')
      .eq('settlement_id', id)
      .eq('document_version', documentVersion)
      .is('superseded_at', null)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        success: true,
        already_confirmed: true,
        acknowledged_at: existing.acknowledged_at,
      });
    }

    const forwarded = req.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : null;

    const { data: created, error: insertError } = await supabase
      .from('payroll_receipt_acknowledgements')
      .insert({
        settlement_id: id,
        employee_id: employeeId,
        user_id: userId,
        document_version: documentVersion,
        document_path_snapshot: settlement.pdf_storage_path,
        document2_path_snapshot: settlement.pdf2_storage_path,
        document_uploaded_at_snapshot: settlement.pdf_uploaded_at,
        source: 'portal',
        ip,
        user_agent: req.headers.get('user-agent'),
      })
      .select('acknowledged_at')
      .single();

    if (insertError) {
      // Carrera con otro tab: el UNIQUE(settlement_id, document_version) ya lo cubre.
      if ((insertError as any).code === '23505') {
        const { data: row } = await supabase
          .from('payroll_receipt_acknowledgements')
          .select('acknowledged_at')
          .eq('settlement_id', id)
          .eq('document_version', documentVersion)
          .maybeSingle();
        return NextResponse.json({
          success: true,
          already_confirmed: true,
          acknowledged_at: row?.acknowledged_at ?? null,
        });
      }
      console.error('[acknowledge] insert error:', insertError);
      return NextResponse.json({ error: 'No se pudo registrar la recepción.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, acknowledged_at: created.acknowledged_at });
  } catch (error: any) {
    console.error('Error in POST /acknowledge:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

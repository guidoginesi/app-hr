import { NextRequest, NextResponse } from 'next/server';
import { getAuthResult } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/portal/payroll/payslips/[id] - Get signed URL for payslip PDF
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const auth = await getAuthResult();
    if (!auth.user || !auth.employee) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await context.params;
    const supabase = getSupabaseServer();

    // Verify the settlement belongs to the logged-in employee
    const { data: settlement, error: settlementError } = await supabase
      .from('payroll_settlements_with_details')
      .select('id, employee_id, contract_type_snapshot')
      .eq('id', id)
      .eq('employee_id', auth.employee.id)
      .single();

    if (settlementError || !settlement) {
      return NextResponse.json({ error: 'Liquidación no encontrada' }, { status: 404 });
    }

    // Verify contract type is RELACION_DEPENDENCIA
    if (settlement.contract_type_snapshot !== 'RELACION_DEPENDENCIA') {
      return NextResponse.json(
        { error: 'Los recibos solo están disponibles para empleados en relación de dependencia' },
        { status: 400 }
      );
    }

    // Get payslip record
    const { data: payslip, error: payslipError } = await supabase
      .from('payroll_payslips')
      .select('pdf_storage_path, pdf_filename')
      .eq('settlement_id', id)
      .single();

    if (payslipError || !payslip || !payslip.pdf_storage_path) {
      return NextResponse.json({ error: 'Recibo no encontrado' }, { status: 404 });
    }

    // Generate signed URL (valid for 1 hour)
    const { data: signedUrlData, error: signedUrlError } = await supabase
      .storage
      .from('payslips')
      .createSignedUrl(payslip.pdf_storage_path, 3600);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error('Error creating signed URL:', signedUrlError);
      return NextResponse.json({ error: 'Error al generar el enlace de descarga' }, { status: 500 });
    }

    return NextResponse.json({
      url: signedUrlData.signedUrl,
      filename: payslip.pdf_filename,
    });
  } catch (error: any) {
    console.error('Error in GET /api/portal/payroll/payslips/[id]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

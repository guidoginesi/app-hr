import { NextRequest, NextResponse } from 'next/server';
import { getAuthResult } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { parsePayslipSlot } from '@/lib/payrollPayslips';

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/portal/payroll/payslips/[id]?slot=1|2 - Download payslip PDF
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const auth = await getAuthResult();
    if (!auth.user || !auth.employee) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await context.params;
    const slot = parsePayslipSlot(req.nextUrl.searchParams.get('slot'));
    const supabase = getSupabaseServer();

    const { data: settlement, error: settlementError } = await supabase
      .from('payroll_settlements_with_details')
      .select('id, employee_id, contract_type_snapshot, status')
      .eq('id', id)
      .eq('employee_id', auth.employee.id)
      .single();

    if (settlementError || !settlement) {
      return NextResponse.json({ error: 'Liquidación no encontrada' }, { status: 404 });
    }

    // Solo recibos publicados: sin esto, un recibo en borrador es descargable con solo conocer el UUID.
    if (settlement.status !== 'SENT') {
      return NextResponse.json({ error: 'El recibo todavía no fue publicado' }, { status: 404 });
    }

    if (settlement.contract_type_snapshot !== 'RELACION_DEPENDENCIA') {
      return NextResponse.json(
        { error: 'Los recibos solo están disponibles para empleados en relación de dependencia' },
        { status: 400 }
      );
    }

    const { data: payslip, error: payslipError } = await supabase
      .from('payroll_payslips')
      .select('pdf_storage_path, pdf_filename, pdf2_storage_path, pdf2_filename')
      .eq('settlement_id', id)
      .single();

    const storagePath = slot === 2 ? payslip?.pdf2_storage_path : payslip?.pdf_storage_path;
    const filename =
      (slot === 2 ? payslip?.pdf2_filename : payslip?.pdf_filename) || `recibo-${slot}.pdf`;

    if (payslipError || !payslip || !storagePath) {
      return NextResponse.json({ error: 'Recibo no encontrado' }, { status: 404 });
    }

    const { data: fileData, error: downloadError } = await supabase.storage
      .from('payslips')
      .download(storagePath);

    if (downloadError || !fileData) {
      console.error('Error downloading payslip:', downloadError);
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('payslips')
        .createSignedUrl(storagePath, 300);
      if (signedUrlError || !signedUrlData?.signedUrl) {
        return NextResponse.json({ error: 'Error al obtener el recibo' }, { status: 500 });
      }
      return NextResponse.json({ url: signedUrlData.signedUrl, filename });
    }

    return new NextResponse(fileData, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-cache',
      },
    });
  } catch (error: any) {
    console.error('Error in GET /api/portal/payroll/payslips/[id]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

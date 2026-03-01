import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/admin/payroll/settlements/[id]/payslip - Upload PDF for RELACION_DEPENDENCIA
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { isAdmin, user } = await requireAdmin();
    if (!isAdmin || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const supabase = getSupabaseServer();

    // Get settlement with period info
    const { data: settlement, error: fetchError } = await supabase
      .from('payroll_employee_settlements')
      .select('*, period:payroll_periods(period_key)')
      .eq('id', id)
      .single();

    if (fetchError || !settlement) {
      return NextResponse.json({ error: 'Liquidación no encontrada' }, { status: 404 });
    }

    if (settlement.contract_type_snapshot !== 'RELACION_DEPENDENCIA') {
      return NextResponse.json(
        { error: 'Solo se pueden subir recibos para liquidaciones de relación de dependencia' },
        { status: 400 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No se proporcionó un archivo' }, { status: 400 });
    }

    const periodData = settlement.period as { period_key: string } | null;
    const periodKey = periodData?.period_key || 'unknown';
    const storagePath = `${settlement.employee_id}/${periodKey}.pdf`;

    const fileBuffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from('payslips')
      .upload(storagePath, fileBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      console.error('Error uploading payslip PDF:', uploadError);
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: payslip, error: updateError } = await supabase
      .from('payroll_payslips')
      .update({
        pdf_storage_path: storagePath,
        pdf_filename: file.name,
        pdf_uploaded_at: new Date().toISOString(),
        pdf_uploaded_by: user.id,
      })
      .eq('settlement_id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating payslip record:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json(payslip, { status: 201 });
  } catch (error: any) {
    console.error('Error in POST /api/admin/payroll/settlements/[id]/payslip:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET /api/admin/payroll/settlements/[id]/payslip - Get signed URL for PDF download
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const supabase = getSupabaseServer();

    const { data: payslip, error: fetchError } = await supabase
      .from('payroll_payslips')
      .select('pdf_storage_path')
      .eq('settlement_id', id)
      .single();

    if (fetchError || !payslip) {
      return NextResponse.json({ error: 'Recibo no encontrado' }, { status: 404 });
    }

    if (!payslip.pdf_storage_path) {
      return NextResponse.json({ error: 'No hay PDF cargado para esta liquidación' }, { status: 404 });
    }

    const { data: signedUrlData, error: urlError } = await supabase.storage
      .from('payslips')
      .createSignedUrl(payslip.pdf_storage_path, 3600);

    if (urlError) {
      console.error('Error creating signed URL:', urlError);
      return NextResponse.json({ error: urlError.message }, { status: 500 });
    }

    return NextResponse.json({ url: signedUrlData.signedUrl });
  } catch (error: any) {
    console.error('Error in GET /api/admin/payroll/settlements/[id]/payslip:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

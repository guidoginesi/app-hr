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

// DELETE /api/admin/payroll/settlements/[id]/payslip - Remove uploaded PDF
export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const supabase = getSupabaseServer();

    // Get current payslip path
    const { data: payslip, error: fetchError } = await supabase
      .from('payroll_payslips')
      .select('pdf_storage_path')
      .eq('settlement_id', id)
      .single();

    if (fetchError || !payslip) {
      return NextResponse.json({ error: 'Recibo no encontrado' }, { status: 404 });
    }

    // Remove from storage if it exists
    if (payslip.pdf_storage_path) {
      const { error: storageError } = await supabase.storage
        .from('payslips')
        .remove([payslip.pdf_storage_path]);

      if (storageError) {
        console.error('Error deleting payslip from storage:', storageError);
        // Continue anyway to clear the DB record
      }
    }

    // Clear DB record
    const { error: updateError } = await supabase
      .from('payroll_payslips')
      .update({
        pdf_storage_path: null,
        pdf_filename: null,
        pdf_uploaded_at: null,
        pdf_uploaded_by: null,
      })
      .eq('settlement_id', id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Also reset settlement status to DRAFT if it was READY_TO_SEND
    await supabase
      .from('payroll_employee_settlements')
      .update({ status: 'DRAFT' })
      .eq('id', id)
      .eq('status', 'READY_TO_SEND');

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in DELETE /api/admin/payroll/settlements/[id]/payslip:', error);
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

    // Download server-side and proxy to avoid S3 ACL issues
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('payslips')
      .download(payslip.pdf_storage_path);

    if (downloadError || !fileData) {
      console.error('Error downloading payslip for admin:', downloadError);
      // Fallback: signed URL
      const { data: signedUrlData, error: urlError } = await supabase.storage
        .from('payslips')
        .createSignedUrl(payslip.pdf_storage_path, 3600);
      if (urlError || !signedUrlData?.signedUrl) {
        return NextResponse.json({ error: urlError?.message || 'Error al obtener el PDF' }, { status: 500 });
      }
      return NextResponse.json({ url: signedUrlData.signedUrl });
    }

    return new NextResponse(fileData, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="recibo.pdf"`,
        'Cache-Control': 'private, no-cache',
      },
    });
  } catch (error: any) {
    console.error('Error in GET /api/admin/payroll/settlements/[id]/payslip:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

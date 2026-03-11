import { NextRequest, NextResponse } from 'next/server';
import { getAuthResult } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/portal/payroll/invoices/[id] - Employee uploads their invoice PDF
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const auth = await getAuthResult();
    if (!auth.user || !auth.employee) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await context.params;
    const supabase = getSupabaseServer();

    // Verify the settlement belongs to the logged-in employee and is MONOTRIBUTO
    const { data: settlement, error: fetchError } = await supabase
      .from('payroll_settlements_with_details')
      .select('id, employee_id, contract_type_snapshot, period_key, status, period_year, period_month, first_name, last_name')
      .eq('id', id)
      .eq('employee_id', auth.employee.id)
      .single();

    if (fetchError || !settlement) {
      return NextResponse.json({ error: 'Liquidación no encontrada' }, { status: 404 });
    }

    if (settlement.contract_type_snapshot !== 'MONOTRIBUTO') {
      return NextResponse.json({ error: 'Las facturas solo aplican a empleados Monotributo' }, { status: 400 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'No se proporcionó un archivo' }, { status: 400 });
    }

    // Build structured filename: POW SA - FACTURA [NOMBRE] - PERIODO [MES AÑO].pdf
    const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const monthName = MONTH_NAMES[(settlement.period_month ?? 1) - 1] ?? settlement.period_month;
    const collaboratorName = `${settlement.first_name} ${settlement.last_name}`.trim();
    const structuredFilename = `POW SA - FACTURA ${collaboratorName} - PERIODO ${monthName} ${settlement.period_year}.pdf`;

    const storagePath = `${auth.employee.id}/${settlement.period_key}.pdf`;
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from('invoices')
      .upload(storagePath, fileBuffer, { contentType: 'application/pdf', upsert: true });

    if (uploadError) {
      console.error('Error uploading invoice:', uploadError);
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    // Upsert invoice record with structured filename
    const { error: upsertError } = await supabase
      .from('payroll_invoices')
      .upsert({
        settlement_id: id,
        pdf_storage_path: storagePath,
        pdf_filename: structuredFilename,
        uploaded_at: new Date().toISOString(),
        uploaded_by: auth.user.id,
      }, { onConflict: 'settlement_id' });

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    return NextResponse.json({
      invoice_storage_path: storagePath,
      invoice_filename: structuredFilename,
      invoice_uploaded_at: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error in POST /api/portal/payroll/invoices/[id]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET /api/portal/payroll/invoices/[id] - Employee downloads their own invoice
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const auth = await getAuthResult();
    if (!auth.user || !auth.employee) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await context.params;
    const supabase = getSupabaseServer();

    const { data: invoice, error } = await supabase
      .from('payroll_invoices')
      .select('pdf_storage_path, pdf_filename, settlement_id')
      .eq('settlement_id', id)
      .single();

    if (error || !invoice?.pdf_storage_path) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 });
    }

    // Verify ownership via settlement
    const { data: settlement } = await supabase
      .from('payroll_employee_settlements')
      .select('employee_id')
      .eq('id', id)
      .single();

    if (!settlement || settlement.employee_id !== auth.employee.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { data: fileData, error: downloadError } = await supabase.storage
      .from('invoices')
      .download(invoice.pdf_storage_path);

    if (downloadError || !fileData) {
      return NextResponse.json({ error: 'Error al obtener la factura' }, { status: 500 });
    }

    return new NextResponse(fileData, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${invoice.pdf_filename || 'factura.pdf'}"`,
        'Cache-Control': 'private, no-cache',
      },
    });
  } catch (error: any) {
    console.error('Error in GET /api/portal/payroll/invoices/[id]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

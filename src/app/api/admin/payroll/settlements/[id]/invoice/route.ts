import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/admin/payroll/settlements/[id]/invoice - Admin downloads employee invoice
export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const supabase = getSupabaseServer();

    const { data: invoice, error } = await supabase
      .from('payroll_invoices')
      .select('pdf_storage_path, pdf_filename')
      .eq('settlement_id', id)
      .single();

    if (error || !invoice?.pdf_storage_path) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 });
    }

    const { data: fileData, error: downloadError } = await supabase.storage
      .from('invoices')
      .download(invoice.pdf_storage_path);

    if (downloadError || !fileData) {
      console.error('Error downloading invoice:', downloadError);
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
    console.error('Error in GET /api/admin/payroll/settlements/[id]/invoice:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

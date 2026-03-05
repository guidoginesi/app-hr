import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/admin/certificates/[id] — generate signed download URL (admin)
export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const supabase = getSupabaseServer();

    const { data: cert, error } = await supabase
      .from('employee_certificates')
      .select('file_path, file_name')
      .eq('id', id)
      .single();

    if (error || !cert) {
      return NextResponse.json({ error: 'Certificado no encontrado' }, { status: 404 });
    }

    const { data: signed, error: signError } = await supabase.storage
      .from('certificates')
      .createSignedUrl(cert.file_path, 300);

    if (signError || !signed?.signedUrl) {
      return NextResponse.json({ error: 'No se pudo generar el enlace de descarga' }, { status: 500 });
    }

    return NextResponse.json({ url: signed.signedUrl, file_name: cert.file_name });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

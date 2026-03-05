import { NextRequest, NextResponse } from 'next/server';
import { requirePortalAccess } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/portal/certificates/[id] — generate a signed download URL
export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const auth = await requirePortalAccess();
    if (!auth?.employee) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const supabase = getSupabaseServer();

    const { data: cert, error } = await supabase
      .from('employee_certificates')
      .select('*')
      .eq('id', id)
      .eq('employee_id', auth.employee.id)
      .single();

    if (error || !cert) {
      return NextResponse.json({ error: 'Certificado no encontrado' }, { status: 404 });
    }

    const { data: signed, error: signError } = await supabase.storage
      .from('certificates')
      .createSignedUrl(cert.file_path, 300); // 5 min

    if (signError || !signed?.signedUrl) {
      return NextResponse.json({ error: 'No se pudo generar el enlace de descarga' }, { status: 500 });
    }

    return NextResponse.json({ url: signed.signedUrl });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/portal/certificates/[id] — delete own certificate
export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const auth = await requirePortalAccess();
    if (!auth?.employee) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const supabase = getSupabaseServer();

    const { data: cert, error } = await supabase
      .from('employee_certificates')
      .select('file_path')
      .eq('id', id)
      .eq('employee_id', auth.employee.id)
      .single();

    if (error || !cert) {
      return NextResponse.json({ error: 'Certificado no encontrado' }, { status: 404 });
    }

    await supabase.storage.from('certificates').remove([cert.file_path]);

    await supabase.from('employee_certificates').delete().eq('id', id);

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

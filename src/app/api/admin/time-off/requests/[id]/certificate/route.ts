import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

const BUCKET = 'certificates';

/**
 * GET — URL firmada de 120s del certificado médico, para HR.
 *
 * El bucket es privado y el acceso lo decide el rol acá, no la URL. El líder no
 * tiene endpoint equivalente: el certificado es dato de salud y no lo ve.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const supabase = getSupabaseServer();
    const { data: leave } = await supabase
      .from('leave_requests')
      .select('certificate_path')
      .eq('id', id)
      .maybeSingle();

    if (!leave) return NextResponse.json({ error: 'Licencia no encontrada' }, { status: 404 });
    if (!leave.certificate_path) {
      return NextResponse.json({ error: 'Todavía no hay certificado cargado.' }, { status: 404 });
    }

    const { data: signed, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(leave.certificate_path as string, 120);
    if (error || !signed) {
      return NextResponse.json({ error: error?.message ?? 'No se pudo abrir el archivo.' }, { status: 500 });
    }
    return NextResponse.json({ url: signed.signedUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error inesperado';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

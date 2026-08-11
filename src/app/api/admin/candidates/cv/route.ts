import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { signedResumeUrl } from '@/lib/resumes';

export const dynamic = 'force-dynamic';

/**
 * Abre el CV de una postulación.
 *
 * Existe porque el bucket dejó de ser público: el link se firma recién cuando
 * alguien lo pide, y sólo si tiene sesión de admin. Antes el CV se abría con la
 * URL guardada en la fila, que funcionaba para cualquiera que la tuviera.
 */
export async function GET(req: NextRequest) {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const applicationId = req.nextUrl.searchParams.get('applicationId');
  if (!applicationId) return NextResponse.json({ error: 'Falta la postulación' }, { status: 400 });

  const supabase = getSupabaseServer();
  const { data: application } = await supabase
    .from('applications')
    .select('resume_url')
    .eq('id', applicationId)
    .maybeSingle();

  if (!application) {
    return NextResponse.json({ error: 'No encontramos esa postulación' }, { status: 404 });
  }

  const url = await signedResumeUrl(application.resume_url as string);
  if (!url) {
    return NextResponse.json({ error: 'Esta postulación no tiene CV' }, { status: 404 });
  }

  return NextResponse.redirect(url);
}

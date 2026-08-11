import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { resumeSignedUrl } from '@/lib/talentPoolServer';

export const dynamic = 'force-dynamic';

/**
 * Abre el CV de una entrada del banco.
 *
 * Va por acá y no con el link directo al archivo por dos razones: el link se
 * firma al momento de abrirlo (así el panel no genera cientos de links que
 * nadie usa), y cuando el bucket de CVs deje de ser público esto sigue andando
 * sin tocar nada.
 */
export async function GET(req: NextRequest) {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Falta el registro' }, { status: 400 });

  const supabase = getSupabaseServer();
  const { data: entry } = await supabase
    .from('talent_pool_entries')
    .select('resume_path')
    .eq('id', id)
    .maybeSingle();
  if (!entry?.resume_path) {
    return NextResponse.json({ error: 'No encontramos el CV' }, { status: 404 });
  }

  const url = await resumeSignedUrl(entry.resume_path as string);
  if (!url) return NextResponse.json({ error: 'No pudimos abrir el CV' }, { status: 500 });

  return NextResponse.redirect(url);
}

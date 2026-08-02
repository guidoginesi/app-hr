import { NextRequest, NextResponse } from 'next/server';
import { getAuthResult } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { resolveInquiryAccess } from '@/lib/inquiryAccess';

type Ctx = { params: Promise<{ id: string; attachmentId: string }> };

// GET — descarga del adjunto. El acceso se resuelve contra la consulta,
// nunca contra el id del archivo suelto.
export async function GET(_req: NextRequest, ctx: Ctx) {
  const auth = await getAuthResult();
  const { id, attachmentId } = await ctx.params;
  const { access } = await resolveInquiryAccess(id, auth);
  if (access === 'none') return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  const supabase = getSupabaseServer();
  const { data: att } = await supabase
    .from('inquiry_attachments')
    .select('file_path, file_name, inquiry_id')
    .eq('id', attachmentId)
    .maybeSingle();

  // El adjunto tiene que pertenecer a ESA consulta.
  if (!att || att.inquiry_id !== id) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  }

  const { data: signed, error } = await supabase.storage
    .from('inquiry-files')
    .createSignedUrl(att.file_path, 120);

  if (error || !signed?.signedUrl) {
    return NextResponse.json({ error: 'No se pudo obtener el archivo' }, { status: 500 });
  }
  return NextResponse.json({ url: signed.signedUrl, filename: att.file_name });
}

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getAuthResult } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import {
  resolveInquiryAccess,
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_MIME,
  ATTACHMENT_MAX_PER_INQUIRY,
} from '@/lib/inquiryAccess';

type Ctx = { params: Promise<{ id: string }> };

// GET — adjuntos de la consulta (para las tres audiencias, según acceso)
export async function GET(_req: NextRequest, ctx: Ctx) {
  const auth = await getAuthResult();
  const { id } = await ctx.params;
  const { access } = await resolveInquiryAccess(id, auth);
  if (access === 'none') return NextResponse.json({ error: 'No encontrada' }, { status: 404 });

  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from('inquiry_attachments')
    .select('id, file_name, file_size, content_type, created_at')
    .eq('inquiry_id', id)
    .order('created_at', { ascending: true });

  return NextResponse.json({ items: data ?? [] });
}

// POST — subir un adjunto (multipart)
export async function POST(req: NextRequest, ctx: Ctx) {
  const auth = await getAuthResult();
  const { id } = await ctx.params;
  const { access } = await resolveInquiryAccess(id, auth);
  // El líder no sube adjuntos: solo el dueño y People.
  if (access !== 'owner' && access !== 'hr') {
    return NextResponse.json({ error: 'No encontrada' }, { status: 404 });
  }

  const form = await req.formData();
  const file = form.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No se envió ningún archivo' }, { status: 400 });

  if (file.size > ATTACHMENT_MAX_BYTES) {
    return NextResponse.json({ error: 'El archivo supera los 4 MB' }, { status: 400 });
  }
  // Validación server-side real: el accept= del cliente es cosmético.
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (!ATTACHMENT_MIME.includes(file.type) || !['pdf', 'jpg', 'jpeg', 'png'].includes(ext)) {
    return NextResponse.json({ error: 'Solo se aceptan PDF, JPG o PNG' }, { status: 400 });
  }

  const supabase = getSupabaseServer();
  const { count } = await supabase
    .from('inquiry_attachments')
    .select('id', { count: 'exact', head: true })
    .eq('inquiry_id', id);
  if ((count ?? 0) >= ATTACHMENT_MAX_PER_INQUIRY) {
    return NextResponse.json({ error: 'Se alcanzó el máximo de archivos para esta consulta' }, { status: 400 });
  }

  const path = `${id}/${randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from('inquiry-files')
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });

  if (upErr) {
    console.error('[inquiries] error subiendo adjunto:', upErr);
    return NextResponse.json({ error: 'No se pudo subir el archivo' }, { status: 500 });
  }

  const { data, error } = await supabase
    .from('inquiry_attachments')
    .insert({
      inquiry_id: id,
      file_path: path,
      file_name: file.name,
      file_size: file.size,
      content_type: file.type,
      uploaded_by: auth.user?.id ?? null,
    })
    .select('id, file_name, file_size, content_type, created_at')
    .single();

  if (error) {
    // No dejamos el objeto huérfano si falla el registro.
    await supabase.storage.from('inquiry-files').remove([path]);
    return NextResponse.json({ error: 'No se pudo registrar el archivo' }, { status: 500 });
  }

  await supabase
    .from('employee_inquiries')
    .update({ last_activity_at: new Date().toISOString() })
    .eq('id', id);

  return NextResponse.json(data, { status: 201 });
}

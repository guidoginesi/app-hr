import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

// Bucket PÚBLICO a propósito: la carátula se muestra dentro de un mail, y un
// cliente de mail no puede pedir una URL firmada. Sólo van imágenes que se
// mandan a todo el equipo; nada privado. Ver db/migration-message-images-bucket.sql.
const MESSAGE_IMAGES_BUCKET = 'message-images';
const MAX_BYTES = 5 * 1024 * 1024;
const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

// POST /api/admin/messages/cover - Sube la carátula del mail y devuelve su URL pública.
export async function POST(req: NextRequest) {
  const { isAdmin, user } = await requireAdmin();
  if (!isAdmin || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'Falta el archivo.' }, { status: 400 });
  const ext = TYPES[file.type];
  if (!ext) return NextResponse.json({ error: 'La carátula tiene que ser JPG, PNG, WebP o GIF.' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'La carátula no puede pasar los 5 MB.' }, { status: 400 });

  const supabase = getSupabaseServer();
  const path = `covers/${new Date().toISOString().slice(0, 7)}/${randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(MESSAGE_IMAGES_BUCKET)
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false, cacheControl: '31536000' });
  if (error) return NextResponse.json({ error: `No se pudo subir la carátula: ${error.message}` }, { status: 500 });

  const { data } = supabase.storage.from(MESSAGE_IMAGES_BUCKET).getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl });
}

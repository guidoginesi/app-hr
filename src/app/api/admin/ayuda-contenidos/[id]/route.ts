import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { linkValido } from '@/lib/ayudaContenidos';
import { limpiarHtml } from '@/lib/ayudaContenidosHtml';
import { CambiosDeContenidoSchema } from '../schema';

type Ctx = { params: Promise<{ id: string }> };

// PATCH /api/admin/ayuda-contenidos/[id] — edición. Todos los campos son opcionales.
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { isAdmin, user } = await requireAdmin();
  if (!isAdmin || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const parsed = CambiosDeContenidoSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 });
  }
  const d = parsed.data;

  const update: Record<string, unknown> = { updated_at: new Date().toISOString(), updated_by: user.id };
  if (d.titulo !== undefined) update.titulo = d.titulo;
  if (d.seccion !== undefined) update.seccion = d.seccion;
  if (d.resumen !== undefined) update.resumen = d.resumen || null;
  if (d.cuerpo_html !== undefined) update.cuerpo_html = limpiarHtml(d.cuerpo_html);
  if (d.icono !== undefined) update.icono = d.icono;
  if (d.audiencia !== undefined) update.audiencia = d.audiencia;
  if (d.orden !== undefined) update.orden = d.orden;
  if (d.publicado !== undefined) update.publicado = d.publicado;
  if (d.link_url !== undefined) {
    const link = d.link_url ? linkValido(d.link_url) : null;
    if (d.link_url && !link) {
      return NextResponse.json({ error: 'El link tiene que empezar con https:// o mailto:.' }, { status: 400 });
    }
    update.link_url = link;
  }

  const supabase = getSupabaseServer();
  const { data, error } = await supabase.from('ayuda_contenidos').update(update).eq('id', id).select('*').single();
  if (error) {
    const noEsta = error.code === 'PGRST116';
    return NextResponse.json({ error: noEsta ? 'No existe ese contenido.' : error.message }, { status: noEsta ? 404 : 500 });
  }
  return NextResponse.json({ contenido: data });
}

// DELETE /api/admin/ayuda-contenidos/[id]
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const supabase = getSupabaseServer();
  const { error } = await supabase.from('ayuda_contenidos').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { linkValido, slugDe } from '@/lib/ayudaContenidos';
import { limpiarHtml } from '@/lib/ayudaContenidosHtml';
import { NuevoContenidoSchema } from './schema';

// GET /api/admin/ayuda-contenidos — todos, publicados o no.
export async function GET() {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('ayuda_contenidos')
    .select('*')
    .order('orden')
    .order('titulo');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contenidos: data ?? [] });
}

// POST /api/admin/ayuda-contenidos — alta.
export async function POST(req: NextRequest) {
  const { isAdmin, user } = await requireAdmin();
  if (!isAdmin || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = NuevoContenidoSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 });
  }
  const d = parsed.data;

  const link = d.link_url ? linkValido(d.link_url) : null;
  if (d.link_url && !link) {
    return NextResponse.json({ error: 'El link tiene que empezar con https:// o mailto:.' }, { status: 400 });
  }

  const supabase = getSupabaseServer();

  // El slug nace del título y no cambia después: si se renombra el contenido,
  // los links que alguien ya compartió siguen andando.
  const base = slugDe(d.titulo);
  const { data: parecidos } = await supabase.from('ayuda_contenidos').select('slug').like('slug', `${base}%`);
  const usados = new Set((parecidos ?? []).map((p) => p.slug as string));
  let slug = base;
  for (let n = 2; usados.has(slug); n++) slug = `${base}-${n}`;

  const { data, error } = await supabase
    .from('ayuda_contenidos')
    .insert({
      slug,
      titulo: d.titulo,
      seccion: d.seccion,
      resumen: d.resumen || null,
      cuerpo_html: limpiarHtml(d.cuerpo_html),
      link_url: link,
      icono: d.icono ?? null,
      audiencia: d.audiencia,
      orden: d.orden,
      publicado: d.publicado,
      updated_by: user.id,
    })
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contenido: data }, { status: 201 });
}

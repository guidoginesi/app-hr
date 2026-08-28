import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { generarPropuestaDeConsulta, yaTienePropuesta } from '@/lib/manual/generarPropuestaDeConsulta';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/**
 * Propuesta de respuesta para una consulta, armada con el Manual RRHH.
 *
 * La primera se genera sola al entrar la consulta, así el borrador ya está
 * cuando People la abre. Este POST es para pedir OTRA: después de sincronizar el
 * manual, de aprobar una FAQ, o simplemente porque la anterior no servía.
 *
 * La propuesta NUNCA se manda sola. Queda como borrador para que People lo
 * edite y lo envíe.
 */

/** Devuelve la última propuesta, con los títulos de las secciones que citó. */
async function ultimaPropuesta(inquiryId: string) {
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from('inquiry_answer_drafts')
    .select('*')
    .eq('inquiry_id', inquiryId)
    .order('creado_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;

  const slugs = (data.secciones_citadas ?? []) as string[];
  const citas: { slug: string; ruta: string[] }[] = [];
  const delManual = slugs.filter((s) => !s.startsWith('faq:'));
  const deFaq = slugs.filter((s) => s.startsWith('faq:')).map((s) => s.slice(4));
  if (delManual.length) {
    const { data: secciones } = await supabase
      .from('manual_sections')
      .select('slug, ruta')
      .in('slug', delManual);
    for (const s of secciones ?? []) citas.push({ slug: s.slug as string, ruta: (s.ruta ?? []) as string[] });
  }
  if (deFaq.length) {
    const { data: faqs } = await supabase.from('manual_faqs').select('id, pregunta').in('id', deFaq);
    // Se marcan como FAQ para que en la pantalla se distingan del manual.
    for (const f of faqs ?? []) citas.push({ slug: `faq:${f.id}`, ruta: ['FAQ', f.pregunta as string] });
  }
  return { ...data, citas };
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  return NextResponse.json({ propuesta: await ultimaPropuesta(id) });
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { isAdmin, user } = await requireAdmin();
  if (!isAdmin || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;

  /**
   * `?auto=1` es la generación automática al abrir una consulta que no tenía
   * propuesta. Si ya hay una, no genera: el alta la dispara sola y tarda unos
   * segundos, así que abrir la consulta en ese rato pediría una segunda para
   * nada. El botón no manda `auto` porque pedir OTRA es justamente su función.
   */
  if (req.nextUrl.searchParams.get('auto') === '1' && (await yaTienePropuesta(id))) {
    return NextResponse.json({ propuesta: await ultimaPropuesta(id) });
  }

  const res = await generarPropuestaDeConsulta(id, { generadoPor: user.id }).catch((e) => ({
    ok: false as const,
    motivo: e instanceof Error ? e.message : 'No se pudo generar la propuesta',
  }));
  if (!res.ok) return NextResponse.json({ error: res.motivo }, { status: 500 });

  return NextResponse.json({ propuesta: await ultimaPropuesta(id) });
}

/** Descartar: es la calificación negativa, y es la que más enseña. */
export async function PATCH(_req: NextRequest, ctx: Ctx) {
  const { isAdmin, user } = await requireAdmin();
  if (!isAdmin || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const supabase = getSupabaseServer();

  const { error } = await supabase
    .from('inquiry_answer_drafts')
    .update({ resultado: 'DESCARTADA', calificado_at: new Date().toISOString(), calificado_por: user.id })
    .eq('inquiry_id', id)
    .is('resultado', null);
  if (error) return NextResponse.json({ error: 'No se pudo registrar' }, { status: 500 });

  return NextResponse.json({ ok: true });
}

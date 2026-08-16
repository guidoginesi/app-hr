import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { generarPropuesta, seccionesCitables, PROMPT_VERSION } from '@/lib/manual/propuesta';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/**
 * Propuesta de respuesta para una consulta, armada con el Manual RRHH.
 *
 * Se genera a pedido y no al entrar la consulta: la mayoría de las consultas
 * las contesta alguien que ya sabe la respuesta, y generar de más cuesta plata
 * en propuestas que nadie va a mirar.
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
  let citas: { slug: string; ruta: string[] }[] = [];
  if (slugs.length) {
    const { data: secciones } = await supabase
      .from('manual_sections')
      .select('slug, ruta')
      .in('slug', slugs);
    citas = (secciones ?? []).map((s) => ({ slug: s.slug as string, ruta: (s.ruta ?? []) as string[] }));
  }
  return { ...data, citas };
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  return NextResponse.json({ propuesta: await ultimaPropuesta(id) });
}

export async function POST(_req: NextRequest, ctx: Ctx) {
  const { isAdmin, user } = await requireAdmin();
  if (!isAdmin || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const supabase = getSupabaseServer();

  const { data: consulta } = await supabase
    .from('inquiries_with_details')
    .select('id, subject, category, employee_name')
    .eq('id', id)
    .maybeSingle();
  if (!consulta) return NextResponse.json({ error: 'Consulta no encontrada' }, { status: 404 });

  // El primer mensaje del colaborador es la consulta; el resto es la
  // conversación. Se manda todo lo que escribió, sin las notas internas.
  const { data: mensajes } = await supabase
    .from('inquiry_messages')
    .select('body, author_role, created_at')
    .eq('inquiry_id', id)
    .eq('is_internal', false)
    .order('created_at');

  const delColaborador = (mensajes ?? []).filter((m) => m.author_role === 'employee');
  if (delColaborador.length === 0) {
    return NextResponse.json({ error: 'La consulta no tiene ningún mensaje del colaborador.' }, { status: 400 });
  }

  let generada;
  try {
    const secciones = await seccionesCitables();
    generada = await generarPropuesta(
      {
        asunto: consulta.subject as string,
        categoria: consulta.category as string,
        nombre: consulta.employee_name as string,
        mensaje: delColaborador.map((m) => m.body as string).join('\n\n'),
      },
      secciones,
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No se pudo generar la propuesta' },
      { status: 500 },
    );
  }

  // Se guarda siempre, también cuando falló: un agente que falla en silencio es
  // peor que no tenerlo.
  const { error: insertError } = await supabase.from('inquiry_answer_drafts').insert({
    inquiry_id: id,
    borrador: generada.borrador,
    nota_para_hr: generada.nota_para_hr,
    secciones_citadas: generada.secciones_citadas,
    hay_respuesta: generada.hay_respuesta,
    necesita_datos_personales: generada.necesita_datos_personales,
    modelo: generada.modelo,
    prompt_version: PROMPT_VERSION,
    secciones_ofrecidas: generada.secciones_ofrecidas,
    tokens_entrada: generada.tokens_entrada,
    tokens_salida: generada.tokens_salida,
    error: generada.error,
    generado_por: user.id,
  });
  if (insertError) {
    console.error('[propuesta] no se pudo guardar:', insertError.message);
    return NextResponse.json({ error: 'No se pudo guardar la propuesta' }, { status: 500 });
  }

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

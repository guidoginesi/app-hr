import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string; messageId: string }> };

/**
 * Editar un mensaje ya enviado de una consulta.
 *
 * Existe porque la alternativa era peor: sin esto, corregir un dato mal en una
 * respuesta ya mandada obligaba a tocar la base a mano, sin rastro y sin que el
 * colaborador se enterara de que el texto cambió debajo suyo.
 *
 * Tres reglas:
 *
 * 1. Sólo mensajes de HR. Lo que escribió el colaborador no se toca: es su voz,
 *    y editarla sería reescribir lo que preguntó.
 * 2. Queda marcado como editado, y la marca se ve también del lado del
 *    colaborador. Si se editó, se dice.
 * 3. Se guarda la versión anterior. Editar sin historial deja un hilo que puede
 *    decir algo distinto de lo que la persona leyó, sin forma de reconstruirlo.
 *
 * NO se notifica: el punto de editar es corregir sin volver a golpear la puerta.
 * Si el cambio amerita avisar, se manda un mensaje nuevo, que para eso está.
 */

const BodySchema = z.object({ body: z.string().min(1).max(10000) });

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { isAdmin, user } = await requireAdmin();
  if (!isAdmin || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'El mensaje no puede quedar vacío.' }, { status: 400 });
  }

  const { id, messageId } = await ctx.params;
  const supabase = getSupabaseServer();

  const { data: mensaje } = await supabase
    .from('inquiry_messages')
    .select('id, inquiry_id, author_role, body')
    .eq('id', messageId)
    .maybeSingle();

  if (!mensaje || mensaje.inquiry_id !== id) {
    return NextResponse.json({ error: 'Mensaje no encontrado' }, { status: 404 });
  }
  if (mensaje.author_role !== 'hr') {
    return NextResponse.json(
      { error: 'Sólo se pueden editar los mensajes de People. Lo que escribió el colaborador no se toca.' },
      { status: 400 },
    );
  }

  const nuevo = parsed.data.body.trim();
  if (nuevo === (mensaje.body as string).trim()) {
    // Sin cambios no se marca como editado: un "editado" que no corresponde
    // resta confianza a la marca cuando sí corresponde.
    return NextResponse.json({ ok: true, sin_cambios: true });
  }

  // El historial primero: si falla, se prefiere no editar antes que editar sin
  // dejar rastro.
  const { error: historialError } = await supabase.from('inquiry_message_edits').insert({
    message_id: messageId,
    body_anterior: mensaje.body,
    editado_por: user.id,
  });
  if (historialError) {
    console.error('[inquiries] no se pudo guardar el historial de edición:', historialError.message);
    return NextResponse.json({ error: 'No se pudo guardar el historial. No se editó nada.' }, { status: 500 });
  }

  const ahora = new Date().toISOString();
  const { error } = await supabase
    .from('inquiry_messages')
    .update({ body: nuevo, edited_at: ahora, edited_by: user.id })
    .eq('id', messageId);
  if (error) {
    console.error('[inquiries] no se pudo editar el mensaje:', error.message);
    return NextResponse.json({ error: 'No se pudo editar el mensaje' }, { status: 500 });
  }

  await supabase.from('inquiry_events').insert({
    inquiry_id: id,
    actor_user_id: user.id,
    event_type: 'message_edited',
    detail: 'Se editó una respuesta ya enviada',
  });

  await supabase.from('employee_inquiries').update({ updated_at: ahora }).eq('id', id);

  return NextResponse.json({ ok: true, edited_at: ahora });
}

/** El historial de una edición, para poder explicar qué decía antes. */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { messageId } = await ctx.params;
  const supabase = getSupabaseServer();

  const { data } = await supabase
    .from('inquiry_message_edits')
    .select('body_anterior, creado_at')
    .eq('message_id', messageId)
    .order('creado_at', { ascending: false });

  return NextResponse.json({ versiones: data ?? [] });
}

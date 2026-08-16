import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthResult } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { getAdminUserIds, createSystemNotification } from '@/lib/notificationService';

type Ctx = { params: Promise<{ id: string }> };
const ReplySchema = z.object({ body: z.string().min(1) });

/** El líder solo accede si tiene un permiso vigente para ESTA consulta. */
async function hasShare(supabase: any, inquiryId: string, leaderUserId: string): Promise<boolean> {
  const { data } = await supabase
    .from('inquiry_leader_shares')
    .select('id')
    .eq('inquiry_id', inquiryId)
    .eq('leader_user_id', leaderUserId)
    .is('revoked_at', null)
    .maybeSingle();
  return Boolean(data);
}

// GET — detalle + hilo SIN notas internas de People
export async function GET(_req: NextRequest, ctx: Ctx) {
  const auth = await getAuthResult();
  if (!auth.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await ctx.params;
  const supabase = getSupabaseServer();
  if (!(await hasShare(supabase, id, auth.user.id))) {
    return NextResponse.json({ error: 'Consulta no encontrada' }, { status: 404 });
  }

  const { data: inquiry } = await supabase
    .from('inquiries_with_details')
    .select('id, employee_name, category, subject, status, created_at')
    .eq('id', id)
    .maybeSingle();

  const { data: messages } = await supabase
    .from('inquiry_messages')
    .select('id, author_role, body, created_at, edited_at')
    .eq('inquiry_id', id)
    .eq('is_internal', false)
    .order('created_at', { ascending: true });

  return NextResponse.json({ inquiry, messages: messages ?? [] });
}

// POST — el líder responde en el hilo
export async function POST(req: NextRequest, ctx: Ctx) {
  const auth = await getAuthResult();
  if (!auth.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const parsed = ReplySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Escribí tu respuesta' }, { status: 400 });

  const { id } = await ctx.params;
  const supabase = getSupabaseServer();
  if (!(await hasShare(supabase, id, auth.user.id))) {
    return NextResponse.json({ error: 'Consulta no encontrada' }, { status: 404 });
  }

  const nowIso = new Date().toISOString();
  await supabase.from('inquiry_messages').insert({
    inquiry_id: id,
    author_user_id: auth.user.id,
    author_role: 'leader',
    body: parsed.data.body.trim(),
  });
  await supabase.from('employee_inquiries').update({ last_activity_at: nowIso, updated_at: nowIso }).eq('id', id);
  await supabase.from('inquiry_events').insert({
    inquiry_id: id,
    actor_user_id: auth.user.id,
    event_type: 'leader_reply',
  });

  const adminIds = await getAdminUserIds();
  await createSystemNotification({
    userIds: adminIds,
    title: 'El líder respondió en una consulta',
    body: 'Hay una respuesta nueva en una consulta que compartiste.',
    deepLink: `/admin/consultas/${id}`,
    dedupeKey: `inquiry-leader-reply-${id}-${Date.now()}`,
  }).catch((e) => console.error('[inquiries] notif líder falló:', e));

  return NextResponse.json({ success: true });
}

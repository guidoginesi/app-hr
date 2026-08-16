import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthResult } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { getAdminUserIds, createSystemNotification } from '@/lib/notificationService';
import { canReopen, type InquiryStatus } from '@/lib/inquiries';

type Ctx = { params: Promise<{ id: string }> };

const ReplySchema = z.object({ body: z.string().min(1, 'Escribí tu respuesta') });

async function loadOwn(supabase: any, id: string, employeeId: string) {
  const { data } = await supabase
    .from('inquiries_with_details')
    .select('*')
    .eq('id', id)
    .eq('employee_id', employeeId)
    .maybeSingle();
  return data;
}

// GET — detalle + hilo (sin notas internas)
export async function GET(_req: NextRequest, ctx: Ctx) {
  const auth = await getAuthResult();
  if (!auth.user || !auth.employee) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await ctx.params;
  const supabase = getSupabaseServer();
  const inquiry = await loadOwn(supabase, id, auth.employee.id);
  if (!inquiry) return NextResponse.json({ error: 'Consulta no encontrada' }, { status: 404 });

  const { data: messages } = await supabase
    .from('inquiry_messages')
    .select('id, author_role, body, created_at, edited_at')
    .eq('inquiry_id', id)
    .eq('is_internal', false)
    .order('created_at', { ascending: true });

  return NextResponse.json({
    inquiry,
    messages: messages ?? [],
    can_reopen: canReopen(inquiry.closed_at, inquiry.status as InquiryStatus),
  });
}

// POST — responder en el hilo (o reabrir si está cerrada dentro de la ventana)
export async function POST(req: NextRequest, ctx: Ctx) {
  const auth = await getAuthResult();
  if (!auth.user || !auth.employee) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const parsed = ReplySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((e) => e.message).join(', ') }, { status: 400 });
  }

  const { id } = await ctx.params;
  const supabase = getSupabaseServer();
  const inquiry = await loadOwn(supabase, id, auth.employee.id);
  if (!inquiry) return NextResponse.json({ error: 'Consulta no encontrada' }, { status: 404 });

  const status = inquiry.status as InquiryStatus;
  const reopening = status === 'cerrada' || status === 'resuelta';
  if (status === 'cerrada' && !canReopen(inquiry.closed_at, status)) {
    return NextResponse.json(
      { error: 'La consulta está cerrada. Abrí una consulta nueva.', closed: true },
      { status: 409 },
    );
  }

  const nowIso = new Date().toISOString();
  await supabase.from('inquiry_messages').insert({
    inquiry_id: id,
    author_user_id: auth.user.id,
    author_role: 'employee',
    body: parsed.data.body.trim(),
  });

  // Al responder el colaborador, la pelota vuelve a HR.
  const update: Record<string, unknown> = { status: 'en_curso', last_activity_at: nowIso, updated_at: nowIso };
  if (reopening) {
    update.reopened_at = nowIso;
    update.reopen_count = (inquiry.reopen_count ?? 0) + 1;
    update.closed_at = null;
    update.resolved_at = null;
  }
  await supabase.from('employee_inquiries').update(update).eq('id', id);

  await supabase.from('inquiry_events').insert({
    inquiry_id: id,
    actor_user_id: auth.user.id,
    event_type: reopening ? 'reopened' : 'employee_reply',
    from_status: status,
    to_status: 'en_curso',
  });

  const employeeName = `${auth.employee.first_name ?? ''} ${auth.employee.last_name ?? ''}`.trim();
  const adminIds = await getAdminUserIds();
  await createSystemNotification({
    userIds: adminIds,
    title: reopening ? 'Consulta reabierta' : 'Respuesta en una consulta',
    body: `${employeeName} respondió en "${inquiry.subject}".`,
    deepLink: '/admin/consultas',
    // Clave por evento, no por consulta: si no, solo se notificaría la primera vez.
    dedupeKey: `inquiry-reply-${id}-${Date.now()}`,
  }).catch((e) => console.error('[inquiries] notif respuesta falló:', e));

  return NextResponse.json({ success: true, reopened: reopening });
}

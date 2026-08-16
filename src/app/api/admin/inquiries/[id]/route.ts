import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { createSystemNotification } from '@/lib/notificationService';
import { sendSimpleEmail } from '@/lib/emailService';
import { renderEmail, getAppUrl, getReplyTo } from '@/lib/email/layout';
import { CATEGORY_LABELS, type InquiryCategory, type InquiryStatus } from '@/lib/inquiries';

type Ctx = { params: Promise<{ id: string }> };

const ActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('reply'), body: z.string().min(1), resolve: z.boolean().optional() }),
  z.object({ action: z.literal('internal_note'), body: z.string().min(1) }),
  z.object({ action: z.literal('set_status'), status: z.enum(['en_curso', 'esperando_colaborador', 'resuelta', 'cerrada']) }),
  z.object({ action: z.literal('assign_to_me') }),
  z.object({ action: z.literal('share_leader') }),
  z.object({ action: z.literal('unshare_leader') }),
]);

/**
 * Marca qué hizo HR con la propuesta del agente, comparando lo que se mandó
 * contra el borrador. Sólo aplica a la propuesta que todavía no fue calificada.
 *
 * Se compara normalizando espacios: un salto de línea de más no es una edición.
 */
async function calificarPropuestaPendiente(
  supabase: ReturnType<typeof getSupabaseServer>,
  inquiryId: string,
  enviado: string,
  userId: string,
) {
  const { data: propuesta } = await supabase
    .from('inquiry_answer_drafts')
    .select('id, borrador')
    .eq('inquiry_id', inquiryId)
    .is('resultado', null)
    .not('borrador', 'is', null)
    .order('creado_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!propuesta) return;

  const normalizar = (t: string) => t.replace(/\s+/g, ' ').trim();
  const usadaTalCual = normalizar(propuesta.borrador as string) === normalizar(enviado);

  const { error } = await supabase
    .from('inquiry_answer_drafts')
    .update({
      resultado: usadaTalCual ? 'USADA' : 'EDITADA',
      // La respuesta real se guarda sólo cuando difiere: si es idéntica ya está
      // en el borrador y guardarla dos veces no agrega nada.
      respuesta_enviada: usadaTalCual ? null : enviado,
      calificado_at: new Date().toISOString(),
      calificado_por: userId,
    })
    .eq('id', propuesta.id);
  // No frena la respuesta al colaborador: perder la calificación es molesto,
  // no mandar la respuesta es un problema.
  if (error) console.error('[propuesta] no se pudo calificar:', error.message);
}

// GET — detalle + hilo completo (incluye notas internas)
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const supabase = getSupabaseServer();

  const { data: inquiry } = await supabase.from('inquiries_with_details').select('*').eq('id', id).maybeSingle();
  if (!inquiry) return NextResponse.json({ error: 'Consulta no encontrada' }, { status: 404 });

  const { data: messages } = await supabase
    .from('inquiry_messages')
    .select('id, author_role, body, is_internal, created_at, edited_at')
    .eq('inquiry_id', id)
    .order('created_at', { ascending: true });

  const { data: shares } = await supabase
    .from('inquiry_leader_shares')
    .select('leader_user_id, shared_at, revoked_at')
    .eq('inquiry_id', id)
    .is('revoked_at', null);

  return NextResponse.json({ inquiry, messages: messages ?? [], shared_with_leader: (shares ?? []).length > 0 });
}

// POST — acciones de People sobre la consulta
export async function POST(req: NextRequest, ctx: Ctx) {
  const { isAdmin, user } = await requireAdmin();
  if (!isAdmin || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = ActionSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Acción inválida' }, { status: 400 });

  const { id } = await ctx.params;
  const supabase = getSupabaseServer();
  const { data: inquiry } = await supabase.from('inquiries_with_details').select('*').eq('id', id).maybeSingle();
  if (!inquiry) return NextResponse.json({ error: 'Consulta no encontrada' }, { status: 404 });

  const nowIso = new Date().toISOString();
  const from = inquiry.status as InquiryStatus;
  const a = parsed.data;

  // ── Nota interna: no cambia estado ni notifica al colaborador ──
  if (a.action === 'internal_note') {
    await supabase.from('inquiry_messages').insert({
      inquiry_id: id,
      author_user_id: user.id,
      author_role: 'hr',
      body: a.body.trim(),
      is_internal: true,
    });
    await supabase.from('employee_inquiries').update({ updated_at: nowIso }).eq('id', id);
    return NextResponse.json({ success: true });
  }

  // ── Respuesta de HR al colaborador ──
  if (a.action === 'reply') {
    const cuerpo = a.body.trim();

    await supabase.from('inquiry_messages').insert({
      inquiry_id: id,
      author_user_id: user.id,
      author_role: 'hr',
      body: cuerpo,
    });

    // La calificación de la propuesta del agente sale sola del flujo: si HR
    // mandó el borrador tal cual, la propuesta era buena; si lo editó, el diff
    // contra lo que mandó es la corrección, que es el dato que más enseña.
    // Preguntarlo aparte sería pedirle a alguien que califique después de
    // haber terminado, que es cuando nadie lo hace.
    await calificarPropuestaPendiente(supabase, id, cuerpo, user.id);

    // "Responder y marcar resuelta" es un solo paso: antes había que responder y
    // después cambiar el estado a mano, y quedaban consultas resueltas sin marcar.
    const nextStatus = a.resolve ? 'resuelta' : 'esperando_colaborador';

    const update: Record<string, unknown> = {
      status: nextStatus,
      last_activity_at: nowIso,
      updated_at: nowIso,
    };
    // El SLA se cumple con la PRIMERA respuesta de HR.
    if (!inquiry.first_hr_response_at) update.first_hr_response_at = nowIso;
    if (!inquiry.assigned_to) update.assigned_to = user.id;
    if (a.resolve) {
      update.resolved_at = nowIso;
      update.resolved_by = user.id;
    }
    await supabase.from('employee_inquiries').update(update).eq('id', id);

    await supabase.from('inquiry_events').insert({
      inquiry_id: id,
      actor_user_id: user.id,
      event_type: 'hr_reply',
      from_status: from,
      to_status: nextStatus,
    });

    // Aviso al colaborador (in-app + mail)
    const notifs: Promise<unknown>[] = [];
    if (inquiry.user_id) {
      notifs.push(
        createSystemNotification({
          userIds: [inquiry.user_id],
          title: a.resolve ? 'Resolvimos tu consulta' : 'Te respondimos tu consulta',
          body: a.resolve
            ? `People respondió y marcó "${inquiry.subject}" como resuelta. Si te quedó algo, respondé y se reabre.`
            : `People respondió en "${inquiry.subject}".`,
          deepLink: '/portal/consultas',
          dedupeKey: `inquiry-hr-reply-${id}-${Date.now()}`,
        }),
      );
    }
    if (inquiry.employee_email) {
      notifs.push(
        sendSimpleEmail({
          to: inquiry.employee_email,
          subject: a.resolve
            ? `Resolvimos tu consulta: ${inquiry.subject}`
            : `Respondimos tu consulta: ${inquiry.subject}`,
          replyTo: getReplyTo(),
          html: renderEmail({
            title: a.resolve ? 'Resolvimos tu consulta' : 'Te respondimos tu consulta',
            contextLabel: 'People · Consultas',
            intro: a.resolve
              ? `Hola ${inquiry.first_name ?? ''}, respondimos tu consulta "${inquiry.subject}" (${CATEGORY_LABELS[inquiry.category as InquiryCategory]}) y la marcamos como resuelta.`
              : `Hola ${inquiry.first_name ?? ''}, respondimos tu consulta "${inquiry.subject}" (${CATEGORY_LABELS[inquiry.category as InquiryCategory]}). Entrá al portal para leer la respuesta y seguir la conversación.`,
            cta: { label: 'Ver la consulta', url: `${getAppUrl()}/portal/consultas` },
            outro: a.resolve ? 'Si el tema no quedó cerrado, respondé desde el portal y la consulta se reabre.' : undefined,
          }),
        }),
      );
    }
    // En serverless una promesa suelta muere con el handler.
    await Promise.allSettled(notifs);

    return NextResponse.json({ success: true });
  }

  // ── Cambio de estado ──
  if (a.action === 'set_status') {
    const update: Record<string, unknown> = { status: a.status, last_activity_at: nowIso, updated_at: nowIso };
    if (a.status === 'resuelta') {
      update.resolved_at = nowIso;
      update.resolved_by = user.id;
    }
    if (a.status === 'cerrada') update.closed_at = nowIso;
    await supabase.from('employee_inquiries').update(update).eq('id', id);
    await supabase.from('inquiry_events').insert({
      inquiry_id: id,
      actor_user_id: user.id,
      event_type: 'status_change',
      from_status: from,
      to_status: a.status,
    });

    if (a.status === 'resuelta' && inquiry.user_id) {
      await createSystemNotification({
        userIds: [inquiry.user_id],
        title: 'Tu consulta fue resuelta',
        body: `"${inquiry.subject}" quedó resuelta. Si necesitás algo más, respondé en el hilo.`,
        deepLink: '/portal/consultas',
        dedupeKey: `inquiry-resolved-${id}-${Date.now()}`,
      }).catch((e) => console.error('[inquiries] notif resuelta falló:', e));
    }
    return NextResponse.json({ success: true, status: a.status });
  }

  // ── Asignarse la consulta ──
  if (a.action === 'assign_to_me') {
    await supabase
      .from('employee_inquiries')
      .update({ assigned_to: user.id, status: from === 'nueva' ? 'en_curso' : from, updated_at: nowIso })
      .eq('id', id);
    await supabase.from('inquiry_events').insert({
      inquiry_id: id,
      actor_user_id: user.id,
      event_type: 'assigned',
      from_status: from,
    });
    return NextResponse.json({ success: true });
  }

  // ── Compartir / dejar de compartir con el líder ──
  // Permiso POR CONSULTA: el líder nunca ve por jerarquía.
  if (a.action === 'share_leader' || a.action === 'unshare_leader') {
    if (!inquiry.manager_id) {
      return NextResponse.json({ error: 'El colaborador no tiene un líder asignado.' }, { status: 400 });
    }
    const { data: leader } = await supabase
      .from('employees')
      .select('user_id, first_name, last_name')
      .eq('id', inquiry.manager_id)
      .maybeSingle();

    if (!leader?.user_id) {
      return NextResponse.json({ error: 'El líder no tiene usuario en la app.' }, { status: 400 });
    }

    if (a.action === 'share_leader') {
      await supabase
        .from('inquiry_leader_shares')
        .upsert(
          { inquiry_id: id, leader_user_id: leader.user_id, shared_by: user.id, shared_at: nowIso, revoked_at: null, revoked_by: null },
          { onConflict: 'inquiry_id,leader_user_id' },
        );
      await supabase.from('inquiry_events').insert({
        inquiry_id: id,
        actor_user_id: user.id,
        event_type: 'shared_with_leader',
        detail: `${leader.first_name ?? ''} ${leader.last_name ?? ''}`.trim(),
      });
      await createSystemNotification({
        userIds: [leader.user_id],
        title: 'People compartió una consulta con vos',
        body: `"${inquiry.subject}" — necesitan tu mirada.`,
        deepLink: '/portal/consultas-equipo',
        dedupeKey: `inquiry-shared-${id}-${leader.user_id}`,
      }).catch((e) => console.error('[inquiries] notif share falló:', e));
    } else {
      await supabase
        .from('inquiry_leader_shares')
        .update({ revoked_at: nowIso, revoked_by: user.id })
        .eq('inquiry_id', id)
        .is('revoked_at', null);
      await supabase.from('inquiry_events').insert({
        inquiry_id: id,
        actor_user_id: user.id,
        event_type: 'unshared_with_leader',
      });
    }
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Acción inválida' }, { status: 400 });
}

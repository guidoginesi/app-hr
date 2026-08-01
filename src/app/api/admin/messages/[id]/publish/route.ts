import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { resolveAudienceUserIds, getEmailsForUserIds } from '@/lib/notificationService';
import { sendGoogleChatMessage } from '@/lib/googleChat';
import { getMessageBodyPlainText } from '@/lib/messageBody';
import { sendBatchEmails } from '@/lib/emailService';
import { renderEmail, getAppUrl, getReplyTo } from '@/lib/email/layout';
import { hasTemplateTokens, renderTemplate, buildRecipientVars } from '@/lib/templateVars';

const BATCH_SIZE = 500;

// POST /api/admin/messages/[id]/publish - Publish a draft message and create recipients
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { isAdmin, user } = await requireAdmin();
    if (!isAdmin || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = getSupabaseServer();

    const { data: message, error: msgError } = await supabase
      .from('messages')
      .select('*')
      .eq('id', id)
      .single();

    if (msgError || !message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    if (message.status !== 'draft') {
      return NextResponse.json(
        { error: 'Solo se pueden publicar mensajes en estado borrador' },
        { status: 400 }
      );
    }

    if (message.type !== 'broadcast') {
      return NextResponse.json(
        { error: 'Solo se pueden publicar mensajes de tipo broadcast desde este endpoint' },
        { status: 400 }
      );
    }

    // Resolve target users from audience
    const audience = message.audience ?? { all: true };

    // Gate de envío masivo: audiencias amplias (todos / roles / tipo) requieren el permiso mass_sender.
    const requiresMassSend =
      ('all' in audience && (audience as any).all) || 'roles' in audience || 'employment_type' in audience;
    if (requiresMassSend) {
      const { data: userRoles } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
      const canMassSend = (userRoles ?? []).some((r: any) => r.role === 'mass_sender');
      if (!canMassSend) {
        return NextResponse.json(
          { error: 'No tenés permiso de envío masivo para esta audiencia. Pedí el permiso a un administrador.' },
          { status: 403 },
        );
      }
    }

    // Deduplicar: un user_id repetido abortaría el INSERT del lote (UNIQUE message_id,user_id).
    const userIds = [...new Set(await resolveAudienceUserIds(audience))];

    if (userIds.length === 0) {
      return NextResponse.json(
        { error: 'No se encontraron usuarios para la audiencia seleccionada' },
        { status: 400 }
      );
    }

    // Insert recipients in batches (upsert idempotente, tolera duplicados / re-publicación)
    let insertedCount = 0;
    for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
      const batch = userIds.slice(i, i + BATCH_SIZE);
      const recipients = batch.map((userId) => ({ message_id: id, user_id: userId }));

      const { error: recipientsError } = await supabase
        .from('message_recipients')
        .upsert(recipients, { onConflict: 'message_id,user_id', ignoreDuplicates: true });

      if (recipientsError) {
        console.error('[publish] Error inserting recipients batch:', recipientsError);
      } else {
        insertedCount += batch.length;
      }
    }

    if (insertedCount === 0) {
      return NextResponse.json({ error: 'No se pudieron crear los destinatarios.' }, { status: 500 });
    }

    // Marcar como publicado (recién después de crear los destinatarios con éxito)
    const { error: updateError } = await supabase
      .from('messages')
      .update({ status: 'published', published_at: new Date().toISOString() })
      .eq('id', id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Enviar por mail a los destinatarios si está habilitado (opt-in por mensaje)
    if (message.send_email) {
      try {
        const recipientEmails = await getEmailsForUserIds(userIds);
        if (recipientEmails.length > 0) {
          const replyTo = getReplyTo();
          const ctx = (message.metadata?.template_context ?? {}) as Record<string, string>;
          let items: { to: string; subject: string; html: string; replyTo?: string }[];

          if (hasTemplateTokens(message.title, message.body)) {
            // Plantilla con variables: mail personalizado por destinatario (con el cuerpo renderizado).
            const { data: emps } = await supabase
              .from('employees')
              .select('user_id, first_name, last_name, dni, cuil')
              .in('user_id', userIds);
            const empByUser = new Map<string, any>((emps ?? []).map((e: any) => [e.user_id, e]));
            items = recipientEmails.map((r) => {
              const vars = buildRecipientVars(empByUser.get(r.userId) ?? null, ctx);
              const title = renderTemplate(message.title, vars);
              return {
                to: r.email,
                subject: `Nuevo mensaje: ${title}`,
                replyTo,
                html: renderEmail({
                  title,
                  contextLabel: 'Pow · Mensajes',
                  bodyHtml: renderTemplate(message.body, vars, true),
                  cta: { label: 'Ver en el portal', url: `${getAppUrl()}/portal/messages` },
                }),
              };
            });
          } else {
            const preview = getMessageBodyPlainText(message.body).slice(0, 200);
            const previewText = preview.length >= 200 ? `${preview.trimEnd()}…` : preview;
            const html = renderEmail({
              title: message.title,
              contextLabel: 'Pow · Mensajes',
              preheader: previewText || 'Tenés un mensaje nuevo en el portal',
              intro: previewText || 'Tenés un mensaje nuevo esperándote en el portal.',
              cta: { label: 'Ver en el portal', url: `${getAppUrl()}/portal/messages` },
              outro: 'Entrá al portal para leer el mensaje completo.',
            });
            items = recipientEmails.map((r) => ({
              to: r.email,
              subject: `Nuevo mensaje: ${message.title}`,
              html,
              replyTo,
            }));
          }

          const sendResult = await sendBatchEmails(items);

          // Persistir el id de proveedor por destinatario (para linkear los webhooks de estado).
          const ids = sendResult.ids ?? [];
          if (ids.some(Boolean)) {
            const nowIso = new Date().toISOString();
            await Promise.all(
              recipientEmails
                .map((r, i) =>
                  ids[i]
                    ? supabase
                        .from('message_recipients')
                        .update({ email_status: 'sent', email_provider_id: ids[i], email_status_at: nowIso })
                        .eq('message_id', id)
                        .eq('user_id', r.userId)
                    : null,
                )
                .filter(Boolean) as any[],
            );
          }
        }
      } catch (emailError: any) {
        console.error('[publish] email fan-out error:', emailError.message);
      }
    }

    // Send to Google Chat if enabled — se omite en mensajes con variables por-destinatario
    // (un chat grupal no puede personalizar {{nombre}}/{{dni}} por persona).
    if (message.send_to_google_chat && !hasTemplateTokens(message.title, message.body)) {
      try {
        const priorityEmoji = message.priority === 'critical' ? '🚨' : message.priority === 'warning' ? '⚠️' : 'ℹ️';
        const chatVars = buildRecipientVars(null, (message.metadata?.template_context ?? {}) as Record<string, string>);
        const chatTitle = renderTemplate(message.title, chatVars);
        const chatBody = renderTemplate(getMessageBodyPlainText(message.body), chatVars);
        const chatText = `${priorityEmoji} *${chatTitle}*\n\n${chatBody}`;
        await sendGoogleChatMessage(chatText);
      } catch (chatError: any) {
        console.error('[publish] Google Chat error:', chatError.message);
      }
    }

    return NextResponse.json({
      success: true,
      recipients_created: insertedCount,
    });
  } catch (error: any) {
    console.error('[publish] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

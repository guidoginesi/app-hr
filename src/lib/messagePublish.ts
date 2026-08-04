// Publicación de un mensaje broadcast: resolver audiencia, crear destinatarios y
// disparar mail/Chat.
//
// Vive acá y no dentro de la ruta porque hay DOS disparadores: el botón
// "Publicar" del admin y el cron que publica los mensajes programados. El actor
// se pasa explícito justamente por eso: el cron no tiene sesión, así que usa a
// quien creó el mensaje. Sin ese parámetro el gate de mass_sender no se podría
// evaluar en el envío programado, y programar sería la forma de evadirlo.

import { getSupabaseServer } from '@/lib/supabaseServer';
import { resolveAudienceUserIds, getEmailsForUserIds, type BroadcastAudience } from '@/lib/notificationService';
import { sendGoogleChatMessage } from '@/lib/googleChat';
import { getMessageBodyPlainText } from '@/lib/messageBody';
import { sendBatchEmails } from '@/lib/emailService';
import { renderEmail, getAppUrl, getReplyTo } from '@/lib/email/layout';
import { hasTemplateTokens, renderTemplate, buildRecipientVars } from '@/lib/templateVars';

const BATCH_SIZE = 500;

export type PublishResult =
  | { ok: true; recipientsCreated: number }
  | { ok: false; status: number; error: string };

/** Audiencias amplias (todos / por rol / por tipo de contrato) exigen mass_sender. */
export function audienceRequiresMassSend(audience: BroadcastAudience): boolean {
  return Boolean(
    ('all' in audience && audience.all) || 'roles' in audience || 'employment_type' in audience,
  );
}

export async function actorCanMassSend(userId: string): Promise<boolean> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase.from('user_roles').select('role').eq('user_id', userId);
  // Ante un error de lectura NO se asume que puede: es un permiso.
  if (error) {
    console.error('[publish] no se pudo verificar mass_sender:', error.message);
    return false;
  }
  return (data ?? []).some((r) => r.role === 'mass_sender');
}

/**
 * Publica un mensaje en borrador.
 *
 * @param actorUserId quién publica. En el envío programado es `created_by` del
 *   mensaje, y se revalida su permiso: si perdió mass_sender entre que programó
 *   y la fecha de envío, el mensaje no sale.
 */
export async function publishMessage(messageId: string, actorUserId: string): Promise<PublishResult> {
  const supabase = getSupabaseServer();

  const { data: message, error: msgError } = await supabase
    .from('messages')
    .select('*')
    .eq('id', messageId)
    .single();

  if (msgError || !message) return { ok: false, status: 404, error: 'Message not found' };
  if (message.status !== 'draft') {
    return { ok: false, status: 400, error: 'Solo se pueden publicar mensajes en estado borrador' };
  }
  if (message.type !== 'broadcast') {
    return { ok: false, status: 400, error: 'Solo se pueden publicar mensajes de tipo broadcast desde este endpoint' };
  }

  const audience = (message.audience ?? { all: true }) as BroadcastAudience;

  if (audienceRequiresMassSend(audience) && !(await actorCanMassSend(actorUserId))) {
    return {
      ok: false,
      status: 403,
      error: 'No tenés permiso de envío masivo para esta audiencia. Pedí el permiso a un administrador.',
    };
  }

  // Deduplicar: un user_id repetido abortaría el INSERT del lote (UNIQUE message_id,user_id).
  const userIds = [...new Set(await resolveAudienceUserIds(audience))];
  if (userIds.length === 0) {
    return { ok: false, status: 400, error: 'No se encontraron usuarios para la audiencia seleccionada' };
  }

  let insertedCount = 0;
  for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
    const batch = userIds.slice(i, i + BATCH_SIZE);
    const recipients = batch.map((userId) => ({ message_id: messageId, user_id: userId }));

    const { error: recipientsError } = await supabase
      .from('message_recipients')
      .upsert(recipients, { onConflict: 'message_id,user_id', ignoreDuplicates: true });

    if (recipientsError) console.error('[publish] Error inserting recipients batch:', recipientsError);
    else insertedCount += batch.length;
  }

  if (insertedCount === 0) {
    return { ok: false, status: 500, error: 'No se pudieron crear los destinatarios.' };
  }

  // Marcar como publicado recién después de crear los destinatarios con éxito.
  // Se limpia scheduled_for para que el cron no lo vuelva a tomar.
  const { error: updateError } = await supabase
    .from('messages')
    .update({ status: 'published', published_at: new Date().toISOString(), scheduled_for: null })
    .eq('id', messageId);

  if (updateError) return { ok: false, status: 500, error: updateError.message };

  if (message.send_email) {
    try {
      const recipientEmails = await getEmailsForUserIds(userIds);
      if (recipientEmails.length > 0) {
        const replyTo = getReplyTo();
        const ctx = (message.metadata?.template_context ?? {}) as Record<string, string>;
        let items: { to: string; subject: string; html: string; replyTo?: string }[];

        if (hasTemplateTokens(message.title, message.body)) {
          // Plantilla con variables: mail personalizado por destinatario.
          const { data: emps } = await supabase
            .from('employees')
            .select('user_id, first_name, last_name, dni, cuil')
            .in('user_id', userIds);
          const empByUser = new Map<string, unknown>((emps ?? []).map((e) => [e.user_id as string, e]));
          items = recipientEmails.map((r) => {
            const vars = buildRecipientVars((empByUser.get(r.userId) ?? null) as never, ctx);
            const title = renderTemplate(message.title, vars);
            return {
              to: r.email,
              subject: `Nuevo mensaje: ${title}`,
              replyTo,
              html: renderEmail({
                title,
                contextLabel: 'Pow · Comunicaciones',
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
            contextLabel: 'Pow · Comunicaciones',
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

        // Persistir el id de proveedor por destinatario, para linkear los webhooks de estado.
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
                      .eq('message_id', messageId)
                      .eq('user_id', r.userId)
                  : null,
              )
              .filter(Boolean),
          );
        }
      }
    } catch (emailError) {
      console.error('[publish] email fan-out error:', emailError instanceof Error ? emailError.message : emailError);
    }
  }

  // Google Chat se omite en mensajes con variables por-destinatario: un chat
  // grupal no puede personalizar {{nombre}}/{{dni}} por persona.
  if (message.send_to_google_chat && !hasTemplateTokens(message.title, message.body)) {
    try {
      const priorityEmoji = message.priority === 'critical' ? '🚨' : message.priority === 'warning' ? '⚠️' : 'ℹ️';
      const chatVars = buildRecipientVars(null, (message.metadata?.template_context ?? {}) as Record<string, string>);
      const chatTitle = renderTemplate(message.title, chatVars);
      const chatBody = renderTemplate(getMessageBodyPlainText(message.body), chatVars);
      await sendGoogleChatMessage(`${priorityEmoji} *${chatTitle}*\n\n${chatBody}`);
    } catch (chatError) {
      console.error('[publish] Google Chat error:', chatError instanceof Error ? chatError.message : chatError);
    }
  }

  return { ok: true, recipientsCreated: insertedCount };
}

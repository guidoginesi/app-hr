import { z } from 'zod';
import { renderEmail, getAppUrl, getReplyTo, getEmailFrom } from '@/lib/email/layout';
import { renderFullMessageEmail } from '@/lib/email/fullMessage';
import { getMessageBodyPlainText } from '@/lib/messageBody';
import { hasTemplateTokens, renderTemplate } from '@/lib/templateVars';

/**
 * Opciones del mail de un mensaje de Comunicaciones. Viven en
 * `messages.metadata.email`, así no hace falta migrar la tabla.
 *
 * - `full`: manda el mensaje entero (con carátula) en vez del aviso corto.
 * - `subject`: asunto propio. Sin él, "Nuevo mensaje: <título>".
 * - `cover_url`: carátula, una URL pública del bucket `message-images`.
 * - `reply_to`: a dónde van las respuestas. Sin él, RESEND_REPLY_TO_EMAIL.
 * - `from_name`: nombre visible del remitente. La dirección no cambia.
 */
export const MessageEmailOptionsSchema = z.object({
  full: z.boolean().default(false),
  subject: z.string().trim().max(150).nullable().optional(),
  cover_url: z
    .string()
    .trim()
    .url('La carátula tiene que ser una URL.')
    .refine((u) => u.startsWith('https://'), 'La carátula tiene que ser una URL https.')
    .nullable()
    .optional(),
  reply_to: z.string().trim().email('El mail para las respuestas no es válido.').nullable().optional(),
  from_name: z.string().trim().max(60).nullable().optional(),
});

export type MessageEmailOptions = z.infer<typeof MessageEmailOptionsSchema>;

export function getMessageEmailOptions(metadata: unknown): MessageEmailOptions {
  const raw = (metadata as { email?: unknown } | null)?.email;
  const parsed = MessageEmailOptionsSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : { full: false };
}

/** Limpia las opciones antes de guardarlas: los vacíos se van. */
export function compactEmailOptions(o: MessageEmailOptions): MessageEmailOptions {
  const out: MessageEmailOptions = { full: o.full };
  if (o.subject) out.subject = o.subject;
  if (o.cover_url) out.cover_url = o.cover_url;
  if (o.reply_to) out.reply_to = o.reply_to;
  if (o.from_name) out.from_name = o.from_name;
  return out;
}

/** "Guido Ginesi <noreply@pow-apps.com>": cambia el nombre, nunca la dirección. */
export function fromWithName(name: string | null | undefined): string | undefined {
  const clean = (name ?? '').replace(/[<>"\r\n]/g, '').trim();
  if (!clean) return undefined;
  const base = getEmailFrom();
  const addr = base.match(/<([^>]+)>/)?.[1] ?? base;
  return `${clean} <${addr}>`;
}

type MessageLike = {
  title: string;
  body: string;
  metadata?: unknown;
};

export type MessageEmailItem = {
  subject: string;
  html: string;
  replyTo?: string;
  from?: string;
};

/**
 * Arma el mail de un mensaje para un destinatario. `vars` son las variables de
 * ese destinatario ({{nombre}}, etc.); se reemplazan siempre que el mensaje las
 * use, en los dos formatos.
 */
export function buildMessageEmail(message: MessageLike, vars: Record<string, string>): MessageEmailItem {
  const opts = getMessageEmailOptions(message.metadata);
  const templated = hasTemplateTokens(message.title, message.body, opts.subject);
  const title = templated ? renderTemplate(message.title, vars) : message.title;
  const portalUrl = `${getAppUrl()}/portal/messages`;
  const replyTo = opts.reply_to || getReplyTo();
  const from = fromWithName(opts.from_name);

  if (opts.full) {
    const bodyHtml = templated ? renderTemplate(message.body, vars, true) : message.body;
    const subject = opts.subject ? (templated ? renderTemplate(opts.subject, vars) : opts.subject) : title;
    const preview = getMessageBodyPlainText(bodyHtml).replace(/\s+/g, ' ').slice(0, 140);
    return {
      subject,
      replyTo,
      from,
      html: renderFullMessageEmail({ title, bodyHtml, coverUrl: opts.cover_url, preheader: preview, portalUrl }),
    };
  }

  const subject = opts.subject
    ? templated
      ? renderTemplate(opts.subject, vars)
      : opts.subject
    : `Nuevo mensaje: ${title}`;

  if (templated) {
    return {
      subject,
      replyTo,
      from,
      html: renderEmail({
        title,
        contextLabel: 'Pow · Comunicaciones',
        bodyHtml: renderTemplate(message.body, vars, true),
        cta: { label: 'Ver en el portal', url: portalUrl },
      }),
    };
  }

  const preview = getMessageBodyPlainText(message.body).slice(0, 200);
  const previewText = preview.length >= 200 ? `${preview.trimEnd()}…` : preview;
  return {
    subject,
    replyTo,
    from,
    html: renderEmail({
      title: message.title,
      contextLabel: 'Pow · Comunicaciones',
      preheader: previewText || 'Tenés un mensaje nuevo en el portal',
      intro: previewText || 'Tenés un mensaje nuevo esperándote en el portal.',
      cta: { label: 'Ver en el portal', url: portalUrl },
      outro: 'Entrá al portal para leer el mensaje completo.',
    }),
  };
}

/** Si el mail lleva el cuerpo entero, conviene personalizar por destinatario. */
export function needsPerRecipientEmail(message: MessageLike): boolean {
  const opts = getMessageEmailOptions(message.metadata);
  return hasTemplateTokens(message.title, message.body, opts.subject);
}

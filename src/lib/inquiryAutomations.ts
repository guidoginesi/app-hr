import { getSupabaseServer } from './supabaseServer';
import { getRoleEmails, createSystemNotification } from './notificationService';
import { sendSimpleEmail } from './emailService';
import { renderEmail, getAppUrl, getReplyTo, escapeHtml } from './email/layout';
import { countBusinessDaysBetween } from './businessDays';
import { AUTO_CLOSE_BUSINESS_DAYS, CATEGORY_LABELS, type InquiryCategory } from './inquiries';

/**
 * Automatismos diarios del canal de consultas (corren en daily-automations):
 *  1. Auto-cierre de "resuelta" sin respuesta del colaborador. Sin esto la
 *     consulta nunca llega a "cerrada" y la ventana de reapertura no arranca.
 *  2. Digest a People de lo que está sin responder (se repite hasta vaciar
 *     la cola, igual que el de aprobaciones).
 */

export async function autoCloseResolvedInquiries(): Promise<number> {
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from('employee_inquiries')
    .select('id, resolved_at, user_id, subject')
    .eq('status', 'resuelta')
    .not('resolved_at', 'is', null);

  const now = new Date();
  const due = (data ?? []).filter(
    (i: any) => countBusinessDaysBetween(new Date(i.resolved_at), now) >= AUTO_CLOSE_BUSINESS_DAYS,
  );
  if (due.length === 0) return 0;

  const nowIso = now.toISOString();
  for (const i of due) {
    await supabase
      .from('employee_inquiries')
      .update({ status: 'cerrada', closed_at: nowIso, updated_at: nowIso })
      .eq('id', i.id);
    await supabase.from('inquiry_events').insert({
      inquiry_id: i.id,
      event_type: 'auto_closed',
      from_status: 'resuelta',
      to_status: 'cerrada',
    });
    if (i.user_id) {
      await createSystemNotification({
        userIds: [i.user_id],
        title: 'Cerramos tu consulta',
        body: `"${i.subject}" se cerró porque quedó resuelta. Podés reabrirla durante los próximos 7 días.`,
        deepLink: '/portal/consultas',
        dedupeKey: `inquiry-autoclosed-${i.id}`,
      }).catch((e) => console.error('[inquiries] notif auto-cierre falló:', e));
    }
  }
  return due.length;
}

export async function sendInquiriesDigest(): Promise<{ sent: string[]; pending: number }> {
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from('inquiries_with_details')
    .select('id, employee_name, category, subject, status, created_at, sla_overdue, first_response_due_at')
    .in('status', ['nueva', 'en_curso'])
    .order('created_at', { ascending: true });

  const pending = data ?? [];
  if (pending.length === 0) return { sent: [], pending: 0 };

  const overdue = pending.filter((i: any) => i.sla_overdue);
  const rows = pending
    .map(
      (i: any) => `
      <tr><td style="padding:10px 0;border-bottom:1px solid #ECECEC;">
        <div style="font-size:13px;font-weight:600;color:#1A1D23;">${escapeHtml(i.subject)}${
          i.sla_overdue ? ' <span style="color:#DC2626;">· vencida</span>' : ''
        }</div>
        <div style="font-size:12px;color:#6B7280;margin-top:2px;">${escapeHtml(i.employee_name ?? '')} · ${
          CATEGORY_LABELS[i.category as InquiryCategory] ?? i.category
        }</div>
      </td></tr>`,
    )
    .join('');

  const recipients = await getRoleEmails(['admin']);
  const sent: string[] = [];

  for (const r of recipients) {
    const res = await sendSimpleEmail({
      to: r.email,
      subject: `Tenés ${pending.length} consulta${pending.length === 1 ? '' : 's'} sin responder`,
      replyTo: getReplyTo(),
      html: renderEmail({
        title: `${pending.length} consulta${pending.length === 1 ? '' : 's'} sin responder`,
        contextLabel: 'People · Consultas',
        badge: overdue.length > 0 ? { tone: 'danger', label: `${overdue.length} vencida(s)` } : undefined,
        preheader: `Resumen diario del canal de consultas`,
        intro: 'Esto es lo que está esperando respuesta del equipo de People:',
        bodyHtml: `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:6px 0 4px;">${rows}</table>`,
        cta: { label: 'Ir a Consultas', url: `${getAppUrl()}/admin/consultas` },
        outro: 'Este resumen se arma cada mañana con lo que sigue sin responder.',
      }),
    });
    if (res.success) sent.push(r.email);
  }

  return { sent, pending: pending.length };
}

export async function runInquiryAutomations(): Promise<{ autoClosed: number; digest: string[]; pending: number }> {
  const autoClosed = await autoCloseResolvedInquiries();
  const { sent, pending } = await sendInquiriesDigest();
  return { autoClosed, digest: sent, pending };
}

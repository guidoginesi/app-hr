import { getSupabaseServer } from './supabaseServer';
import { sendBatchEmails } from './emailService';
import { renderEmail, getAppUrl, getReplyTo } from './email/layout';
import { createSystemNotification } from './notificationService';
import { formatPayrollPeriodLabelFromKey, type PayrollPeriodType } from './payrollPeriods';
import { isPendingAck } from './payrollReceipts';

/**
 * Recordatorios de recepción del recibo de sueldo.
 *
 * Cadencia automática (cron diario): primer recordatorio a los 3 días de publicado,
 * después cada 7 días, máximo 4 envíos. Se corta si el período se cierra o si la
 * persona confirma. NO se escala al líder (regla del ticket).
 */

const FIRST_AFTER_DAYS = 3;
const REPEAT_EVERY_DAYS = 7;
const MAX_REMINDERS = 4;

const daysBetween = (from: string | Date, to: Date): number =>
  Math.floor((to.getTime() - new Date(from).getTime()) / 86_400_000);

export type PendingReceipt = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email_to: string | null;
  employee_email: string | null;
  employee_user_id: string | null;
  period_year: number;
  period_month: number;
  period_type: PayrollPeriodType | null;
  sent_at: string | null;
  payslip_version?: number | null;
  payslip_replaced_at?: string | null;
};

/** Liquidaciones de relación de dependencia publicadas, que requieren acuse y no lo tienen. */
export async function findPendingReceipts(
  supabase: any,
  opts: { periodId?: string } = {},
): Promise<PendingReceipt[]> {
  let query = supabase
    .from('payroll_settlements_with_details')
    .select(
      'id, first_name, last_name, email_to, employee_email, employee_user_id, period_year, period_month, period_type, period_status, sent_at, status, requires_acknowledgement, acknowledged_at, pdf_storage_path, pdf2_storage_path, payslip_version, payslip_replaced_at',
    )
    .eq('contract_type_snapshot', 'RELACION_DEPENDENCIA')
    .eq('status', 'SENT')
    // Se filtra en la base para no traer los 219 históricos ni chocar con el
    // límite implícito de filas de PostgREST.
    .eq('requires_acknowledgement', true)
    .is('acknowledged_at', null);

  if (opts.periodId) query = query.eq('period_id', opts.periodId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? [])
    .filter((s: any) => s.period_status !== 'CLOSED')
    .filter((s: any) => isPendingAck(s));
}

function reminderEmail(s: PendingReceipt): { subject: string; html: string } {
  const periodLabel = formatPayrollPeriodLabelFromKey({
    year: s.period_year,
    month: s.period_month,
    period_type: s.period_type ?? 'MONTHLY',
  });
  const name = `${s.first_name ?? ''}`.trim() || 'equipo';
  return {
    subject: `Recordatorio: confirmá la recepción de tu recibo ${periodLabel}`,
    html: renderEmail({
      title: 'Confirmá la recepción de tu recibo',
      contextLabel: 'People · Recibos',
      badge: { tone: 'warning', label: 'Pendiente' },
      preheader: `Todavía no confirmaste la recepción de tu recibo de ${periodLabel}.`,
      intro: `Hola ${name}, tu recibo de sueldo de ${periodLabel} está disponible en el portal y todavía no confirmaste que lo recibiste. Entrá, descargalo y marcá la casilla "Recibido".`,
      cta: { label: 'Ir a mis recibos', url: `${getAppUrl()}/portal/recibos` },
      outro: 'Marcar "Recibido" deja constancia de que accediste al documento. No implica conformidad con lo liquidado.',
    }),
  };
}

/**
 * Envía el recordatorio a las liquidaciones dadas (mail + in-app) y lo registra.
 * `automated` distingue el envío del cron del botón manual de HR.
 */
export async function sendReceiptReminders(
  supabase: any,
  pending: PendingReceipt[],
  opts: { automated: boolean; sentBy?: string | null },
): Promise<{ notified: number; emailed: number; inApp: number; failed: number }> {
  if (pending.length === 0) return { notified: 0, emailed: 0, inApp: 0, failed: 0 };

  const replyTo = getReplyTo();
  const emails: { to: string; subject: string; html: string; replyTo?: string }[] = [];
  const emailed: PendingReceipt[] = [];
  const inAppOnly: PendingReceipt[] = [];
  const notifPromises: Promise<unknown>[] = [];
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');

  for (const s of pending) {
    const to = (s.email_to || s.employee_email || '').trim();
    if (to) {
      const { subject, html } = reminderEmail(s);
      emails.push({ to, subject, html, replyTo });
      emailed.push(s);
    } else if (s.employee_user_id) {
      inAppOnly.push(s);
    }

    if (s.employee_user_id) {
      const periodLabel = formatPayrollPeriodLabelFromKey({
        year: s.period_year,
        month: s.period_month,
        period_type: s.period_type ?? 'MONTHLY',
      });
      // dedupeKey por día: el dedupe de createSystemNotification es permanente,
      // sin la fecha el segundo recordatorio nunca se enviaría.
      notifPromises.push(
        createSystemNotification({
          userIds: [s.employee_user_id],
          title: `Confirmá la recepción de tu recibo — ${periodLabel}`,
          body: `Tu recibo de ${periodLabel} está disponible y todavía no confirmaste que lo recibiste.`,
          deepLink: '/portal/recibos',
          dedupeKey: `payslip-reminder-${s.id}-${day}`,
        }).catch((e) => console.error('[ReceiptReminders] in-app notif failed:', e)),
      );
    }
  }

  // Esperar las notificaciones: en serverless, una promesa suelta puede morir con el handler.
  await Promise.allSettled(notifPromises);

  let ids: (string | null)[] = [];
  let emailOk = false;
  if (emails.length > 0) {
    const res = await sendBatchEmails(emails);
    emailOk = res.success;
    ids = res.ids ?? [];
    if (!emailOk) console.error('[ReceiptReminders] batch de mails falló:', res.error);
  }

  // Solo se registra lo que efectivamente salió: si no, la cadencia se consume
  // con envíos fantasma y el recibo queda sin recordatorios.
  const rows = [
    ...emailed
      .map((s, i) => ({ s, providerId: emailOk ? ids[i] ?? null : null, ok: emailOk && Boolean(ids[i]) }))
      .filter((r) => r.ok)
      .map((r) => ({
        settlement_id: r.s.id,
        channel: 'email' as const,
        automated: opts.automated,
        sent_by: opts.sentBy ?? null,
        email_provider_id: r.providerId,
        document_version: r.s.payslip_version ?? 1,
      })),
    // El canal in-app también consume cadencia: si no, quien no tiene mail
    // recibiría una notificación por día para siempre.
    ...inAppOnly.map((s) => ({
      settlement_id: s.id,
      channel: 'in_app' as const,
      automated: opts.automated,
      sent_by: opts.sentBy ?? null,
      email_provider_id: null,
      document_version: s.payslip_version ?? 1,
    })),
  ];

  if (rows.length > 0) {
    const { error } = await supabase.from('payroll_receipt_reminders').insert(rows);
    // Si no se pudo registrar, propagamos: sin registro no hay tope de reenvíos.
    if (error) throw new Error(`No se pudo registrar el recordatorio: ${error.message}`);
  }

  const emailedOk = rows.filter((r) => r.channel === 'email').length;
  return {
    notified: rows.length,
    emailed: emailedOk,
    inApp: inAppOnly.length,
    failed: pending.length - rows.length,
  };
}

/**
 * Avisa al colaborador que su recibo fue reemplazado por una versión nueva y que
 * tiene que volver a confirmar la recepción.
 */
export async function notifyPayslipReplaced(
  supabase: any,
  settlementId: string,
  newVersion: number,
): Promise<void> {
  const { data: s } = await supabase
    .from('payroll_settlements_with_details')
    .select(
      'id, first_name, email_to, employee_email, employee_user_id, period_year, period_month, period_type, status',
    )
    .eq('id', settlementId)
    .single();

  if (!s || s.status !== 'SENT') return;

  const periodLabel = formatPayrollPeriodLabelFromKey({
    year: s.period_year,
    month: s.period_month,
    period_type: s.period_type ?? 'MONTHLY',
  });
  const name = `${s.first_name ?? ''}`.trim() || 'equipo';
  const to = (s.email_to || s.employee_email || '').trim();

  if (to) {
    await sendBatchEmails([
      {
        to,
        subject: `Tu recibo de ${periodLabel} fue actualizado`,
        replyTo: getReplyTo(),
        html: renderEmail({
          title: 'Tu recibo fue actualizado',
          contextLabel: 'People · Recibos',
          badge: { tone: 'warning', label: 'Nueva versión' },
          preheader: `Se publicó una versión corregida de tu recibo de ${periodLabel}.`,
          intro: `Hola ${name}, se publicó una versión corregida de tu recibo de sueldo de ${periodLabel}. Descargala desde el portal y volvé a marcar "Recibido".`,
          cta: { label: 'Ver mi recibo', url: `${getAppUrl()}/portal/recibos` },
          outro: 'La confirmación anterior quedó archivada como constancia de la versión previa.',
        }),
      },
    ]).catch((e) => console.error('[PayslipReplaced] email failed:', e));
  }

  if (s.employee_user_id) {
    createSystemNotification({
      userIds: [s.employee_user_id],
      title: `Tu recibo de ${periodLabel} fue actualizado`,
      body: 'Se publicó una versión corregida. Descargala y volvé a confirmar la recepción.',
      deepLink: '/portal/recibos',
      dedupeKey: `payslip-replaced-${settlementId}-v${newVersion}`,
    }).catch((e) => console.error('[PayslipReplaced] in-app notif failed:', e));
  }
}

/**
 * Corrida automática (cron diario): aplica la cadencia y envía sólo a quien toca.
 */
export async function runAutomaticReceiptReminders(): Promise<{ sent: number; skipped: number }> {
  const supabase = getSupabaseServer();
  const pending = await findPendingReceipts(supabase);
  if (pending.length === 0) return { sent: 0, skipped: 0 };

  const { data: previous } = await supabase
    .from('payroll_receipt_reminders')
    .select('settlement_id, sent_at, document_version')
    .in(
      'settlement_id',
      pending.map((p) => p.id),
    )
    // Solo los automáticos: los recordatorios manuales de HR no deben consumir
    // el cupo de la cadencia ni apagarla.
    .eq('automated', true)
    .order('sent_at', { ascending: false });

  const history = new Map<string, { sent_at: string; document_version: number }[]>();
  for (const r of previous ?? []) {
    const list = history.get(r.settlement_id) ?? [];
    list.push({ sent_at: r.sent_at, document_version: r.document_version ?? 1 });
    history.set(r.settlement_id, list);
  }

  const now = new Date();
  const due = pending.filter((s) => {
    if (!s.sent_at) return false;
    const version = s.payslip_version ?? 1;
    // Cada versión del documento arranca con su propio cupo.
    const sent = (history.get(s.id) ?? []).filter((r) => r.document_version === version);
    if (sent.length >= MAX_REMINDERS) return false;
    // Si el recibo se reemplazó, la cuenta arranca desde el reemplazo.
    const startFrom = s.payslip_replaced_at ?? s.sent_at;
    if (sent.length === 0) return daysBetween(startFrom, now) >= FIRST_AFTER_DAYS;
    return daysBetween(sent[0].sent_at, now) >= REPEAT_EVERY_DAYS;
  });

  if (due.length === 0) return { sent: 0, skipped: pending.length };

  const res = await sendReceiptReminders(supabase, due, { automated: true });
  return { sent: res.notified, skipped: pending.length - due.length };
}

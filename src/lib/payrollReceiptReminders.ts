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
};

/** Liquidaciones de relación de dependencia publicadas, que requieren acuse y no lo tienen. */
export async function findPendingReceipts(
  supabase: any,
  opts: { periodId?: string } = {},
): Promise<PendingReceipt[]> {
  let query = supabase
    .from('payroll_settlements_with_details')
    .select(
      'id, first_name, last_name, email_to, employee_email, employee_user_id, period_year, period_month, period_type, period_status, sent_at, status, requires_acknowledgement, acknowledged_at, pdf_storage_path, pdf2_storage_path',
    )
    .eq('contract_type_snapshot', 'RELACION_DEPENDENCIA')
    .eq('status', 'SENT');

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
): Promise<{ notified: number }> {
  if (pending.length === 0) return { notified: 0 };

  const replyTo = getReplyTo();
  const emails: { to: string; subject: string; html: string; replyTo?: string }[] = [];
  const emailed: PendingReceipt[] = [];

  for (const s of pending) {
    const to = (s.email_to || s.employee_email || '').trim();
    if (to) {
      const { subject, html } = reminderEmail(s);
      emails.push({ to, subject, html, replyTo });
      emailed.push(s);
    }

    if (s.employee_user_id) {
      const periodLabel = formatPayrollPeriodLabelFromKey({
        year: s.period_year,
        month: s.period_month,
        period_type: s.period_type ?? 'MONTHLY',
      });
      // dedupeKey por día: el dedupe de createSystemNotification es permanente,
      // sin la fecha el segundo recordatorio nunca se enviaría.
      const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      createSystemNotification({
        userIds: [s.employee_user_id],
        title: `Confirmá la recepción de tu recibo — ${periodLabel}`,
        body: `Tu recibo de ${periodLabel} está disponible y todavía no confirmaste que lo recibiste.`,
        deepLink: '/portal/recibos',
        dedupeKey: `payslip-reminder-${s.id}-${day}`,
      }).catch((e) => console.error('[ReceiptReminders] in-app notif failed:', e));
    }
  }

  let ids: (string | null)[] = [];
  if (emails.length > 0) {
    const res = await sendBatchEmails(emails);
    ids = res.ids ?? [];
  }

  const rows = emailed.map((s, i) => ({
    settlement_id: s.id,
    channel: 'email',
    automated: opts.automated,
    sent_by: opts.sentBy ?? null,
    email_provider_id: ids[i] ?? null,
  }));
  if (rows.length > 0) {
    const { error } = await supabase.from('payroll_receipt_reminders').insert(rows);
    if (error) console.error('[ReceiptReminders] no se pudo registrar el recordatorio:', error);
  }

  return { notified: pending.length };
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
    .select('settlement_id, sent_at')
    .in(
      'settlement_id',
      pending.map((p) => p.id),
    )
    .order('sent_at', { ascending: false });

  const history = new Map<string, string[]>();
  for (const r of previous ?? []) {
    const list = history.get(r.settlement_id) ?? [];
    list.push(r.sent_at);
    history.set(r.settlement_id, list);
  }

  const now = new Date();
  const due = pending.filter((s) => {
    if (!s.sent_at) return false;
    const sent = history.get(s.id) ?? [];
    if (sent.length >= MAX_REMINDERS) return false;
    if (sent.length === 0) return daysBetween(s.sent_at, now) >= FIRST_AFTER_DAYS;
    return daysBetween(sent[0], now) >= REPEAT_EVERY_DAYS;
  });

  if (due.length === 0) return { sent: 0, skipped: pending.length };

  const { notified } = await sendReceiptReminders(supabase, due, { automated: true });
  return { sent: notified, skipped: pending.length - due.length };
}

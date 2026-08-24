import { getSupabaseServer } from './supabaseServer';
import { sendBatchEmails } from './emailService';
import { renderEmail, getAppUrl, getReplyTo } from './email/layout';
import { createSystemNotification } from './notificationService';
import { formatPayrollPeriodLabelFromKey, type PayrollPeriodType } from './payrollPeriods';

/**
 * Recordatorios de factura pendiente (Monotributo).
 *
 * El botón "Reclamar facturas" ya existía. El problema era que alguien se tenía
 * que acordar, y que no dejaba rastro: sin rastro no se puede saber si a una
 * persona ya se le escribió tres veces o ninguna, así que automatizarlo tal cual
 * habría sido mandar el mismo mail todos los días hasta que facture.
 *
 * Cadencia automática (cron diario): el primero a los 3 días de enviada la
 * liquidación, después cada 7, máximo 4. Se corta sola cuando carga la factura o
 * cuando se cierra el período. Es la misma cadencia que la de recepción de
 * recibos, a propósito: el mismo problema no debería tener dos ritmos distintos
 * ni dos lugares donde ajustarlo.
 *
 * Los recordatorios manuales quedan registrados pero NO consumen el cupo
 * automático: que Administración reclame por su cuenta no tiene por qué apagar
 * la cadencia.
 */

const PRIMERO_A_LOS_DIAS = 3;
const REPETIR_CADA_DIAS = 7;
const MAXIMO = 4;

/**
 * Tope de antigüedad para la cadencia automática.
 *
 * Al enchufar esto había 6 facturas pendientes y las más viejas eran de abril y
 * mayo — 112 y 83 días. Sin tope, la primera corrida les habría escrito de golpe
 * por algo de hace tres meses, sin que nadie lo decidiera. Una deuda de esa edad
 * es una conversación, no un recordatorio automático.
 *
 * No desaparecen: siguen en la pantalla del período, el botón "Reclamar
 * facturas" las alcanza, y el cron informa cuántas dejó afuera.
 */
const MAXIMO_DE_ANTIGUEDAD_DIAS = 60;

const diasEntre = (desde: string | Date, hasta: Date): number =>
  Math.floor((hasta.getTime() - new Date(desde).getTime()) / 86_400_000);

export type FacturaPendiente = {
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

/** Monotributistas con la liquidación enviada y la factura sin cargar. */
export async function findPendingInvoices(
  supabase: ReturnType<typeof getSupabaseServer>,
  opts: { periodId?: string } = {},
): Promise<FacturaPendiente[]> {
  let query = supabase
    .from('payroll_settlements_with_details')
    .select(
      'id, first_name, last_name, email_to, employee_email, employee_user_id, period_year, period_month, period_type, period_status, sent_at',
    )
    .eq('contract_type_snapshot', 'MONOTRIBUTO')
    .eq('status', 'SENT')
    .is('invoice_storage_path', null);

  if (opts.periodId) query = query.eq('period_id', opts.periodId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  // Un período cerrado ya no espera nada: seguir reclamando sería pedir algo que
  // no vamos a usar.
  return ((data ?? []) as unknown as (FacturaPendiente & { period_status: string })[]).filter(
    (s) => s.period_status !== 'CLOSED',
  );
}

function etiquetaDePeriodo(s: FacturaPendiente): string {
  return formatPayrollPeriodLabelFromKey({
    year: s.period_year,
    month: s.period_month,
    period_type: s.period_type ?? 'MONTHLY',
  });
}

function mail(s: FacturaPendiente): { subject: string; html: string } {
  const periodo = etiquetaDePeriodo(s);
  const nombre = `${s.first_name ?? ''}`.trim() || 'equipo';

  return {
    subject: `Recordatorio: factura pendiente ${periodo}`,
    html: renderEmail({
      title: 'Tenés una factura pendiente',
      contextLabel: 'People · Liquidaciones',
      badge: { tone: 'warning', label: 'Factura pendiente' },
      preheader: `Todavía no recibimos tu factura de ${periodo}.`,
      intro: `Hola ${nombre}, todavía no recibimos tu factura correspondiente a la liquidación de ${periodo}. Por favor emitíla por el importe de tu liquidación y cargala en el portal.`,
      cta: { label: 'Cargar factura', url: `${getAppUrl()}/portal/liquidaciones` },
    }),
  };
}

export type ResultadoDeEnvio = { notified: number; emailed: number; inApp: number; failed: number };

/**
 * Manda los recordatorios y los registra. Compartida por el botón manual y por
 * el cron: si fueran dos caminos, el texto y el registro se irían separando.
 */
export async function sendInvoiceReminders(
  supabase: ReturnType<typeof getSupabaseServer>,
  pendientes: FacturaPendiente[],
  opts: { automated: boolean; sentBy?: string | null },
): Promise<ResultadoDeEnvio> {
  if (pendientes.length === 0) return { notified: 0, emailed: 0, inApp: 0, failed: 0 };

  const conMail = pendientes.filter((s) => (s.email_to || s.employee_email || '').trim());
  const sinMail = pendientes.filter((s) => !(s.email_to || s.employee_email || '').trim());

  let ids: (string | null)[] = [];
  let mailOk = true;
  if (conMail.length > 0) {
    const res = await sendBatchEmails(
      conMail.map((s) => ({
        to: (s.email_to || s.employee_email)!.trim(),
        replyTo: getReplyTo(),
        ...mail(s),
      })),
    );
    mailOk = res.success;
    ids = res.ids ?? [];
    if (!mailOk) console.error('[FacturaPendiente] el batch de mails falló:', res.error);
  }

  // La notificación in-app va para todos: quien no tiene mail sólo se entera por
  // acá, y quien lo tiene la ve al entrar al portal.
  for (const s of pendientes) {
    if (!s.employee_user_id) continue;
    const periodo = etiquetaDePeriodo(s);
    createSystemNotification({
      userIds: [s.employee_user_id],
      title: `Factura pendiente — ${periodo}`,
      body: `Todavía no recibimos tu factura de ${periodo}. Podés cargarla desde el portal.`,
      deepLink: '/portal/liquidaciones',
      // Un recordatorio por día como mucho, aunque algo se dispare dos veces.
      dedupeKey: `factura-pendiente-${s.id}-${new Date().toISOString().slice(0, 10)}`,
    }).catch((e) => console.error('[FacturaPendiente] notificación in-app:', e));
  }

  const filas = [
    ...conMail
      .map((s, i) => ({ s, providerId: mailOk ? ids[i] ?? null : null, ok: mailOk && Boolean(ids[i]) }))
      .filter((r) => r.ok)
      .map((r) => ({
        settlement_id: r.s.id,
        channel: 'email' as const,
        automated: opts.automated,
        sent_by: opts.sentBy ?? null,
        email_provider_id: r.providerId,
      })),
    // El canal in-app también consume cadencia: si no, quien no tiene mail
    // recibiría una notificación por día para siempre.
    ...sinMail
      .filter((s) => s.employee_user_id)
      .map((s) => ({
        settlement_id: s.id,
        channel: 'in_app' as const,
        automated: opts.automated,
        sent_by: opts.sentBy ?? null,
        email_provider_id: null,
      })),
  ];

  if (filas.length > 0) {
    const { error } = await supabase.from('payroll_invoice_reminders').insert(filas);
    // Sin registro no hay tope: mejor fallar que mandar para siempre.
    if (error) throw new Error(`No se pudo registrar el recordatorio: ${error.message}`);
  }

  return {
    notified: filas.length,
    emailed: filas.filter((f) => f.channel === 'email').length,
    inApp: filas.filter((f) => f.channel === 'in_app').length,
    failed: pendientes.length - filas.length,
  };
}

/** Corrida automática (cron diario): aplica la cadencia y escribe sólo a quien toca. */
export async function runAutomaticInvoiceReminders(): Promise<{
  sent: number;
  skipped: number;
  /** Pendientes que la cadencia no toca por antigüedad: hay que reclamarlas a mano. */
  tooOld: number;
}> {
  const supabase = getSupabaseServer();
  const todas = await findPendingInvoices(supabase);
  if (todas.length === 0) return { sent: 0, skipped: 0, tooOld: 0 };

  const ahoraParaEdad = new Date();
  const pendientes = todas.filter(
    (s) => s.sent_at && diasEntre(s.sent_at, ahoraParaEdad) <= MAXIMO_DE_ANTIGUEDAD_DIAS,
  );
  const tooOld = todas.length - pendientes.length;
  if (pendientes.length === 0) return { sent: 0, skipped: 0, tooOld };

  const { data: previos } = await supabase
    .from('payroll_invoice_reminders')
    .select('settlement_id, sent_at')
    .in('settlement_id', pendientes.map((p) => p.id))
    // Sólo los automáticos: que Administración reclame a mano no gasta el cupo.
    .eq('automated', true)
    .order('sent_at', { ascending: false });

  const historia = new Map<string, string[]>();
  for (const r of previos ?? []) {
    const lista = historia.get(r.settlement_id as string) ?? [];
    lista.push(r.sent_at as string);
    historia.set(r.settlement_id as string, lista);
  }

  const ahora = new Date();
  const toca = pendientes.filter((s) => {
    if (!s.sent_at) return false;
    const enviados = historia.get(s.id) ?? [];
    if (enviados.length >= MAXIMO) return false;
    if (enviados.length === 0) return diasEntre(s.sent_at, ahora) >= PRIMERO_A_LOS_DIAS;
    return diasEntre(enviados[0], ahora) >= REPETIR_CADA_DIAS;
  });

  if (toca.length === 0) return { sent: 0, skipped: pendientes.length, tooOld };

  const res = await sendInvoiceReminders(supabase, toca, { automated: true });
  return { sent: res.notified, skipped: pendientes.length - toca.length, tooOld };
}

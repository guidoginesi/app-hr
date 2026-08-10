// Recordatorio automático del certificado de licencia vencido (médico y de examen).
//
// Corre en el cron diario. Avisa UNA sola vez por licencia, cuando el plazo ya
// pasó y el certificado sigue sin cargarse.
//
// La deduplicación se apoya en time_off_email_logs (mismo patrón que el
// recordatorio pre-licencia) en vez de una columna nueva: así no hace falta otra
// migración, y si el cron no corre un día el aviso igual sale al siguiente —
// disparar sólo el día exacto del vencimiento lo perdería para siempre.

import { getSupabaseServer } from '@/lib/supabaseServer';
import { sendSimpleEmail, logTimeOffEmail } from '@/lib/emailService';
import { renderEmail } from '@/lib/email/layout';
import { createSystemNotification } from '@/lib/notificationService';
import {
  LEAVE_CERT_RULES,
  leaveCertDeadline,
  leaveCertRule,
  argentinaDay,
} from '@/lib/leaveCertificates';

const TEMPLATE_KEY = 'time_off_leave_certificate_reminder';
/** Ventana hacia atrás: más allá de esto, reclamar por mail ya no tiene sentido. */
const LOOKBACK_DAYS = 90;

function toUtcDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatearFecha(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export async function runLeaveCertificateReminders(): Promise<{ enviados: number; errores: string[] }> {
  const supabase = getSupabaseServer();
  const errores: string[] = [];
  let enviados = 0;

  const today = argentinaDay();
  const desde = new Date(toUtcDate(today).getTime() - LOOKBACK_DAYS * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const { data: leaves, error } = await supabase
    .from('leave_requests_with_details')
    .select('id, employee_id, start_date, end_date, days_requested, status, certificate_path, employee_name, leave_type_code, leave_type_name')
    .in('leave_type_code', Object.keys(LEAVE_CERT_RULES))
    .is('certificate_path', null)
    .gte('start_date', desde)
    .lte('start_date', today)
    .not('status', 'in', '("cancelled","rejected","rejected_leader","rejected_hr")');

  if (error) {
    errores.push(`No se pudieron leer las licencias: ${error.message}`);
    return { enviados, errores };
  }

  for (const leave of leaves ?? []) {
    try {
      const code = leave.leave_type_code as string;
      const rule = leaveCertRule(code);
      if (!rule) continue;

      // Misma función que usa el chip de la UI: si divergieran, el mail diría
      // "vencido" un día antes de que la pantalla lo muestre.
      const vence = leaveCertDeadline({
        leaveTypeCode: code,
        startDate: leave.start_date as string,
        endDate: leave.end_date as string,
      });
      if (!vence || today <= vence) continue; // todavía en plazo

      const { data: yaAvisado } = await supabase
        .from('time_off_email_logs')
        .select('id')
        .eq('leave_request_id', leave.id)
        .eq('template_key', TEMPLATE_KEY)
        .is('error', null)
        .maybeSingle();
      if (yaAvisado) continue;

      const { data: emp } = await supabase
        .from('employees')
        .select('first_name, work_email, personal_email, user_id')
        .eq('id', leave.employee_id as string)
        .maybeSingle();

      const to = (emp?.work_email as string) || (emp?.personal_email as string);
      const nombre = (emp?.first_name as string)?.split(' ')[0] ?? 'Hola';
      const periodo = `${formatearFecha(leave.start_date as string)} al ${formatearFecha(leave.end_date as string)}`;
      const desde = rule.anchor === 'end' ? 'el fin' : 'el inicio';
      const subject = `Nos falta tu ${rule.label}`;

      if (to) {
        const html = renderEmail({
          title: `Nos falta tu ${rule.label}`,
          contextLabel: 'Pow · Licencias',
          intro: `${nombre}, registraste una ${leave.leave_type_name} del ${periodo} y todavía no subiste el ${rule.label}. El plazo era de ${rule.businessDays} días hábiles desde ${desde} de la licencia.`,
          details: [
            { label: 'Período', value: periodo },
            { label: 'Días', value: String(leave.days_requested) },
          ],
          cta: { label: 'Subir el comprobante', url: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://hr.pow-apps.com'}/portal/time-off/requests` },
          outro: 'Si ya lo entregaste por otra vía, avisanos por Consultas y lo cargamos nosotros.',
        });

        const res = await sendSimpleEmail({ to, subject, html });
        // El log es la marca de "ya avisado": sólo se escribe sin error cuando
        // el mail salió, así que un fallo se reintenta mañana.
        await logTimeOffEmail({
          leaveRequestId: leave.id as string,
          recipientEmail: to,
          templateKey: TEMPLATE_KEY,
          subject,
          body: '',
          error: res.success ? undefined : (res.error ?? 'Error al enviar'),
        });
        if (!res.success) {
          errores.push(`${leave.employee_name}: ${res.error}`);
          continue;
        }
      } else {
        errores.push(`${leave.employee_name}: sin email configurado`);
        continue;
      }

      if (emp?.user_id) {
        await createSystemNotification({
          userIds: [emp.user_id as string],
          title: `Falta tu ${rule.label}`,
          body: `Tu ${leave.leave_type_name} del ${periodo} sigue sin comprobante. Subilo desde Time Off → Historial de solicitudes.`,
          priority: 'warning',
          deepLink: '/portal/time-off/requests',
          metadata: { entity_type: 'leave_request', entity_id: leave.id },
          dedupeKey: `leave_request:${leave.id}:cert_overdue`,
        }).catch(() => {});
      }

      enviados += 1;
    } catch (e) {
      errores.push(`${leave.employee_name}: ${e instanceof Error ? e.message : 'error inesperado'}`);
    }
  }

  return { enviados, errores };
}

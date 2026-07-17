import type { SupabaseClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { buildPdfFilename, generateArtTeletrabajoPdf } from './pdf';
import { renderEmail, getEmailFrom, escapeHtml } from '../email/layout';
import { buildTeleworkRoster, getArtTeletrabajoConfig } from './roster';
import type { ArtNotificationType } from './types';
import type { LeaveTrigger } from './roster';

function getResend() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured');
  return new Resend(apiKey);
}

function buildEmailHtml(params: {
  notificationType: ArtNotificationType;
  rosterDate: string;
  triggers: LeaveTrigger[];
  employeeCount: number;
}) {
  const actionLabel =
    params.notificationType === 'pre_departure'
      ? 'cambio de domicilio de teletrabajo (inicio mañana)'
      : 'retorno a domicilio habitual';

  const facts = `
    <p style="margin:0 0 4px;font-size:13px;line-height:1.55;color:#374151;"><strong>Fecha de referencia del listado:</strong> ${escapeHtml(params.rosterDate)}</p>
    <p style="margin:0 0 13px;font-size:13px;line-height:1.55;color:#374151;"><strong>Empleados en relación de dependencia incluidos:</strong> ${params.employeeCount}</p>`;

  const peopleList =
    params.triggers.length > 0
      ? `<ul style="margin:0;padding-left:18px;color:#374151;font-size:13px;line-height:1.7;">${params.triggers
          .map(
            (t) =>
              `<li><strong>${escapeHtml(t.employee_name)}</strong> (${t.leave_type_code === 'remote_work_trip' ? 'Fuera de domicilio' : 'Trabajo remoto'}) — ${escapeHtml(t.start_date)} a ${escapeHtml(t.end_date)}</li>`,
          )
          .join('')}</ul>`
      : '<p style="margin:0;font-size:13px;color:#6B7280;">Sin movimientos individuales registrados.</p>';

  return renderEmail({
    title: 'Formulario de Teletrabajo ART actualizado',
    contextLabel: 'ART · Teletrabajo',
    badge: {
      tone: 'neutral',
      label: params.notificationType === 'pre_departure' ? 'Salida' : 'Retorno',
    },
    intro: `Se adjunta el formulario Teletrabajo Berkley ART actualizado por ${actionLabel}.`,
    bodyHtml: facts + peopleList,
    footerNote: 'Envío automático desde app-hr.',
  });
}

function buildSubject(notificationType: ArtNotificationType, employerCuit: string, rosterDate: string) {
  const prefix = employerCuit ? `Teletrabajo-${employerCuit}` : 'Teletrabajo';
  const suffix = notificationType === 'pre_departure' ? 'Salida' : 'Retorno';
  return `${prefix} — ${suffix} — ${rosterDate}`;
}

export async function sendArtTeletrabajoNotification(params: {
  supabase: SupabaseClient;
  notificationType: ArtNotificationType;
  triggerDate: string;
  rosterDate: string;
  triggers: LeaveTrigger[];
  force?: boolean;
}) {
  const config = getArtTeletrabajoConfig();

  if (config.recipients.length === 0) {
    throw new Error('ART_TELETRABAJO_RECIPIENTS no está configurado');
  }

  if (!params.force) {
    const { data: existing } = await params.supabase
      .from('art_teletrabajo_notifications')
      .select('id')
      .eq('notification_type', params.notificationType)
      .eq('trigger_date', params.triggerDate)
      .maybeSingle();

    if (existing) {
      return { skipped: true, reason: 'already_sent' as const };
    }
  } else {
    await params.supabase
      .from('art_teletrabajo_notifications')
      .delete()
      .eq('notification_type', params.notificationType)
      .eq('trigger_date', params.triggerDate);
  }

  const roster = await buildTeleworkRoster(params.supabase, params.rosterDate, config);
  const pdfBytes = await generateArtTeletrabajoPdf(roster, config);
  const filename = buildPdfFilename(params.rosterDate, params.notificationType);
  const fromEmail = getEmailFrom();
  const resend = getResend();

  const subject = buildSubject(params.notificationType, config.employerCuit, params.rosterDate);
  const html = buildEmailHtml({
    notificationType: params.notificationType,
    rosterDate: params.rosterDate,
    triggers: params.triggers,
    employeeCount: roster.length,
  });

  const { data, error } = await resend.emails.send({
    from: fromEmail,
    to: config.recipients,
    subject,
    html,
    attachments: [
      {
        filename,
        content: Buffer.from(pdfBytes).toString('base64'),
      },
    ],
  });

  if (error) {
    await params.supabase.from('art_teletrabajo_notifications').insert({
      notification_type: params.notificationType,
      trigger_date: params.triggerDate,
      roster_date: params.rosterDate,
      leave_request_ids: params.triggers.map((t) => t.id),
      recipient_emails: config.recipients,
      employee_count: roster.length,
      error: error.message,
    });
    throw new Error(error.message);
  }

  await params.supabase.from('art_teletrabajo_notifications').insert({
    notification_type: params.notificationType,
    trigger_date: params.triggerDate,
    roster_date: params.rosterDate,
    leave_request_ids: params.triggers.map((t) => t.id),
    recipient_emails: config.recipients,
    employee_count: roster.length,
    resend_ids: data?.id ? [data.id] : [],
  });

  return {
    skipped: false,
    resendId: data?.id,
    employeeCount: roster.length,
    recipients: config.recipients,
    filename,
  };
}

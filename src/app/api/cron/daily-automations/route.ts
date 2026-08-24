import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { sendGoogleChatMessage } from '@/lib/googleChat';
import { sendTimeOffEmail } from '@/lib/emailService';
import { getEmailFrom, renderPlainTemplate } from '@/lib/email/layout';
import { formatDateLocal, parseLocalDate } from '@/lib/dateUtils';
import { sendApprovalDigests } from '@/lib/approvalDigest';
import { runAutomaticReceiptReminders } from '@/lib/payrollReceiptReminders';
import { runAutomaticInvoiceReminders } from '@/lib/payrollInvoiceReminders';
import { runInquiryAutomations } from '@/lib/inquiryAutomations';
import { runLeaveCertificateReminders } from '@/lib/leaveCertificateReminders';
import { runBirthdayLeaveAutomation } from '@/lib/birthdayLeaveAutomation';
import { sendTalentPoolDigest } from '@/lib/talentPoolDigest';
import { publishScheduledMessages } from '@/lib/scheduledMessages';
import { Resend } from 'resend';

// Vercel Cron: runs daily at 9:00 AM UTC
// vercel.json: { "crons": [{ "path": "/api/cron/daily-automations", "schedule": "0 9 * * *" }] }

function replaceVariables(text: string, vars: Record<string, string>): string {
  let result = text;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
  }
  return result;
}

function getArgentinaDateString(offsetDays = 0): string {
  const todayStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(new Date());
  const date = parseLocalDate(todayStr);
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatLeaveDate(date: string): string {
  return formatDateLocal(date, 'es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

async function createInternalMessage(
  supabase: any,
  employeeUserId: string,
  title: string,
  body: string
) {
  const { data: message } = await supabase
    .from('messages')
    .insert({
      type: 'broadcast',
      title,
      body,
      priority: 'info',
      require_confirmation: false,
      audience: { all: false },
      status: 'published',
      published_at: new Date().toISOString(),
      metadata: { automated: true },
    })
    .select('id')
    .single();

  if (message?.id) {
    await supabase.from('message_recipients').insert({
      message_id: message.id,
      user_id: employeeUserId,
    });
  }
}

export async function GET(req: NextRequest) {
  // Solo Vercel Cron (manda el Bearer automáticamente cuando existe CRON_SECRET)
  // o un disparo manual con el secreto.
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET?.trim();
  // Falla cerrado: sin secreto configurado el endpoint queda abierto a internet
  // y este cron manda mails (cumpleaños, digests, recordatorios de recibos).
  if (!cronSecret) {
    console.error('[cron] CRON_SECRET no está configurado: se rechaza la ejecución.');
    return NextResponse.json({ error: 'Cron no configurado' }, { status: 503 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseServer();
  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = getEmailFrom();
  const resend = resendKey ? new Resend(resendKey) : null;

  const today = new Date();
  const todayMonth = today.getUTCMonth() + 1;
  const todayDay = today.getUTCDate();
  const currentYear = today.getUTCFullYear();

  const results = {
    birthdays: [] as string[],
    anniversaries: [] as string[],
    preLeaveReminders: [] as string[],
    approvalDigests: { sent: [] as string[], errors: [] as string[] },
    receiptReminders: { sent: 0, skipped: 0 },
    invoiceReminders: { sent: 0, skipped: 0, tooOld: 0 },
    inquiries: { autoClosed: 0, digest: [] as string[], pending: 0 },
    talentPool: { sent: [] as string[], nuevos: 0 },
    leaveCertificates: { enviados: 0, errores: [] as string[] },
    birthdayLeave: { acreditados: [] as string[], vencidos: [] as string[], errores: [] as string[] },
    scheduledMessages: { publicados: 0, fallidos: 0, detalle: [] as { id: string; title: string; ok: boolean; error?: string }[] },
    errors: [] as string[],
  };

  // Fetch active automation templates
  const { data: templates } = await supabase
    .from('email_templates')
    .select('template_key, subject, body, is_active, send_internal_message, internal_message_text, send_to_google_chat')
    .in('template_key', ['birthday_greeting', 'work_anniversary', 'time_off_pre_leave_reminder'])
    .eq('is_active', true);

  const templateMap: Record<string, any> = {};
  for (const t of templates || []) templateMap[t.template_key] = t;

  // Fetch all active employees with birth_date or hire_date
  const { data: employees } = await supabase
    .from('employees')
    .select('id, first_name, last_name, work_email, personal_email, birth_date, hire_date, user_id')
    .eq('status', 'active');

  for (const emp of employees || []) {
    const firstName = emp.first_name?.split(' ')[0] || emp.first_name || 'equipo';
    const fullName = `${emp.first_name} ${emp.last_name}`;
    const emailTo = emp.work_email || emp.personal_email;

    // ── BIRTHDAY ──────────────────────────────────────────────────
    if (emp.birth_date) {
      const bd = new Date(emp.birth_date);
      if (bd.getUTCMonth() + 1 === todayMonth && bd.getUTCDate() === todayDay) {
        const tpl = templateMap['birthday_greeting'];
        if (tpl) {
          // Check dedup
          const { data: logged } = await supabase
            .from('automation_log')
            .select('id')
            .eq('employee_id', emp.id)
            .eq('template_key', 'birthday_greeting')
            .eq('triggered_year', currentYear)
            .maybeSingle();

          if (!logged) {
            const vars = { firstName, employeeName: fullName };
            try {
              // Send email
              if (resend && emailTo) {
                const bSubject = replaceVariables(tpl.subject, vars);
                await resend.emails.send({
                  from: fromEmail,
                  to: emailTo,
                  subject: bSubject,
                  html: renderPlainTemplate({
                    templateKey: 'birthday_greeting',
                    subject: bSubject,
                    body: replaceVariables(tpl.body, vars),
                  }),
                });
              }
              // Send internal message
              if (tpl.send_internal_message && emp.user_id && tpl.internal_message_text) {
                await createInternalMessage(
                  supabase,
                  emp.user_id,
                  replaceVariables(tpl.subject, vars),
                  replaceVariables(tpl.internal_message_text, vars)
                );
              }
              // Send to Google Chat
              if (tpl.send_to_google_chat) {
                const chatText = `🎂 *¡Hoy es el cumpleaños de ${fullName}!* Sumate a felicitarlo/a 🎉`;
                await sendGoogleChatMessage(chatText);
              }
              // Log
              await supabase.from('automation_log').insert({
                employee_id: emp.id,
                template_key: 'birthday_greeting',
                triggered_year: currentYear,
                metadata: { email: emailTo },
              });
              results.birthdays.push(fullName);
            } catch (e: any) {
              results.errors.push(`Birthday ${fullName}: ${e.message}`);
            }
          }
        }
      }
    }

    // ── WORK ANNIVERSARY ─────────────────────────────────────────
    if (emp.hire_date) {
      const hd = new Date(emp.hire_date);
      if (
        hd.getUTCMonth() + 1 === todayMonth &&
        hd.getUTCDate() === todayDay &&
        hd.getUTCFullYear() < currentYear
      ) {
        const years = currentYear - hd.getUTCFullYear();
        const tpl = templateMap['work_anniversary'];
        if (tpl) {
          const { data: logged } = await supabase
            .from('automation_log')
            .select('id')
            .eq('employee_id', emp.id)
            .eq('template_key', 'work_anniversary')
            .eq('triggered_year', currentYear)
            .maybeSingle();

          if (!logged) {
            const vars = {
              firstName,
              employeeName: fullName,
              years: String(years),
              yearsSuffix: years === 1 ? '' : 's',
              hireDate: hd.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' }),
            };
            try {
              if (resend && emailTo) {
                const aSubject = replaceVariables(tpl.subject, vars);
                await resend.emails.send({
                  from: fromEmail,
                  to: emailTo,
                  subject: aSubject,
                  html: renderPlainTemplate({
                    templateKey: 'work_anniversary',
                    subject: aSubject,
                    body: replaceVariables(tpl.body, vars),
                  }),
                });
              }
              if (tpl.send_internal_message && emp.user_id && tpl.internal_message_text) {
                await createInternalMessage(
                  supabase,
                  emp.user_id,
                  replaceVariables(tpl.subject, vars),
                  replaceVariables(tpl.internal_message_text, vars)
                );
              }
              // Send to Google Chat
              if (tpl.send_to_google_chat) {
                const chatText = `🎉 *¡${fullName} cumple ${years} año${years === 1 ? '' : 's'} en Pow hoy!* Gracias por ser parte del equipo 💜`;
                await sendGoogleChatMessage(chatText);
              }
              await supabase.from('automation_log').insert({
                employee_id: emp.id,
                template_key: 'work_anniversary',
                triggered_year: currentYear,
                metadata: { email: emailTo, years },
              });
              results.anniversaries.push(`${fullName} (${years} año${years === 1 ? '' : 's'})`);
            } catch (e: any) {
              results.errors.push(`Anniversary ${fullName}: ${e.message}`);
            }
          }
        }
      }
    }
  }

  // ── PRE-LEAVE REMINDER (1 day before approved leave) ───────────
  const preLeaveTemplate = templateMap['time_off_pre_leave_reminder'];
  if (preLeaveTemplate) {
    const tomorrow = getArgentinaDateString(1);

    const { data: upcomingLeaves } = await supabase
      .from('leave_requests')
      .select(`
        id,
        start_date,
        end_date,
        days_requested,
        employee_id,
        employees (
          id,
          first_name,
          last_name,
          work_email,
          personal_email,
          user_id
        ),
        leave_types (
          name,
          count_type
        )
      `)
      .eq('status', 'approved')
      .eq('start_date', tomorrow);

    for (const leave of upcomingLeaves || []) {
      const employee = Array.isArray(leave.employees) ? leave.employees[0] : leave.employees;
      const leaveType = Array.isArray(leave.leave_types) ? leave.leave_types[0] : leave.leave_types;
      if (!employee) continue;

      const emailTo = employee.work_email || employee.personal_email;
      const fullName = `${employee.first_name} ${employee.last_name}`;

      const { data: alreadySent } = await supabase
        .from('time_off_email_logs')
        .select('id')
        .eq('leave_request_id', leave.id)
        .eq('template_key', 'time_off_pre_leave_reminder')
        .is('error', null)
        .maybeSingle();

      if (alreadySent) continue;

      if (!emailTo) {
        results.errors.push(`Pre-leave ${fullName}: sin email configurado`);
        continue;
      }

      const firstName = employee.first_name?.split(' ')[0] || employee.first_name || 'equipo';
      const vars = {
        nombre: firstName,
        fecha_inicio: formatLeaveDate(leave.start_date),
        fecha_fin: formatLeaveDate(leave.end_date),
        cantidad_dias: String(leave.days_requested),
        unidad_tiempo: leaveType?.count_type === 'weeks' ? 'semana(s)' : 'día(s)',
        tipo_licencia: leaveType?.name || 'Licencia',
      };

      try {
        const sendResult = await sendTimeOffEmail({
          templateKey: 'time_off_pre_leave_reminder',
          to: emailTo,
          variables: vars,
          leaveRequestId: leave.id,
        });

        if (!sendResult.success) {
          results.errors.push(`Pre-leave ${fullName}: ${sendResult.error}`);
          continue;
        }

        if (preLeaveTemplate.send_internal_message && employee.user_id && preLeaveTemplate.internal_message_text) {
          await createInternalMessage(
            supabase,
            employee.user_id,
            replaceVariables(preLeaveTemplate.subject, vars),
            replaceVariables(preLeaveTemplate.internal_message_text, vars)
          );
        }

        results.preLeaveReminders.push(`${fullName} (${leave.start_date})`);
      } catch (e: any) {
        results.errors.push(`Pre-leave ${fullName}: ${e.message}`);
      }
    }
  }

  // ── PENDING APPROVALS DIGEST (adelantos + capacitaciones) ──────
  try {
    results.approvalDigests = await sendApprovalDigests();
  } catch (e: any) {
    results.errors.push(`Approval digests: ${e.message}`);
  }

  // ── RECORDATORIOS DE RECEPCIÓN DE RECIBOS ──────────────────────
  try {
    results.receiptReminders = await runAutomaticReceiptReminders();
  } catch (e: any) {
    results.errors.push(`Receipt reminders: ${e.message}`);
  }

  // ── RECORDATORIOS DE FACTURA PENDIENTE (Monotributo) ───────────
  try {
    results.invoiceReminders = await runAutomaticInvoiceReminders();
  } catch (e) {
    results.errors.push(`Invoice reminders: ${e instanceof Error ? e.message : e}`);
  }

  // ── CONSULTAS: auto-cierre + digest a People ───────────────────
  try {
    results.inquiries = await runInquiryAutomations();
  } catch (e: any) {
    results.errors.push(`Inquiry automations: ${e.message}`);
  }

  // ── CERTIFICADOS DE LICENCIA VENCIDOS (médico y de examen) ─────
  try {
    results.leaveCertificates = await runLeaveCertificateReminders();
  } catch (e: any) {
    results.errors.push(`Leave certificate reminders: ${e.message}`);
  }

  // ── DÍA DE CUMPLEAÑOS: acreditación y vencimiento ──────────────
  try {
    results.birthdayLeave = await runBirthdayLeaveAutomation();
  } catch (e: any) {
    results.errors.push(`Birthday leave: ${e.message}`);
  }

  // ── BANCO DE TALENTOS: resumen a People ────────────────────────
  try {
    results.talentPool = await sendTalentPoolDigest();
  } catch (e: any) {
    results.errors.push(`Talent pool digest: ${e.message}`);
  }

  // ── MENSAJES PROGRAMADOS ───────────────────────────────────────
  // Va último a propósito: publicar un mensaje dispara mails a toda la audiencia,
  // así que si algo falla antes conviene que los automatismos internos ya hayan
  // corrido en vez de quedar tapados por un error del fan-out.
  try {
    results.scheduledMessages = await publishScheduledMessages();
  } catch (e: any) {
    results.errors.push(`Scheduled messages: ${e.message}`);
  }

  return NextResponse.json({
    ok: true,
    date: today.toISOString().split('T')[0],
    ...results,
  });
}

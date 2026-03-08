import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { sendGoogleChatMessage } from '@/lib/googleChat';
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

function textToHtml(text: string): string {
  return text
    .split('\n')
    .map(line => {
      const bold = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      return bold ? `<p>${bold}</p>` : '<br/>';
    })
    .join('');
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
  // Allow Vercel cron or manual trigger with secret
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseServer();
  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
  const resend = resendKey ? new Resend(resendKey) : null;

  const today = new Date();
  const todayMonth = today.getUTCMonth() + 1;
  const todayDay = today.getUTCDate();
  const currentYear = today.getUTCFullYear();

  const results = { birthdays: [] as string[], anniversaries: [] as string[], errors: [] as string[] };

  // Fetch active automation templates
  const { data: templates } = await supabase
    .from('email_templates')
    .select('template_key, subject, body, is_active, send_internal_message, internal_message_text, send_to_google_chat')
    .in('template_key', ['birthday_greeting', 'work_anniversary'])
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
                await resend.emails.send({
                  from: fromEmail,
                  to: emailTo,
                  subject: replaceVariables(tpl.subject, vars),
                  html: textToHtml(replaceVariables(tpl.body, vars)),
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
                await resend.emails.send({
                  from: fromEmail,
                  to: emailTo,
                  subject: replaceVariables(tpl.subject, vars),
                  html: textToHtml(replaceVariables(tpl.body, vars)),
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

  return NextResponse.json({
    ok: true,
    date: today.toISOString().split('T')[0],
    ...results,
  });
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { sendGoogleChatMessage } from '@/lib/googleChat';
import { getEmailFrom, renderPlainTemplate } from '@/lib/email/layout';

function replaceVariables(text: string, vars: Record<string, string>): string {
  let result = text;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
  }
  return result;
}

// POST /api/admin/messages/test-automation
// Dev-only endpoint: bypasses session auth, uses service role key
export async function POST(req: NextRequest) {

  const { employee_id, template_key } = await req.json();
  if (!employee_id || !template_key) {
    return NextResponse.json({ error: 'employee_id y template_key son requeridos' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: emp } = await supabase
    .from('employees')
    .select('id, first_name, last_name, work_email, personal_email, hire_date, user_id')
    .eq('id', employee_id)
    .single();

  if (!emp) return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });

  const { data: tpl } = await supabase
    .from('email_templates')
    .select('template_key, subject, body, is_active, send_internal_message, internal_message_text, send_to_google_chat')
    .eq('template_key', template_key)
    .single();

  if (!tpl) return NextResponse.json({ error: 'Template no encontrado' }, { status: 404 });

  const firstName = emp.first_name?.split(' ')[0] || emp.first_name;
  const fullName = `${emp.first_name} ${emp.last_name}`;
  const emailTo = emp.work_email || emp.personal_email;

  const hireDate = emp.hire_date ? new Date(emp.hire_date) : null;
  const years = hireDate ? new Date().getFullYear() - hireDate.getFullYear() : 0;

  const vars: Record<string, string> = {
    firstName,
    employeeName: fullName,
    years: String(years),
    yearsSuffix: years === 1 ? '' : 's',
    hireDate: hireDate
      ? hireDate.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
      : '',
  };

  const subject = replaceVariables(tpl.subject, vars);
  const bodyHtml = renderPlainTemplate({
    templateKey: tpl.template_key,
    subject,
    body: replaceVariables(tpl.body, vars),
  });

  const resendKey = process.env.RESEND_API_KEY;

  if (!resendKey) return NextResponse.json({ error: 'RESEND_API_KEY no configurado' }, { status: 500 });
  if (!emailTo) return NextResponse.json({ error: 'El empleado no tiene email configurado' }, { status: 400 });

  const resend = new Resend(resendKey);
  const { error: sendError } = await resend.emails.send({
    from: getEmailFrom(),
    to: emailTo,
    subject: `[TEST] ${subject}`,
    html: bodyHtml,
  });

  if (sendError) return NextResponse.json({ error: sendError.message }, { status: 500 });

  // Send to Google Chat if enabled
  let googleChatSent = false;
  if (tpl.send_to_google_chat) {
    try {
      await sendGoogleChatMessage(`[TEST] ${subject}`);
      googleChatSent = true;
    } catch (e: any) {
      console.warn('[test-automation] Google Chat error:', e.message);
    }
  }

  return NextResponse.json({ ok: true, sent_to: emailTo, subject: `[TEST] ${subject}`, google_chat_sent: googleChatSent });
}

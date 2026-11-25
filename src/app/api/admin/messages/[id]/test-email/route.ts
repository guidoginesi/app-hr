import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { sendBatchEmails } from '@/lib/emailService';
import { getEmailsForUserIds } from '@/lib/notificationService';
import { buildMessageEmail } from '@/lib/messageEmail';
import { buildRecipientVars } from '@/lib/templateVars';

// POST /api/admin/messages/[id]/test-email
// Manda el mail del mensaje SOLO a quien lo pide, tal como le llegaría a cada
// destinatario (con sus propias variables). No publica ni crea destinatarios.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { isAdmin, user } = await requireAdmin();
  if (!isAdmin || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const supabase = getSupabaseServer();
  const { data: message, error } = await supabase
    .from('messages')
    .select('id, title, body, metadata')
    .eq('id', id)
    .single();
  if (error || !message) return NextResponse.json({ error: 'Message not found' }, { status: 404 });

  const [own] = await getEmailsForUserIds([user.id]);
  const to = own?.email ?? user.email;
  if (!to) return NextResponse.json({ error: 'No encontré tu mail.' }, { status: 400 });

  const { data: emp } = await supabase
    .from('employees')
    .select('first_name, last_name, dni, cuil')
    .eq('user_id', user.id)
    .maybeSingle();
  const ctx = ((message.metadata as { template_context?: Record<string, string> } | null)?.template_context ?? {});
  const mail = buildMessageEmail(message, buildRecipientVars((emp ?? null) as never, ctx), user.id);

  const result = await sendBatchEmails([{ to, ...mail, subject: `[Prueba] ${mail.subject}` }]);
  if (!result.success || !result.ids?.[0]) {
    return NextResponse.json({ error: result.error ?? 'Resend no aceptó el mail de prueba.' }, { status: 502 });
  }
  return NextResponse.json({ to });
}

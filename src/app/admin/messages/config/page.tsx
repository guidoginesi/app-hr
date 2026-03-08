import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { MessagesShell } from '../MessagesShell';
import { MessagesConfigClient } from './MessagesConfigClient';


export const dynamic = 'force-dynamic';

export default async function MessagesConfigPage() {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) redirect('/admin/login');

  const supabase = getSupabaseServer();
  const { data: templates } = await supabase
    .from('email_templates')
    .select('id, template_key, subject, body, description, variables, is_active, category, send_internal_message, internal_message_text, send_to_google_chat')
    .in('category', ['automation', 'time_off', 'payroll'])
    .order('category')
    .order('template_key');

  return (
    <MessagesShell active="configuracion">
      <MessagesConfigClient initialTemplates={templates || []} />
    </MessagesShell>
  );
}

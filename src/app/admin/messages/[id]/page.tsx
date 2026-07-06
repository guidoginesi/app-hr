import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { Button } from '@pow/ui/components/ui/button';
import { MessagesLayout } from '../MessagesLayout';
import { AdminMessageDetailClient } from './AdminMessageDetailClient';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminMessageDetailPage({ params }: Props) {
  const { isAdmin, user } = await requireAdmin();
  if (!isAdmin || !user) {
    redirect('/admin/login');
  }

  const { id } = await params;
  const supabase = getSupabaseServer();

  const { data: message, error: msgError } = await supabase
    .from('messages')
    .select('*')
    .eq('id', id)
    .single();

  if (msgError || !message) {
    notFound();
  }

  const { data: recipients } = await supabase
    .from('message_recipients')
    .select('id, user_id, delivered_at, read_at, confirmed_at, dismissed_at')
    .eq('message_id', id)
    .order('delivered_at', { ascending: false });

  // Enrich with employee info
  const userIds = (recipients ?? []).map((r: any) => r.user_id);
  let employeeMap: Record<string, { first_name: string; last_name: string; job_title: string; work_email: string }> = {};

  if (userIds.length > 0) {
    const { data: employees } = await supabase
      .from('employees')
      .select('user_id, first_name, last_name, job_title, work_email, personal_email')
      .in('user_id', userIds);

    for (const emp of employees ?? []) {
      employeeMap[emp.user_id] = {
        first_name: emp.first_name,
        last_name: emp.last_name,
        job_title: emp.job_title || '',
        work_email: emp.work_email || emp.personal_email || '',
      };
    }
  }

  const enrichedRecipients = (recipients ?? []).map((r: any) => ({
    ...r,
    employee: employeeMap[r.user_id] ?? null,
  }));

  const metrics = {
    recipients_total: enrichedRecipients.length,
    read_count: enrichedRecipients.filter((r: any) => r.read_at !== null).length,
    confirmed_count: enrichedRecipients.filter((r: any) => r.confirmed_at !== null).length,
  };

  return (
    <MessagesLayout
      showTabs={false}
      actions={
        <Link href="/admin/messages">
          <Button variant="outline">Volver a mensajes</Button>
        </Link>
      }
    >
      <AdminMessageDetailClient
        message={message as any}
        recipients={enrichedRecipients}
        metrics={metrics}
      />
    </MessagesLayout>
  );
}

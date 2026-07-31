import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { MessagesLayout } from './MessagesLayout';
import { AdminMessagesClient } from './AdminMessagesClient';

export const dynamic = 'force-dynamic';

export default async function AdminMessagesPage() {
  const { isAdmin, user } = await requireAdmin();
  if (!isAdmin || !user) {
    redirect('/admin/login');
  }

  const supabase = getSupabaseServer();

  const { data: messages } = await supabase
    .from('messages')
    .select('id, type, title, body, priority, require_confirmation, status, created_at, published_at, expires_at, audience, created_by, metadata')
    .order('created_at', { ascending: false })
    .limit(100);

  // Enrich with metrics
  const messageIds = (messages ?? []).map((m: any) => m.id);
  let metricsMap: Record<string, { recipients_total: number; read_count: number; confirmed_count: number }> = {};

  if (messageIds.length > 0) {
    const { data: metrics } = await supabase
      .from('message_recipients')
      .select('message_id, read_at, confirmed_at')
      .in('message_id', messageIds);

    for (const msgId of messageIds) {
      const rows = (metrics ?? []).filter((r: any) => r.message_id === msgId);
      metricsMap[msgId] = {
        recipients_total: rows.length,
        read_count: rows.filter((r: any) => r.read_at !== null).length,
        confirmed_count: rows.filter((r: any) => r.confirmed_at !== null).length,
      };
    }
  }

  const enriched = (messages ?? []).map((m: any) => ({
    ...m,
    ...(metricsMap[m.id] ?? { recipients_total: 0, read_count: 0, confirmed_count: 0 }),
  }));

  // Datos para los pickers de audiencia (área / líder / individual)
  const { data: departments } = await supabase
    .from('departments')
    .select('id, name')
    .eq('is_active', true)
    .order('name');

  const { data: employeesRaw } = await supabase
    .from('employees')
    .select('id, user_id, first_name, last_name, department_id, manager_id')
    .eq('status', 'active')
    .not('user_id', 'is', null)
    .order('first_name');

  const employees = (employeesRaw ?? []) as any[];
  const managerIds = new Set(employees.filter((e) => e.manager_id).map((e) => e.manager_id as string));
  const leaders = employees.filter((e) => managerIds.has(e.id));

  return (
    <MessagesLayout active="mensajes">
      <AdminMessagesClient
        messages={enriched}
        departments={departments ?? []}
        employees={employees}
        leaders={leaders}
      />
    </MessagesLayout>
  );
}

import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { parseMessageFilters, queryMessages } from '@/lib/messagesQuery';
import { MessagesLayout } from './MessagesLayout';
import { AdminMessagesClient } from './AdminMessagesClient';

export const dynamic = 'force-dynamic';

export default async function AdminMessagesPage() {
  const { isAdmin, user } = await requireAdmin();
  if (!isAdmin || !user) {
    redirect('/admin/login');
  }

  const supabase = getSupabaseServer();

  // Primer render sin filtros (el cliente re-consulta al cambiar los filtros).
  const filters = parseMessageFilters(new URLSearchParams());
  const { items, total } = await queryMessages(supabase, filters);

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
        messages={items}
        total={total}
        departments={departments ?? []}
        employees={employees}
        leaders={leaders}
      />
    </MessagesLayout>
  );
}

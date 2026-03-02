import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { AdminProfileDropdown } from '@/components/AdminProfileDropdown';
import { NotificationBell } from '@/components/NotificationBell';
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
    <div className="flex min-h-screen bg-zinc-50 text-zinc-900">
      {/* Sidebar */}
      <aside className="flex w-64 flex-shrink-0 flex-col border-r border-zinc-200 bg-white shadow-sm">
        <div className="flex h-16 items-center border-b border-zinc-200 px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100">
              <svg className="h-5 w-5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-900">Mensajes</p>
              <p className="text-xs text-zinc-500">Centro de comunicación</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 px-3 py-4">
          <Link
            href="/admin/messages"
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 hover:text-black"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Todos los mensajes
          </Link>
        </nav>
        <div className="border-t border-zinc-200 px-3 py-3">
          <Link
            href="/admin"
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-500 transition-all hover:bg-zinc-100 hover:text-zinc-900"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Volver al inicio
          </Link>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-zinc-200 bg-white px-8 shadow-sm">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-zinc-900">Detalle del mensaje</h1>
            <p className="mt-0.5 text-xs font-normal text-zinc-500">Métricas y lista de destinatarios</p>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell detailBasePath="/portal/messages" />
            <AdminProfileDropdown />
          </div>
        </header>

        <main className="flex-1 bg-zinc-50 px-8 py-8">
          <AdminMessageDetailClient
            message={message as any}
            recipients={enrichedRecipients}
            metrics={metrics}
          />
        </main>
      </div>
    </div>
  );
}

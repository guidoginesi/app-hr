import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { AdminShell } from '../AdminShell';
import { ReferidosAdminClient } from './ReferidosAdminClient';

export const dynamic = 'force-dynamic';

export default async function AdminReferidosPage() {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) redirect('/admin');

  const supabase = getSupabaseServer();

  const [{ data: referrals }, { data: jobs }] = await Promise.all([
    supabase
      .from('referrals')
      .select(`
        *,
        job:jobs!job_id(id, title, department),
        referrer:employees!referrer_employee_id(id, first_name, last_name, job_title)
      `)
      .order('created_at', { ascending: false }),
    supabase
      .from('jobs')
      .select('id, title')
      .order('title'),
  ]);

  return (
    <AdminShell active="referidos">
      <ReferidosAdminClient initialReferrals={referrals || []} jobs={jobs || []} />
    </AdminShell>
  );
}

import { redirect } from 'next/navigation';
import { requirePortalAccess } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { PortalShell } from '../PortalShell';
import { ReferidosClient } from './ReferidosClient';

export const dynamic = 'force-dynamic';

export default async function ReferidosPage() {
  const auth = await requirePortalAccess();
  if (!auth?.employee) redirect('/portal/login');

  const { employee, isLeader } = auth;
  const supabase = getSupabaseServer();

  const [{ data: jobs }, { data: referrals }] = await Promise.all([
    supabase
      .from('jobs')
      .select('id, title, department, location, work_mode')
      .eq('is_published', true)
      .order('created_at', { ascending: false }),
    supabase
      .from('referrals')
      .select(`*, job:jobs!job_id(id, title, department)`)
      .eq('referrer_employee_id', employee.id)
      .order('created_at', { ascending: false }),
  ]);

  return (
    <PortalShell employee={employee} isLeader={isLeader} active="referidos">
      <ReferidosClient initialJobs={jobs || []} initialReferrals={referrals || []} />
    </PortalShell>
  );
}

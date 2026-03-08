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

  // Fetch application snapshots separately to avoid FK ambiguity
  const appIds = (referrals || [])
    .map((r: any) => r.application_id)
    .filter(Boolean) as string[];

  let applicationsMap: Record<string, any> = {};
  if (appIds.length > 0) {
    const { data: apps } = await supabase
      .from('applications')
      .select('id, current_stage, current_stage_status, final_outcome, offer_status')
      .in('id', appIds);
    if (apps) {
      for (const app of apps) applicationsMap[app.id] = app;
    }
  }

  const referralsWithApp = (referrals || []).map((r: any) => ({
    ...r,
    application: r.application_id ? (applicationsMap[r.application_id] ?? null) : null,
  }));

  return (
    <PortalShell employee={employee} isLeader={isLeader} active="referidos">
      <ReferidosClient initialJobs={jobs || []} initialReferrals={referralsWithApp} />
    </PortalShell>
  );
}

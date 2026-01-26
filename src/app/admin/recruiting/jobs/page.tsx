import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { RecruitingShell } from '../RecruitingShell';
import { JobsClient } from '../../jobs/JobsClient';

export const dynamic = 'force-dynamic';

export default async function RecruitingJobsPage() {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) {
    redirect('/admin/login');
  }

  const supabase = getSupabaseServer();

  const { data: jobs, error } = await supabase
    .from('jobs')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching jobs:', error);
  }

  return (
    <RecruitingShell active="busquedas">
      <JobsClient jobs={jobs || []} />
    </RecruitingShell>
  );
}

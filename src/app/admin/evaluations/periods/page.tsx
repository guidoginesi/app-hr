import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { EvaluationsShell } from '../EvaluationsShell';
import { PeriodsClient } from './PeriodsClient';

export const dynamic = 'force-dynamic';

export default async function EvaluationPeriodsPage() {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) {
    redirect('/admin/login');
  }

  const supabase = getSupabaseServer();

  const { data: periods } = await supabase
    .from('evaluation_periods')
    .select('*')
    .order('year', { ascending: false });

  return (
    <EvaluationsShell active="periods">
      <PeriodsClient periods={periods || []} />
    </EvaluationsShell>
  );
}

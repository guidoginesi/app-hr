import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { requirePortalAccess } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import {
  getAiTrainingCycles,
  getAiTrainingRanking,
  resolveCycleId,
} from '@/lib/entrenamientoIaQueries';
import { PortalShell } from '../PortalShell';
import { PortalEntrenamientoClient } from './PortalEntrenamientoClient';

export const dynamic = 'force-dynamic';

export default async function PortalEntrenamientoPage({
  searchParams,
}: {
  searchParams: Promise<{ cycle_id?: string }>;
}) {
  const auth = await requirePortalAccess();
  if (!auth?.employee) redirect('/portal/login');

  const { cycle_id: cycleIdParam } = await searchParams;
  const cycles = await getAiTrainingCycles();
  const selectedCycleId = await resolveCycleId(cycleIdParam ?? cycles[0]?.id ?? null);
  const ranking = selectedCycleId ? await getAiTrainingRanking(selectedCycleId) : [];

  const supabase = getSupabaseServer();
  let history: any[] = [];
  if (selectedCycleId) {
    const { data } = await supabase
      .from('ai_training_score_details')
      .select('*')
      .eq('cycle_id', selectedCycleId)
      .eq('employee_id', auth.employee.id)
      .order('session_date', { ascending: false });
    history = data ?? [];
  }

  return (
    <PortalShell employee={auth.employee} isLeader={auth.isLeader} active="entrenamiento-ia">
      <Suspense fallback={<div className="text-sm text-muted-foreground">Cargando…</div>}>
        <PortalEntrenamientoClient
          cycles={cycles}
          ranking={ranking}
          selectedCycleId={selectedCycleId}
          employeeId={auth.employee.id}
          history={history}
          historyTotal={history.reduce((sum, row) => sum + (row.total_points ?? 0), 0)}
          view="ranking"
        />
      </Suspense>
    </PortalShell>
  );
}

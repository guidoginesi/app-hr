import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { requireAdmin } from '@/lib/checkAuth';
import {
  getAiTrainingCycles,
  getAiTrainingRanking,
  resolveCycleId,
} from '@/lib/entrenamientoIaQueries';
import { EntrenamientoIAShell } from './EntrenamientoIAShell';
import { AdminRankingClient } from './AdminRankingClient';

export const dynamic = 'force-dynamic';

export default async function EntrenamientoIAPage({
  searchParams,
}: {
  searchParams: Promise<{ cycle_id?: string }>;
}) {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) redirect('/admin/login');

  const { cycle_id: cycleIdParam } = await searchParams;
  const cycles = await getAiTrainingCycles();
  const selectedCycleId = await resolveCycleId(cycleIdParam ?? cycles[0]?.id ?? null);

  const ranking = selectedCycleId ? await getAiTrainingRanking(selectedCycleId) : [];

  return (
    <EntrenamientoIAShell active="ranking">
      <Suspense fallback={<div className="text-sm text-muted-foreground">Cargando ranking…</div>}>
        <AdminRankingClient
          cycles={cycles}
          ranking={ranking}
          selectedCycleId={selectedCycleId}
        />
      </Suspense>
    </EntrenamientoIAShell>
  );
}

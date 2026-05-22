import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/checkAuth';
import {
  getAiTrainingCycles,
  getAiTrainingSessions,
  resolveCycleId,
} from '@/lib/entrenamientoIaQueries';
import { EntrenamientoIAShell } from '../EntrenamientoIAShell';
import { SessionsClient } from './SessionsClient';

export const dynamic = 'force-dynamic';

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ cycle_id?: string }>;
}) {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) redirect('/admin/login');

  const { cycle_id: cycleIdParam } = await searchParams;
  const cycles = await getAiTrainingCycles();
  const selectedCycleId = await resolveCycleId(cycleIdParam ?? cycles[0]?.id ?? null);
  const sessions = await getAiTrainingSessions();

  return (
    <EntrenamientoIAShell active="sessions">
      <SessionsClient cycles={cycles} sessions={sessions} selectedCycleId={selectedCycleId} />
    </EntrenamientoIAShell>
  );
}

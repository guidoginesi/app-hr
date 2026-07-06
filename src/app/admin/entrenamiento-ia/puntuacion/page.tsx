import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { requireAdmin } from '@/lib/checkAuth';
import {
  getAiTrainingCycles,
  getAiTrainingSessions,
  resolveCycleId,
} from '@/lib/entrenamientoIaQueries';
import { EntrenamientoIALayout } from '../EntrenamientoIALayout';
import { PuntuacionClient } from './PuntuacionClient';
import { SkeletonRows } from '@pow/ui/components/ui/skeleton';

export const dynamic = 'force-dynamic';

export default async function PuntuacionPage({
  searchParams,
}: {
  searchParams: Promise<{ cycle_id?: string; session_id?: string }>;
}) {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) redirect('/admin/login');

  const params = await searchParams;
  const cycles = await getAiTrainingCycles();
  const selectedCycleId = await resolveCycleId(params.cycle_id ?? cycles[0]?.id ?? null);
  const sessions = selectedCycleId
    ? await getAiTrainingSessions(selectedCycleId)
    : await getAiTrainingSessions();

  const selectedSessionId =
    params.session_id ?? (sessions.length > 0 ? sessions[0].id : null);

  return (
    <EntrenamientoIALayout active="puntuacion">
      <Suspense fallback={<SkeletonRows rows={6} />}>
        <PuntuacionClient
          cycles={cycles}
          sessions={sessions}
          selectedCycleId={selectedCycleId}
          selectedSessionId={selectedSessionId}
        />
      </Suspense>
    </EntrenamientoIALayout>
  );
}

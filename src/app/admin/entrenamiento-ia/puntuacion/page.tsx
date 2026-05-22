import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { requireAdmin } from '@/lib/checkAuth';
import {
  getAiTrainingCycles,
  getAiTrainingSessions,
  resolveCycleId,
} from '@/lib/entrenamientoIaQueries';
import { EntrenamientoIAShell } from '../EntrenamientoIAShell';
import { PuntuacionClient } from './PuntuacionClient';

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
    <EntrenamientoIAShell active="puntuacion">
      <Suspense fallback={<div className="text-sm text-zinc-500">Cargando…</div>}>
        <PuntuacionClient
          cycles={cycles}
          sessions={sessions}
          selectedCycleId={selectedCycleId}
          selectedSessionId={selectedSessionId}
        />
      </Suspense>
    </EntrenamientoIAShell>
  );
}

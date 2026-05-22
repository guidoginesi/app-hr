'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import type { AiTrainingCycle, AiTrainingRankingRow } from '@/types/entrenamiento-ia';
import { RankingTable, ScoringRulesCard } from '@/components/entrenamiento-ia/RankingTable';

type Props = {
  cycles: AiTrainingCycle[];
  ranking: AiTrainingRankingRow[];
  selectedCycleId: string | null;
};

export function AdminRankingClient({ cycles, ranking, selectedCycleId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedCycle = cycles.find((c) => c.id === selectedCycleId) ?? cycles[0] ?? null;
  const topThree = [...ranking].sort((a, b) => b.total_points - a.total_points).slice(0, 3);
  const participantsWithPoints = ranking.filter((r) => r.total_points > 0).length;

  const handleCycleChange = (cycleId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('cycle_id', cycleId);
    router.push(`/admin/entrenamiento-ia?${params.toString()}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900">Ranking del ciclo</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Tablero general visible para todo el equipo Pow
          </p>
        </div>
        {cycles.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Ciclo</label>
            <select
              value={selectedCycle?.id ?? ''}
              onChange={(e) => handleCycleChange(e.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
            >
              {cycles.map((cycle) => (
                <option key={cycle.id} value={cycle.id}>
                  {cycle.name}
                  {cycle.is_active ? ' (activo)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Participantes</p>
          <p className="mt-2 text-3xl font-bold text-zinc-900">{ranking.length}</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Con puntos</p>
          <p className="mt-2 text-3xl font-bold text-sky-700">{participantsWithPoints}</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Líder del ciclo</p>
          <p className="mt-2 text-lg font-bold text-zinc-900 truncate">
            {topThree[0]
              ? `${topThree[0].first_name} ${topThree[0].last_name}`
              : '—'}
          </p>
          {topThree[0] && (
            <p className="text-sm text-sky-700 font-semibold">{topThree[0].total_points} pts</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <RankingTable rows={ranking} />
        </div>
        <ScoringRulesCard />
      </div>
    </div>
  );
}

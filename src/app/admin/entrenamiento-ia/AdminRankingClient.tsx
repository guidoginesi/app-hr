'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import type { AiTrainingCycle, AiTrainingRankingRow } from '@/types/entrenamiento-ia';
import { RankingTable, ScoringRulesCard } from '@/components/entrenamiento-ia/RankingTable';
import { Stat } from '@pow/ui/components/ui/stat';
import { SelectMenu } from '@pow/ui/components/ui/select-menu';
import { Users, Award, Trophy } from 'lucide-react';

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
      {cycles.length > 0 && (
        <div className="flex justify-end">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Ciclo</label>
            <SelectMenu
              ariaLabel="Ciclo"
              align="end"
              value={selectedCycle?.id ?? ''}
              onChange={handleCycleChange}
              options={cycles.map((cycle) => ({
                value: cycle.id,
                label: `${cycle.name}${cycle.is_active ? ' (activo)' : ''}`,
              }))}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat icon={<Users className="h-6 w-6" />} label="Participantes" value={String(ranking.length)} />
        <Stat icon={<Award className="h-6 w-6" />} label="Con puntos" value={String(participantsWithPoints)} />
        <Stat
          icon={<Trophy className="h-6 w-6" />}
          label="Líder del ciclo"
          value={topThree[0] ? `${topThree[0].first_name} ${topThree[0].last_name}` : '—'}
          sub={topThree[0] ? `${topThree[0].total_points} pts` : undefined}
        />
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

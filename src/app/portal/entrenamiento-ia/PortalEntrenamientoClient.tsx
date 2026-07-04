'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { AiTrainingCycle, AiTrainingRankingRow, AiTrainingScoreDetail } from '@/types/entrenamiento-ia';
import { buildScoreBreakdown } from '@/types/entrenamiento-ia';
import { RankingTable, ScoringRulesCard } from '@/components/entrenamiento-ia/RankingTable';
import { PageHeader } from '@pow/ui/components/ui/page-header';
import { SelectMenu } from '@pow/ui/components/ui/select-menu';

type Props = {
  cycles: AiTrainingCycle[];
  ranking: AiTrainingRankingRow[];
  selectedCycleId: string | null;
  employeeId: string;
  history: AiTrainingScoreDetail[];
  historyTotal: number;
  view: 'ranking' | 'historial';
};

export function PortalEntrenamientoClient({
  cycles,
  ranking,
  selectedCycleId,
  employeeId,
  history,
  historyTotal,
  view,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleCycleChange = (cycleId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('cycle_id', cycleId);
    const base = view === 'historial' ? '/portal/entrenamiento-ia/historial' : '/portal/entrenamiento-ia';
    router.push(`${base}?${params.toString()}`);
  };

  const myRank =
    [...ranking]
      .sort((a, b) => b.total_points - a.total_points)
      .findIndex((r) => r.employee_id === employeeId) + 1;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Entrenamiento IA"
        description="Ranking de capacitaciones internas · participación voluntaria"
        actions={
          cycles.length > 0 ? (
            <SelectMenu
              value={selectedCycleId ?? ''}
              onChange={handleCycleChange}
              ariaLabel="Ciclo"
              align="end"
              options={cycles.map((cycle) => ({
                value: cycle.id,
                label: `${cycle.name}${cycle.is_active ? ' (activo)' : ''}`,
              }))}
            />
          ) : undefined
        }
      />

      <div className="flex gap-2 border-b border-[var(--border)]">
        <Link
          href={`/portal/entrenamiento-ia${selectedCycleId ? `?cycle_id=${selectedCycleId}` : ''}`}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            view === 'ranking'
              ? 'border-brand text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Ranking general
        </Link>
        <Link
          href={`/portal/entrenamiento-ia/historial${selectedCycleId ? `?cycle_id=${selectedCycleId}` : ''}`}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            view === 'historial'
              ? 'border-brand text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Mi historial
        </Link>
      </div>

      {view === 'ranking' ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-[var(--border)] bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tu posición</p>
              <p className="mt-2 text-2xl font-bold text-foreground">
                {myRank > 0 ? `#${myRank}` : '—'}
              </p>
              <p className="text-sm text-muted-foreground">
                {ranking.find((r) => r.employee_id === employeeId)?.total_points ?? 0} puntos totales
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Colaboradores en el ranking</p>
              <p className="mt-2 text-2xl font-bold text-foreground">{ranking.length}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <RankingTable rows={ranking} highlightEmployeeId={employeeId} />
            </div>
            <ScoringRulesCard />
          </div>
        </>
      ) : (
        <>
          <div className="rounded-xl border border-[var(--border)] bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total del ciclo</p>
            <p className="mt-2 text-2xl font-bold text-foreground">{historyTotal} pts</p>
            <p className="text-sm text-muted-foreground">{history.length} sesión{history.length !== 1 ? 'es' : ''} registrada{history.length !== 1 ? 's' : ''}</p>
          </div>

          {history.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border)] bg-white p-12 text-center">
              <p className="text-sm text-muted-foreground">
                Todavía no tenés puntajes registrados en este ciclo. ¡Sumate a la próxima capacitación!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((entry) => {
                const breakdown = buildScoreBreakdown({
                  attended: entry.attended,
                  participation_count: entry.participation_count,
                  exam_score: entry.exam_score,
                  activity_on_time: entry.activity_on_time,
                  manual_adjustment: entry.manual_adjustment,
                });

                return (
                  <div key={entry.id} className="rounded-xl border border-[var(--border)] bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-semibold text-foreground">{entry.session_title}</p>
                        <p className="text-xs text-muted-foreground">{entry.session_date}</p>
                      </div>
                      <p className="text-xl font-bold text-foreground">{entry.total_points} pts</p>
                    </div>
                    <ul className="mt-4 space-y-1">
                      {breakdown.map((line) => (
                        <li key={line.label} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{line.label}</span>
                          <span className="font-medium text-foreground">+{line.points}</span>
                        </li>
                      ))}
                    </ul>
                    {entry.notes && (
                      <p className="mt-3 text-xs text-muted-foreground border-t border-[var(--border)] pt-3">
                        Nota HR: {entry.notes}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

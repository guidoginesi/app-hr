'use client';

import Link from 'next/link';
import { buttonVariants } from '@pow/ui/components/ui/button';
import { PageHeader } from '@pow/ui/components/ui/page-header';
import type { EvaluationPeriod, Evaluation, EvaluationDimension } from '@/types/evaluation';
import { SCALE_DEFINITIONS, getScaleLabel } from '@/types/evaluation';

type ResultadosClientProps = {
  period: EvaluationPeriod;
  selfEvaluation: Evaluation | null;
  leaderEvaluation: (Evaluation & { evaluator?: { id: string; first_name: string; last_name: string } }) | null;
  dimensions: EvaluationDimension[];
  canShowResults: boolean;
};

export function ResultadosClient({
  period,
  selfEvaluation,
  leaderEvaluation,
  dimensions,
  canShowResults,
}: ResultadosClientProps) {
  const selfScore = selfEvaluation?.total_score;
  const leaderScore = leaderEvaluation?.total_score;
  const gap = selfScore !== null && selfScore !== undefined && leaderScore !== null && leaderScore !== undefined
    ? leaderScore - selfScore
    : null;

  const selfDimensionScores = selfEvaluation?.dimension_scores || {};
  const leaderDimensionScores = leaderEvaluation?.dimension_scores || {};

  const getScoreColor = (score: number): string => {
    if (score <= 2) return 'text-[var(--red-600)]';
    if (score <= 6) return 'text-[var(--amber-600)]';
    return 'text-[var(--green-700)]';
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Resultados de Evaluación"
        description={period.name}
        actions={
          <Link href="/portal/evaluaciones" className={buttonVariants({ variant: 'outline' })}>
            Volver
          </Link>
        }
      />

      {/* Status Check */}
      {!selfEvaluation || selfEvaluation.status !== 'submitted' ? (
        <div className="rounded-xl border border-warning/30 bg-warning-subtle p-6">
          <p className="text-[var(--amber-600)] font-medium">Tu autoevaluación aún no está completa</p>
          <p className="text-sm text-[var(--amber-600)] mt-1">
            Completá tu autoevaluación para ver los resultados.
          </p>
          <Link href="/portal/evaluaciones" className={`mt-4 ${buttonVariants({ variant: 'primary' })}`}>
            Ir a evaluaciones
          </Link>
        </div>
      ) : (
        <>
          {/* Overall Scores */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="rounded-xl border border-[var(--border)] bg-white p-6 text-center shadow-sm">
              <p className="text-sm font-medium text-foreground">Mi Autoevaluación</p>
              <p className={`text-4xl font-bold mt-2 ${selfScore ? getScoreColor(selfScore) : 'text-muted-foreground'}`}>
                {selfScore?.toFixed(1) || '-'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">/10</p>
              {selfScore && (
                <p className="text-xs text-muted-foreground mt-2">{getScaleLabel(Math.round(selfScore))}</p>
              )}
            </div>

            {canShowResults && leaderEvaluation && leaderEvaluation.status === 'submitted' ? (
              <>
                <div className="rounded-xl border border-[var(--border)] bg-white p-6 text-center shadow-sm">
                  <p className="text-sm font-medium text-foreground">Evaluación de Líder</p>
                  <p className={`text-4xl font-bold mt-2 ${leaderScore ? getScoreColor(leaderScore) : 'text-muted-foreground'}`}>
                    {leaderScore?.toFixed(1) || '-'}
                  </p>
                  <p className="text-xs text-foreground mt-1">/10</p>
                  {leaderScore && (
                    <p className="text-xs text-foreground mt-2">{getScaleLabel(Math.round(leaderScore))}</p>
                  )}
                  {leaderEvaluation.evaluator && (
                    <p className="text-xs text-foreground mt-2">
                      Por: {leaderEvaluation.evaluator.first_name} {leaderEvaluation.evaluator.last_name}
                    </p>
                  )}
                </div>

                <div className="rounded-xl border border-[var(--border)] bg-white p-6 text-center shadow-sm">
                  <p className="text-sm font-medium text-muted-foreground">GAP</p>
                  <p className={`text-4xl font-bold mt-2 ${
                    gap === null ? 'text-muted-foreground' :
                    gap >= 0 ? 'text-[var(--green-700)]' : 'text-[var(--red-600)]'
                  }`}>
                    {gap !== null ? (gap >= 0 ? '+' : '') + gap.toFixed(1) : '-'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {gap !== null && (
                      gap > 0 ? 'Tu líder te evaluó mejor que vos mismo' :
                      gap < 0 ? 'Tu líder te evaluó más bajo que vos mismo' :
                      'Coinciden las evaluaciones'
                    )}
                  </p>
                </div>
              </>
            ) : (
              <div className="lg:col-span-2 rounded-xl border border-[var(--border)] bg-white p-6 flex items-center justify-center shadow-sm">
                <p className="text-sm text-muted-foreground">
                  {!canShowResults
                    ? 'Los resultados de la evaluación de líder aún no están disponibles.'
                    : 'Tu líder aún no ha completado tu evaluación.'
                  }
                </p>
              </div>
            )}
          </div>

          {/* Dimension Comparison */}
          <div className="rounded-xl border border-[var(--border)] bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-secondary-foreground">Resultados por Dimensión</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="pb-2 pr-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dimensión</th>
                    <th className="w-28 pb-2 pl-4 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Autoevaluación</th>
                    {canShowResults && leaderEvaluation?.status === 'submitted' && (
                      <th className="w-24 pb-2 pl-4 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Líder</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {dimensions.map((dim) => {
                    const selfDimScore = selfDimensionScores[dim.id];
                    const leaderDimScore = leaderDimensionScores[dim.id];

                    return (
                      <tr key={dim.id} className="border-t border-[var(--border)]">
                        <td className="py-3 pr-4">
                          <span className="font-medium text-secondary-foreground">{dim.name}</span>
                          {dim.description && (
                            <span className="block text-xs text-muted-foreground">{dim.description}</span>
                          )}
                        </td>
                        <td className="py-3 pl-4 text-right">
                          <span className={`font-semibold ${selfDimScore ? getScoreColor(selfDimScore) : 'text-muted-foreground'}`}>
                            {selfDimScore?.toFixed(1) || '-'}
                          </span>
                        </td>
                        {canShowResults && leaderEvaluation?.status === 'submitted' && (
                          <td className="py-3 pl-4 text-right">
                            <span className={`font-semibold ${leaderDimScore ? getScoreColor(leaderDimScore) : 'text-muted-foreground'}`}>
                              {leaderDimScore?.toFixed(1) || '-'}
                            </span>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Scale Reference */}
          <div className="rounded-xl border border-[var(--border)] bg-white p-6">
            <h3 className="mb-4 text-sm font-semibold text-secondary-foreground">Referencia de escala</h3>
            <div className="flex flex-wrap gap-2">
              {SCALE_DEFINITIONS.map((def) => (
                <div key={def.min} className="inline-flex items-center gap-2 rounded-lg bg-muted px-3 py-1.5">
                  <span className="text-sm font-semibold text-secondary-foreground">{def.min}-{def.max}</span>
                  <span className="text-xs text-muted-foreground">{def.label}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

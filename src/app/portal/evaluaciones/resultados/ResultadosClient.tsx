'use client';

import Link from 'next/link';
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
    if (score <= 2) return 'text-red-600';
    if (score <= 4) return 'text-orange-600';
    if (score <= 6) return 'text-yellow-600';
    if (score <= 8) return 'text-green-600';
    return 'text-emerald-600';
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Resultados de Evaluación</h1>
          <p className="mt-1 text-sm text-zinc-500">{period.name}</p>
        </div>
        <Link
          href="/portal/evaluaciones"
          className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Volver
        </Link>
      </div>

      {/* Status Check */}
      {!selfEvaluation || selfEvaluation.status !== 'submitted' ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
          <p className="text-amber-900 font-medium">Tu autoevaluación aún no está completa</p>
          <p className="text-sm text-amber-700 mt-1">
            Completá tu autoevaluación para ver los resultados.
          </p>
          <Link
            href="/portal/evaluaciones"
            className="mt-4 inline-block rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
          >
            Ir a evaluaciones
          </Link>
        </div>
      ) : (
        <>
          {/* Overall Scores */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-6 text-center">
              <p className="text-sm font-medium text-blue-600">Mi Autoevaluación</p>
              <p className={`text-4xl font-bold mt-2 ${selfScore ? getScoreColor(selfScore) : 'text-zinc-400'}`}>
                {selfScore?.toFixed(1) || '-'}
              </p>
              <p className="text-xs text-blue-600 mt-1">/10</p>
              {selfScore && (
                <p className="text-xs text-blue-700 mt-2">{getScaleLabel(Math.round(selfScore))}</p>
              )}
            </div>

            {canShowResults && leaderEvaluation && leaderEvaluation.status === 'submitted' ? (
              <>
                <div className="rounded-xl border border-purple-200 bg-purple-50 p-6 text-center">
                  <p className="text-sm font-medium text-purple-600">Evaluación de Líder</p>
                  <p className={`text-4xl font-bold mt-2 ${leaderScore ? getScoreColor(leaderScore) : 'text-zinc-400'}`}>
                    {leaderScore?.toFixed(1) || '-'}
                  </p>
                  <p className="text-xs text-purple-600 mt-1">/10</p>
                  {leaderScore && (
                    <p className="text-xs text-purple-700 mt-2">{getScaleLabel(Math.round(leaderScore))}</p>
                  )}
                  {leaderEvaluation.evaluator && (
                    <p className="text-xs text-purple-600 mt-2">
                      Por: {leaderEvaluation.evaluator.first_name} {leaderEvaluation.evaluator.last_name}
                    </p>
                  )}
                </div>

                <div className="rounded-xl border border-zinc-200 bg-white p-6 text-center">
                  <p className="text-sm font-medium text-zinc-600">GAP</p>
                  <p className={`text-4xl font-bold mt-2 ${
                    gap === null ? 'text-zinc-400' :
                    gap >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {gap !== null ? (gap >= 0 ? '+' : '') + gap.toFixed(1) : '-'}
                  </p>
                  <p className="text-xs text-zinc-500 mt-2">
                    {gap !== null && (
                      gap > 0 ? 'Tu líder te evaluó mejor que vos mismo' :
                      gap < 0 ? 'Tu líder te evaluó más bajo que vos mismo' :
                      'Coinciden las evaluaciones'
                    )}
                  </p>
                </div>
              </>
            ) : (
              <div className="lg:col-span-2 rounded-xl border border-zinc-200 bg-zinc-50 p-6 flex items-center justify-center">
                <p className="text-sm text-zinc-500">
                  {!canShowResults
                    ? 'Los resultados de la evaluación de líder aún no están disponibles.'
                    : 'Tu líder aún no ha completado tu evaluación.'
                  }
                </p>
              </div>
            )}
          </div>

          {/* Dimension Comparison */}
          <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-zinc-900">Resultados por Dimensión</h2>
            </div>
            <div className="p-6">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-4 px-4">
                <span className="flex-1">Dimensión</span>
                <span className="w-24 text-center">Autoevaluación</span>
                {canShowResults && leaderEvaluation?.status === 'submitted' && (
                  <span className="w-24 text-center">Líder</span>
                )}
              </div>
              <div className="space-y-2">
                {dimensions.map((dim) => {
                  const selfDimScore = selfDimensionScores[dim.id];
                  const leaderDimScore = leaderDimensionScores[dim.id];
                  
                  return (
                    <div key={dim.id} className="flex items-center justify-between p-4 rounded-lg bg-zinc-50">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-zinc-800">{dim.name}</p>
                        {dim.description && (
                          <p className="text-xs text-zinc-500">{dim.description}</p>
                        )}
                      </div>
                      <div className="w-24 text-center">
                        <span className={`text-sm font-semibold ${selfDimScore ? getScoreColor(selfDimScore) : 'text-zinc-400'}`}>
                          {selfDimScore?.toFixed(1) || '-'}
                        </span>
                      </div>
                      {canShowResults && leaderEvaluation?.status === 'submitted' && (
                        <div className="w-24 text-center">
                          <span className={`text-sm font-semibold ${leaderDimScore ? getScoreColor(leaderDimScore) : 'text-zinc-400'}`}>
                            {leaderDimScore?.toFixed(1) || '-'}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Scale Reference */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6">
            <h3 className="text-sm font-semibold text-zinc-900 mb-3">Referencia de escala</h3>
            <div className="flex flex-wrap gap-2">
              {SCALE_DEFINITIONS.map((def) => (
                <div key={def.min} className="inline-flex items-center gap-2 rounded-lg bg-zinc-50 px-3 py-1.5">
                  <span className="text-sm font-semibold text-zinc-700">{def.min}-{def.max}</span>
                  <span className="text-xs text-zinc-500">{def.label}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

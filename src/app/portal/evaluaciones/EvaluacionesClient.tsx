'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Employee } from '@/types/employee';
import type { EvaluationPeriod, Evaluation } from '@/types/evaluation';
import { SCALE_DEFINITIONS } from '@/types/evaluation';

type EvaluacionesClientProps = {
  employee: Employee;
  isLeader: boolean;
  activePeriod: EvaluationPeriod | null;
  selfEvaluation: Evaluation | null;
  leaderEvaluations: any[];
  pendingTeamEvaluations: any[];
};

export function EvaluacionesClient({
  employee,
  isLeader,
  activePeriod,
  selfEvaluation,
  leaderEvaluations,
  pendingTeamEvaluations,
}: EvaluacionesClientProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startSelfEvaluation = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/portal/evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'self' }),
      });

      const data = await res.json();
      
      if (res.ok) {
        router.push(`/portal/evaluaciones/autoevaluacion/${data.id}`);
      } else if (data.evaluationId) {
        // Already exists, redirect to it
        router.push(`/portal/evaluaciones/autoevaluacion/${data.evaluationId}`);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Error al iniciar la evaluación');
    } finally {
      setLoading(false);
    }
  };

  const startLeaderEvaluation = async (employeeId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/portal/evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'leader', employee_id: employeeId }),
      });

      const data = await res.json();
      
      if (res.ok) {
        router.push(`/portal/evaluaciones/evaluar/${data.id}`);
      } else if (data.evaluationId) {
        router.push(`/portal/evaluaciones/evaluar/${data.evaluationId}`);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Error al iniciar la evaluación');
    } finally {
      setLoading(false);
    }
  };

  if (!activePeriod) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Evaluación de Desempeño</h1>
          <p className="mt-1 text-sm text-zinc-500">Sistema de evaluación de desempeño</p>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-8 text-center">
          <h2 className="text-lg font-semibold text-amber-900">No hay período de evaluación activo</h2>
          <p className="mt-2 text-sm text-amber-700">
            Actualmente no hay un período de evaluación abierto. Te notificaremos cuando comience el próximo ciclo.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Evaluación de Desempeño</h1>
        <p className="mt-1 text-sm text-zinc-500">{activePeriod.name}</p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">{error}</div>
      )}

      {/* Self Evaluation Section */}
      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-zinc-900">Mi Autoevaluación</h2>
        </div>
        <div className="p-6">
          {selfEvaluation ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-zinc-900">
                  Estado: {' '}
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    selfEvaluation.status === 'submitted'
                      ? 'bg-green-100 text-green-700'
                      : selfEvaluation.status === 'in_progress'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-zinc-100 text-zinc-600'
                  }`}>
                    {selfEvaluation.status === 'submitted' ? 'Completada' : selfEvaluation.status === 'in_progress' ? 'En progreso' : 'Sin comenzar'}
                  </span>
                </p>
                {selfEvaluation.total_score && (
                  <p className="text-sm text-zinc-500 mt-1">
                    Puntaje: {selfEvaluation.total_score.toFixed(1)}/10
                  </p>
                )}
              </div>
              {selfEvaluation.status !== 'submitted' ? (
                <Link
                  href={`/portal/evaluaciones/autoevaluacion/${selfEvaluation.id}`}
                  className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
                >
                  Continuar
                </Link>
              ) : (
                <Link
                  href={`/portal/evaluaciones/resultados`}
                  className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Ver resultados
                </Link>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-zinc-700">Aún no has comenzado tu autoevaluación</p>
                <p className="text-sm text-zinc-500 mt-1">
                  Evalúa tu propio desempeño durante el período {activePeriod.year}
                </p>
              </div>
              <button
                onClick={startSelfEvaluation}
                disabled={loading || !activePeriod.self_evaluation_enabled}
                className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
              >
                {loading ? 'Iniciando...' : 'Comenzar autoevaluación'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Leader Evaluation Section */}
      {isLeader && (
        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-zinc-900">Evaluar a mi equipo</h2>
          </div>
          <div className="p-6 space-y-4">
            {pendingTeamEvaluations.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-zinc-700 mb-3">Pendientes de evaluar</h3>
                <div className="space-y-2">
                  {pendingTeamEvaluations.map((member) => {
                    const selfEvalCompleted = member.selfEvaluationStatus === 'submitted';
                    const isDisabled = loading || !activePeriod.leader_evaluation_enabled || !selfEvalCompleted;
                    
                    return (
                      <div key={member.id} className="flex items-center justify-between rounded-lg border border-zinc-200 p-4">
                        <div>
                          <p className="font-medium text-zinc-900">{member.first_name} {member.last_name}</p>
                          <div className="flex items-center gap-2">
                            <p className="text-sm text-zinc-500">{member.job_title || 'Sin puesto'}</p>
                            {!selfEvalCompleted && (
                              <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                                Autoevaluación pendiente
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="relative group">
                          <button
                            onClick={() => startLeaderEvaluation(member.id)}
                            disabled={isDisabled}
                            className="rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Evaluar
                          </button>
                          {!selfEvalCompleted && (
                            <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block z-10">
                              <div className="rounded-lg bg-zinc-900 px-3 py-2 text-xs text-white whitespace-nowrap shadow-lg">
                                Autoevaluación pendiente
                                <div className="absolute top-full right-4 border-4 border-transparent border-t-zinc-900"></div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {leaderEvaluations.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-zinc-700 mb-3">Evaluaciones realizadas</h3>
                <div className="space-y-2">
                  {leaderEvaluations.map((eval_: any) => (
                    <div key={eval_.id} className="flex items-center justify-between rounded-lg border border-zinc-200 p-4">
                      <div>
                        <p className="font-medium text-zinc-900">
                          {eval_.employee?.first_name} {eval_.employee?.last_name}
                        </p>
                        <p className="text-sm text-zinc-500">{eval_.employee?.job_title || 'Sin puesto'}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          eval_.status === 'submitted'
                            ? 'bg-green-100 text-green-700'
                            : eval_.status === 'in_progress'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-zinc-100 text-zinc-600'
                        }`}>
                          {eval_.status === 'submitted' ? 'Completada' : eval_.status === 'in_progress' ? 'En progreso' : 'Borrador'}
                        </span>
                        {eval_.status !== 'submitted' && (
                          <Link
                            href={`/portal/evaluaciones/evaluar/${eval_.id}`}
                            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                          >
                            Continuar
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {pendingTeamEvaluations.length === 0 && leaderEvaluations.length === 0 && (
              <p className="text-sm text-zinc-500">No tienes colaboradores asignados para evaluar.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

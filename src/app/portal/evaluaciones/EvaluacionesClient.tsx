'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PageHeader } from '@pow/ui/components/ui/page-header';
import { Button, buttonVariants } from '@pow/ui/components/ui/button';
import { SelectMenu } from '@pow/ui/components/ui/select-menu';
import type { Employee } from '@/types/employee';
import type { EvaluationPeriod, Evaluation } from '@/types/evaluation';
import { SCALE_DEFINITIONS } from '@/types/evaluation';

// Avatar de miembro del equipo: foto o iniciales (como en Time Off).
function MemberAvatar({ name, photoUrl }: { name: string; photoUrl?: string | null }) {
  if (photoUrl) {
    return <img src={photoUrl} alt={name} className="h-9 w-9 shrink-0 rounded-full object-cover" />;
  }
  const initials = name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
      {initials}
    </div>
  );
}

type EvaluacionesClientProps = {
  employee: Employee;
  isLeader: boolean;
  activePeriod: EvaluationPeriod | null;
  periods: EvaluationPeriod[];
  selectedPeriodId: string | null;
  selfEvaluation: Evaluation | null;
  leaderEvaluations: any[];
  pendingTeamEvaluations: any[];
};

export function EvaluacionesClient({
  employee,
  isLeader,
  activePeriod,
  periods,
  selectedPeriodId,
  selfEvaluation,
  leaderEvaluations,
  pendingTeamEvaluations,
}: EvaluacionesClientProps) {
  const router = useRouter();

  const periodSelector =
    periods.length > 0 ? (
      <SelectMenu
        value={selectedPeriodId ?? ''}
        onChange={(v) => router.push(`/portal/evaluaciones?period_id=${v}`)}
        ariaLabel="Período"
        align="end"
        options={periods.map((p) => ({ value: p.id, label: String(p.year) }))}
      />
    ) : undefined;
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
        <PageHeader title="Evaluación de Desempeño" description="Sistema de evaluación de desempeño" actions={periodSelector} />

        <div className="rounded-xl border border-warning/30 bg-warning-subtle p-8 text-center">
          <h2 className="text-lg font-semibold text-[var(--amber-600)]">No hay período de evaluación activo</h2>
          <p className="mt-2 text-sm text-[var(--amber-600)]">
            Actualmente no hay un período de evaluación abierto. Te notificaremos cuando comience el próximo ciclo.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Evaluación de Desempeño" description={activePeriod.name} actions={periodSelector} />

      {error && (
        <div className="rounded-lg bg-danger-subtle p-4 text-sm text-[var(--red-600)]">{error}</div>
      )}

      {/* Self Evaluation Section */}
      <div className="rounded-xl border border-[var(--border)] bg-white shadow-sm">
        <div className="border-b border-[var(--border)] px-6 py-4">
          <h2 className="text-sm font-semibold text-secondary-foreground">Mi Autoevaluación</h2>
        </div>
        <div className="p-6">
          {selfEvaluation ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Estado: {' '}
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    selfEvaluation.status === 'submitted'
                      ? 'bg-success-subtle text-[var(--green-700)]'
                      : selfEvaluation.status === 'in_progress'
                      ? 'bg-warning-subtle text-[var(--amber-600)]'
                      : 'bg-secondary text-muted-foreground'
                  }`}>
                    {selfEvaluation.status === 'submitted' ? 'Completada' : selfEvaluation.status === 'in_progress' ? 'En progreso' : 'Sin comenzar'}
                  </span>
                </p>
                {selfEvaluation.total_score && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Puntaje: {selfEvaluation.total_score.toFixed(1)}/10
                  </p>
                )}
              </div>
              {selfEvaluation.status !== 'submitted' ? (
                <Link
                  href={`/portal/evaluaciones/autoevaluacion/${selfEvaluation.id}`}
                  className={buttonVariants({ variant: 'primary' })}
                >
                  Continuar
                </Link>
              ) : (
                <Link href={`/portal/evaluaciones/resultados`} className={buttonVariants({ variant: 'outline' })}>
                  Ver resultados
                </Link>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-secondary-foreground">Aún no has comenzado tu autoevaluación</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Evalúa tu propio desempeño durante el período {activePeriod.year}
                </p>
              </div>
              <Button
                onClick={startSelfEvaluation}
                loading={loading}
                disabled={!activePeriod.self_evaluation_enabled}
              >
                Comenzar autoevaluación
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Leader Evaluation Section */}
      {isLeader && (
        <div className="rounded-xl border border-[var(--border)] bg-white shadow-sm">
          <div className="border-b border-[var(--border)] px-6 py-4">
            <h2 className="text-sm font-semibold text-secondary-foreground">Evaluar a mi equipo</h2>
          </div>
          <div className="p-6 space-y-4">
            {pendingTeamEvaluations.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-secondary-foreground mb-3">Pendientes de evaluar</h3>
                <div className="space-y-2">
                  {pendingTeamEvaluations.map((member) => {
                    const selfEvalCompleted = member.selfEvaluationStatus === 'submitted';
                    const isDisabled = loading || !activePeriod.leader_evaluation_enabled || !selfEvalCompleted;
                    
                    return (
                      <div key={member.id} className="flex items-center justify-between rounded-lg border border-[var(--border)] p-4">
                        <div className="flex items-center gap-3">
                          <MemberAvatar name={`${member.first_name} ${member.last_name}`} photoUrl={member.photo_url} />
                          <div>
                            <p className="text-sm font-medium text-secondary-foreground">{member.first_name} {member.last_name}</p>
                            <div className="flex items-center gap-2">
                              <p className="text-sm text-muted-foreground">{member.job_title || 'Sin puesto'}</p>
                              {!selfEvalCompleted && (
                                <span className="inline-flex items-center rounded-full bg-warning-subtle px-2 py-0.5 text-xs font-medium text-[var(--amber-600)]">
                                  Autoevaluación pendiente
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="relative group">
                          <Button onClick={() => startLeaderEvaluation(member.id)} disabled={isDisabled}>
                            Evaluar
                          </Button>
                          {!selfEvalCompleted && (
                            <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block z-10">
                              <div className="rounded-lg bg-foreground px-3 py-2 text-xs text-white whitespace-nowrap shadow-lg">
                                Autoevaluación pendiente
                                <div className="absolute top-full right-4 border-4 border-transparent border-t-[var(--border)]"></div>
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
                <h3 className="text-sm font-medium text-secondary-foreground mb-3">Evaluaciones realizadas</h3>
                <div className="space-y-2">
                  {leaderEvaluations.map((eval_: any) => (
                    <div key={eval_.id} className="flex items-center justify-between rounded-lg border border-[var(--border)] p-4">
                      <div className="flex items-center gap-3">
                        <MemberAvatar name={`${eval_.employee?.first_name ?? ''} ${eval_.employee?.last_name ?? ''}`} photoUrl={eval_.employee?.photo_url} />
                        <div>
                          <p className="text-sm font-medium text-secondary-foreground">
                            {eval_.employee?.first_name} {eval_.employee?.last_name}
                          </p>
                          <p className="text-sm text-muted-foreground">{eval_.employee?.job_title || 'Sin puesto'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          eval_.status === 'submitted'
                            ? 'bg-success-subtle text-[var(--green-700)]'
                            : eval_.status === 'in_progress'
                            ? 'bg-warning-subtle text-[var(--amber-600)]'
                            : 'bg-secondary text-muted-foreground'
                        }`}>
                          {eval_.status === 'submitted' ? 'Completada' : eval_.status === 'in_progress' ? 'En progreso' : 'Borrador'}
                        </span>
                        {eval_.status !== 'submitted' && (
                          <Link
                            href={`/portal/evaluaciones/evaluar/${eval_.id}`}
                            className={buttonVariants({ variant: 'primary' })}
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
              <p className="text-sm text-muted-foreground">No tienes colaboradores asignados para evaluar.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

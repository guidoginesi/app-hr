'use client';

import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import { X, Loader2 } from 'lucide-react';
import { Button } from '@pow/ui/components/ui/button';
import { TabNav } from '@pow/ui/components/ui/tab-nav';
import { Sheet, SheetContent, SheetClose } from '@pow/ui/components/ui/sheet';
import {
  getSeniorityLabel, 
  getSeniorityCategory, 
  SENIORITY_CATEGORY_COLORS,
  SENIORITY_CATEGORY_LABELS,
  SeniorityCategory
} from '@/types/corporate-objectives';
import { PERIOD_TYPE_LABELS, STATUS_LABELS, STATUS_COLORS } from '@/types/objective';

type Employee = {
  id: string;
  first_name: string;
  last_name: string;
  job_title: string | null;
  photo_url: string | null;
  seniority_level: string | null;
  hire_date: string | null;
  personal_email: string;
  work_email: string | null;
  status: string;
  department: { id: string; name: string } | null;
  legal_entity: { id: string; name: string } | null;
  manager: { id: string; first_name: string; last_name: string } | null;
};

type Evaluation = {
  id: string;
  type: 'self' | 'leader';
  status: string;
  created_at: string;
  submitted_at: string | null;
  total_score: number | null;
  dimension_scores: Record<string, number> | null;
  period?: {
    id: string;
    name: string;
    year: number;
    status: string;
  } | null;
  evaluator?: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
};

type Objective = {
  id: string;
  year: number;
  period_type: string;
  title: string;
  description: string | null;
  weight: number;
  status: string;
  achievement: number | null;
  evaluated_at: string | null;
};

type Recategorization = {
  id: string;
  level_recategorization: 'approved' | 'not_approved' | null;
  position_recategorization: 'approved' | 'not_approved' | null;
  recommended_level: string | null;
  notes: string | null;
  hr_status: 'pending' | 'approved' | 'rejected' | null;
  evaluation?: {
    id: string;
    period?: { id: string; name: string; year: number } | null;
  };
};

type SeniorityHistoryItem = {
  id: string;
  previous_level: string | null;
  new_level: string;
  effective_date: string;
  notes: string | null;
};

type Props = {
  employee: Employee;
  evaluations: Evaluation[];
  objectives: Objective[];
  recategorizations: Recategorization[];
  seniorityHistory: SeniorityHistoryItem[];
};

type ResponseItem = {
  id: string;
  score: number;
  explanation: string | null;
  item_id: string;
  statement: string;
  dimension_id: string;
  dimension_name: string;
};

type OpenQuestion = {
  id: string;
  question_key: string;
  response: string;
};

type EvaluationResponses = {
  evaluation: { id: string; type: string; status: string; total_score: number | null };
  responses: ResponseItem[];
  openQuestions: OpenQuestion[];
};

const OPEN_QUESTION_LABELS: Record<string, string> = {
  highlights: 'Fortalezas destacadas',
  improvements: 'Áreas de mejora',
  goals: 'Objetivos propuestos',
  comments: 'Comentarios adicionales',
};

function ResponsesModal({
  evaluation,
  onClose,
}: {
  evaluation: Evaluation;
  onClose: () => void;
}) {
  const [data, setData] = useState<EvaluationResponses | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchResponses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/evaluations/${evaluation.id}/responses`);
      if (!res.ok) throw new Error('Error al cargar respuestas');
      setData(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [evaluation.id]);

  useEffect(() => {
    fetchResponses();
  }, [fetchResponses]);

  // Group responses by dimension
  const byDimension = data
    ? data.responses.reduce((acc, r) => {
        if (!acc[r.dimension_id]) acc[r.dimension_id] = { name: r.dimension_name, items: [] };
        acc[r.dimension_id].items.push(r);
        return acc;
      }, {} as Record<string, { name: string; items: ResponseItem[] }>)
    : {};

  const typeLabel = evaluation.type === 'self' ? 'Autoevaluación' : 'Evaluación de Líder';
  const typeBg = evaluation.type === 'self' ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground';

  return (
    <Sheet open onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" flush title="Respuestas de la evaluación" className="max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${typeBg}`}>
              {typeLabel}
            </span>
            {evaluation.total_score !== null && (
              <span className="text-base font-semibold text-foreground tabular-nums">
                {evaluation.total_score.toFixed(1)}/10
              </span>
            )}
          </div>
          <SheetClose
            aria-label="Cerrar"
            className="-mr-1.5 grid h-8 w-8 place-items-center rounded-[var(--radius)] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-5 w-5" />
          </SheetClose>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          {error && (
            <div className="py-12 text-center text-sm text-[var(--red-600)]">{error}</div>
          )}
          {!loading && !error && data && (
            <>
              {/* Scored responses grouped by dimension */}
              {Object.values(byDimension).map((dim) => (
                <div key={dim.name}>
                  <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{dim.name}</h4>
                  <div className="space-y-2">
                    {dim.items.map((item) => (
                      <div key={item.id} className="rounded-xl border border-[var(--border)] bg-muted p-4">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm text-secondary-foreground">{item.statement}</p>
                          <span className={`shrink-0 text-lg font-bold ${
                            item.score >= 7 ? 'text-[var(--green-700)]' :
                            item.score >= 5 ? 'text-[var(--amber-600)]' : 'text-[var(--red-600)]'
                          }`}>
                            {item.score}
                          </span>
                        </div>
                        {item.explanation && (
                          <p className="mt-2 text-xs text-muted-foreground italic">"{item.explanation}"</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Open questions */}
              {data.openQuestions.length > 0 && (
                <div>
                  <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Preguntas abiertas</h4>
                  <div className="space-y-2">
                    {data.openQuestions.map((q) => (
                      <div key={q.id} className="rounded-xl border border-[var(--border)] bg-muted p-4">
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          {OPEN_QUESTION_LABELS[q.question_key] || q.question_key}
                        </p>
                        <p className="text-sm text-secondary-foreground whitespace-pre-wrap">{q.response}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {data.responses.length === 0 && data.openQuestions.length === 0 && (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  No hay respuestas registradas para esta evaluación
                </div>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function EmployeeEvaluationsClient({ 
  employee, 
  evaluations, 
  objectives,
  recategorizations,
  seniorityHistory 
}: Props) {
  const [activeTab, setActiveTab] = useState<'evaluations' | 'objectives' | 'recategorizations' | 'history'>('evaluations');
  const [selectedEvaluation, setSelectedEvaluation] = useState<Evaluation | null>(null);

  const seniorityCategory = employee.seniority_level 
    ? getSeniorityCategory(employee.seniority_level) 
    : null;

  // Group evaluations by period
  const evaluationsByPeriod = evaluations.reduce((acc, ev) => {
    const periodKey = ev.period?.id || 'sin-periodo';
    if (!acc[periodKey]) {
      acc[periodKey] = {
        period: ev.period,
        evaluations: []
      };
    }
    acc[periodKey].evaluations.push(ev);
    return acc;
  }, {} as Record<string, { period: Evaluation['period']; evaluations: Evaluation[] }>);

  // Group objectives by year
  const objectivesByYear = objectives.reduce((acc, obj) => {
    if (!acc[obj.year]) {
      acc[obj.year] = [];
    }
    acc[obj.year].push(obj);
    return acc;
  }, {} as Record<number, Objective[]>);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'submitted':
        return <span className="inline-flex items-center rounded-full bg-success-subtle px-2.5 py-0.5 text-xs font-medium text-[var(--green-700)]">Completada</span>;
      case 'in_progress':
        return <span className="inline-flex items-center rounded-full bg-warning-subtle px-2.5 py-0.5 text-xs font-medium text-[var(--amber-600)]">En progreso</span>;
      default:
        return <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-muted-foreground">Borrador</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with back button */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin/evaluations/all"
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border)] bg-white hover:bg-muted"
        >
          <svg className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {employee.first_name} {employee.last_name}
          </h1>
          <p className="text-sm text-muted-foreground">Historial completo de evaluaciones y objetivos</p>
        </div>
      </div>

      {/* Employee Card */}
      <div className="rounded-xl border border-[var(--border)] bg-white p-6">
        <div className="flex items-start gap-6">
          {/* Avatar */}
          {employee.photo_url ? (
            <img
              src={employee.photo_url}
              alt={`${employee.first_name} ${employee.last_name}`}
              className="h-20 w-20 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
              <span className="text-2xl font-semibold text-muted-foreground">
                {employee.first_name.charAt(0)}{employee.last_name.charAt(0)}
              </span>
            </div>
          )}

          {/* Info */}
          <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Puesto</p>
              <p className="text-sm font-medium text-foreground">{employee.job_title || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Departamento</p>
              <p className="text-sm font-medium text-foreground">{employee.department?.name || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Manager</p>
              <p className="text-sm font-medium text-foreground">
                {employee.manager?.first_name && employee.manager?.last_name 
                  ? `${employee.manager.first_name} ${employee.manager.last_name}` 
                  : '-'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Nivel de Seniority</p>
              {employee.seniority_level && seniorityCategory ? (
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${SENIORITY_CATEGORY_COLORS[seniorityCategory]}`}>
                  {getSeniorityLabel(employee.seniority_level)}
                </span>
              ) : (
                <p className="text-sm font-medium text-foreground">-</p>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Fecha de ingreso</p>
              <p className="text-sm font-medium text-foreground">
                {employee.hire_date ? new Date(employee.hire_date).toLocaleDateString('es-AR') : '-'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="text-sm font-medium text-foreground">{employee.work_email || employee.personal_email}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Estado</p>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                employee.status === 'active' ? 'bg-success-subtle text-[var(--green-700)]' : 'bg-secondary text-muted-foreground'
              }`}>
                {employee.status === 'active' ? 'Activo' : employee.status}
              </span>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Sociedad</p>
              <p className="text-sm font-medium text-foreground">{employee.legal_entity?.name || '-'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <TabNav
        value={activeTab}
        onChange={(v) => setActiveTab(v as typeof activeTab)}
        options={[
          { id: 'evaluations', label: 'Evaluaciones', count: evaluations.length },
          { id: 'objectives', label: 'Objetivos', count: objectives.length },
          { id: 'recategorizations', label: 'Recategorizaciones', count: recategorizations.length },
          { id: 'history', label: 'Historial Seniority', count: seniorityHistory.length },
        ].map((tab) => ({
          value: tab.id,
          label: tab.count > 0 ? `${tab.label} (${tab.count})` : tab.label,
        }))}
        aria-label="Secciones del empleado"
      />

      {/* Tab Content */}
      {activeTab === 'evaluations' && (
        <div className="space-y-6">
          {Object.values(evaluationsByPeriod).length === 0 ? (
            <div className="rounded-xl border border-[var(--border)] bg-white p-12 text-center">
              <p className="text-sm text-muted-foreground">No hay evaluaciones registradas</p>
            </div>
          ) : (
            Object.values(evaluationsByPeriod).map(({ period, evaluations: periodEvals }) => (
              <div key={period?.id || 'sin-periodo'} className="rounded-xl border border-[var(--border)] bg-white">
                <div className="border-b border-[var(--border)] px-6 py-4">
                  <h3 className="text-base font-semibold text-foreground">
                    {period?.name || 'Sin período'} {period?.year && `(${period.year})`}
                  </h3>
                </div>
                <div className="divide-y divide-[var(--border)]">
                  {periodEvals.map((evaluation) => (
                    <div key={evaluation.id} className="flex items-center justify-between px-6 py-4">
                      <div className="flex items-center gap-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          evaluation.type === 'self'
                            ? 'bg-accent text-accent-foreground'
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {evaluation.type === 'self' ? 'Autoevaluación' : 'Evaluación de Líder'}
                        </span>
                        {evaluation.type === 'leader' && evaluation.evaluator && (
                          <span className="text-sm text-muted-foreground">
                            por {evaluation.evaluator.first_name} {evaluation.evaluator.last_name}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        {evaluation.total_score !== null && (
                          <span className="text-lg font-semibold text-foreground">
                            {evaluation.total_score.toFixed(1)}/10
                          </span>
                        )}
                        {getStatusBadge(evaluation.status)}
                        <span className="text-xs text-muted-foreground">
                          {new Date(evaluation.created_at).toLocaleDateString('es-AR')}
                        </span>
                        {evaluation.status === 'submitted' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedEvaluation(evaluation)}
                          >
                            Ver respuestas
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'objectives' && (
        <div className="space-y-6">
          {Object.keys(objectivesByYear).length === 0 ? (
            <div className="rounded-xl border border-[var(--border)] bg-white p-12 text-center">
              <p className="text-sm text-muted-foreground">No hay objetivos registrados</p>
            </div>
          ) : (
            Object.entries(objectivesByYear)
              .sort(([a], [b]) => Number(b) - Number(a))
              .map(([year, yearObjectives]) => (
                <div key={year} className="rounded-xl border border-[var(--border)] bg-white">
                  <div className="border-b border-[var(--border)] px-6 py-4">
                    <h3 className="text-base font-semibold text-foreground">Objetivos {year}</h3>
                  </div>
                  <div className="divide-y divide-[var(--border)]">
                    {yearObjectives.map((objective) => (
                      <div key={objective.id} className="px-6 py-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
                                {PERIOD_TYPE_LABELS[objective.period_type as keyof typeof PERIOD_TYPE_LABELS] || objective.period_type}
                              </span>
                              <span className="text-xs text-muted-foreground">Peso: {objective.weight}%</span>
                            </div>
                            <p className="text-sm font-medium text-foreground">{objective.title}</p>
                            {objective.description && (
                              <p className="mt-1 text-sm text-muted-foreground">{objective.description}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              STATUS_COLORS[objective.status as keyof typeof STATUS_COLORS] || 'bg-secondary text-muted-foreground'
                            }`}>
                              {STATUS_LABELS[objective.status as keyof typeof STATUS_LABELS] || objective.status}
                            </span>
                            {objective.achievement !== null && (
                              <p className="mt-1 text-lg font-semibold text-foreground">
                                {objective.achievement}%
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
          )}
        </div>
      )}

      {activeTab === 'recategorizations' && (
        <div className="space-y-4">
          {recategorizations.length === 0 ? (
            <div className="rounded-xl border border-[var(--border)] bg-white p-12 text-center">
              <p className="text-sm text-muted-foreground">No hay recategorizaciones registradas</p>
            </div>
          ) : (
            recategorizations.map((recat) => (
              <div key={recat.id} className="rounded-xl border border-[var(--border)] bg-white p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {recat.evaluation?.period?.name} ({recat.evaluation?.period?.year})
                    </p>
                    <div className="flex gap-2">
                      {recat.level_recategorization === 'approved' && (
                        <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                          Dentro del nivel
                        </span>
                      )}
                      {recat.position_recategorization === 'approved' && (
                        <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                          Ascenso de nivel
                        </span>
                      )}
                    </div>
                    {recat.recommended_level && (
                      <p className="mt-2 text-sm text-secondary-foreground">
                        Nivel recomendado: <span className="font-medium">{getSeniorityLabel(recat.recommended_level)}</span>
                      </p>
                    )}
                    {recat.notes && (
                      <p className="mt-2 text-sm text-muted-foreground">{recat.notes}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      recat.hr_status === 'approved'
                        ? 'bg-success-subtle text-[var(--green-700)]'
                        : recat.hr_status === 'rejected'
                        ? 'bg-danger-subtle text-[var(--red-600)]'
                        : 'bg-warning-subtle text-[var(--amber-600)]'
                    }`}>
                      {recat.hr_status === 'approved' ? 'Aprobado HR' : recat.hr_status === 'rejected' ? 'Rechazado HR' : 'Pendiente HR'}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-4">
          {seniorityHistory.length === 0 ? (
            <div className="rounded-xl border border-[var(--border)] bg-white p-12 text-center">
              <p className="text-sm text-muted-foreground">No hay historial de cambios de seniority</p>
            </div>
          ) : (
            <div className="rounded-xl border border-[var(--border)] bg-white">
              <div className="divide-y divide-[var(--border)]">
                {seniorityHistory.map((item, index) => (
                  <div key={item.id} className="flex items-center gap-4 px-6 py-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                      <svg className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {item.previous_level && (
                          <>
                            <span className="text-sm text-muted-foreground">{getSeniorityLabel(item.previous_level)}</span>
                            <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </>
                        )}
                        <span className="text-sm font-medium text-foreground">{getSeniorityLabel(item.new_level)}</span>
                      </div>
                      {item.notes && (
                        <p className="mt-1 text-sm text-muted-foreground">{item.notes}</p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(item.effective_date).toLocaleDateString('es-AR')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {selectedEvaluation && (
        <ResponsesModal
          evaluation={selectedEvaluation}
          onClose={() => setSelectedEvaluation(null)}
        />
      )}
    </div>
  );
}

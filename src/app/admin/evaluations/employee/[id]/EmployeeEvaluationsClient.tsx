'use client';

import Link from 'next/link';
import { useState } from 'react';
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

export function EmployeeEvaluationsClient({ 
  employee, 
  evaluations, 
  objectives,
  recategorizations,
  seniorityHistory 
}: Props) {
  const [activeTab, setActiveTab] = useState<'evaluations' | 'objectives' | 'recategorizations' | 'history'>('evaluations');

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
        return <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">Completada</span>;
      case 'in_progress':
        return <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">En progreso</span>;
      default:
        return <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600">Borrador</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with back button */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin/evaluations/all"
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50"
        >
          <svg className="h-5 w-5 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            {employee.first_name} {employee.last_name}
          </h1>
          <p className="text-sm text-zinc-500">Historial completo de evaluaciones y objetivos</p>
        </div>
      </div>

      {/* Employee Card */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6">
        <div className="flex items-start gap-6">
          {/* Avatar */}
          {employee.photo_url ? (
            <img
              src={employee.photo_url}
              alt={`${employee.first_name} ${employee.last_name}`}
              className="h-20 w-20 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-purple-100">
              <span className="text-2xl font-semibold text-purple-700">
                {employee.first_name.charAt(0)}{employee.last_name.charAt(0)}
              </span>
            </div>
          )}

          {/* Info */}
          <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-zinc-500">Puesto</p>
              <p className="text-sm font-medium text-zinc-900">{employee.job_title || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Departamento</p>
              <p className="text-sm font-medium text-zinc-900">{employee.department?.name || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Manager</p>
              <p className="text-sm font-medium text-zinc-900">
                {employee.manager ? `${employee.manager.first_name} ${employee.manager.last_name}` : '-'}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Nivel de Seniority</p>
              {employee.seniority_level && seniorityCategory ? (
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${SENIORITY_CATEGORY_COLORS[seniorityCategory]}`}>
                  {getSeniorityLabel(employee.seniority_level)}
                </span>
              ) : (
                <p className="text-sm font-medium text-zinc-900">-</p>
              )}
            </div>
            <div>
              <p className="text-xs text-zinc-500">Fecha de ingreso</p>
              <p className="text-sm font-medium text-zinc-900">
                {employee.hire_date ? new Date(employee.hire_date).toLocaleDateString('es-AR') : '-'}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Email</p>
              <p className="text-sm font-medium text-zinc-900">{employee.work_email || employee.personal_email}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Estado</p>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                employee.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-600'
              }`}>
                {employee.status === 'active' ? 'Activo' : employee.status}
              </span>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Sociedad</p>
              <p className="text-sm font-medium text-zinc-900">{employee.legal_entity?.name || '-'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-zinc-200">
        <nav className="flex gap-6">
          {[
            { id: 'evaluations', label: 'Evaluaciones', count: evaluations.length },
            { id: 'objectives', label: 'Objetivos', count: objectives.length },
            { id: 'recategorizations', label: 'Recategorizaciones', count: recategorizations.length },
            { id: 'history', label: 'Historial Seniority', count: seniorityHistory.length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`relative pb-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-purple-600'
                  : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs">
                  {tab.count}
                </span>
              )}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600" />
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'evaluations' && (
        <div className="space-y-6">
          {Object.values(evaluationsByPeriod).length === 0 ? (
            <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center">
              <p className="text-sm text-zinc-500">No hay evaluaciones registradas</p>
            </div>
          ) : (
            Object.values(evaluationsByPeriod).map(({ period, evaluations: periodEvals }) => (
              <div key={period?.id || 'sin-periodo'} className="rounded-xl border border-zinc-200 bg-white">
                <div className="border-b border-zinc-200 px-6 py-4">
                  <h3 className="font-semibold text-zinc-900">
                    {period?.name || 'Sin período'} {period?.year && `(${period.year})`}
                  </h3>
                </div>
                <div className="divide-y divide-zinc-100">
                  {periodEvals.map((evaluation) => (
                    <div key={evaluation.id} className="flex items-center justify-between px-6 py-4">
                      <div className="flex items-center gap-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          evaluation.type === 'self'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-purple-100 text-purple-700'
                        }`}>
                          {evaluation.type === 'self' ? 'Autoevaluación' : 'Evaluación de Líder'}
                        </span>
                        {evaluation.type === 'leader' && evaluation.evaluator && (
                          <span className="text-sm text-zinc-500">
                            por {evaluation.evaluator.first_name} {evaluation.evaluator.last_name}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        {evaluation.total_score !== null && (
                          <span className="text-lg font-semibold text-zinc-900">
                            {evaluation.total_score.toFixed(1)}/10
                          </span>
                        )}
                        {getStatusBadge(evaluation.status)}
                        <span className="text-xs text-zinc-400">
                          {new Date(evaluation.created_at).toLocaleDateString('es-AR')}
                        </span>
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
            <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center">
              <p className="text-sm text-zinc-500">No hay objetivos registrados</p>
            </div>
          ) : (
            Object.entries(objectivesByYear)
              .sort(([a], [b]) => Number(b) - Number(a))
              .map(([year, yearObjectives]) => (
                <div key={year} className="rounded-xl border border-zinc-200 bg-white">
                  <div className="border-b border-zinc-200 px-6 py-4">
                    <h3 className="font-semibold text-zinc-900">Objetivos {year}</h3>
                  </div>
                  <div className="divide-y divide-zinc-100">
                    {yearObjectives.map((objective) => (
                      <div key={objective.id} className="px-6 py-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                                {PERIOD_TYPE_LABELS[objective.period_type as keyof typeof PERIOD_TYPE_LABELS] || objective.period_type}
                              </span>
                              <span className="text-xs text-zinc-400">Peso: {objective.weight}%</span>
                            </div>
                            <p className="font-medium text-zinc-900">{objective.title}</p>
                            {objective.description && (
                              <p className="mt-1 text-sm text-zinc-500">{objective.description}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              STATUS_COLORS[objective.status as keyof typeof STATUS_COLORS] || 'bg-zinc-100 text-zinc-600'
                            }`}>
                              {STATUS_LABELS[objective.status as keyof typeof STATUS_LABELS] || objective.status}
                            </span>
                            {objective.achievement !== null && (
                              <p className="mt-1 text-lg font-semibold text-zinc-900">
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
            <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center">
              <p className="text-sm text-zinc-500">No hay recategorizaciones registradas</p>
            </div>
          ) : (
            recategorizations.map((recat) => (
              <div key={recat.id} className="rounded-xl border border-zinc-200 bg-white p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-zinc-500 mb-2">
                      {recat.evaluation?.period?.name} ({recat.evaluation?.period?.year})
                    </p>
                    <div className="flex gap-2">
                      {recat.level_recategorization === 'approved' && (
                        <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700">
                          Dentro del nivel
                        </span>
                      )}
                      {recat.position_recategorization === 'approved' && (
                        <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700">
                          Ascenso de nivel
                        </span>
                      )}
                    </div>
                    {recat.recommended_level && (
                      <p className="mt-2 text-sm text-zinc-700">
                        Nivel recomendado: <span className="font-medium">{getSeniorityLabel(recat.recommended_level)}</span>
                      </p>
                    )}
                    {recat.notes && (
                      <p className="mt-2 text-sm text-zinc-500">{recat.notes}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      recat.hr_status === 'approved'
                        ? 'bg-emerald-100 text-emerald-700'
                        : recat.hr_status === 'rejected'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-700'
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
            <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center">
              <p className="text-sm text-zinc-500">No hay historial de cambios de seniority</p>
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-200 bg-white">
              <div className="divide-y divide-zinc-100">
                {seniorityHistory.map((item, index) => (
                  <div key={item.id} className="flex items-center gap-4 px-6 py-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100">
                      <svg className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {item.previous_level && (
                          <>
                            <span className="text-sm text-zinc-500">{getSeniorityLabel(item.previous_level)}</span>
                            <svg className="h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </>
                        )}
                        <span className="font-medium text-zinc-900">{getSeniorityLabel(item.new_level)}</span>
                      </div>
                      {item.notes && (
                        <p className="mt-1 text-sm text-zinc-500">{item.notes}</p>
                      )}
                    </div>
                    <span className="text-xs text-zinc-400">
                      {new Date(item.effective_date).toLocaleDateString('es-AR')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

'use client';

import Link from 'next/link';
import { CorporateObjective, ObjectiveWeightDistribution, getSeniorityLabel, getSeniorityCategory, SENIORITY_CATEGORY_COLORS, SENIORITY_CATEGORY_LABELS, SeniorityCategory, Quarter, QUARTER_LABELS } from '@/types/corporate-objectives';
import { Objective, STATUS_LABELS, STATUS_COLORS, PERIOD_TYPE_LABELS } from '@/types/objective';

type Employee = {
  id: string;
  first_name: string;
  last_name: string;
  seniority_level: number | null;
  job_title: string | null;
  department_name: string | null;
  manager_name: string | null;
};

type EmployeeObjectivesDetailClientProps = {
  employee: Employee;
  corporateObjectives: CorporateObjective[];
  areaObjectives: Objective[];
  weights: ObjectiveWeightDistribution;
  seniorityLevel: string | null;
  seniorityCategory: SeniorityCategory;
  currentYear: number;
};

const QUARTERS: Quarter[] = ['q1', 'q2', 'q3', 'q4'];

export function EmployeeObjectivesDetailClient({
  employee,
  corporateObjectives,
  areaObjectives,
  weights,
  seniorityLevel,
  seniorityCategory,
  currentYear,
}: EmployeeObjectivesDetailClientProps) {
  const billingObjective = corporateObjectives.find(o => o.objective_type === 'billing');
  const npsObjectives = QUARTERS.map(q => corporateObjectives.find(o => o.objective_type === 'nps' && o.quarter === q));
  const area1 = areaObjectives.find(o => o.objective_number === 1) || areaObjectives[0];
  const area2 = areaObjectives.find(o => o.objective_number === 2) || areaObjectives[1];

  // Calculate billing progress
  const billingProgress = billingObjective && billingObjective.actual_value && billingObjective.target_value
    ? Math.min((billingObjective.actual_value / billingObjective.target_value) * 100, billingObjective.cap_percentage || 150)
    : null;

  // Check if billing gate is met
  const billingGateMet = billingObjective && billingObjective.actual_value && billingObjective.target_value
    ? (billingObjective.actual_value / billingObjective.target_value) * 100 >= (billingObjective.gate_percentage || 90)
    : false;

  // Calculate NPS progress (average of configured quarters)
  const npsProgressValues = npsObjectives
    .filter((obj): obj is CorporateObjective => obj !== undefined && obj.actual_value !== null && obj.target_value !== null)
    .map(obj => Math.min((obj.actual_value! / obj.target_value!) * 100, 100));
  
  const npsProgress = npsProgressValues.length > 0
    ? npsProgressValues.reduce((sum, p) => sum + p, 0) / npsProgressValues.length
    : null;

  const npsConfiguredCount = npsObjectives.filter(o => o !== undefined).length;

  // Calculate weighted total progress
  let totalWeightedProgress: number | null = null;
  let weightedSum = 0;
  let totalWeight = 0;

  if (billingProgress !== null) {
    weightedSum += billingProgress * weights.billing;
    totalWeight += weights.billing;
  }
  if (npsProgress !== null) {
    weightedSum += npsProgress * weights.nps;
    totalWeight += weights.nps;
  }
  if (area1?.progress_percentage !== null && area1?.progress_percentage !== undefined) {
    weightedSum += area1.progress_percentage * weights.area1;
    totalWeight += weights.area1;
  }
  if (area2?.progress_percentage !== null && area2?.progress_percentage !== undefined) {
    weightedSum += area2.progress_percentage * weights.area2;
    totalWeight += weights.area2;
  }

  if (totalWeight > 0) {
    totalWeightedProgress = Math.round(weightedSum / totalWeight);
  }

  return (
    <div className="space-y-6">
      {/* Back link and header */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin/objectives"
          className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Volver al dashboard
        </Link>
      </div>

      {/* Employee Info Card */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-100 text-xl font-semibold text-rose-600">
              {employee.first_name[0]}{employee.last_name[0]}
            </div>
            <div>
              <h1 className="text-xl font-semibold text-zinc-900">
                {employee.first_name} {employee.last_name}
              </h1>
              <p className="text-sm text-zinc-500">{employee.job_title || 'Sin cargo definido'}</p>
              <div className="mt-1 flex items-center gap-3 text-sm text-zinc-500">
                {employee.department_name && (
                  <span>{employee.department_name}</span>
                )}
                {employee.manager_name && (
                  <>
                    <span className="text-zinc-300">•</span>
                    <span>Líder: {employee.manager_name}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Seniority and Weights */}
          <div className="text-right">
            {seniorityLevel ? (
              (() => {
                const colors = SENIORITY_CATEGORY_COLORS[seniorityCategory];
                return (
                  <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${colors.bg} ${colors.text}`}>
                    {getSeniorityLabel(seniorityLevel)}
                  </span>
                );
              })()
            ) : (
              <span className="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium bg-zinc-100 text-zinc-500">
                Sin nivel definido
              </span>
            )}
            <div className="mt-2 text-xs text-zinc-500">
              <p>Corp: {weights.billing + weights.nps}% | Área: {weights.area1 + weights.area2}%</p>
            </div>
          </div>
        </div>

        {/* Progress Summary */}
        <div className="mt-6 grid gap-4 border-t border-zinc-100 pt-6 sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Progreso Total</p>
            <div className="mt-1 flex items-center gap-2">
              {totalWeightedProgress !== null ? (
                <>
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-zinc-200">
                    <div 
                      className={`h-full rounded-full ${
                        totalWeightedProgress >= 100 ? 'bg-emerald-500' :
                        totalWeightedProgress >= 75 ? 'bg-blue-500' :
                        totalWeightedProgress >= 50 ? 'bg-amber-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.min(totalWeightedProgress, 100)}%` }}
                    />
                  </div>
                  <span className="text-lg font-bold text-zinc-900">{totalWeightedProgress}%</span>
                </>
              ) : (
                <span className="text-sm text-zinc-400">Sin datos suficientes</span>
              )}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Gate de Facturación</p>
            <div className="mt-1">
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-sm font-medium ${
                billingGateMet 
                  ? 'bg-emerald-100 text-emerald-700' 
                  : 'bg-red-100 text-red-600'
              }`}>
                {billingGateMet ? (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Cumplido
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    No cumplido
                  </>
                )}
              </span>
              <p className="mt-1 text-xs text-zinc-500">
                Mínimo {billingObjective?.gate_percentage || 90}% para habilitar bonus
              </p>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Estado Objetivos</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-sm font-medium ${
                billingObjective ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-500'
              }`}>
                FC: {billingObjective ? '1/1' : '0/1'}
              </span>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-sm font-medium ${
                npsConfiguredCount === 4 ? 'bg-blue-100 text-blue-700' : 
                npsConfiguredCount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-zinc-100 text-zinc-500'
              }`}>
                NPS: {npsConfiguredCount}/4
              </span>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-sm font-medium ${
                areaObjectives.length >= 2 
                  ? 'bg-emerald-100 text-emerald-700' 
                  : areaObjectives.length > 0
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-red-100 text-red-600'
              }`}>
                Área: {Math.min(areaObjectives.length, 2)}/2
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Objectives Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Billing Objective */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
                <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-zinc-900">Facturación</h3>
                <p className="text-xs text-zinc-500">Peso: {weights.billing}%</p>
              </div>
            </div>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
              Corporativo
            </span>
          </div>

          {billingObjective ? (
            <div className="space-y-3">
              <p className="text-sm font-medium text-zinc-900">{billingObjective.title}</p>
              {billingObjective.description && (
                <p className="text-sm text-zinc-500">{billingObjective.description}</p>
              )}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-zinc-500">Meta</p>
                  <p className="font-medium text-zinc-900">
                    ${billingObjective.target_value?.toLocaleString('es-AR') || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-zinc-500">Actual</p>
                  <p className="font-medium text-zinc-900">
                    ${billingObjective.actual_value?.toLocaleString('es-AR') || '-'}
                  </p>
                </div>
              </div>
              {billingProgress !== null && (
                <div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-500">Progreso</span>
                    <span className="font-medium text-zinc-900">{Math.round(billingProgress)}%</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-200">
                    <div 
                      className={`h-full rounded-full ${
                        billingProgress >= 100 ? 'bg-emerald-500' :
                        billingProgress >= 90 ? 'bg-blue-500' : 'bg-amber-500'
                      }`}
                      style={{ width: `${Math.min(billingProgress, 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-zinc-400 italic">No configurado para {currentYear}</p>
          )}
        </div>

        {/* NPS Objective (Quarterly) */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-zinc-900">NPS (Trimestral)</h3>
                <p className="text-xs text-zinc-500">Peso total: {weights.nps}%</p>
              </div>
            </div>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              npsConfiguredCount === 4 ? 'bg-blue-100 text-blue-700' :
              npsConfiguredCount > 0 ? 'bg-amber-100 text-amber-700' :
              'bg-zinc-100 text-zinc-500'
            }`}>
              {npsConfiguredCount}/4 trimestres
            </span>
          </div>

          {npsConfiguredCount > 0 ? (
            <div className="space-y-3">
              {/* Progress summary */}
              {npsProgress !== null && (
                <div className="rounded-lg bg-blue-50 p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-blue-700">Progreso promedio</span>
                    <span className="font-bold text-blue-900">{Math.round(npsProgress)}%</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-blue-200">
                    <div 
                      className={`h-full rounded-full ${
                        npsProgress >= 100 ? 'bg-emerald-500' :
                        npsProgress >= 75 ? 'bg-blue-500' : 'bg-amber-500'
                      }`}
                      style={{ width: `${Math.min(npsProgress, 100)}%` }}
                    />
                  </div>
                </div>
              )}
              
              {/* Quarterly breakdown */}
              <div className="grid grid-cols-2 gap-2">
                {QUARTERS.map((q, idx) => {
                  const npsObj = npsObjectives[idx];
                  const quarterProgress = npsObj && npsObj.actual_value !== null && npsObj.target_value
                    ? Math.min((npsObj.actual_value / npsObj.target_value) * 100, 100)
                    : null;
                    
                  return (
                    <div key={q} className={`rounded-lg border p-2 ${npsObj ? 'border-blue-200 bg-blue-50/50' : 'border-zinc-200 bg-zinc-50'}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-zinc-600">{QUARTER_LABELS[q]}</span>
                        {npsObj && quarterProgress !== null && (
                          <span className={`text-xs font-bold ${
                            quarterProgress >= 100 ? 'text-emerald-600' :
                            quarterProgress >= 75 ? 'text-blue-600' : 'text-amber-600'
                          }`}>
                            {Math.round(quarterProgress)}%
                          </span>
                        )}
                      </div>
                      {npsObj ? (
                        <div className="mt-1 text-xs text-zinc-500">
                          <span>Meta: {npsObj.target_value}</span>
                          {npsObj.actual_value !== null && (
                            <span className="ml-2">Actual: {npsObj.actual_value}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-zinc-400">Sin configurar</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-sm text-zinc-400 italic">No hay NPS configurado para {currentYear}</p>
          )}
        </div>

        {/* Area Objective 1 */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                <svg className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-zinc-900">Objetivo de Área 1</h3>
                <p className="text-xs text-zinc-500">Peso: {weights.area1}%</p>
              </div>
            </div>
            <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
              Área/Rol
            </span>
          </div>

          {area1 ? (
            <div className="space-y-3">
              <p className="text-sm font-medium text-zinc-900">{area1.title}</p>
              {area1.description && (
                <p className="text-sm text-zinc-500">{area1.description}</p>
              )}
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[area1.status].bg} ${STATUS_COLORS[area1.status].text}`}>
                  {STATUS_LABELS[area1.status]}
                </span>
                {area1.period_type && (
                  <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                    {PERIOD_TYPE_LABELS[area1.period_type]}
                  </span>
                )}
                {area1.is_professional_development && (
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                    Desarrollo profesional
                  </span>
                )}
              </div>
              <div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-500">Progreso</span>
                  <span className="font-medium text-zinc-900">{area1.progress_percentage}%</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-200">
                  <div 
                    className={`h-full rounded-full ${
                      area1.progress_percentage >= 100 ? 'bg-emerald-500' :
                      area1.progress_percentage >= 75 ? 'bg-blue-500' :
                      area1.progress_percentage >= 50 ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(area1.progress_percentage, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-zinc-400 italic">No cargado por el líder</p>
          )}
        </div>

        {/* Area Objective 2 */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-zinc-900">Objetivo de Área 2</h3>
                <p className="text-xs text-zinc-500">Peso: {weights.area2}%</p>
              </div>
            </div>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
              Área/Rol
            </span>
          </div>

          {area2 ? (
            <div className="space-y-3">
              <p className="text-sm font-medium text-zinc-900">{area2.title}</p>
              {area2.description && (
                <p className="text-sm text-zinc-500">{area2.description}</p>
              )}
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[area2.status].bg} ${STATUS_COLORS[area2.status].text}`}>
                  {STATUS_LABELS[area2.status]}
                </span>
                {area2.period_type && (
                  <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                    {PERIOD_TYPE_LABELS[area2.period_type]}
                  </span>
                )}
                {area2.is_professional_development && (
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                    Desarrollo profesional
                  </span>
                )}
              </div>
              <div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-500">Progreso</span>
                  <span className="font-medium text-zinc-900">{area2.progress_percentage}%</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-200">
                  <div 
                    className={`h-full rounded-full ${
                      area2.progress_percentage >= 100 ? 'bg-emerald-500' :
                      area2.progress_percentage >= 75 ? 'bg-blue-500' :
                      area2.progress_percentage >= 50 ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(area2.progress_percentage, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-zinc-400 italic">No cargado por el líder</p>
          )}
        </div>
      </div>

      {/* Weight Distribution Info */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-900 mb-4">Distribución de Pesos - {seniorityLevel ? getSeniorityLabel(seniorityLevel) : SENIORITY_CATEGORY_LABELS[seniorityCategory]}</h3>
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-emerald-600">{weights.billing}%</div>
            <div className="text-sm text-zinc-500">Facturación</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{weights.nps}%</div>
            <div className="text-sm text-zinc-500">NPS</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{weights.area1}%</div>
            <div className="text-sm text-zinc-500">Área 1</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-amber-600">{weights.area2}%</div>
            <div className="text-sm text-zinc-500">Área 2</div>
          </div>
        </div>
        <div className="mt-4 h-4 overflow-hidden rounded-full bg-zinc-200">
          <div className="flex h-full">
            <div className="bg-emerald-500" style={{ width: `${weights.billing}%` }} />
            <div className="bg-blue-500" style={{ width: `${weights.nps}%` }} />
            <div className="bg-purple-500" style={{ width: `${weights.area1}%` }} />
            <div className="bg-amber-500" style={{ width: `${weights.area2}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

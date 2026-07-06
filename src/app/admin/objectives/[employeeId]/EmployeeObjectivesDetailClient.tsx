'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { CorporateObjective, ObjectiveWeightDistribution, getSeniorityLabel, getSeniorityCategory, SENIORITY_CATEGORY_COLORS, SENIORITY_CATEGORY_LABELS, SeniorityCategory, Quarter, QUARTER_LABELS } from '@/types/corporate-objectives';
import { Objective, STATUS_LABELS, STATUS_COLORS, PERIOD_TYPE_LABELS } from '@/types/objective';
import { BarList } from '@pow/ui/components/ui/bar-list';

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
          className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Volver al dashboard
        </Link>
      </div>

      {/* Employee Info Card */}
      <div className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-xl font-semibold text-secondary-foreground">
              {employee.first_name[0]}{employee.last_name[0]}
            </div>
            <div>
              <h1 className="text-base font-semibold text-foreground">
                {employee.first_name} {employee.last_name}
              </h1>
              <p className="text-xs text-muted-foreground">{employee.job_title || 'Sin cargo definido'}</p>
              <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                {employee.department_name && (
                  <span>{employee.department_name}</span>
                )}
                {employee.manager_name && (
                  <>
                    <span className="text-muted-foreground">•</span>
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
              <span className="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium bg-secondary text-muted-foreground">
                Sin nivel definido
              </span>
            )}
            <div className="mt-2 text-xs text-muted-foreground">
              <p>Corp: {weights.billing + weights.nps}% | Área: {weights.area1 + weights.area2}%</p>
            </div>
          </div>
        </div>

        {/* Progress Summary */}
        <div className="mt-6 grid gap-4 border-t border-[var(--border)] pt-6 sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Progreso Total</p>
            <div className="mt-1 flex items-center gap-2">
              {totalWeightedProgress !== null ? (
                <>
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-accent">
                    <div
                      className="h-full rounded-full bg-brand transition-all duration-500"
                      style={{ width: `${Math.min(totalWeightedProgress, 100)}%` }}
                    />
                  </div>
                  <span className="text-base font-bold text-foreground tabular-nums">{totalWeightedProgress}%</span>
                </>
              ) : (
                <span className="text-sm text-muted-foreground">Sin datos suficientes</span>
              )}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Gate de Facturación</p>
            <div className="mt-1">
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-sm font-medium ${
                billingGateMet 
                  ? 'bg-success-subtle text-[var(--green-700)]' 
                  : 'bg-danger-subtle text-[var(--red-600)]'
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
              <p className="mt-1 text-xs text-muted-foreground">
                Mínimo {billingObjective?.gate_percentage || 90}% para habilitar bonus
              </p>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Estado Objetivos</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-sm font-medium ${
                billingObjective ? 'bg-success-subtle text-[var(--green-700)]' : 'bg-secondary text-muted-foreground'
              }`}>
                FC: {billingObjective ? '1/1' : '0/1'}
              </span>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-sm font-medium ${
                npsConfiguredCount === 4 ? 'bg-accent text-accent-foreground' : 
                npsConfiguredCount > 0 ? 'bg-warning-subtle text-[var(--amber-600)]' : 'bg-secondary text-muted-foreground'
              }`}>
                NPS: {npsConfiguredCount}/4
              </span>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-sm font-medium ${
                areaObjectives.length >= 2 
                  ? 'bg-success-subtle text-[var(--green-700)]' 
                  : areaObjectives.length > 0
                  ? 'bg-warning-subtle text-[var(--amber-600)]'
                  : 'bg-danger-subtle text-[var(--red-600)]'
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
        <div className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                <svg className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">Facturación</h3>
                <p className="text-xs text-muted-foreground">Peso: {weights.billing}%</p>
              </div>
            </div>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
              Corporativo
            </span>
          </div>

          {billingObjective ? (
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">{billingObjective.title}</p>
              {billingObjective.description && (
                <p className="text-sm text-muted-foreground">{billingObjective.description}</p>
              )}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Meta</p>
                  <p className="text-sm font-medium text-foreground">
                    ${billingObjective.target_value?.toLocaleString('es-AR') || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Actual</p>
                  <p className="text-sm font-medium text-foreground">
                    ${billingObjective.actual_value?.toLocaleString('es-AR') || '-'}
                  </p>
                </div>
              </div>
              {billingProgress !== null && (
                <div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progreso</span>
                    <span className="font-medium text-foreground tabular-nums">{Math.round(billingProgress)}%</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-accent">
                    <div
                      className="h-full rounded-full bg-brand transition-all duration-500"
                      style={{ width: `${Math.min(billingProgress, 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">No configurado para {currentYear}</p>
          )}
        </div>

        {/* NPS Objective (Quarterly) */}
        <div className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                <svg className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">NPS (Trimestral)</h3>
                <p className="text-xs text-muted-foreground">Peso total: {weights.nps}%</p>
              </div>
            </div>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              npsConfiguredCount === 4 ? 'bg-accent text-accent-foreground' :
              npsConfiguredCount > 0 ? 'bg-warning-subtle text-[var(--amber-600)]' :
              'bg-secondary text-muted-foreground'
            }`}>
              {npsConfiguredCount}/4 trimestres
            </span>
          </div>

          {npsConfiguredCount > 0 ? (
            <div className="space-y-3">
              {/* Progress summary */}
              {npsProgress !== null && (
                <div className="rounded-lg bg-muted p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-sm font-medium text-foreground">Progreso promedio</span>
                    <span className="font-bold text-foreground tabular-nums">{Math.round(npsProgress)}%</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-accent">
                    <div
                      className="h-full rounded-full bg-brand transition-all duration-500"
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
                    <div key={q} className={`rounded-lg border p-2 ${npsObj ? 'border-[var(--orange-100)] bg-accent/50' : 'border-[var(--border)] bg-muted'}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">{QUARTER_LABELS[q]}</span>
                        {npsObj && quarterProgress !== null && (
                          <span className={`text-xs font-bold ${
                            quarterProgress >= 100 ? 'text-[var(--green-700)]' :
                            quarterProgress >= 75 ? 'text-accent-foreground' : 'text-[var(--amber-600)]'
                          }`}>
                            {Math.round(quarterProgress)}%
                          </span>
                        )}
                      </div>
                      {npsObj ? (
                        <div className="mt-1 text-xs text-muted-foreground">
                          <span>Meta: {npsObj.target_value}</span>
                          {npsObj.actual_value !== null && (
                            <span className="ml-2">Actual: {npsObj.actual_value}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sin configurar</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">No hay NPS configurado para {currentYear}</p>
          )}
        </div>

        {/* Area Objective 1 */}
        <div className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                <svg className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">Objetivo de Área 1</h3>
                <p className="text-xs text-muted-foreground">Peso: {weights.area1}%</p>
              </div>
            </div>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
              Área/Rol
            </span>
          </div>

          {area1 ? (
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">{area1.title}</p>
              {area1.description && (
                <p className="text-sm text-muted-foreground">{area1.description}</p>
              )}
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[area1.status].bg} ${STATUS_COLORS[area1.status].text}`}>
                  {STATUS_LABELS[area1.status]}
                </span>
                {area1.period_type && (
                  <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {PERIOD_TYPE_LABELS[area1.period_type]}
                  </span>
                )}
                {area1.is_professional_development && (
                  <span className="inline-flex items-center rounded-full bg-warning-subtle px-2 py-0.5 text-xs font-medium text-[var(--amber-600)]">
                    Desarrollo profesional
                  </span>
                )}
              </div>
              <div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Progreso</span>
                  <span className="font-medium text-foreground tabular-nums">{area1.progress_percentage}%</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-accent">
                  <div
                    className="h-full rounded-full bg-brand transition-all duration-500"
                    style={{ width: `${Math.min(area1.progress_percentage, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">No cargado por el líder</p>
          )}
        </div>

        {/* Area Objective 2 */}
        <div className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                <svg className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">Objetivo de Área 2</h3>
                <p className="text-xs text-muted-foreground">Peso: {weights.area2}%</p>
              </div>
            </div>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
              Área/Rol
            </span>
          </div>

          {area2 ? (
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">{area2.title}</p>
              {area2.description && (
                <p className="text-sm text-muted-foreground">{area2.description}</p>
              )}
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[area2.status].bg} ${STATUS_COLORS[area2.status].text}`}>
                  {STATUS_LABELS[area2.status]}
                </span>
                {area2.period_type && (
                  <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {PERIOD_TYPE_LABELS[area2.period_type]}
                  </span>
                )}
                {area2.is_professional_development && (
                  <span className="inline-flex items-center rounded-full bg-warning-subtle px-2 py-0.5 text-xs font-medium text-[var(--amber-600)]">
                    Desarrollo profesional
                  </span>
                )}
              </div>
              <div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Progreso</span>
                  <span className="font-medium text-foreground tabular-nums">{area2.progress_percentage}%</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-accent">
                  <div
                    className="h-full rounded-full bg-brand transition-all duration-500"
                    style={{ width: `${Math.min(area2.progress_percentage, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">No cargado por el líder</p>
          )}
        </div>
      </div>

      {/* Weight Distribution Info */}
      <div className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-foreground mb-4">Distribución de Pesos - {seniorityLevel ? getSeniorityLabel(seniorityLevel) : SENIORITY_CATEGORY_LABELS[seniorityCategory]}</h3>
        <BarList
          max={100}
          items={[
            { label: 'Facturación', value: weights.billing, hint: `${weights.billing}%` },
            { label: 'NPS', value: weights.nps, hint: `${weights.nps}%` },
            { label: 'Área 1', value: weights.area1, hint: `${weights.area1}%` },
            { label: 'Área 2', value: weights.area2, hint: `${weights.area2}%` },
          ]}
        />
      </div>
    </div>
  );
}

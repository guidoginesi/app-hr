'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
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

type BonusData = {
  member: {
    id: string;
    name: string;
    seniority_level: string | null;
    effective_seniority_level: string | null;
    hire_date: string | null;
  };
  year: number;
  isCurrentYear: boolean;
  weights: {
    company: number;
    area: number;
    billing: number;
    nps: number;
    area1: number;
    area2: number;
  };
  proRata: {
    applies: boolean;
    factor: number;
    months: number;
    percentage: number;
  };
  corporate: {
    billing: {
      target: number | null;
      actual: number | null;
      gatePercentage: number;
      gateMet: boolean;
      rawCompletion: number;
      completion: number;
    };
    nps: {
      quarters: { quarter: string; score: number | null; met: boolean; actual: number | null; target: number | null }[];
      averageCompletion: number;
    };
    totalCompletion: number;
  };
  personal: {
    objectives: { title: string; achievement: number | null; subObjectives?: { title: string; achievement: number | null }[] }[];
    averageCompletion: number;
    evaluatedCount: number;
    totalCount: number;
  };
  bonus: {
    companyComponent: number;
    personalComponent: number;
    totalPercentage: number;
    gateMet: boolean;
    finalPercentage: number;
  };
};

type EmployeeObjectivesDetailClientProps = {
  employee: Employee;
  corporateObjectives: CorporateObjective[];
  areaObjectives: Objective[];
  weights: ObjectiveWeightDistribution;
  seniorityLevel: string | null;
  seniorityCategory: SeniorityCategory;
  currentYear: number;
  availableBonusYears?: number[];
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
  availableBonusYears = [],
}: EmployeeObjectivesDetailClientProps) {
  const [activeTab, setActiveTab] = useState<'objectives' | 'bonus'>('objectives');
  const [bonusYear, setBonusYear] = useState(availableBonusYears[0] || currentYear);
  const [bonusData, setBonusData] = useState<BonusData | null>(null);
  const [loadingBonus, setLoadingBonus] = useState(false);

  useEffect(() => {
    if (activeTab === 'bonus') {
      loadBonusData(bonusYear);
    }
  }, [activeTab, bonusYear]);

  const loadBonusData = async (year: number) => {
    setLoadingBonus(true);
    try {
      const res = await fetch(`/api/admin/objectives/${employee.id}/bonus?year=${year}`);
      if (res.ok) {
        const data = await res.json();
        setBonusData(data);
      }
    } catch (error) {
      console.error('Error loading bonus data:', error);
    }
    setLoadingBonus(false);
  };

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

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-zinc-100 p-1">
        <button
          onClick={() => setActiveTab('objectives')}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'objectives'
              ? 'bg-white text-zinc-900 shadow-sm'
              : 'text-zinc-600 hover:text-zinc-900'
          }`}
        >
          Objetivos
        </button>
        <button
          onClick={() => setActiveTab('bonus')}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'bonus'
              ? 'bg-white text-zinc-900 shadow-sm'
              : 'text-zinc-600 hover:text-zinc-900'
          }`}
        >
          Cálculo de Bono
        </button>
      </div>

      {/* Objectives Tab */}
      {activeTab === 'objectives' && (
      <>
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
      </>
      )}

      {/* Bonus Tab */}
      {activeTab === 'bonus' && (
        <div className="space-y-6">
          {/* Year Selector */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-zinc-900">Cálculo de Bono</h3>
              <p className="text-sm text-zinc-500">Seleccioná el año para ver el bono correspondiente</p>
            </div>
            {availableBonusYears.length > 0 ? (
              <select
                value={bonusYear}
                onChange={(e) => setBonusYear(Number(e.target.value))}
                className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                {availableBonusYears.map(year => (
                  <option key={year} value={year}>
                    {year} {year === currentYear ? '(en curso)' : ''}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-sm text-zinc-500">Sin objetivos corporativos configurados</span>
            )}
          </div>

          {loadingBonus ? (
            <div className="rounded-xl border border-zinc-200 bg-white p-12">
              <div className="flex items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-rose-600 border-t-transparent" />
              </div>
            </div>
          ) : bonusData ? (
            <>
              {/* No Corporate Objectives Banner */}
              {!bonusData.corporate.billing.target && bonusData.corporate.nps.quarters.length === 0 && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                  <div className="flex items-center gap-3">
                    <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="font-medium text-blue-800">Sin objetivos corporativos configurados para {bonusData.year}</p>
                      <p className="text-sm text-blue-700">
                        Los objetivos corporativos (Facturación y NPS) deben configurarse desde la sección de Objetivos en el panel de administración.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Pro-rata Info Banner */}
              {bonusData.proRata.applies && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-center gap-3">
                    <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <div>
                      <p className="font-medium text-amber-800">Bono proporcional</p>
                      <p className="text-sm text-amber-700">
                        El empleado ingresó durante {bonusData.year}, por lo que el bono se calcula proporcionalmente ({bonusData.proRata.months} meses trabajados).
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Seniority Level Info */}
              {bonusData.member.effective_seniority_level && 
               bonusData.member.effective_seniority_level !== bonusData.member.seniority_level && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                  <div className="flex items-center gap-3">
                    <svg className="h-5 w-5 text-blue-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="font-medium text-blue-800">Nivel de seniority histórico</p>
                      <p className="text-sm text-blue-700">
                        El bono de {bonusData.year} se calcula con el nivel <strong>{bonusData.member.effective_seniority_level}</strong> (vigente al cierre del período).
                        El nivel actual es <strong>{bonusData.member.seniority_level}</strong>.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Weights Info Bar */}
              <div className="flex h-8 rounded-lg overflow-hidden">
                <div 
                  className="bg-purple-500 flex items-center justify-center"
                  style={{ width: `${bonusData.weights.company}%` }}
                >
                  <span className="text-xs font-semibold text-white">Corporativo {bonusData.weights.company}%</span>
                </div>
                <div 
                  className="bg-blue-500 flex items-center justify-center"
                  style={{ width: `${bonusData.weights.area}%` }}
                >
                  <span className="text-xs font-semibold text-white">Personal {bonusData.weights.area}%</span>
                </div>
              </div>

              {/* Corporate Objectives */}
              <div className="rounded-xl border border-zinc-200 bg-white p-6">
                <h3 className="text-base font-semibold text-zinc-900 mb-4">
                  Objetivos corporativos
                  <span className="ml-2 text-sm font-normal text-zinc-500">
                    ({bonusData.corporate.totalCompletion.toFixed(1)}% promedio)
                  </span>
                </h3>
                <div className="space-y-4">
                  {/* Billing */}
                  <div className={`rounded-lg border p-4 ${bonusData.bonus.gateMet ? 'border-emerald-200 bg-emerald-50' : 'border-zinc-200 bg-zinc-50'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-zinc-900">Facturación (Anual)</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-700">
                          Peso: {bonusData.weights.billing}%
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {bonusData.bonus.gateMet ? (
                          <>
                            <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 flex items-center gap-1">
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Gate alcanzado
                            </span>
                            <span className={`font-semibold ${bonusData.corporate.billing.completion >= 100 ? 'text-emerald-600' : 'text-amber-600'}`}>
                              {bonusData.corporate.billing.completion.toFixed(1)}%
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700">
                              Gate no alcanzado ({bonusData.corporate.billing.gatePercentage}% req.)
                            </span>
                            <span className="text-xs text-zinc-500">
                              ({bonusData.corporate.billing.rawCompletion.toFixed(1)}% logrado)
                            </span>
                            <span className="font-semibold text-red-600">
                              0%
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    {bonusData.corporate.billing.target && (
                      <p className="text-xs text-zinc-500">
                        Objetivo: ${bonusData.corporate.billing.target.toLocaleString()} | 
                        Actual: ${(bonusData.corporate.billing.actual || 0).toLocaleString()}
                      </p>
                    )}
                  </div>

                  {/* NPS */}
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                    {(() => {
                      const quartersWithData = bonusData.corporate.nps.quarters.filter(q => q.score !== null);
                      const quartersMet = quartersWithData.filter(q => q.met).length;
                      const totalQuarters = quartersWithData.length;
                      return (
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-zinc-900">NPS (Trimestral)</span>
                            <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-700">
                              Peso: {bonusData.weights.nps}%
                            </span>
                          </div>
                          <div className="text-right">
                            <span className={`font-semibold ${quartersMet === totalQuarters && totalQuarters > 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                              {bonusData.corporate.nps.averageCompletion.toFixed(0)}%
                            </span>
                            {totalQuarters > 0 && (
                              <span className="text-xs text-zinc-500 ml-2">
                                ({quartersMet}/{totalQuarters} cumplidos)
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                    <div className="grid grid-cols-4 gap-2">
                      {['q1', 'q2', 'q3', 'q4'].map(quarter => {
                        const npsQ = bonusData.corporate.nps.quarters.find(q => q.quarter === quarter);
                        const hasData = npsQ && npsQ.score !== null;
                        return (
                          <div key={quarter} className="text-center p-2 bg-white rounded border border-zinc-200">
                            <p className="text-xs text-zinc-500 uppercase">{quarter}</p>
                            {hasData ? (
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                npsQ.met ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                              }`}>
                                {npsQ.met ? 'Cumplido' : 'No cumplido'}
                              </span>
                            ) : (
                              <span className="text-zinc-400 text-sm">-</span>
                            )}
                            {npsQ && npsQ.actual !== null && npsQ.target !== null && (
                              <p className="text-xs text-zinc-400 mt-1">{npsQ.actual} / {npsQ.target}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Personal Objectives */}
              <div className="rounded-xl border border-zinc-200 bg-white p-6">
                <h3 className="text-base font-semibold text-zinc-900 mb-4">
                  Objetivos personales
                  <span className="ml-2 text-sm font-normal text-zinc-500">
                    ({bonusData.personal.averageCompletion.toFixed(1)}% promedio - {bonusData.personal.evaluatedCount}/{bonusData.personal.totalCount} evaluados)
                  </span>
                </h3>
                {bonusData.personal.objectives.length > 0 ? (
                  <div className="space-y-2">
                    {bonusData.personal.objectives.map((obj, index) => (
                      <div key={index} className="py-2 border-b border-zinc-100 last:border-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-zinc-700">{obj.title}</span>
                          <span className={`font-semibold ${
                            obj.achievement === null ? 'text-zinc-400' :
                            obj.achievement >= 100 ? 'text-emerald-600' :
                            obj.achievement >= 75 ? 'text-blue-600' :
                            'text-amber-600'
                          }`}>
                            {obj.achievement !== null ? `${obj.achievement}%` : 'Sin evaluar'}
                          </span>
                        </div>
                        {obj.subObjectives && obj.subObjectives.length > 0 && (
                          <div className="mt-2 ml-4 space-y-1">
                            {obj.subObjectives.map((sub, subIdx) => (
                              <div key={subIdx} className="flex items-center justify-between text-xs">
                                <span className="text-zinc-500">{sub.title}</span>
                                <span className={
                                  sub.achievement === null ? 'text-zinc-400' :
                                  sub.achievement >= 100 ? 'text-emerald-600' :
                                  'text-zinc-600'
                                }>
                                  {sub.achievement !== null ? `${sub.achievement}%` : '-'}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500">No hay objetivos personales registrados</p>
                )}
              </div>

              {/* Calculation Breakdown */}
              <div className="rounded-xl border border-zinc-200 bg-white p-6">
                <h3 className="text-base font-semibold text-zinc-900 mb-4">Desglose del cálculo</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2 border-b border-zinc-100">
                    <span className="text-sm text-zinc-600">
                      Componente corporativo ({bonusData.corporate.totalCompletion.toFixed(1)}% × {bonusData.weights.company}%)
                    </span>
                    <span className="font-semibold text-purple-600">
                      {bonusData.bonus.companyComponent.toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-zinc-100">
                    <span className="text-sm text-zinc-600">
                      Componente personal ({bonusData.personal.averageCompletion.toFixed(1)}% × {bonusData.weights.area}%)
                    </span>
                    <span className="font-semibold text-blue-600">
                      {bonusData.bonus.personalComponent.toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-zinc-100">
                    <span className="text-sm font-medium text-zinc-900">
                      Subtotal
                    </span>
                    <span className="font-bold text-zinc-900">
                      {bonusData.bonus.totalPercentage.toFixed(2)}%
                    </span>
                  </div>
                  {bonusData.proRata.applies && (
                    <div className="flex items-center justify-between py-2 border-b border-zinc-100 bg-amber-50 rounded px-2 -mx-2">
                      <span className="text-sm text-amber-800">
                        Proporcionalidad ({bonusData.proRata.months}/12 meses trabajados = {bonusData.proRata.percentage.toFixed(1)}%)
                      </span>
                      <span className="font-semibold text-amber-700">
                        × {bonusData.proRata.factor.toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between py-3 rounded-lg px-3 bg-rose-50">
                    <span className="font-semibold text-rose-900">
                      Bono a pagar
                    </span>
                    <span className="text-xl font-bold text-rose-600">
                      {bonusData.bonus.finalPercentage.toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center">
              <p className="text-zinc-500">No se pudo cargar la información del bono</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

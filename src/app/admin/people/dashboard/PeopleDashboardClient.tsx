'use client';

import { useMemo } from 'react';
import { 
  getSeniorityLabel, 
  getSeniorityCategory, 
  SENIORITY_CATEGORY_COLORS,
  SENIORITY_CATEGORY_LABELS,
  SeniorityCategory
} from '@/types/corporate-objectives';

type Employee = {
  id: string;
  first_name: string;
  last_name: string;
  status: string;
  hire_date: string | null;
  termination_date: string | null;
  seniority_level: string | null;
  department_id: string | null;
  legal_entity_id: string | null;
  employment_type: string | null;
  created_at: string;
  department: { id: string; name: string } | null;
  legal_entity: { id: string; name: string } | null;
};

type Department = { id: string; name: string };
type LegalEntity = { id: string; name: string };

type Props = {
  employees: Employee[];
  departments: Department[];
  legalEntities: LegalEntity[];
};

export function PeopleDashboardClient({ employees, departments, legalEntities }: Props) {
  const metrics = useMemo(() => {
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

    // Filter active employees
    const activeEmployees = employees.filter(e => e.status === 'active');
    const terminatedEmployees = employees.filter(e => e.status === 'terminated');

    // Total headcount
    const totalActive = activeEmployees.length;
    const totalTerminated = terminatedEmployees.length;

    // New hires (last 6 months)
    const newHires = activeEmployees.filter(e => {
      if (!e.hire_date) return false;
      return new Date(e.hire_date) >= sixMonthsAgo;
    });

    // Terminations (last 12 months)
    const recentTerminations = terminatedEmployees.filter(e => {
      if (!e.termination_date) return false;
      return new Date(e.termination_date) >= oneYearAgo;
    });

    // Retention rate (last 12 months)
    // Formula: (Employees at start - Terminations) / Employees at start * 100
    const employeesAtStart = totalActive + recentTerminations.length;
    const retentionRate = employeesAtStart > 0 
      ? ((employeesAtStart - recentTerminations.length) / employeesAtStart * 100)
      : 100;

    // Average tenure (in years)
    const tenures = activeEmployees
      .filter(e => e.hire_date)
      .map(e => {
        const hireDate = new Date(e.hire_date!);
        const years = (now.getTime() - hireDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
        return years;
      });
    const avgTenure = tenures.length > 0 
      ? tenures.reduce((a, b) => a + b, 0) / tenures.length 
      : 0;

    // Distribution by department
    const byDepartment: Record<string, number> = {};
    activeEmployees.forEach(e => {
      const deptName = e.department?.name || 'Sin departamento';
      byDepartment[deptName] = (byDepartment[deptName] || 0) + 1;
    });

    // Distribution by seniority category
    const bySeniority: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const withoutSeniority: number[] = [];
    activeEmployees.forEach(e => {
      if (e.seniority_level) {
        const category = getSeniorityCategory(e.seniority_level);
        if (category) {
          bySeniority[category] = (bySeniority[category] || 0) + 1;
        }
      } else {
        withoutSeniority.push(1);
      }
    });

    // Distribution by legal entity
    const byLegalEntity: Record<string, number> = {};
    activeEmployees.forEach(e => {
      const entityName = e.legal_entity?.name || 'Sin sociedad';
      byLegalEntity[entityName] = (byLegalEntity[entityName] || 0) + 1;
    });

    // Tenure distribution
    const tenureRanges = {
      'Menos de 1 año': 0,
      '1-2 años': 0,
      '2-5 años': 0,
      '5-10 años': 0,
      'Más de 10 años': 0,
    };
    tenures.forEach(t => {
      if (t < 1) tenureRanges['Menos de 1 año']++;
      else if (t < 2) tenureRanges['1-2 años']++;
      else if (t < 5) tenureRanges['2-5 años']++;
      else if (t < 10) tenureRanges['5-10 años']++;
      else tenureRanges['Más de 10 años']++;
    });

    // Distribution by employment type
    const byEmploymentType = {
      'Relación de dependencia': 0,
      'Monotributo': 0,
      'Sin asignar': 0,
    };
    activeEmployees.forEach(e => {
      if (e.employment_type === 'dependency') {
        byEmploymentType['Relación de dependencia']++;
      } else if (e.employment_type === 'monotributista') {
        byEmploymentType['Monotributo']++;
      } else {
        byEmploymentType['Sin asignar']++;
      }
    });

    return {
      totalActive,
      totalTerminated,
      newHires: newHires.length,
      recentTerminations: recentTerminations.length,
      retentionRate,
      avgTenure,
      byDepartment,
      bySeniority,
      withoutSeniority: withoutSeniority.length,
      byLegalEntity,
      tenureRanges,
      byEmploymentType,
    };
  }, [employees]);

  // Colors for charts
  const departmentColors = [
    'bg-success', 'bg-primary', 'bg-cat-violet', 'bg-warning', 
    'bg-danger', 'bg-cat-cyan', 'bg-brand', 'bg-primary'
  ];

  const seniorityColors: Record<number, string> = {
    1: 'bg-secondary',
    2: 'bg-primary',
    3: 'bg-success',
    4: 'bg-cat-violet',
    5: 'bg-warning',
  };

  const tenureColors = [
    'bg-danger', 'bg-warning', 'bg-success', 'bg-primary', 'bg-cat-violet'
  ];

  // Calculate max for bar charts
  const maxDept = Math.max(...Object.values(metrics.byDepartment), 1);
  const maxSeniority = Math.max(...Object.values(metrics.bySeniority), 1);
  const maxTenure = Math.max(...Object.values(metrics.tenureRanges), 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard de People</h1>
        <p className="mt-1 text-sm text-muted-foreground">Indicadores de gestión del equipo</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Active */}
        <div className="rounded-xl border border-[var(--border)] bg-white p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success-subtle">
              <svg className="h-6 w-6 text-[var(--green-700)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Empleados activos</p>
              <p className="text-2xl font-bold text-foreground">{metrics.totalActive}</p>
            </div>
          </div>
        </div>

        {/* New Hires */}
        <div className="rounded-xl border border-[var(--border)] bg-white p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent">
              <svg className="h-6 w-6 text-accent-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Nuevos (últimos 6 meses)</p>
              <p className="text-2xl font-bold text-foreground">{metrics.newHires}</p>
            </div>
          </div>
        </div>

        {/* Retention Rate */}
        <div className="rounded-xl border border-[var(--border)] bg-white p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-cat-violet-subtle">
              <svg className="h-6 w-6 text-cat-violet" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Tasa de retención (12m)</p>
              <p className="text-2xl font-bold text-foreground">{metrics.retentionRate.toFixed(1)}%</p>
            </div>
          </div>
        </div>

        {/* Average Tenure */}
        <div className="rounded-xl border border-[var(--border)] bg-white p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-warning-subtle">
              <svg className="h-6 w-6 text-[var(--amber-600)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Antigüedad promedio</p>
              <p className="text-2xl font-bold text-foreground">{metrics.avgTenure.toFixed(1)} años</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Department */}
        <div className="rounded-xl border border-[var(--border)] bg-white p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Distribución por Departamento</h3>
          <div className="space-y-3">
            {Object.entries(metrics.byDepartment)
              .sort(([, a], [, b]) => b - a)
              .map(([dept, count], index) => (
                <div key={dept} className="flex items-center gap-3">
                  <div className="w-32 text-sm text-muted-foreground truncate" title={dept}>{dept}</div>
                  <div className="flex-1 h-6 bg-secondary rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${departmentColors[index % departmentColors.length]} rounded-full transition-all duration-500`}
                      style={{ width: `${(count / maxDept) * 100}%` }}
                    />
                  </div>
                  <div className="w-8 text-sm font-semibold text-foreground text-right">{count}</div>
                </div>
              ))}
          </div>
        </div>

        {/* By Seniority */}
        <div className="rounded-xl border border-[var(--border)] bg-white p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Distribución por Seniority</h3>
          <div className="space-y-3">
            {([1, 2, 3, 4, 5] as SeniorityCategory[]).map((category) => (
              <div key={category} className="flex items-center gap-3">
                <div className="w-32 text-sm text-muted-foreground">{SENIORITY_CATEGORY_LABELS[category]}</div>
                <div className="flex-1 h-6 bg-secondary rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${seniorityColors[category]} rounded-full transition-all duration-500`}
                    style={{ width: `${(metrics.bySeniority[category] / maxSeniority) * 100}%` }}
                  />
                </div>
                <div className="w-8 text-sm font-semibold text-foreground text-right">{metrics.bySeniority[category]}</div>
              </div>
            ))}
            {metrics.withoutSeniority > 0 && (
              <div className="flex items-center gap-3">
                <div className="w-32 text-sm text-muted-foreground">Sin asignar</div>
                <div className="flex-1 h-6 bg-secondary rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-secondary rounded-full transition-all duration-500"
                    style={{ width: `${(metrics.withoutSeniority / maxSeniority) * 100}%` }}
                  />
                </div>
                <div className="w-8 text-sm font-semibold text-muted-foreground text-right">{metrics.withoutSeniority}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Second Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Tenure */}
        <div className="rounded-xl border border-[var(--border)] bg-white p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Distribución por Antigüedad</h3>
          <div className="space-y-3">
            {Object.entries(metrics.tenureRanges).map(([range, count], index) => (
              <div key={range} className="flex items-center gap-3">
                <div className="w-32 text-sm text-muted-foreground">{range}</div>
                <div className="flex-1 h-6 bg-secondary rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${tenureColors[index]} rounded-full transition-all duration-500`}
                    style={{ width: `${(count / maxTenure) * 100}%` }}
                  />
                </div>
                <div className="w-8 text-sm font-semibold text-foreground text-right">{count}</div>
              </div>
            ))}
          </div>
        </div>

        {/* By Legal Entity */}
        <div className="rounded-xl border border-[var(--border)] bg-white p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Headcount por Sociedad</h3>
          <div className="space-y-3">
            {Object.entries(metrics.byLegalEntity)
              .sort(([, a], [, b]) => b - a)
              .map(([entity, count], index) => {
                const maxEntity = Math.max(...Object.values(metrics.byLegalEntity), 1);
                return (
                  <div key={entity} className="flex items-center gap-3">
                    <div className="w-32 text-sm text-muted-foreground truncate" title={entity}>{entity}</div>
                    <div className="flex-1 h-6 bg-secondary rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${departmentColors[(index + 3) % departmentColors.length]} rounded-full transition-all duration-500`}
                        style={{ width: `${(count / maxEntity) * 100}%` }}
                      />
                    </div>
                    <div className="w-8 text-sm font-semibold text-foreground text-right">{count}</div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* Third Row - Employment Type */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Employment Type - Donut Chart */}
        <div className="rounded-xl border border-[var(--border)] bg-white p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Condición Laboral</h3>
          <div className="flex items-center gap-8">
            {/* Donut Chart */}
            <div className="relative w-40 h-40 flex-shrink-0">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                {(() => {
                  const total = metrics.byEmploymentType['Relación de dependencia'] + 
                               metrics.byEmploymentType['Monotributo'] + 
                               metrics.byEmploymentType['Sin asignar'];
                  if (total === 0) return null;
                  
                  const dependency = metrics.byEmploymentType['Relación de dependencia'];
                  const monotributo = metrics.byEmploymentType['Monotributo'];
                  const sinAsignar = metrics.byEmploymentType['Sin asignar'];
                  
                  const dependencyPct = (dependency / total) * 100;
                  const monotributoPct = (monotributo / total) * 100;
                  const sinAsignarPct = (sinAsignar / total) * 100;
                  
                  let offset = 0;
                  const segments = [];
                  
                  if (dependency > 0) {
                    segments.push(
                      <circle
                        key="dependency"
                        cx="18"
                        cy="18"
                        r="15.915"
                        fill="transparent"
                        stroke="#10b981"
                        strokeWidth="3.5"
                        strokeDasharray={`${dependencyPct} ${100 - dependencyPct}`}
                        strokeDashoffset={-offset}
                        className="transition-all duration-500"
                      />
                    );
                    offset += dependencyPct;
                  }
                  
                  if (monotributo > 0) {
                    segments.push(
                      <circle
                        key="monotributo"
                        cx="18"
                        cy="18"
                        r="15.915"
                        fill="transparent"
                        stroke="#f59e0b"
                        strokeWidth="3.5"
                        strokeDasharray={`${monotributoPct} ${100 - monotributoPct}`}
                        strokeDashoffset={-offset}
                        className="transition-all duration-500"
                      />
                    );
                    offset += monotributoPct;
                  }
                  
                  if (sinAsignar > 0) {
                    segments.push(
                      <circle
                        key="sinAsignar"
                        cx="18"
                        cy="18"
                        r="15.915"
                        fill="transparent"
                        stroke="#d4d4d8"
                        strokeWidth="3.5"
                        strokeDasharray={`${sinAsignarPct} ${100 - sinAsignarPct}`}
                        strokeDashoffset={-offset}
                        className="transition-all duration-500"
                      />
                    );
                  }
                  
                  return segments;
                })()}
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-2xl font-bold text-foreground">{metrics.totalActive}</div>
                  <div className="text-xs text-muted-foreground">Total</div>
                </div>
              </div>
            </div>
            
            {/* Legend */}
            <div className="space-y-3 flex-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-success" />
                  <span className="text-sm text-muted-foreground">Relación de dependencia</span>
                </div>
                <span className="text-sm font-semibold text-foreground">
                  {metrics.byEmploymentType['Relación de dependencia']}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-warning" />
                  <span className="text-sm text-muted-foreground">Monotributo</span>
                </div>
                <span className="text-sm font-semibold text-foreground">
                  {metrics.byEmploymentType['Monotributo']}
                </span>
              </div>
              {metrics.byEmploymentType['Sin asignar'] > 0 && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-secondary" />
                    <span className="text-sm text-muted-foreground">Sin asignar</span>
                  </div>
                  <span className="text-sm font-semibold text-muted-foreground">
                    {metrics.byEmploymentType['Sin asignar']}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Placeholder or additional chart */}
        <div className="rounded-xl border border-[var(--border)] bg-white p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Resumen de Condiciones</h3>
          <div className="space-y-4">
            {(() => {
              const total = metrics.byEmploymentType['Relación de dependencia'] + 
                           metrics.byEmploymentType['Monotributo'];
              const dependencyPct = total > 0 
                ? ((metrics.byEmploymentType['Relación de dependencia'] / total) * 100).toFixed(1)
                : '0';
              const monotributoPct = total > 0 
                ? ((metrics.byEmploymentType['Monotributo'] / total) * 100).toFixed(1)
                : '0';
              
              return (
                <>
                  <div className="flex items-center justify-between p-4 rounded-lg bg-success-subtle">
                    <div>
                      <p className="text-sm font-medium text-[var(--green-700)]">Relación de dependencia</p>
                      <p className="text-xs text-[var(--green-700)]">Empleados en nómina</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-[var(--green-700)]">{dependencyPct}%</p>
                      <p className="text-xs text-[var(--green-700)]">{metrics.byEmploymentType['Relación de dependencia']} personas</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-lg bg-warning-subtle">
                    <div>
                      <p className="text-sm font-medium text-[var(--amber-600)]">Monotributo</p>
                      <p className="text-xs text-[var(--amber-600)]">Contratistas independientes</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-[var(--amber-600)]">{monotributoPct}%</p>
                      <p className="text-xs text-[var(--amber-600)]">{metrics.byEmploymentType['Monotributo']} personas</p>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-[var(--border)] bg-white p-4">
          <p className="text-xs text-muted-foreground">Bajas (últimos 12m)</p>
          <p className="text-xl font-bold text-foreground">{metrics.recentTerminations}</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-white p-4">
          <p className="text-xs text-muted-foreground">Total histórico</p>
          <p className="text-xl font-bold text-foreground">{employees.length}</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-white p-4">
          <p className="text-xs text-muted-foreground">Departamentos</p>
          <p className="text-xl font-bold text-foreground">{Object.keys(metrics.byDepartment).length}</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-white p-4">
          <p className="text-xs text-muted-foreground">Sociedades</p>
          <p className="text-xl font-bold text-foreground">{Object.keys(metrics.byLegalEntity).length}</p>
        </div>
      </div>
    </div>
  );
}

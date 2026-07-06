'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@pow/ui/components/ui/button';
import { SelectMenu } from '@pow/ui/components/ui/select-menu';
import { BarList } from '@pow/ui/components/ui/bar-list';
import { Stat } from '@pow/ui/components/ui/stat';
import { Star, ClipboardList, ClipboardCheck, UserSquare, Users } from 'lucide-react';

type Period = {
  id: string;
  name: string;
  year: number;
  start_date: string;
  end_date: string;
  status: string;
};

type Evaluation = {
  id: string;
  period_id: string;
  employee_id: string;
  type: 'self' | 'leader';
  status: string;
  total_score: number | null;
  employee: {
    id: string;
    first_name: string;
    last_name: string;
    department: { id: string; name: string } | null;
  };
};

type ItemScore = {
  item_id: string;
  period_id: string;
  statement: string;
  dimension_name: string;
  avg_score: number;
  response_count: number;
};

type Props = {
  periods: Period[];
  evaluations: Evaluation[];
  itemScores: ItemScore[];
  activePeriodId: string | null;
};

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('es-AR');
}

export function EvaluationsDashboardClient({
  periods,
  evaluations,
  itemScores,
  activePeriodId,
}: Props) {
  const router = useRouter();
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>(activePeriodId || 'all');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [employeeDeptFilter, setEmployeeDeptFilter] = useState<string>('all');

  // Filter evaluations by selected period
  const filteredEvaluations = useMemo(() => {
    if (selectedPeriodId === 'all') return evaluations;
    return evaluations.filter(e => e.period_id === selectedPeriodId);
  }, [evaluations, selectedPeriodId]);

  // Filter item scores by period_id
  const filteredItemScores = useMemo(() => {
    if (selectedPeriodId === 'all') return itemScores;
    return itemScores.filter(s => s.period_id === selectedPeriodId);
  }, [itemScores, selectedPeriodId]);

  // Compute department scores dynamically from the already-filtered evaluations
  const filteredDepartmentScores = useMemo(() => {
    const map = new Map<string, { department_id: string; department_name: string; scores: number[]; employees: Set<string> }>();
    filteredEvaluations
      .filter(e => e.type === 'leader' && e.total_score !== null && e.employee?.department)
      .forEach(e => {
        const dept = e.employee.department!;
        if (!map.has(dept.id)) {
          map.set(dept.id, { department_id: dept.id, department_name: dept.name, scores: [], employees: new Set() });
        }
        const d = map.get(dept.id)!;
        d.scores.push(e.total_score as number);
        d.employees.add(e.employee_id);
      });
    return Array.from(map.values())
      .map(d => ({
        department_id: d.department_id,
        department_name: d.department_name,
        avg_score: d.scores.reduce((a, b) => a + b, 0) / d.scores.length,
        employee_count: d.employees.size,
      }))
      .sort((a, b) => b.avg_score - a.avg_score);
  }, [filteredEvaluations]);

  // Calculate stats
  const stats = useMemo(() => {
    const submitted = filteredEvaluations.filter(e => e.status === 'submitted');
    const selfEvals = filteredEvaluations.filter(e => e.type === 'self');
    const leaderEvals = filteredEvaluations.filter(e => e.type === 'leader');
    
    // Average score (only from leader evaluations that are submitted)
    const leaderSubmitted = submitted.filter(e => e.type === 'leader' && e.total_score !== null);
    const avgScore = leaderSubmitted.length > 0
      ? leaderSubmitted.reduce((acc, e) => acc + (e.total_score || 0), 0) / leaderSubmitted.length
      : null;

    return {
      total: filteredEvaluations.length,
      submitted: submitted.length,
      selfCount: selfEvals.length,
      leaderCount: leaderEvals.length,
      avgScore,
    };
  }, [filteredEvaluations]);

  // Top/Bottom 3 items
  const topItems = useMemo(() => {
    return [...filteredItemScores]
      .sort((a, b) => b.avg_score - a.avg_score)
      .slice(0, 3);
  }, [filteredItemScores]);

  const bottomItems = useMemo(() => {
    return [...filteredItemScores]
      .sort((a, b) => a.avg_score - b.avg_score)
      .slice(0, 3);
  }, [filteredItemScores]);

  // Employee scores (from leader evaluations only, filtered by period)
  const employeeScores = useMemo(() => {
    return filteredEvaluations
      .filter(e => e.type === 'leader' && e.total_score !== null && e.employee)
      .map(e => ({
        id: e.employee_id,
        name: `${e.employee.first_name} ${e.employee.last_name}`,
        department: e.employee.department?.name || 'Sin área',
        score: e.total_score as number,
      }))
      .sort((a, b) => b.score - a.score);
  }, [filteredEvaluations]);

  // Get unique departments for filter
  const availableDepartments = useMemo(() => {
    const depts = new Set(employeeScores.map(e => e.department));
    return Array.from(depts).sort();
  }, [employeeScores]);

  // Filtered employee scores for display
  const filteredEmployeeScores = useMemo(() => {
    return employeeScores.filter(emp => {
      const matchesSearch = employeeSearch === '' || 
        emp.name.toLowerCase().includes(employeeSearch.toLowerCase()) ||
        emp.department.toLowerCase().includes(employeeSearch.toLowerCase());
      const matchesDept = employeeDeptFilter === 'all' || emp.department === employeeDeptFilter;
      return matchesSearch && matchesDept;
    });
  }, [employeeScores, employeeSearch, employeeDeptFilter]);

  // Calculate average from ALL employees (not filtered)
  const globalAvgScore = useMemo(() => {
    if (employeeScores.length === 0) return null;
    return employeeScores.reduce((acc, e) => acc + e.score, 0) / employeeScores.length;
  }, [employeeScores]);

  // Top/Bottom employees (from all, not filtered)
  const topEmployees = employeeScores.slice(0, 3);
  const bottomEmployees = [...employeeScores].sort((a, b) => a.score - b.score).slice(0, 3);

  const selectedPeriod = periods.find(p => p.id === selectedPeriodId);

  return (
    <div className="space-y-8">
      {/* Period Filter */}
      <div className="flex items-center justify-end gap-3">
        <label className="text-sm font-medium text-secondary-foreground">Período:</label>
        <SelectMenu
          ariaLabel="Filtrar por período"
          align="end"
          value={selectedPeriodId}
          onChange={(v) => setSelectedPeriodId(v)}
          options={[
            { value: 'all', label: 'Todos los períodos' },
            ...periods.map((period) => ({ value: period.id, label: `${period.name} (${period.year})` })),
          ]}
        />
      </div>

      {/* Selected Period Info */}
      {selectedPeriod && (
        <div className="rounded-xl border border-[var(--border)] bg-muted p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  selectedPeriod.status === 'open'
                    ? 'bg-success-subtle text-[var(--green-700)]'
                    : selectedPeriod.status === 'closed'
                    ? 'bg-secondary text-muted-foreground'
                    : 'bg-warning-subtle text-[var(--amber-600)]'
                }`}>
                  {selectedPeriod.status === 'open' ? 'Abierto' : selectedPeriod.status === 'closed' ? 'Cerrado' : 'Borrador'}
                </span>
                <h2 className="text-base font-semibold text-foreground">{selectedPeriod.name}</h2>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatDate(selectedPeriod.start_date)} - {formatDate(selectedPeriod.end_date)}
              </p>
            </div>
            <Button onClick={() => router.push('/admin/evaluations/periods')}>
              Gestionar períodos
            </Button>
          </div>
        </div>
      )}

      {/* Main Stats */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Stat
          icon={<Star className="h-6 w-6" />}
          label="Score promedio"
          value={stats.avgScore !== null ? stats.avgScore.toFixed(1) : '-'}
          sub="Evaluaciones de líderes"
        />
        <Stat
          icon={<ClipboardList className="h-6 w-6" />}
          label="Total evaluaciones"
          value={String(stats.total)}
          sub="En el período"
        />
        <Stat
          icon={<ClipboardCheck className="h-6 w-6" />}
          label="Completadas"
          value={String(stats.submitted)}
          sub="Enviadas"
        />
        <Stat
          icon={<UserSquare className="h-6 w-6" />}
          label="Autoevaluaciones"
          value={String(stats.selfCount)}
          sub="De colaboradores"
        />
        <Stat
          icon={<Users className="h-6 w-6" />}
          label="Eval. líderes"
          value={String(stats.leaderCount)}
          sub="De líderes"
        />
      </div>

      {/* Performance by Department */}
      {filteredDepartmentScores.length > 0 && (
        <div className="rounded-xl border border-[var(--border)] bg-white shadow-sm">
          <div className="border-b border-[var(--border)] px-6 py-4">
            <h3 className="text-base font-semibold text-foreground">Performance por área</h3>
            <p className="text-sm text-muted-foreground">Score promedio de evaluaciones de líder por departamento</p>
          </div>
          <div className="p-6">
            <BarList
              max={10}
              items={filteredDepartmentScores.map((dept) => ({
                label: dept.department_name,
                value: Number(dept.avg_score.toFixed(1)),
                hint: `${dept.avg_score.toFixed(1)} / 10`,
              }))}
            />
          </div>
        </div>
      )}

      {/* Top/Bottom Items */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top 3 */}
        <div className="rounded-xl border border-[var(--border)] bg-white shadow-sm">
          <div className="border-b border-[var(--border)] px-6 py-4">
            <h3 className="text-base font-semibold text-foreground">Top 3 competencias</h3>
            <p className="text-sm text-muted-foreground">Mejor puntuadas en evaluaciones</p>
          </div>
          <ul className="divide-y divide-[var(--border)]">
            {topItems.length > 0 ? topItems.map((item, idx) => (
              <li key={item.item_id} className="px-6 py-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.statement}</p>
                    <p className="text-xs text-muted-foreground">{item.dimension_name}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-base font-bold text-foreground tabular-nums">{item.avg_score.toFixed(1)}</p>
                    <p className="text-xs text-muted-foreground">{item.response_count} respuestas</p>
                  </div>
                </div>
              </li>
            )) : (
              <li className="px-6 py-8 text-center text-sm text-muted-foreground">
                No hay datos suficientes
              </li>
            )}
          </ul>
        </div>

        {/* Bottom 3 */}
        <div className="rounded-xl border border-[var(--border)] bg-white shadow-sm">
          <div className="border-b border-[var(--border)] px-6 py-4">
            <h3 className="text-base font-semibold text-foreground">Áreas de mejora</h3>
            <p className="text-sm text-muted-foreground">Competencias con menor puntuación</p>
          </div>
          <ul className="divide-y divide-[var(--border)]">
            {bottomItems.length > 0 ? bottomItems.map((item, idx) => (
              <li key={item.item_id} className="px-6 py-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.statement}</p>
                    <p className="text-xs text-muted-foreground">{item.dimension_name}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-base font-bold text-foreground tabular-nums">{item.avg_score.toFixed(1)}</p>
                    <p className="text-xs text-muted-foreground">{item.response_count} respuestas</p>
                  </div>
                </div>
              </li>
            )) : (
              <li className="px-6 py-8 text-center text-sm text-muted-foreground">
                No hay datos suficientes
              </li>
            )}
          </ul>
        </div>
      </div>

      {/* Top/Bottom Employees */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top Employees */}
        <div className="rounded-xl border border-[var(--border)] bg-white shadow-sm">
          <div className="border-b border-[var(--border)] px-6 py-4">
            <h3 className="text-base font-semibold text-foreground">Top performers</h3>
            <p className="text-sm text-muted-foreground">Empleados con mejor puntuación</p>
          </div>
          <ul className="divide-y divide-[var(--border)]">
            {topEmployees.length > 0 ? topEmployees.map((emp, idx) => (
              <li key={emp.id} className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-foreground">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{emp.name}</p>
                    <p className="text-xs text-muted-foreground">{emp.department}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-2xl font-bold text-foreground tabular-nums">{emp.score.toFixed(1)}</p>
                  </div>
                </div>
              </li>
            )) : (
              <li className="px-6 py-8 text-center text-sm text-muted-foreground">
                No hay datos suficientes
              </li>
            )}
          </ul>
        </div>

        {/* Bottom Employees */}
        <div className="rounded-xl border border-[var(--border)] bg-white shadow-sm">
          <div className="border-b border-[var(--border)] px-6 py-4">
            <h3 className="text-base font-semibold text-foreground">Requieren atención</h3>
            <p className="text-sm text-muted-foreground">Empleados con menor puntuación</p>
          </div>
          <ul className="divide-y divide-[var(--border)]">
            {bottomEmployees.length > 0 ? bottomEmployees.map((emp, idx) => (
              <li key={emp.id} className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-foreground">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{emp.name}</p>
                    <p className="text-xs text-muted-foreground">{emp.department}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-2xl font-bold text-foreground tabular-nums">{emp.score.toFixed(1)}</p>
                  </div>
                </div>
              </li>
            )) : (
              <li className="px-6 py-8 text-center text-sm text-muted-foreground">
                No hay datos suficientes
              </li>
            )}
          </ul>
        </div>
      </div>

      {/* All Employees Score Distribution */}
      {employeeScores.length > 0 && (
        <div className="rounded-xl border border-[var(--border)] bg-white shadow-sm">
          <div className="border-b border-[var(--border)] px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-foreground">Distribución de Scores por Empleado</h3>
                <p className="text-sm text-muted-foreground">
                  {filteredEmployeeScores.length} de {employeeScores.length} empleados
                </p>
              </div>
              <div className="flex items-center gap-4">
                {globalAvgScore !== null && (
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-brand" />
                    <span className="text-sm text-muted-foreground">Media: <span className="font-semibold">{globalAvgScore.toFixed(1)}</span></span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Filters */}
            <div className="mt-4 flex items-center gap-4">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Buscar por nombre o área..."
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] px-4 py-2 text-sm placeholder:text-muted-foreground focus:border-brand focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <SelectMenu
                ariaLabel="Filtrar por área"
                className="w-56"
                value={employeeDeptFilter}
                onChange={(v) => setEmployeeDeptFilter(v)}
                options={[
                  { value: 'all', label: 'Todas las áreas' },
                  ...availableDepartments.map(dept => ({ value: dept, label: dept })),
                ]}
              />
            </div>
          </div>
          <div className="p-6">
            {/* Scale Header */}
            <div className="mb-4 flex items-center">
              <div className="w-48" />
              <div className="flex-1 relative">
                <div className="flex justify-between text-xs text-muted-foreground px-1">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                    <span key={n} className="w-6 text-center">{n}</span>
                  ))}
                </div>
              </div>
              <div className="w-16" />
            </div>

            {/* Employee Rows */}
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
              {filteredEmployeeScores.length > 0 ? filteredEmployeeScores.map((emp) => (
                <div key={emp.id} className="flex items-center gap-4">
                  <div className="w-48 truncate">
                    <p className="text-sm font-medium text-secondary-foreground truncate">{emp.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{emp.department}</p>
                  </div>
                  <div className="flex-1 relative">
                    {/* Scale Background */}
                    <div className="h-8 rounded-lg bg-gradient-to-r from-danger-subtle via-warning-subtle to-success-subtle relative">
                      {/* Scale Divisions */}
                      <div className="absolute inset-0 flex">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                          <div key={n} className="flex-1 border-r border-[var(--border)]/50" />
                        ))}
                        <div className="flex-1" />
                      </div>
                      
                      {/* Mean Marker */}
                      {globalAvgScore !== null && (
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-brand z-10"
                          style={{ left: `${((globalAvgScore - 1) / 9) * 100}%` }}
                        />
                      )}
                      
                      {/* Employee Score Marker */}
                      <div 
                        className="absolute top-1 bottom-1 w-6 -ml-3 rounded-md bg-foreground flex items-center justify-center shadow-md z-20"
                        style={{ left: `${((emp.score - 1) / 9) * 100}%` }}
                      >
                        <span className="text-xs font-bold text-white">{emp.score.toFixed(1)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="w-16 text-right">
                    <span className={`text-sm font-semibold ${
                      emp.score >= 7 ? 'text-[var(--green-700)]' : 
                      emp.score >= 5 ? 'text-[var(--amber-600)]' : 'text-[var(--red-600)]'
                    }`}>
                      {emp.score.toFixed(1)}
                    </span>
                  </div>
                </div>
              )) : (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No se encontraron empleados con los filtros seleccionados
                </div>
              )}
            </div>

            {/* Legend */}
            <div className="mt-6 pt-4 border-t border-[var(--border)] flex items-center justify-center gap-6 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="h-3 w-6 rounded bg-danger-subtle" />
                <span>1-4: Por debajo</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-6 rounded bg-warning-subtle" />
                <span>5-6: Esperado</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-6 rounded bg-success-subtle" />
                <span>7-10: Superior</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-0.5 bg-brand" />
                <span>Media del equipo</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
          <h3 className="text-base font-semibold text-foreground">Configuración</h3>
          <p className="mt-1 text-sm text-muted-foreground">Administra períodos y dimensiones de evaluación</p>
          <div className="mt-4 flex gap-3">
            <Link
              href="/admin/evaluations/periods"
              className="rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-muted"
            >
              Períodos
            </Link>
            <Link
              href="/admin/evaluations/dimensions"
              className="rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-muted"
            >
              Dimensiones
            </Link>
          </div>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
          <h3 className="text-base font-semibold text-foreground">Seguimiento</h3>
          <p className="mt-1 text-sm text-muted-foreground">Visualiza todas las evaluaciones del sistema</p>
          <div className="mt-4">
            <Link
              href="/admin/evaluations/all"
              className="rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-muted"
            >
              Ver todas las evaluaciones
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';

// Demo data for testing - remove in production
const DEMO_EMPLOYEES = [
  { name: 'María García', department: 'Tecnología', score: 9.2 },
  { name: 'Juan Pérez', department: 'Ventas', score: 7.8 },
  { name: 'Ana Rodríguez', department: 'Marketing', score: 8.5 },
  { name: 'Carlos López', department: 'Recursos Humanos', score: 6.3 },
  { name: 'Laura Martínez', department: 'Finanzas', score: 8.9 },
  { name: 'Pedro Sánchez', department: 'Tecnología', score: 7.1 },
  { name: 'Sofía Fernández', department: 'Operaciones', score: 8.0 },
  { name: 'Diego González', department: 'Ventas', score: 5.8 },
  { name: 'Valentina Torres', department: 'Marketing', score: 9.0 },
  { name: 'Martín Ruiz', department: 'Tecnología', score: 7.5 },
  { name: 'Camila Díaz', department: 'Recursos Humanos', score: 8.2 },
  { name: 'Nicolás Herrera', department: 'Finanzas', score: 6.9 },
  { name: 'Isabella Vargas', department: 'Operaciones', score: 7.7 },
  { name: 'Sebastián Castro', department: 'Ventas', score: 8.4 },
  { name: 'Luciana Morales', department: 'Marketing', score: 5.5 },
  { name: 'Tomás Ortiz', department: 'Tecnología', score: 9.1 },
  { name: 'Florencia Romero', department: 'Recursos Humanos', score: 7.3 },
  { name: 'Mateo Acosta', department: 'Finanzas', score: 8.7 },
  { name: 'Emilia Medina', department: 'Operaciones', score: 6.6 },
  { name: 'Benjamín Flores', department: 'Ventas', score: 7.9 },
  { name: 'Victoria Ríos', department: 'Marketing', score: 8.1 },
  { name: 'Lucas Jiménez', department: 'Tecnología', score: 6.2 },
  { name: 'Antonella Vega', department: 'Recursos Humanos', score: 9.3 },
  { name: 'Santiago Mendoza', department: 'Finanzas', score: 7.0 },
  { name: 'Catalina Suárez', department: 'Operaciones', score: 8.6 },
  { name: 'Gabriel Ramos', department: 'Ventas', score: 5.9 },
  { name: 'Julieta Silva', department: 'Marketing', score: 7.4 },
  { name: 'Daniel Molina', department: 'Tecnología', score: 8.8 },
  { name: 'Renata Aguirre', department: 'Recursos Humanos', score: 6.7 },
  { name: 'Maximiliano Peña', department: 'Finanzas', score: 7.6 },
  { name: 'Paulina Guerrero', department: 'Operaciones', score: 9.4 },
  { name: 'Joaquín Navarro', department: 'Ventas', score: 6.4 },
  { name: 'Agustina Campos', department: 'Marketing', score: 8.3 },
  { name: 'Felipe Delgado', department: 'Tecnología', score: 7.2 },
  { name: 'Milagros Vera', department: 'Recursos Humanos', score: 5.7 },
  { name: 'Ignacio Sosa', department: 'Finanzas', score: 8.0 },
  { name: 'Bianca Figueroa', department: 'Operaciones', score: 6.8 },
  { name: 'Franco Cabrera', department: 'Ventas', score: 9.0 },
  { name: 'Alma Rojas', department: 'Marketing', score: 7.8 },
  { name: 'Lautaro Paz', department: 'Tecnología', score: 6.1 },
].map((emp, idx) => ({ ...emp, id: `demo-${idx}` }));

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
  statement: string;
  dimension_name: string;
  avg_score: number;
  response_count: number;
};

type DepartmentScore = {
  department_id: string;
  department_name: string;
  avg_score: number;
  employee_count: number;
};

type Props = {
  periods: Period[];
  evaluations: Evaluation[];
  itemScores: ItemScore[];
  departmentScores: DepartmentScore[];
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
  departmentScores,
  activePeriodId,
}: Props) {
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>(activePeriodId || 'all');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [employeeDeptFilter, setEmployeeDeptFilter] = useState<string>('all');
  const [showDemoData, setShowDemoData] = useState(true); // Toggle for demo data

  // Filter evaluations by selected period
  const filteredEvaluations = useMemo(() => {
    if (selectedPeriodId === 'all') return evaluations;
    return evaluations.filter(e => e.period_id === selectedPeriodId);
  }, [evaluations, selectedPeriodId]);

  // Filter item scores by selected period (already filtered from server if needed)
  const filteredItemScores = useMemo(() => {
    // Item scores are already aggregated, filter based on period
    if (selectedPeriodId === 'all') return itemScores;
    return itemScores; // In real scenario, this would be filtered server-side
  }, [itemScores, selectedPeriodId]);

  // Filter department scores
  const filteredDepartmentScores = useMemo(() => {
    if (selectedPeriodId === 'all') return departmentScores;
    return departmentScores;
  }, [departmentScores, selectedPeriodId]);

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

  // Employee scores (from leader evaluations)
  const realEmployeeScores = useMemo(() => {
    return filteredEvaluations
      .filter(e => e.type === 'leader' && e.total_score !== null && e.employee)
      .map(e => ({
        id: e.employee_id,
        name: `${e.employee.first_name} ${e.employee.last_name}`,
        department: e.employee.department?.name || 'Sin área',
        score: e.total_score as number,
      }));
  }, [filteredEvaluations]);

  // Combine real data with demo data if enabled
  const employeeScores = useMemo(() => {
    const combined = showDemoData 
      ? [...realEmployeeScores, ...DEMO_EMPLOYEES]
      : realEmployeeScores;
    return combined.sort((a, b) => b.score - a.score);
  }, [realEmployeeScores, showDemoData]);

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Dashboard de Evaluaciones</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Resumen general del módulo de evaluaciones de desempeño
          </p>
        </div>
        
        {/* Period Filter */}
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-zinc-700">Período:</label>
          <select
            value={selectedPeriodId}
            onChange={(e) => setSelectedPeriodId(e.target.value)}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
          >
            <option value="all">Todos los períodos</option>
            {periods.map((period) => (
              <option key={period.id} value={period.id}>
                {period.name} ({period.year})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Selected Period Info */}
      {selectedPeriod && (
        <div className="rounded-xl border border-purple-200 bg-purple-50 p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  selectedPeriod.status === 'open' 
                    ? 'bg-green-100 text-green-700'
                    : selectedPeriod.status === 'closed'
                    ? 'bg-zinc-100 text-zinc-600'
                    : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {selectedPeriod.status === 'open' ? 'Abierto' : selectedPeriod.status === 'closed' ? 'Cerrado' : 'Borrador'}
                </span>
                <h2 className="text-lg font-semibold text-purple-900">{selectedPeriod.name}</h2>
              </div>
              <p className="mt-1 text-sm text-purple-700">
                {formatDate(selectedPeriod.start_date)} - {formatDate(selectedPeriod.end_date)}
              </p>
            </div>
            <Link
              href="/admin/evaluations/periods"
              className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
            >
              Gestionar períodos
            </Link>
          </div>
        </div>
      )}

      {/* Main Stats */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Score Promedio</p>
          <p className="mt-3 text-4xl font-bold text-purple-600">
            {stats.avgScore !== null ? stats.avgScore.toFixed(1) : '-'}
          </p>
          <p className="mt-2 text-xs text-zinc-500">Evaluaciones de líderes</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Total Evaluaciones</p>
          <p className="mt-3 text-4xl font-bold text-zinc-900">{stats.total}</p>
          <p className="mt-2 text-xs text-zinc-500">En el período</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Completadas</p>
          <p className="mt-3 text-4xl font-bold text-green-600">{stats.submitted}</p>
          <p className="mt-2 text-xs text-zinc-500">Enviadas</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Autoevaluaciones</p>
          <p className="mt-3 text-4xl font-bold text-blue-600">{stats.selfCount}</p>
          <p className="mt-2 text-xs text-zinc-500">De colaboradores</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Eval. Líderes</p>
          <p className="mt-3 text-4xl font-bold text-purple-600">{stats.leaderCount}</p>
          <p className="mt-2 text-xs text-zinc-500">De líderes</p>
        </div>
      </div>

      {/* Performance by Department */}
      {filteredDepartmentScores.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-200 px-6 py-4">
            <h3 className="text-base font-semibold text-zinc-900">Performance por Área</h3>
            <p className="text-sm text-zinc-500">Score promedio de evaluaciones de líder por departamento</p>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {filteredDepartmentScores.map((dept) => (
                <div key={dept.department_id} className="flex items-center gap-4">
                  <div className="w-40 truncate">
                    <span className="text-sm font-medium text-zinc-700">{dept.department_name}</span>
                  </div>
                  <div className="flex-1">
                    <div className="h-4 w-full rounded-full bg-zinc-100">
                      <div
                        className="h-4 rounded-full bg-purple-500"
                        style={{ width: `${(dept.avg_score / 10) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-20 text-right">
                    <span className="text-sm font-semibold text-zinc-900">{dept.avg_score.toFixed(1)}</span>
                    <span className="text-xs text-zinc-500"> / 10</span>
                  </div>
                  <div className="w-24 text-right">
                    <span className="text-xs text-zinc-500">{dept.employee_count} empleados</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Top/Bottom Items */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top 3 */}
        <div className="rounded-xl border border-green-200 bg-green-50 shadow-sm">
          <div className="border-b border-green-200 px-6 py-4">
            <h3 className="text-base font-semibold text-green-900">Top 3 Competencias</h3>
            <p className="text-sm text-green-700">Mejor puntuadas en evaluaciones</p>
          </div>
          <ul className="divide-y divide-green-200">
            {topItems.length > 0 ? topItems.map((item, idx) => (
              <li key={item.item_id} className="px-6 py-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-200 text-xs font-bold text-green-800">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-green-900 truncate">{item.statement}</p>
                    <p className="text-xs text-green-700">{item.dimension_name}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-green-800">{item.avg_score.toFixed(1)}</p>
                    <p className="text-xs text-green-600">{item.response_count} respuestas</p>
                  </div>
                </div>
              </li>
            )) : (
              <li className="px-6 py-8 text-center text-sm text-green-700">
                No hay datos suficientes
              </li>
            )}
          </ul>
        </div>

        {/* Bottom 3 */}
        <div className="rounded-xl border border-amber-200 bg-amber-50 shadow-sm">
          <div className="border-b border-amber-200 px-6 py-4">
            <h3 className="text-base font-semibold text-amber-900">Áreas de Mejora</h3>
            <p className="text-sm text-amber-700">Competencias con menor puntuación</p>
          </div>
          <ul className="divide-y divide-amber-200">
            {bottomItems.length > 0 ? bottomItems.map((item, idx) => (
              <li key={item.item_id} className="px-6 py-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-200 text-xs font-bold text-amber-800">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-amber-900 truncate">{item.statement}</p>
                    <p className="text-xs text-amber-700">{item.dimension_name}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-amber-800">{item.avg_score.toFixed(1)}</p>
                    <p className="text-xs text-amber-600">{item.response_count} respuestas</p>
                  </div>
                </div>
              </li>
            )) : (
              <li className="px-6 py-8 text-center text-sm text-amber-700">
                No hay datos suficientes
              </li>
            )}
          </ul>
        </div>
      </div>

      {/* Top/Bottom Employees */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top Employees */}
        <div className="rounded-xl border border-green-200 bg-green-50 shadow-sm">
          <div className="border-b border-green-200 px-6 py-4">
            <h3 className="text-base font-semibold text-green-900">Top Performers</h3>
            <p className="text-sm text-green-700">Empleados con mejor puntuación</p>
          </div>
          <ul className="divide-y divide-green-200">
            {topEmployees.length > 0 ? topEmployees.map((emp, idx) => (
              <li key={emp.id} className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-200 text-sm font-bold text-green-800">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-green-900">{emp.name}</p>
                    <p className="text-xs text-green-700">{emp.department}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-2xl font-bold text-green-800">{emp.score.toFixed(1)}</p>
                  </div>
                </div>
              </li>
            )) : (
              <li className="px-6 py-8 text-center text-sm text-green-700">
                No hay datos suficientes
              </li>
            )}
          </ul>
        </div>

        {/* Bottom Employees */}
        <div className="rounded-xl border border-amber-200 bg-amber-50 shadow-sm">
          <div className="border-b border-amber-200 px-6 py-4">
            <h3 className="text-base font-semibold text-amber-900">Requieren Atención</h3>
            <p className="text-sm text-amber-700">Empleados con menor puntuación</p>
          </div>
          <ul className="divide-y divide-amber-200">
            {bottomEmployees.length > 0 ? bottomEmployees.map((emp, idx) => (
              <li key={emp.id} className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-200 text-sm font-bold text-amber-800">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-amber-900">{emp.name}</p>
                    <p className="text-xs text-amber-700">{emp.department}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-2xl font-bold text-amber-800">{emp.score.toFixed(1)}</p>
                  </div>
                </div>
              </li>
            )) : (
              <li className="px-6 py-8 text-center text-sm text-amber-700">
                No hay datos suficientes
              </li>
            )}
          </ul>
        </div>
      </div>

      {/* All Employees Score Distribution */}
      {employeeScores.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-zinc-900">Distribución de Scores por Empleado</h3>
                <p className="text-sm text-zinc-500">
                  {filteredEmployeeScores.length} de {employeeScores.length} empleados
                </p>
              </div>
              <div className="flex items-center gap-4">
                {globalAvgScore !== null && (
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-purple-500" />
                    <span className="text-sm text-zinc-600">Media: <span className="font-semibold">{globalAvgScore.toFixed(1)}</span></span>
                  </div>
                )}
                {/* Demo data toggle - remove in production */}
                <label className="flex items-center gap-2 text-xs text-zinc-500">
                  <input
                    type="checkbox"
                    checked={showDemoData}
                    onChange={(e) => setShowDemoData(e.target.checked)}
                    className="rounded border-zinc-300"
                  />
                  Demo data
                </label>
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
                  className="w-full rounded-lg border border-zinc-300 px-4 py-2 text-sm placeholder:text-zinc-400 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>
              <select
                value={employeeDeptFilter}
                onChange={(e) => setEmployeeDeptFilter(e.target.value)}
                className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
              >
                <option value="all">Todas las áreas</option>
                {availableDepartments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="p-6">
            {/* Scale Header */}
            <div className="mb-4 flex items-center">
              <div className="w-48" />
              <div className="flex-1 relative">
                <div className="flex justify-between text-xs text-zinc-400 px-1">
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
                    <p className="text-sm font-medium text-zinc-800 truncate">{emp.name}</p>
                    <p className="text-xs text-zinc-500 truncate">{emp.department}</p>
                  </div>
                  <div className="flex-1 relative">
                    {/* Scale Background */}
                    <div className="h-8 rounded-lg bg-gradient-to-r from-red-100 via-yellow-100 to-green-100 relative">
                      {/* Scale Divisions */}
                      <div className="absolute inset-0 flex">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                          <div key={n} className="flex-1 border-r border-zinc-200/50" />
                        ))}
                        <div className="flex-1" />
                      </div>
                      
                      {/* Mean Marker */}
                      {globalAvgScore !== null && (
                        <div 
                          className="absolute top-0 bottom-0 w-0.5 bg-purple-500 z-10"
                          style={{ left: `${((globalAvgScore - 1) / 9) * 100}%` }}
                        />
                      )}
                      
                      {/* Employee Score Marker */}
                      <div 
                        className="absolute top-1 bottom-1 w-6 -ml-3 rounded-md bg-zinc-800 flex items-center justify-center shadow-md z-20"
                        style={{ left: `${((emp.score - 1) / 9) * 100}%` }}
                      >
                        <span className="text-xs font-bold text-white">{emp.score.toFixed(1)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="w-16 text-right">
                    <span className={`text-sm font-semibold ${
                      emp.score >= 7 ? 'text-green-600' : 
                      emp.score >= 5 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {emp.score.toFixed(1)}
                    </span>
                  </div>
                </div>
              )) : (
                <div className="py-8 text-center text-sm text-zinc-500">
                  No se encontraron empleados con los filtros seleccionados
                </div>
              )}
            </div>

            {/* Legend */}
            <div className="mt-6 pt-4 border-t border-zinc-200 flex items-center justify-center gap-6 text-xs text-zinc-500">
              <div className="flex items-center gap-2">
                <div className="h-3 w-6 rounded bg-red-100" />
                <span>1-4: Por debajo</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-6 rounded bg-yellow-100" />
                <span>5-6: Esperado</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-6 rounded bg-green-100" />
                <span>7-10: Superior</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-0.5 bg-purple-500" />
                <span>Media del equipo</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h3 className="text-base font-semibold text-zinc-900">Configuración</h3>
          <p className="mt-1 text-sm text-zinc-500">Administra períodos y dimensiones de evaluación</p>
          <div className="mt-4 flex gap-3">
            <Link
              href="/admin/evaluations/periods"
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Períodos
            </Link>
            <Link
              href="/admin/evaluations/dimensions"
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Dimensiones
            </Link>
          </div>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h3 className="text-base font-semibold text-zinc-900">Seguimiento</h3>
          <p className="mt-1 text-sm text-zinc-500">Visualiza todas las evaluaciones del sistema</p>
          <div className="mt-4">
            <Link
              href="/admin/evaluations/all"
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Ver todas las evaluaciones
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

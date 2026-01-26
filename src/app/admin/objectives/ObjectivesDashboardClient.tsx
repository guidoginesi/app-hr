'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { CorporateObjective, EmployeeObjectivesStatus, ObjectivesDashboardStats, getSeniorityShortLabel, getSeniorityCategory, SENIORITY_CATEGORY_COLORS, SENIORITY_CATEGORY_LABELS, SeniorityCategory } from '@/types/corporate-objectives';

type Department = {
  id: string;
  name: string;
};

type ObjectivesDashboardClientProps = {
  initialEmployees: EmployeeObjectivesStatus[];
  initialStats: ObjectivesDashboardStats;
  departments: Department[];
  corporateObjectives: CorporateObjective[];
  currentYear: number;
};

export function ObjectivesDashboardClient({
  initialEmployees,
  initialStats,
  departments,
  corporateObjectives,
  currentYear,
}: ObjectivesDashboardClientProps) {
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [selectedSeniority, setSelectedSeniority] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'complete' | 'partial' | 'none'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter employees
  const filteredEmployees = useMemo(() => {
    return initialEmployees.filter((emp) => {
      // Department filter
      if (selectedDepartment && emp.department_name !== selectedDepartment) {
        return false;
      }

      // Seniority filter (filter by category: 1, 2, 3, 4, 5)
      if (selectedSeniority) {
        const empCategory = getSeniorityCategory(emp.seniority_level);
        if (empCategory?.toString() !== selectedSeniority) {
          return false;
        }
      }

      // Status filter
      if (statusFilter === 'complete' && !emp.has_all_objectives) {
        return false;
      }
      if (statusFilter === 'partial' && (emp.has_all_objectives || (emp.area_objectives_count === 0 && !emp.has_billing && emp.nps_count === 0))) {
        return false;
      }
      if (statusFilter === 'none' && (emp.area_objectives_count > 0 || emp.has_billing || emp.nps_count > 0)) {
        return false;
      }

      // Search filter
      if (searchQuery) {
        const fullName = `${emp.first_name} ${emp.last_name}`.toLowerCase();
        if (!fullName.includes(searchQuery.toLowerCase())) {
          return false;
        }
      }

      return true;
    });
  }, [initialEmployees, selectedDepartment, selectedSeniority, statusFilter, searchQuery]);

  const years = [currentYear + 1, currentYear, currentYear - 1];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Dashboard de Objetivos</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Estado de objetivos de todos los empleados
          </p>
        </div>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-rose-500"
        >
          {years.map(year => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
      </div>

      {/* Corporate Objectives Status */}
      {(!initialStats.has_billing || initialStats.nps_count === 0) && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex items-center gap-3">
            <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-amber-800">
                {!initialStats.has_billing && !initialStats.nps_count 
                  ? 'Objetivos corporativos no configurados' 
                  : !initialStats.has_billing 
                  ? 'Facturación no configurada' 
                  : `NPS: ${initialStats.nps_count}/4 trimestres configurados`}
              </p>
              <p className="text-sm text-amber-700">
                <Link href="/admin/objectives/config" className="underline hover:text-amber-900">
                  Configurar objetivos corporativos
                </Link>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100">
              <svg className="h-5 w-5 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-zinc-900">{initialStats.total_employees}</p>
              <p className="text-sm text-zinc-500">Total empleados</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
              <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-600">{initialStats.with_complete_objectives}</p>
              <p className="text-sm text-zinc-500">Objetivos completos</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
              <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600">{initialStats.with_partial_objectives}</p>
              <p className="text-sm text-zinc-500">Objetivos parciales</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
              <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{initialStats.without_objectives}</p>
              <p className="text-sm text-zinc-500">Sin objetivos</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Buscar empleado..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-white py-2 pl-10 pr-4 text-sm shadow-sm focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
          />
        </div>

        <select
          value={selectedDepartment}
          onChange={(e) => setSelectedDepartment(e.target.value)}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
        >
          <option value="">Todos los departamentos</option>
          {departments.map(dept => (
            <option key={dept.id} value={dept.name}>{dept.name}</option>
          ))}
        </select>

        <select
          value={selectedSeniority}
          onChange={(e) => setSelectedSeniority(e.target.value)}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
        >
          <option value="">Todos los niveles</option>
          {([1, 2, 3, 4, 5] as SeniorityCategory[]).map(cat => (
            <option key={cat} value={cat}>{SENIORITY_CATEGORY_LABELS[cat]}</option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
        >
          <option value="all">Todos los estados</option>
          <option value="complete">Completos (4/4)</option>
          <option value="partial">Parciales</option>
          <option value="none">Sin objetivos</option>
        </select>
      </div>

      {/* Employees Table */}
      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Empleado</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Departamento</th>
                <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-zinc-500">Seniority</th>
                <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-zinc-500">FC</th>
                <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-zinc-500">NPS</th>
                <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-zinc-500">Área</th>
                <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-zinc-500">Progreso</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 bg-white">
              {filteredEmployees.map((emp) => (
                <tr key={emp.id} className="hover:bg-zinc-50">
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-100 text-sm font-medium text-rose-600">
                        {emp.first_name[0]}{emp.last_name[0]}
                      </div>
                      <span className="text-sm font-medium text-zinc-900">
                        {emp.first_name} {emp.last_name}
                      </span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-500">
                    {emp.department_name || '-'}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-center">
                    {emp.seniority_level ? (
                      (() => {
                        const category = getSeniorityCategory(emp.seniority_level);
                        const colors = category ? SENIORITY_CATEGORY_COLORS[category] : { bg: 'bg-zinc-100', text: 'text-zinc-700' };
                        return (
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors.bg} ${colors.text}`}>
                            {getSeniorityShortLabel(emp.seniority_level)}
                          </span>
                        );
                      })()
                    ) : (
                      <span className="text-xs text-zinc-400">-</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-center">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      emp.has_billing
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-zinc-100 text-zinc-500'
                    }`}>
                      {emp.has_billing ? '1/1' : '0/1'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-center">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      emp.nps_count === 4
                        ? 'bg-blue-100 text-blue-700'
                        : emp.nps_count > 0
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-zinc-100 text-zinc-500'
                    }`}>
                      {emp.nps_count}/4
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-center">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      emp.area_objectives_count >= 2
                        ? 'bg-emerald-100 text-emerald-700'
                        : emp.area_objectives_count > 0
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-red-100 text-red-600'
                    }`}>
                      {emp.area_objectives_count}/2
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-center">
                    {emp.total_progress !== null ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="h-2 w-16 overflow-hidden rounded-full bg-zinc-200">
                          <div 
                            className={`h-full rounded-full ${
                              emp.total_progress >= 100 ? 'bg-emerald-500' :
                              emp.total_progress >= 75 ? 'bg-blue-500' :
                              emp.total_progress >= 50 ? 'bg-amber-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${Math.min(emp.total_progress, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-zinc-600">{emp.total_progress}%</span>
                      </div>
                    ) : (
                      <span className="text-xs text-zinc-400">-</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right">
                    <Link
                      href={`/admin/objectives/${emp.id}`}
                      className="inline-flex items-center gap-1 text-sm font-medium text-rose-600 hover:text-rose-700"
                    >
                      Ver
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  </td>
                </tr>
              ))}
              {filteredEmployees.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-sm text-zinc-500">
                    No se encontraron empleados con los filtros seleccionados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

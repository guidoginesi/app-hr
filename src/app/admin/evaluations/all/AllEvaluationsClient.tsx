'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';

type Evaluation = {
  id: string;
  type: 'self' | 'leader';
  status: 'draft' | 'in_progress' | 'submitted';
  total_score: number | null;
  created_at: string;
  employee: {
    id: string;
    first_name: string;
    last_name: string;
    job_title: string | null;
    photo_url: string | null;
    department: { id: string; name: string } | null;
  };
  evaluator: {
    id: string;
    first_name: string;
    last_name: string;
  };
  period: {
    id: string;
    name: string;
    year: number;
  };
};

type Period = {
  id: string;
  name: string;
  year: number;
};

type Props = {
  evaluations: Evaluation[];
  periods: Period[];
};

export function AllEvaluationsClient({ evaluations, periods }: Props) {
  const [search, setSearch] = useState('');
  const [periodFilter, setPeriodFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'self' | 'leader'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'submitted' | 'in_progress' | 'draft'>('all');

  // Group evaluations by employee
  const groupedByEmployee = useMemo(() => {
    const filtered = evaluations.filter(e => {
      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        const fullName = `${e.employee?.first_name} ${e.employee?.last_name}`.toLowerCase();
        if (!fullName.includes(searchLower)) return false;
      }
      // Period filter
      if (periodFilter !== 'all' && e.period?.id !== periodFilter) return false;
      // Type filter
      if (typeFilter !== 'all' && e.type !== typeFilter) return false;
      // Status filter
      if (statusFilter !== 'all' && e.status !== statusFilter) return false;
      return true;
    });

    // Group by employee ID
    const grouped = new Map<string, { employee: Evaluation['employee']; evaluations: Evaluation[] }>();
    
    filtered.forEach(e => {
      if (!e.employee) return;
      const key = e.employee.id;
      if (!grouped.has(key)) {
        grouped.set(key, { employee: e.employee, evaluations: [] });
      }
      grouped.get(key)!.evaluations.push(e);
    });

    return Array.from(grouped.values()).sort((a, b) => 
      `${a.employee.last_name} ${a.employee.first_name}`.localeCompare(`${b.employee.last_name} ${b.employee.first_name}`)
    );
  }, [evaluations, search, periodFilter, typeFilter, statusFilter]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'submitted':
        return <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">Completada</span>;
      case 'in_progress':
        return <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">En progreso</span>;
      default:
        return <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">Borrador</span>;
    }
  };

  const totalCount = evaluations.length;
  const filteredCount = groupedByEmployee.reduce((acc, g) => acc + g.evaluations.length, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Todas las Evaluaciones</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {filteredCount} {filteredCount === 1 ? 'evaluación' : 'evaluaciones'} 
          {filteredCount !== totalCount && ` de ${totalCount} total`}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Buscar empleado..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-10 pr-4 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
        </div>

        {/* Period Filter */}
        <select
          value={periodFilter}
          onChange={(e) => setPeriodFilter(e.target.value)}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
        >
          <option value="all">Todos los períodos</option>
          {periods.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.year})
            </option>
          ))}
        </select>

        {/* Type Filter */}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
        >
          <option value="all">Todos los tipos</option>
          <option value="self">Autoevaluación</option>
          <option value="leader">Evaluación de Líder</option>
        </select>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
        >
          <option value="all">Todos los estados</option>
          <option value="submitted">Completadas</option>
          <option value="in_progress">En progreso</option>
          <option value="draft">Borrador</option>
        </select>
      </div>

      {/* List grouped by employee */}
      {groupedByEmployee.length > 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white">
          <ul className="divide-y divide-zinc-200">
            {groupedByEmployee.map(({ employee, evaluations: empEvaluations }) => (
              <li key={employee.id}>
                <Link
                  href={`/admin/evaluations/employee/${employee.id}`}
                  className="block p-4 hover:bg-zinc-50 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    {employee.photo_url ? (
                      <img
                        src={employee.photo_url}
                        alt={`${employee.first_name} ${employee.last_name}`}
                        className="h-12 w-12 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 flex-shrink-0">
                        <span className="text-sm font-semibold text-purple-700">
                          {employee.first_name.charAt(0)}{employee.last_name.charAt(0)}
                        </span>
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-zinc-900">
                            {employee.first_name} {employee.last_name}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {employee.job_title || 'Sin puesto'} 
                            {employee.department && ` • ${employee.department.name}`}
                          </p>
                        </div>
                        <svg className="h-5 w-5 text-zinc-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>

                      {/* Evaluations summary */}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {empEvaluations.slice(0, 3).map((evaluation) => (
                          <div 
                            key={evaluation.id} 
                            className="flex items-center gap-2 rounded-lg border border-zinc-100 bg-zinc-50 px-2 py-1"
                          >
                            <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium ${
                              evaluation.type === 'self'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-purple-100 text-purple-700'
                            }`}>
                              {evaluation.type === 'self' ? 'Auto' : 'Líder'}
                            </span>
                            {evaluation.total_score !== null && (
                              <span className="text-xs font-semibold text-zinc-700">
                                {evaluation.total_score.toFixed(1)}
                              </span>
                            )}
                            {getStatusBadge(evaluation.status)}
                          </div>
                        ))}
                        {empEvaluations.length > 3 && (
                          <span className="text-xs text-zinc-400 self-center">
                            +{empEvaluations.length - 3} más
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center">
          <svg className="mx-auto h-12 w-12 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="mt-4 text-sm text-zinc-500">
            {search || periodFilter !== 'all' || typeFilter !== 'all' || statusFilter !== 'all'
              ? 'No se encontraron evaluaciones con los filtros seleccionados'
              : 'No hay evaluaciones registradas aún'
            }
          </p>
        </div>
      )}
    </div>
  );
}

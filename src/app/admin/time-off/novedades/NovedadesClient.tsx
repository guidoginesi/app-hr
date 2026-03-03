'use client';

import { useEffect, useState, useCallback } from 'react';
import { TimeOffShell } from '../TimeOffShell';
import { formatDateLocal } from '@/lib/dateUtils';

interface Novedad {
  id: string;
  employee_id: string;
  employee_name: string;
  leave_type_name: string;
  leave_type_code: string;
  start_date: string;
  end_date: string;
  days_requested: number;
  count_type: string;
  status: string;
  notes: string | null;
  rejection_reason: string | null;
  hr_rejection_reason: string | null;
  leader_rejection_reason: string | null;
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const STATUS_LABELS: Record<string, string> = {
  approved: 'Aprobada',
  pending_leader: 'Pend. Líder',
  pending_hr: 'Pend. HR',
  rejected_leader: 'Rechazada Líder',
  rejected_hr: 'Rechazada HR',
  rejected: 'Rechazada',
  cancelled: 'Cancelada',
  pending: 'Pendiente',
};

const STATUS_COLORS: Record<string, string> = {
  approved: 'bg-emerald-100 text-emerald-800',
  pending_leader: 'bg-amber-100 text-amber-800',
  pending_hr: 'bg-blue-100 text-blue-800',
  rejected_leader: 'bg-red-100 text-red-800',
  rejected_hr: 'bg-red-100 text-red-800',
  rejected: 'bg-red-100 text-red-800',
  cancelled: 'bg-zinc-100 text-zinc-500',
  pending: 'bg-amber-100 text-amber-800',
};

function exportToExcel(novedades: Novedad[], year: number, month: number) {
  const periodLabel = `${MONTH_NAMES[month - 1]} ${year}`;

  const headers = ['Empleado', 'Tipo de licencia', 'Fecha inicio', 'Fecha fin', 'Duración', 'Estado', 'Observaciones'];

  const rows = novedades.map((n) => {
    const duracion = n.count_type === 'weeks'
      ? `${n.days_requested} semana${n.days_requested !== 1 ? 's' : ''}`
      : `${n.days_requested} día${n.days_requested !== 1 ? 's' : ''}`;

    const obs = [n.notes, n.rejection_reason, n.hr_rejection_reason, n.leader_rejection_reason]
      .filter(Boolean)
      .join(' | ');

    return [
      n.employee_name,
      n.leave_type_name,
      formatDateLocal(n.start_date),
      formatDateLocal(n.end_date),
      duracion,
      STATUS_LABELS[n.status] ?? n.status,
      obs,
    ];
  });

  // Build CSV with BOM for Excel UTF-8 compatibility
  const BOM = '\uFEFF';
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\r\n');

  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `novedades-${year}-${String(month).padStart(2, '0')}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function NovedadesClient() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [employeeId, setEmployeeId] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [novedades, setNovedades] = useState<Novedad[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        year: String(year),
        month: String(month),
      });
      if (employeeId) params.set('employee_id', employeeId);
      if (statusFilter) params.set('status', statusFilter);

      const res = await fetch(`/api/admin/time-off/novedades?${params}`);
      const data = await res.json();
      if (res.ok) {
        setNovedades(data.novedades ?? []);
        setEmployees(data.employees ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [year, month, employeeId, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const periodLabel = `${MONTH_NAMES[month - 1]} ${year}`;

  const durationLabel = (n: Novedad) =>
    n.count_type === 'weeks'
      ? `${n.days_requested} sem.`
      : `${n.days_requested} día${n.days_requested !== 1 ? 's' : ''}`;

  const observations = (n: Novedad) =>
    [n.notes, n.rejection_reason, n.hr_rejection_reason, n.leader_rejection_reason]
      .filter(Boolean)
      .join(' | ');

  const yearOptions = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  return (
    <TimeOffShell active="novedades">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Novedades</h1>
          <p className="text-sm text-zinc-500">Licencias y ausencias del período seleccionado</p>
        </div>

        {/* Filters */}
        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-end gap-4 px-6 py-4">
            {/* Period */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-500">Mes</label>
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                {MONTH_NAMES.map((name, i) => (
                  <option key={i + 1} value={i + 1}>{name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-500">Año</label>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {/* Employee filter */}
            <div className="flex flex-col gap-1 min-w-[200px]">
              <label className="text-xs font-medium text-zinc-500">Persona</label>
              <select
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                <option value="">Todos</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.first_name} {emp.last_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status filter */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-500">Estado</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                <option value="">Todos</option>
                <option value="approved">Aprobadas</option>
                <option value="pending_leader">Pend. Líder</option>
                <option value="pending_hr">Pend. HR</option>
                <option value="rejected_leader">Rechazadas Líder</option>
                <option value="rejected_hr">Rechazadas HR</option>
              </select>
            </div>

            {/* Spacer + Export */}
            <div className="ml-auto flex items-end">
              <button
                onClick={() => exportToExcel(novedades, year, month)}
                disabled={novedades.length === 0}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Exportar Excel
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
            <div>
              <h2 className="text-base font-semibold text-zinc-900">{periodLabel}</h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                {loading ? 'Cargando...' : `${novedades.length} novedad${novedades.length !== 1 ? 'es' : ''}`}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
            </div>
          ) : novedades.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-zinc-400">
              <svg className="mb-3 h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-sm font-medium">Sin novedades para este período</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    <th className="px-6 py-3">Empleado</th>
                    <th className="px-6 py-3">Tipo de licencia</th>
                    <th className="px-6 py-3">Fecha inicio</th>
                    <th className="px-6 py-3">Fecha fin</th>
                    <th className="px-6 py-3 text-center">Duración</th>
                    <th className="px-6 py-3">Estado</th>
                    <th className="px-6 py-3">Observaciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {novedades.map((n) => {
                    const obs = observations(n);
                    const isExpanded = expandedRow === n.id;
                    return (
                      <tr
                        key={n.id}
                        className="hover:bg-zinc-50 transition-colors"
                      >
                        <td className="px-6 py-3 font-medium text-zinc-900">{n.employee_name}</td>
                        <td className="px-6 py-3 text-zinc-600">{n.leave_type_name}</td>
                        <td className="px-6 py-3 text-zinc-600">{formatDateLocal(n.start_date)}</td>
                        <td className="px-6 py-3 text-zinc-600">{formatDateLocal(n.end_date)}</td>
                        <td className="px-6 py-3 text-center">
                          <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700">
                            {durationLabel(n)}
                          </span>
                        </td>
                        <td className="px-6 py-3">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[n.status] ?? 'bg-zinc-100 text-zinc-600'}`}>
                            {STATUS_LABELS[n.status] ?? n.status}
                          </span>
                        </td>
                        <td className="px-6 py-3 max-w-xs">
                          {obs ? (
                            <button
                              onClick={() => setExpandedRow(isExpanded ? null : n.id)}
                              className="flex items-start gap-1 text-left text-zinc-600 hover:text-zinc-900 transition-colors"
                            >
                              <span className={`text-xs leading-relaxed ${isExpanded ? '' : 'line-clamp-1'}`}>
                                {obs}
                              </span>
                              {obs.length > 60 && (
                                <svg className={`mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-zinc-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              )}
                            </button>
                          ) : (
                            <span className="text-xs text-zinc-300">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </TimeOffShell>
  );
}

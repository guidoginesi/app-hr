'use client';

import { useEffect, useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
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
  approved: 'bg-success-subtle text-[var(--green-700)]',
  pending_leader: 'bg-warning-subtle text-[var(--amber-600)]',
  pending_hr: 'bg-accent text-accent-foreground',
  rejected_leader: 'bg-danger-subtle text-[var(--red-600)]',
  rejected_hr: 'bg-danger-subtle text-[var(--red-600)]',
  rejected: 'bg-danger-subtle text-[var(--red-600)]',
  cancelled: 'bg-secondary text-muted-foreground',
  pending: 'bg-warning-subtle text-[var(--amber-600)]',
};

function exportToExcel(novedades: Novedad[], year: number, month: number) {
  const periodLabel = `${MONTH_NAMES[month - 1]} ${year}`;

  const rows = novedades.map((n) => ({
    Empleado: n.employee_name,
    'Tipo de licencia': n.leave_type_name,
    'Fecha inicio': formatDateLocal(n.start_date),
    'Fecha fin': formatDateLocal(n.end_date),
    Duración: n.count_type === 'weeks'
      ? `${n.days_requested} semana${n.days_requested !== 1 ? 's' : ''}`
      : `${n.days_requested} día${n.days_requested !== 1 ? 's' : ''}`,
    Estado: STATUS_LABELS[n.status] ?? n.status,
    Observaciones: [n.notes, n.rejection_reason, n.hr_rejection_reason, n.leader_rejection_reason]
      .filter(Boolean).join(' | '),
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, periodLabel);
  XLSX.writeFile(wb, `novedades-${year}-${String(month).padStart(2, '0')}.xlsx`);
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
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Novedades</h1>
          <p className="text-sm text-muted-foreground">Licencias y ausencias del período seleccionado</p>
        </div>

        {/* Filters */}
        <div className="rounded-xl border border-[var(--border)] bg-white shadow-sm">
          <div className="flex flex-wrap items-end gap-4 px-6 py-4">
            {/* Period */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Mes</label>
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-foreground shadow-sm focus:border-warning/30 focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {MONTH_NAMES.map((name, i) => (
                  <option key={i + 1} value={i + 1}>{name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Año</label>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-foreground shadow-sm focus:border-warning/30 focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {/* Employee filter */}
            <div className="flex flex-col gap-1 min-w-[200px]">
              <label className="text-xs font-medium text-muted-foreground">Persona</label>
              <select
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-foreground shadow-sm focus:border-warning/30 focus:outline-none focus:ring-1 focus:ring-ring"
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
              <label className="text-xs font-medium text-muted-foreground">Estado</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-foreground shadow-sm focus:border-warning/30 focus:outline-none focus:ring-1 focus:ring-ring"
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
                className="flex items-center gap-2 rounded-lg bg-success px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-success disabled:cursor-not-allowed disabled:opacity-40"
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
        <div className="rounded-xl border border-[var(--border)] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">{periodLabel}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {loading ? 'Cargando...' : `${novedades.length} novedad${novedades.length !== 1 ? 'es' : ''}`}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-warning/30 border-t-transparent" />
            </div>
          ) : novedades.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <svg className="mb-3 h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-sm font-medium">Sin novedades para este período</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-muted text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="px-6 py-3">Empleado</th>
                    <th className="px-6 py-3">Tipo de licencia</th>
                    <th className="px-6 py-3">Fecha inicio</th>
                    <th className="px-6 py-3">Fecha fin</th>
                    <th className="px-6 py-3 text-center">Duración</th>
                    <th className="px-6 py-3">Estado</th>
                    <th className="px-6 py-3">Observaciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {novedades.map((n) => {
                    const obs = observations(n);
                    const isExpanded = expandedRow === n.id;
                    return (
                      <tr
                        key={n.id}
                        className="hover:bg-muted transition-colors"
                      >
                        <td className="px-6 py-3 font-medium text-foreground">{n.employee_name}</td>
                        <td className="px-6 py-3 text-muted-foreground">{n.leave_type_name}</td>
                        <td className="px-6 py-3 text-muted-foreground">{formatDateLocal(n.start_date)}</td>
                        <td className="px-6 py-3 text-muted-foreground">{formatDateLocal(n.end_date)}</td>
                        <td className="px-6 py-3 text-center">
                          <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                            {durationLabel(n)}
                          </span>
                        </td>
                        <td className="px-6 py-3">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[n.status] ?? 'bg-secondary text-muted-foreground'}`}>
                            {STATUS_LABELS[n.status] ?? n.status}
                          </span>
                        </td>
                        <td className="px-6 py-3 max-w-xs">
                          {obs ? (
                            <button
                              onClick={() => setExpandedRow(isExpanded ? null : n.id)}
                              className="flex items-start gap-1 text-left text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <span className={`text-xs leading-relaxed ${isExpanded ? '' : 'line-clamp-1'}`}>
                                {obs}
                              </span>
                              {obs.length > 60 && (
                                <svg className={`mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              )}
                            </button>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
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

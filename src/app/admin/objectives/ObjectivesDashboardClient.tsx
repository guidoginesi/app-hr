'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { X, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@pow/ui/components/ui/button';
import { SelectMenu } from '@pow/ui/components/ui/select-menu';
import { Sheet, SheetContent, SheetClose } from '@pow/ui/components/ui/sheet';
import {
  CorporateObjective,
  EmployeeObjectivesStatus,
  ObjectivesDashboardStats,
  getSeniorityShortLabel,
  getSeniorityCategory,
  SENIORITY_CATEGORY_COLORS,
  SENIORITY_CATEGORY_LABELS,
  SeniorityCategory,
} from '@/types/corporate-objectives';

type Department = { id: string; name: string };

type ObjectivesDashboardClientProps = {
  initialEmployees: EmployeeObjectivesStatus[];
  initialStats: ObjectivesDashboardStats;
  departments: Department[];
  corporateObjectives: CorporateObjective[];
  currentYear: number;
};

// ─── Modal types ────────────────────────────────────────────────────────────

type SubObjective = {
  id: string;
  sub_objective_number: number | null;
  title: string;
  progress_percentage: number;
  achievement_percentage: number | null;
  is_locked: boolean;
  status: string;
};

type AreaObjective = {
  id: string;
  objective_number: number | null;
  title: string;
  description: string | null;
  periodicity: string;
  weight_pct: number;
  progress_percentage: number;
  achievement_percentage: number | null;
  is_locked: boolean;
  status: string;
  created_by_employee: { first_name: string; last_name: string } | null;
  // sub-objectives come from a separate pass
  sub_objectives?: SubObjective[];
};

type ModalData = {
  employee: { id: string; first_name: string; last_name: string; job_title: string | null; department_name: string | null };
  area_objectives: AreaObjective[];
  year: number;
};

// ─── Helper: effective progress for a single row ─────────────────────────────
function effectiveProgress(obj: { progress_percentage: number; achievement_percentage: number | null; is_locked: boolean }): number {
  if (obj.is_locked || obj.achievement_percentage != null) return obj.achievement_percentage ?? 0;
  return obj.progress_percentage;
}

function objectiveProgress(obj: AreaObjective): number {
  if (obj.periodicity !== 'annual' && obj.sub_objectives && obj.sub_objectives.length > 0) {
    const total = obj.sub_objectives.reduce((s, sub) => s + effectiveProgress(sub), 0);
    return Math.round(total / obj.sub_objectives.length);
  }
  return effectiveProgress(obj);
}

const PERIODICITY_LABEL: Record<string, string> = {
  annual: 'Anual',
  semestral: 'Semestral',
  trimestral: 'Trimestral',
};

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  not_started: { label: 'Sin iniciar', cls: 'bg-secondary text-muted-foreground' },
  in_progress: { label: 'En progreso', cls: 'bg-accent text-accent-foreground' },
  completed: { label: 'Completado', cls: 'bg-success-subtle text-[var(--green-700)]' },
};

// ─── Modal component ─────────────────────────────────────────────────────────

function ObjectivesModal({
  employeeId,
  employeeName,
  year,
  onClose,
}: {
  employeeId: string;
  employeeName: string;
  year: number;
  onClose: () => void;
}) {
  const [data, setData] = useState<ModalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchObjectives = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/objectives/${employeeId}?year=${year}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `Error ${res.status} al cargar objetivos`);

      // Attach sub-objectives to each main objective
      const mainObjs: AreaObjective[] = (json.area_objectives || []).filter(
        (o: any) => o.parent_objective_id == null
      );
      const subObjs: SubObjective[] = (json.area_objectives || []).filter(
        (o: any) => o.parent_objective_id != null
      );

      const populated = mainObjs.map((obj) => ({
        ...obj,
        sub_objectives: subObjs.filter((s: any) => s.parent_objective_id === obj.id),
      }));

      setData({ employee: json.employee, area_objectives: populated, year: json.year });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [employeeId, year]);

  useEffect(() => {
    fetchObjectives();
  }, [fetchObjectives]);

  return (
    <Sheet open onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" flush title={`Objetivos de ${employeeName}`} className="max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">{employeeName}</h2>
            <p className="text-xs text-muted-foreground">Objetivos personales · {year}</p>
          </div>
          <SheetClose
            aria-label="Cerrar"
            className="-mr-1.5 grid h-8 w-8 place-items-center rounded-[var(--radius)] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-5 w-5" />
          </SheetClose>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-danger-subtle px-4 py-3 text-sm text-[var(--red-600)]">{error}</div>
          )}

          {!loading && !error && data && (
            <>
              {data.area_objectives.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[var(--border)] py-10 text-center">
                  <p className="text-sm text-muted-foreground">Sin objetivos cargados para {year}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {data.area_objectives.map((obj, idx) => {
                    const pct = objectiveProgress(obj);
                    const isEvaluated = obj.is_locked || obj.achievement_percentage != null;
                    const badgeInfo = STATUS_BADGE[obj.status] ?? { label: obj.status, cls: 'bg-secondary text-muted-foreground' };

                    return (
                      <div key={obj.id} className="rounded-xl border border-[var(--border)] bg-muted p-4">
                        {/* Objective header */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground">
                              {idx + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground leading-snug">{obj.title}</p>
                              {obj.description && (
                                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{obj.description}</p>
                              )}
                            </div>
                          </div>
                          <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badgeInfo.cls}`}>
                            {badgeInfo.label}
                          </span>
                        </div>

                        {/* Tags row */}
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className="rounded bg-white border border-[var(--border)] px-2 py-0.5">
                            {PERIODICITY_LABEL[obj.periodicity] ?? obj.periodicity}
                          </span>
                          <span className="rounded bg-white border border-[var(--border)] px-2 py-0.5">
                            Peso {obj.weight_pct}%
                          </span>
                          {isEvaluated && (
                            <span className="rounded bg-cat-violet-subtle border border-cat-violet/20 px-2 py-0.5 text-cat-violet font-medium">
                              Evaluado
                            </span>
                          )}
                          {obj.created_by_employee && (
                            <span className="text-muted-foreground">
                              Cargado por {obj.created_by_employee.first_name} {obj.created_by_employee.last_name}
                            </span>
                          )}
                        </div>

                        {/* Progress bar */}
                        <div className="mt-3 flex items-center gap-3">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-accent">
                            <div
                              className="h-full rounded-full bg-brand transition-all duration-500"
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </div>
                          <span className="w-10 shrink-0 text-right text-xs font-semibold text-foreground tabular-nums">
                            {pct}%
                          </span>
                        </div>

                        {/* Sub-objectives */}
                        {obj.sub_objectives && obj.sub_objectives.length > 0 && (
                          <div className="mt-3 space-y-2 pl-2 border-l-2 border-[var(--border)]">
                            {obj.sub_objectives
                              .sort((a, b) => (a.sub_objective_number ?? 0) - (b.sub_objective_number ?? 0))
                              .map((sub) => {
                                const subPct = effectiveProgress(sub);
                                const subEval = sub.is_locked || sub.achievement_percentage != null;
                                return (
                                  <div key={sub.id} className="flex items-center gap-3 rounded-lg bg-white px-3 py-2">
                                    <span className="shrink-0 text-xs text-muted-foreground">#{sub.sub_objective_number}</span>
                                    <span className="min-w-0 flex-1 truncate text-xs text-secondary-foreground">{sub.title}</span>
                                    {subEval && (
                                      <span className="shrink-0 text-xs text-cat-violet font-medium">eval.</span>
                                    )}
                                    <div className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-accent">
                                      <div
                                        className="h-full rounded-full bg-brand transition-all duration-500"
                                        style={{ width: `${Math.min(subPct, 100)}%` }}
                                      />
                                    </div>
                                    <span className="w-8 shrink-0 text-right text-xs font-medium text-muted-foreground tabular-nums">
                                      {subPct}%
                                    </span>
                                  </div>
                                );
                              })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Main dashboard ───────────────────────────────────────────────────────────

export function ObjectivesDashboardClient({
  initialEmployees,
  initialStats,
  departments,
  corporateObjectives,
  currentYear,
}: ObjectivesDashboardClientProps) {
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [selectedSeniority, setSelectedSeniority] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'complete' | 'partial' | 'none'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [modalEmployee, setModalEmployee] = useState<{ id: string; name: string } | null>(null);
  const router = useRouter();

  const handleYearChange = (year: number) => {
    router.push(`/admin/objectives?year=${year}`);
  };

  const handleRefresh = () => router.refresh();

  // Filter employees
  const filteredEmployees = useMemo(() => {
    return initialEmployees.filter((emp) => {
      if (selectedDepartment && emp.department_name !== selectedDepartment) return false;

      if (selectedSeniority) {
        const empCategory = getSeniorityCategory(emp.seniority_level);
        if (empCategory?.toString() !== selectedSeniority) return false;
      }

      if (statusFilter === 'complete' && !emp.has_all_objectives) return false;
      if (statusFilter === 'partial' && (emp.has_all_objectives || emp.area_objectives_count === 0)) return false;
      if (statusFilter === 'none' && emp.area_objectives_count > 0) return false;

      if (searchQuery) {
        const fullName = `${emp.first_name} ${emp.last_name}`.toLowerCase();
        if (!fullName.includes(searchQuery.toLowerCase())) return false;
      }

      return true;
    });
  }, [initialEmployees, selectedDepartment, selectedSeniority, statusFilter, searchQuery]);

  const years = [currentYear + 1, currentYear, currentYear - 1];

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-end gap-3">
        <Button variant="outline" onClick={handleRefresh}>
          Actualizar
        </Button>
        <SelectMenu
          ariaLabel="Filtrar por año"
          value={String(currentYear)}
          onChange={(v) => handleYearChange(Number(v))}
          options={years.map((year) => ({ value: String(year), label: String(year) }))}
        />
      </div>

      {/* Corporate Objectives Status */}
      {(!initialStats.has_billing || initialStats.nps_count === 0) && (
        <div className="rounded-lg border border-warning/30 bg-warning-subtle px-4 py-3">
          <div className="flex items-center gap-3">
            <svg className="h-5 w-5 text-[var(--amber-600)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-[var(--amber-600)]">
                {!initialStats.has_billing && !initialStats.nps_count
                  ? 'Objetivos corporativos no configurados'
                  : !initialStats.has_billing
                  ? 'Facturación no configurada'
                  : `NPS: ${initialStats.nps_count}/4 trimestres configurados`}
              </p>
              <p className="text-sm text-[var(--amber-600)]">
                <Link href="/admin/objectives/config" className="underline hover:text-[var(--amber-600)]">
                  Configurar objetivos corporativos
                </Link>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-[var(--border)] bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
              <svg className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{initialStats.total_employees}</p>
              <p className="text-sm text-muted-foreground">Total empleados</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success-subtle">
              <svg className="h-5 w-5 text-[var(--green-700)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--green-700)]">{initialStats.with_complete_objectives}</p>
              <p className="text-sm text-muted-foreground">Objetivos completos</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning-subtle">
              <svg className="h-5 w-5 text-[var(--amber-600)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--amber-600)]">{initialStats.with_partial_objectives}</p>
              <p className="text-sm text-muted-foreground">Objetivos parciales</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-danger-subtle">
              <svg className="h-5 w-5 text-[var(--red-600)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--red-600)]">{initialStats.without_objectives}</p>
              <p className="text-sm text-muted-foreground">Sin objetivos personales</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Buscar empleado..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-white py-2 pl-10 pr-4 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <SelectMenu
          ariaLabel="Filtrar por departamento"
          value={selectedDepartment}
          onChange={(v) => setSelectedDepartment(v)}
          options={[
            { value: '', label: 'Todos los departamentos' },
            ...departments.map((dept) => ({ value: dept.name, label: dept.name })),
          ]}
        />

        <SelectMenu
          ariaLabel="Filtrar por nivel"
          value={selectedSeniority}
          onChange={(v) => setSelectedSeniority(v)}
          options={[
            { value: '', label: 'Todos los niveles' },
            ...([1, 2, 3, 4, 5] as SeniorityCategory[]).map((cat) => ({
              value: String(cat),
              label: SENIORITY_CATEGORY_LABELS[cat],
            })),
          ]}
        />

        <SelectMenu
          ariaLabel="Filtrar por estado"
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as any)}
          options={[
            { value: 'all', label: 'Todos los estados' },
            { value: 'complete', label: 'Completos (4/4)' },
            { value: 'partial', label: 'Parciales' },
            { value: 'none', label: 'Sin objetivos personales' },
          ]}
        />
      </div>

      {/* Employees Table */}
      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[var(--border)]">
            <thead className="bg-muted">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Empleado</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Departamento</th>
                <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">Seniority</th>
                <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">FC</th>
                <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">NPS</th>
                <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">Área</th>
                <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">Progreso</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] bg-white">
              {filteredEmployees.map((emp) => (
                <tr key={emp.id} className="hover:bg-muted">
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-sm font-medium text-secondary-foreground">
                        {emp.first_name[0]}{emp.last_name[0]}
                      </div>
                      <span className="text-sm font-medium text-foreground">
                        {emp.first_name} {emp.last_name}
                      </span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
                    {emp.department_name || '-'}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-center">
                    {emp.seniority_level ? (
                      (() => {
                        const category = getSeniorityCategory(emp.seniority_level);
                        const colors = category ? SENIORITY_CATEGORY_COLORS[category] : { bg: 'bg-secondary', text: 'text-secondary-foreground' };
                        return (
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors.bg} ${colors.text}`}>
                            {getSeniorityShortLabel(emp.seniority_level)}
                          </span>
                        );
                      })()
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-center">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      emp.has_billing ? 'bg-success-subtle text-[var(--green-700)]' : 'bg-secondary text-muted-foreground'
                    }`}>
                      {emp.has_billing ? '1/1' : '0/1'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-center">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      emp.nps_count === 4
                        ? 'bg-accent text-accent-foreground'
                        : emp.nps_count > 0
                        ? 'bg-warning-subtle text-[var(--amber-600)]'
                        : 'bg-secondary text-muted-foreground'
                    }`}>
                      {emp.nps_count}/4
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-center">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      emp.area_objectives_count >= 2
                        ? 'bg-success-subtle text-[var(--green-700)]'
                        : emp.area_objectives_count > 0
                        ? 'bg-warning-subtle text-[var(--amber-600)]'
                        : 'bg-danger-subtle text-[var(--red-600)]'
                    }`}>
                      {emp.area_objectives_count}/2
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-center">
                    {emp.total_progress !== null ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="h-2 w-16 overflow-hidden rounded-full bg-accent">
                          <div
                            className="h-full rounded-full bg-brand transition-all duration-500"
                            style={{ width: `${Math.min(emp.total_progress, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-muted-foreground tabular-nums">{emp.total_progress}%</span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setModalEmployee({ id: emp.id, name: `${emp.first_name} ${emp.last_name}` })}
                    >
                      Ver
                    </Button>
                  </td>
                </tr>
              ))}
              {filteredEmployees.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-sm text-muted-foreground">
                    No se encontraron empleados con los filtros seleccionados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Objectives Modal */}
      {modalEmployee && (
        <ObjectivesModal
          employeeId={modalEmployee.id}
          employeeName={modalEmployee.name}
          year={currentYear}
          onClose={() => setModalEmployee(null)}
        />
      )}
    </div>
  );
}

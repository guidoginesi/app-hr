'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@pow/ui/components/ui/button';
import { SelectMenu } from '@pow/ui/components/ui/select-menu';
import { SegmentedControl } from '@pow/ui/components/ui/segmented-control';
import { Sheet, SheetContent, SheetClose } from '@pow/ui/components/ui/sheet';
import { SENIORITY_LEVELS, getSeniorityLabel } from '@/types/corporate-objectives';

type EmployeeInfo = {
  id: string;
  first_name: string;
  last_name: string;
  job_title: string | null;
  seniority_level: string | null;
  department: { id: string; name: string } | null;
};

type PeriodInfo = {
  id: string;
  name: string;
  year: number;
};

type Recategorization = {
  id: string;
  evaluation_id: string | null;
  employee_id: string | null;
  period_id: string | null;
  level_recategorization: 'approved' | 'not_approved' | null;
  position_recategorization: 'approved' | 'not_approved' | null;
  recommended_level: string | null;
  notes: string | null;
  hr_status: 'pending' | 'approved' | 'rejected' | null;
  hr_notes: string | null;
  created_at: string;
  updated_at: string;
  // Direct joins (populated even without an evaluation)
  employee: EmployeeInfo | null;
  period_info: PeriodInfo | null;
  // Evaluation join — null for note-only records
  evaluation: {
    id: string;
    period_id: string;
    employee_id: string;
    evaluator_id: string;
    type: string;
    status: string;
    total_score: number | null;
    employee: EmployeeInfo;
    evaluator: { id: string; first_name: string; last_name: string };
    period: PeriodInfo;
  } | null;
};

type Period = {
  id: string;
  name: string;
  year: number;
};

type RecategorizationsClientProps = {
  recategorizations: Recategorization[];
  periods: Period[];
};

export function RecategorizationsClient({ recategorizations: initialRecategorizations, periods }: RecategorizationsClientProps) {
  const [recategorizations, setRecategorizations] = useState(initialRecategorizations);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [periodFilter, setPeriodFilter] = useState<string>('all');
  const [selectedRecat, setSelectedRecat] = useState<Recategorization | null>(null);
  const [hrNotes, setHrNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // A record is visible once the leader has saved any decision (both fields are set)
  const hasMadeDecision = (r: Recategorization) =>
    r.level_recategorization !== null && r.position_recategorization !== null;

  // "No aplica": leader explicitly closed it because the employee didn't qualify
  const isNotApplicable = (r: Recategorization) =>
    r.level_recategorization === 'not_approved' && r.position_recategorization === 'not_approved';

  // Resolve employee and period from either the linked evaluation or the direct joins
  const getEmployee = (r: Recategorization): EmployeeInfo | null =>
    r.evaluation?.employee ?? r.employee ?? null;

  const getPeriod = (r: Recategorization): PeriodInfo | null =>
    r.evaluation?.period ?? r.period_info ?? null;

  // Effective HR status: isNotApplicable records are always treated as 'rejected'
  const effectiveHrStatus = (r: Recategorization) =>
    isNotApplicable(r) ? 'rejected' : (r.hr_status || 'pending');

  // Filter recategorizations
  const filteredRecategorizations = recategorizations.filter(r => {
    if (!hasMadeDecision(r)) return false;

    // Filter by HR status
    if (filter !== 'all') {
      if (effectiveHrStatus(r) !== filter) return false;
    }

    // Filter by period (check both the evaluation period and the direct period_info)
    if (periodFilter !== 'all') {
      const periodId = getPeriod(r)?.id;
      if (periodId !== periodFilter) return false;
    }

    return true;
  });

  const handleApprove = async (recat: Recategorization) => {
    setIsProcessing(true);
    try {
      const res = await fetch(`/api/admin/recategorizations/${recat.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hr_status: 'approved',
          hr_notes: hrNotes,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setRecategorizations(prev => prev.map(r => r.id === recat.id ? { ...r, ...updated } : r));
        setSelectedRecat(null);
        setHrNotes('');
      }
    } catch (error) {
      console.error('Error approving recategorization:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async (recat: Recategorization) => {
    setIsProcessing(true);
    try {
      const res = await fetch(`/api/admin/recategorizations/${recat.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hr_status: 'rejected',
          hr_notes: hrNotes,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setRecategorizations(prev => prev.map(r => r.id === recat.id ? { ...r, ...updated } : r));
        setSelectedRecat(null);
        setHrNotes('');
      }
    } catch (error) {
      console.error('Error rejecting recategorization:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusBadge = (recat: Recategorization) => {
    if (isNotApplicable(recat)) {
      return <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-muted-foreground">No aplica</span>;
    }
    switch (recat.hr_status) {
      case 'approved':
        return <span className="inline-flex items-center rounded-full bg-success-subtle px-2.5 py-0.5 text-xs font-medium text-[var(--green-700)]">Aprobado por HR</span>;
      case 'rejected':
        return <span className="inline-flex items-center rounded-full bg-danger-subtle px-2.5 py-0.5 text-xs font-medium text-[var(--red-600)]">Rechazado por HR</span>;
      default:
        return <span className="inline-flex items-center rounded-full bg-warning-subtle px-2.5 py-0.5 text-xs font-medium text-[var(--amber-600)]">Pendiente de HR</span>;
    }
  };

  const getLeaderDecision = (recat: Recategorization) => {
    if (isNotApplicable(recat)) return 'No aplica';
    const decisions = [];
    if (recat.level_recategorization === 'approved') {
      decisions.push('Dentro del nivel');
    }
    if (recat.position_recategorization === 'approved') {
      decisions.push('Ascenso de nivel');
    }
    return decisions.join(' + ') || 'Sin cambios';
  };

  const pendingCount = recategorizations.filter(r =>
    hasMadeDecision(r) &&
    !isNotApplicable(r) &&
    (!r.hr_status || r.hr_status === 'pending')
  ).length;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Estado:</span>
          <SegmentedControl<typeof filter>
            aria-label="Filtrar por estado"
            value={filter}
            onChange={(v) => setFilter(v)}
            options={[
              {
                value: 'pending',
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    Pendientes
                    {pendingCount > 0 && (
                      <span className="rounded-full bg-warning-subtle px-1.5 py-0.5 text-xs font-medium text-[var(--amber-600)] tabular-nums">
                        {pendingCount}
                      </span>
                    )}
                  </span>
                ),
              },
              { value: 'approved', label: 'Aprobadas' },
              { value: 'rejected', label: 'Rechazadas' },
              { value: 'all', label: 'Todas' },
            ]}
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Período:</span>
          <SelectMenu
            ariaLabel="Filtrar por período"
            value={periodFilter}
            onChange={(v) => setPeriodFilter(v)}
            options={[
              { value: 'all', label: 'Todos los períodos' },
              ...periods.map((p) => ({ value: p.id, label: `${p.name} (${p.year})` })),
            ]}
          />
        </div>
      </div>

      {/* List */}
      {filteredRecategorizations.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-white p-12 text-center">
          <svg className="mx-auto h-12 w-12 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="mt-4 text-sm text-muted-foreground">
            {filter === 'pending' 
              ? 'No hay recategorizaciones pendientes de aprobación'
              : 'No se encontraron recategorizaciones con los filtros seleccionados'
            }
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--border)] bg-white shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-[var(--border)]">
            <thead className="bg-muted">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Empleado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Propuesto por
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Nivel actual
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Propuesta
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Nivel recomendado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Estado HR
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-[var(--border)]">
              {filteredRecategorizations.map((recat) => {
                const emp = getEmployee(recat);
                const period = getPeriod(recat);
                return (
                <tr key={recat.id} className="hover:bg-muted">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {emp?.first_name} {emp?.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {emp?.job_title || 'Sin puesto'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {emp?.department?.name || 'Sin departamento'}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <p className="text-sm text-secondary-foreground">
                      {recat.evaluation?.evaluator
                        ? `${recat.evaluation.evaluator.first_name} ${recat.evaluation.evaluator.last_name}`
                        : <span className="text-muted-foreground italic">Sin evaluación</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {period?.name}
                    </p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-secondary-foreground">
                      {emp?.seniority_level 
                        ? getSeniorityLabel(emp.seniority_level)
                        : 'Sin nivel'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-medium text-foreground">
                      {getLeaderDecision(recat)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-secondary-foreground">
                      {recat.recommended_level 
                        ? getSeniorityLabel(recat.recommended_level)
                        : '-'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(recat)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    {!isNotApplicable(recat) && (!recat.hr_status || recat.hr_status === 'pending') && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedRecat(recat);
                          setHrNotes('');
                        }}
                      >
                        Revisar
                      </Button>
                    )}
                    {(isNotApplicable(recat) || (recat.hr_status && recat.hr_status !== 'pending')) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedRecat(recat);
                          setHrNotes(recat.hr_notes || '');
                        }}
                      >
                        Ver detalle
                      </Button>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Review Sheet */}
      {selectedRecat && (
        <Sheet open onOpenChange={(o) => { if (!o) setSelectedRecat(null); }}>
          <SheetContent
            side="right"
            flush
            title={isNotApplicable(selectedRecat) ? 'No aplica recategorización' : 'Revisar recategorización'}
            className="max-w-lg"
          >
              <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
                <h2 className="type-title">
                  {selectedRecat && isNotApplicable(selectedRecat)
                    ? 'No aplica recategorización'
                    : 'Revisar recategorización'}
                </h2>
                <SheetClose
                  aria-label="Cerrar"
                  className="-mr-1.5 grid h-8 w-8 place-items-center rounded-[var(--radius)] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="h-5 w-5" />
                </SheetClose>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto p-6">
                {/* Employee Info */}
                <div className="rounded-lg bg-muted p-4">
                  <h3 className="text-sm font-medium text-secondary-foreground mb-2">Empleado</h3>
                  <p className="text-base font-semibold text-foreground">
                    {getEmployee(selectedRecat)?.first_name} {getEmployee(selectedRecat)?.last_name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {getEmployee(selectedRecat)?.job_title || 'Sin puesto'} • {getEmployee(selectedRecat)?.department?.name || 'Sin departamento'}
                  </p>
                  {!selectedRecat.evaluation_id && (
                    <p className="mt-1 text-xs text-[var(--amber-600)] font-medium">Nota sin evaluación vinculada</p>
                  )}
                </div>

                {/* Current Level */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Nivel actual</p>
                    <p className="text-sm font-medium text-foreground">
                      {getEmployee(selectedRecat)?.seniority_level 
                        ? getSeniorityLabel(getEmployee(selectedRecat)!.seniority_level!)
                        : 'Sin nivel'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Nivel recomendado</p>
                    <p className="text-sm font-medium text-foreground">
                      {selectedRecat.recommended_level
                        ? getSeniorityLabel(selectedRecat.recommended_level)
                        : '-'}
                    </p>
                  </div>
                </div>

                {/* Leader Decision */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Decisión del líder</p>
                  <div className="flex gap-2">
                    {isNotApplicable(selectedRecat) ? (
                      <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                        No aplica
                      </span>
                    ) : (
                      <>
                        {selectedRecat.level_recategorization === 'approved' && (
                          <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">
                            Dentro del nivel
                          </span>
                        )}
                        {selectedRecat.position_recategorization === 'approved' && (
                          <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">
                            Ascenso de nivel
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Leader Notes */}
                {selectedRecat.notes && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Notas del líder</p>
                    <p className="text-sm text-secondary-foreground bg-muted rounded-lg p-3">
                      {selectedRecat.notes}
                    </p>
                  </div>
                )}

                {/* HR Notes — only shown when HR action is needed */}
                {!isNotApplicable(selectedRecat) && (
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">
                      Notas de HR {(!selectedRecat.hr_status || selectedRecat.hr_status === 'pending') && '(opcional)'}
                    </label>
                    {(!selectedRecat.hr_status || selectedRecat.hr_status === 'pending') ? (
                      <textarea
                        value={hrNotes}
                        onChange={(e) => setHrNotes(e.target.value)}
                        placeholder="Agregar comentarios..."
                        rows={3}
                        className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    ) : (
                      <p className="text-sm text-secondary-foreground bg-muted rounded-lg p-3">
                        {selectedRecat.hr_notes || 'Sin notas'}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 border-t border-[var(--border)] p-4">
                <Button
                  variant="outline"
                  onClick={() => setSelectedRecat(null)}
                >
                  {(!isNotApplicable(selectedRecat) && (!selectedRecat.hr_status || selectedRecat.hr_status === 'pending'))
                    ? 'Cancelar'
                    : 'Cerrar'}
                </Button>
                {!isNotApplicable(selectedRecat) && (!selectedRecat.hr_status || selectedRecat.hr_status === 'pending') && (
                  <>
                    <Button
                      variant="outline"
                      className="border-danger/30 text-[var(--red-600)] hover:bg-danger-subtle"
                      onClick={() => handleReject(selectedRecat)}
                      loading={isProcessing}
                    >
                      Rechazar
                    </Button>
                    <Button
                      onClick={() => handleApprove(selectedRecat)}
                      loading={isProcessing}
                    >
                      Aprobar
                    </Button>
                  </>
                )}
              </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { SENIORITY_LEVELS, getSeniorityLabel } from '@/types/corporate-objectives';

type Recategorization = {
  id: string;
  evaluation_id: string;
  level_recategorization: 'approved' | 'not_approved' | null;
  position_recategorization: 'approved' | 'not_approved' | null;
  recommended_level: string | null;
  notes: string | null;
  hr_status: 'pending' | 'approved' | 'rejected' | null;
  hr_notes: string | null;
  created_at: string;
  updated_at: string;
  evaluation: {
    id: string;
    period_id: string;
    employee_id: string;
    evaluator_id: string;
    type: string;
    status: string;
    total_score: number | null;
    employee: {
      id: string;
      first_name: string;
      last_name: string;
      job_title: string | null;
      seniority_level: string | null;
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

  // Filter recategorizations
  const filteredRecategorizations = recategorizations.filter(r => {
    // Only show recategorizations where leader approved something
    const hasApproval = r.level_recategorization === 'approved' || r.position_recategorization === 'approved';
    if (!hasApproval) return false;

    // Filter by HR status
    if (filter !== 'all') {
      const hrStatus = r.hr_status || 'pending';
      if (hrStatus !== filter) return false;
    }

    // Filter by period
    if (periodFilter !== 'all' && r.evaluation?.period?.id !== periodFilter) {
      return false;
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

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'approved':
        return <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">Aprobado por HR</span>;
      case 'rejected':
        return <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">Rechazado por HR</span>;
      default:
        return <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">Pendiente de HR</span>;
    }
  };

  const getLeaderDecision = (recat: Recategorization) => {
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
    (r.level_recategorization === 'approved' || r.position_recategorization === 'approved') && 
    (!r.hr_status || r.hr_status === 'pending')
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Recategorizaciones</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Revisión y aprobación de propuestas de recategorización de líderes
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-500">Estado:</span>
          <div className="flex rounded-lg border border-zinc-200 bg-white p-1">
            {[
              { value: 'pending', label: 'Pendientes', count: pendingCount },
              { value: 'approved', label: 'Aprobadas' },
              { value: 'rejected', label: 'Rechazadas' },
              { value: 'all', label: 'Todas' },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setFilter(option.value as typeof filter)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  filter === option.value
                    ? 'bg-purple-600 text-white'
                    : 'text-zinc-600 hover:bg-zinc-100'
                }`}
              >
                {option.label}
                {option.count !== undefined && option.count > 0 && (
                  <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 py-0.5 text-xs text-white">
                    {option.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-500">Período:</span>
          <select
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
          >
            <option value="all">Todos los períodos</option>
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.year})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* List */}
      {filteredRecategorizations.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center">
          <svg className="mx-auto h-12 w-12 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="mt-4 text-sm text-zinc-500">
            {filter === 'pending' 
              ? 'No hay recategorizaciones pendientes de aprobación'
              : 'No se encontraron recategorizaciones con los filtros seleccionados'
            }
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-zinc-200">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Empleado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Propuesto por
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Nivel actual
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Propuesta
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Nivel recomendado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Estado HR
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-zinc-200">
              {filteredRecategorizations.map((recat) => (
                <tr key={recat.id} className="hover:bg-zinc-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <p className="text-sm font-medium text-zinc-900">
                        {recat.evaluation?.employee?.first_name} {recat.evaluation?.employee?.last_name}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {recat.evaluation?.employee?.job_title || 'Sin puesto'}
                      </p>
                      <p className="text-xs text-zinc-400">
                        {recat.evaluation?.employee?.department?.name || 'Sin departamento'}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <p className="text-sm text-zinc-700">
                      {recat.evaluation?.evaluator?.first_name} {recat.evaluation?.evaluator?.last_name}
                    </p>
                    <p className="text-xs text-zinc-400">
                      {recat.evaluation?.period?.name}
                    </p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-zinc-700">
                      {recat.evaluation?.employee?.seniority_level 
                        ? getSeniorityLabel(recat.evaluation.employee.seniority_level)
                        : 'Sin nivel'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-medium text-purple-600">
                      {getLeaderDecision(recat)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-zinc-700">
                      {recat.recommended_level 
                        ? getSeniorityLabel(recat.recommended_level)
                        : '-'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(recat.hr_status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    {(!recat.hr_status || recat.hr_status === 'pending') && (
                      <button
                        onClick={() => {
                          setSelectedRecat(recat);
                          setHrNotes('');
                        }}
                        className="text-sm font-medium text-purple-600 hover:text-purple-700"
                      >
                        Revisar
                      </button>
                    )}
                    {recat.hr_status && recat.hr_status !== 'pending' && (
                      <button
                        onClick={() => {
                          setSelectedRecat(recat);
                          setHrNotes(recat.hr_notes || '');
                        }}
                        className="text-sm font-medium text-zinc-500 hover:text-zinc-700"
                      >
                        Ver detalle
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {selectedRecat && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={() => setSelectedRecat(null)} />

            <div className="relative w-full max-w-lg rounded-xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
                <h2 className="text-lg font-semibold text-zinc-900">
                  Revisar Recategorización
                </h2>
                <button
                  onClick={() => setSelectedRecat(null)}
                  className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-6 space-y-4">
                {/* Employee Info */}
                <div className="rounded-lg bg-zinc-50 p-4">
                  <h3 className="text-sm font-medium text-zinc-700 mb-2">Empleado</h3>
                  <p className="text-base font-semibold text-zinc-900">
                    {selectedRecat.evaluation?.employee?.first_name} {selectedRecat.evaluation?.employee?.last_name}
                  </p>
                  <p className="text-sm text-zinc-500">
                    {selectedRecat.evaluation?.employee?.job_title || 'Sin puesto'} • {selectedRecat.evaluation?.employee?.department?.name || 'Sin departamento'}
                  </p>
                </div>

                {/* Current Level */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-zinc-500 mb-1">Nivel actual</p>
                    <p className="text-sm font-medium text-zinc-900">
                      {selectedRecat.evaluation?.employee?.seniority_level 
                        ? getSeniorityLabel(selectedRecat.evaluation.employee.seniority_level)
                        : 'Sin nivel'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 mb-1">Nivel recomendado</p>
                    <p className="text-sm font-medium text-purple-600">
                      {selectedRecat.recommended_level 
                        ? getSeniorityLabel(selectedRecat.recommended_level)
                        : '-'}
                    </p>
                  </div>
                </div>

                {/* Leader Decision */}
                <div>
                  <p className="text-xs text-zinc-500 mb-1">Propuesta del líder</p>
                  <div className="flex gap-2">
                    {selectedRecat.level_recategorization === 'approved' && (
                      <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700">
                        Dentro del nivel
                      </span>
                    )}
                    {selectedRecat.position_recategorization === 'approved' && (
                      <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700">
                        Ascenso de nivel
                      </span>
                    )}
                  </div>
                </div>

                {/* Leader Notes */}
                {selectedRecat.notes && (
                  <div>
                    <p className="text-xs text-zinc-500 mb-1">Notas del líder</p>
                    <p className="text-sm text-zinc-700 bg-zinc-50 rounded-lg p-3">
                      {selectedRecat.notes}
                    </p>
                  </div>
                )}

                {/* HR Notes */}
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">
                    Notas de HR {(!selectedRecat.hr_status || selectedRecat.hr_status === 'pending') && '(opcional)'}
                  </label>
                  {(!selectedRecat.hr_status || selectedRecat.hr_status === 'pending') ? (
                    <textarea
                      value={hrNotes}
                      onChange={(e) => setHrNotes(e.target.value)}
                      placeholder="Agregar comentarios..."
                      rows={3}
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    />
                  ) : (
                    <p className="text-sm text-zinc-700 bg-zinc-50 rounded-lg p-3">
                      {selectedRecat.hr_notes || 'Sin notas'}
                    </p>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 border-t border-zinc-200 px-6 py-4">
                <button
                  onClick={() => setSelectedRecat(null)}
                  className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  {(!selectedRecat.hr_status || selectedRecat.hr_status === 'pending') ? 'Cancelar' : 'Cerrar'}
                </button>
                {(!selectedRecat.hr_status || selectedRecat.hr_status === 'pending') && (
                  <>
                    <button
                      onClick={() => handleReject(selectedRecat)}
                      disabled={isProcessing}
                      className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      {isProcessing ? 'Procesando...' : 'Rechazar'}
                    </button>
                    <button
                      onClick={() => handleApprove(selectedRecat)}
                      disabled={isProcessing}
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {isProcessing ? 'Procesando...' : 'Aprobar'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { LeaveRequestWithDetails, LeaveRequestStatus } from '@/types/time-off';
import { LEAVE_STATUS_LABELS, LEAVE_STATUS_COLORS } from '@/types/time-off';
import { formatDateLocal } from '@/lib/dateUtils';

export default function TeamTimeOffPage() {
  const [requests, setRequests] = useState<LeaveRequestWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('pending_leader');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    fetchRequests();
  }, [statusFilter]);

  async function fetchRequests() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);

      const res = await fetch(`/api/portal/team/time-off/requests?${params}`);
      if (res.ok) {
        const data = await res.json();
        setRequests(data);
      }
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(id: string) {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/portal/team/time-off/requests/${id}/approve`, {
        method: 'PUT',
      });

      if (res.ok) {
        fetchRequests();
      }
    } catch (error) {
      console.error('Error approving request:', error);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReject(id: string) {
    if (!rejectReason.trim()) return;

    setActionLoading(id);
    try {
      const res = await fetch(`/api/portal/team/time-off/requests/${id}/reject`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejection_reason: rejectReason }),
      });

      if (res.ok) {
        setRejectingId(null);
        setRejectReason('');
        fetchRequests();
      }
    } catch (error) {
      console.error('Error rejecting request:', error);
    } finally {
      setActionLoading(null);
    }
  }

  function getStatusBadge(status: LeaveRequestStatus) {
    const colors = LEAVE_STATUS_COLORS[status] || LEAVE_STATUS_COLORS.pending;
    return `${colors.bg} ${colors.text}`;
  }

  function getStatusText(status: LeaveRequestStatus) {
    return LEAVE_STATUS_LABELS[status] || status;
  }

  // Check if request can be approved/rejected by leader
  function canLeaderAct(status: LeaveRequestStatus) {
    return status === 'pending_leader' || status === 'pending';
  }

  const pendingCount = requests.filter((r) => r.status === 'pending_leader' || r.status === 'pending').length;

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/portal/team"
          className="mb-6 inline-flex items-center text-sm text-zinc-500 hover:text-zinc-900"
        >
          <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Volver a Mi Equipo
        </Link>

        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-zinc-900">Solicitudes de Time Off del Equipo</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Aprueba o rechaza las solicitudes de vacaciones y licencias de tu equipo
          </p>
        </div>

        {/* Info about two-level approval */}
        <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-blue-900">Flujo de aprobación de 2 niveles</p>
              <p className="mt-1 text-xs text-blue-700">
                Tu aprobación es el <strong>primer paso</strong>. Luego HR dará la aprobación final.
              </p>
            </div>
          </div>
        </div>

        {/* Pending banner */}
        {statusFilter !== 'pending_leader' && pendingCount > 0 && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-amber-800">
                Tienes <strong>{pendingCount}</strong> solicitud{pendingCount > 1 ? 'es' : ''}{' '}
                esperando tu aprobación
              </p>
              <button
                onClick={() => setStatusFilter('pending_leader')}
                className="text-sm font-medium text-amber-700 hover:text-amber-800"
              >
                Ver pendientes
              </button>
            </div>
          </div>
        )}

        {/* Filter */}
        <div className="mb-6">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="">Todos los estados</option>
            <option value="pending_leader">Pendientes de mi aprobación</option>
            <option value="pending_hr">Esperando aprobación HR</option>
            <option value="approved">Aprobadas</option>
            <option value="rejected_leader">Rechazadas por mí</option>
            <option value="rejected_hr">Rechazadas por HR</option>
          </select>
        </div>

        {/* Requests list */}
        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
            </div>
          ) : requests.length === 0 ? (
            <div className="py-12 text-center text-sm text-zinc-500">
              No hay solicitudes {statusFilter === 'pending' ? 'pendientes' : ''}
            </div>
          ) : (
            <ul className="divide-y divide-zinc-200">
              {requests.map((request) => (
                <li key={request.id} className="px-6 py-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      {request.employee_photo_url ? (
                        <img
                          src={request.employee_photo_url}
                          alt={request.employee_name}
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                          <span className="text-sm font-semibold text-emerald-700">
                            {request.employee_name
                              ?.split(' ')
                              .map((n) => n[0])
                              .join('')
                              .slice(0, 2)}
                          </span>
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold text-zinc-900">{request.employee_name}</h3>
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusBadge(
                              request.status as LeaveRequestStatus
                            )}`}
                          >
                            {getStatusText(request.status as LeaveRequestStatus)}
                          </span>
                        </div>
                        <p className="mt-1 text-sm font-medium text-zinc-700">
                          {request.leave_type_name} • {request.days_requested}{' '}
                          {request.count_type === 'weeks' 
                            ? `semana${request.days_requested > 1 ? 's' : ''}`
                            : `día${request.days_requested > 1 ? 's' : ''}`}
                        </p>
                        <p className="text-sm text-zinc-500">
                          {formatDateLocal(request.start_date)} - {formatDateLocal(request.end_date)}
                        </p>
                        {request.notes && (
                          <p className="mt-2 text-sm text-zinc-500">"{request.notes}"</p>
                        )}
                        
                        {/* Two-level approval status */}
                        {(request.status === 'pending_hr' || request.status === 'approved' || request.status === 'rejected_hr') && (
                          <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
                            <span className="flex items-center gap-1">
                              <svg className="h-3 w-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                              Aprobado por ti {request.leader_approved_at && `(${formatDateLocal(request.leader_approved_at)})`}
                            </span>
                            {request.status === 'pending_hr' && (
                              <span className="text-blue-600">→ Esperando HR</span>
                            )}
                            {request.status === 'approved' && request.hr_approver_name && (
                              <span className="flex items-center gap-1">
                                <svg className="h-3 w-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                                HR: {request.hr_approver_name}
                              </span>
                            )}
                          </div>
                        )}
                        
                        {/* Rejection reasons */}
                        {request.leader_rejection_reason && (
                          <p className="mt-2 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
                            <strong>Motivo (Líder):</strong> {request.leader_rejection_reason}
                          </p>
                        )}
                        {request.hr_rejection_reason && (
                          <p className="mt-2 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
                            <strong>Motivo (HR):</strong> {request.hr_rejection_reason}
                          </p>
                        )}
                        {/* Legacy rejection reason fallback */}
                        {request.rejection_reason && !request.leader_rejection_reason && !request.hr_rejection_reason && (
                          <p className="mt-2 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
                            <strong>Motivo rechazo:</strong> {request.rejection_reason}
                          </p>
                        )}
                      </div>
                    </div>

                    {canLeaderAct(request.status as LeaveRequestStatus) && (
                      <div className="flex flex-col gap-2">
                        {rejectingId === request.id ? (
                          <div className="flex flex-col gap-2">
                            <textarea
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                              placeholder="Motivo del rechazo..."
                              rows={2}
                              className="w-48 rounded border border-zinc-300 px-2 py-1 text-sm"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleReject(request.id)}
                                disabled={!rejectReason.trim() || actionLoading === request.id}
                                className="flex-1 rounded bg-red-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                              >
                                {actionLoading === request.id ? '...' : 'Rechazar'}
                              </button>
                              <button
                                onClick={() => {
                                  setRejectingId(null);
                                  setRejectReason('');
                                }}
                                className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => handleApprove(request.id)}
                              disabled={actionLoading === request.id}
                              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                            >
                              {actionLoading === request.id ? '...' : 'Aprobar'}
                            </button>
                            <button
                              onClick={() => setRejectingId(request.id)}
                              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
                            >
                              Rechazar
                            </button>
                            <p className="mt-1 text-center text-xs text-zinc-400">
                              Paso 1 de 2
                            </p>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

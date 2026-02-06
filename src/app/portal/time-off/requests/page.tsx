'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { LeaveRequestWithDetails, LeaveRequestStatus } from '@/types/time-off';
import { LEAVE_STATUS_LABELS, LEAVE_STATUS_COLORS, CANCELLABLE_STATUSES } from '@/types/time-off';
import { formatDateLocal } from '@/lib/dateUtils';

export default function TimeOffRequestsHistoryPage() {
  const [requests, setRequests] = useState<LeaveRequestWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    fetchRequests();
  }, [statusFilter]);

  async function fetchRequests() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);

      const res = await fetch(`/api/portal/time-off/requests?${params}`);
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

  async function handleCancel(id: string) {
    if (!confirm('¿Estás seguro de que deseas cancelar esta solicitud?')) return;

    setCancellingId(id);
    try {
      const res = await fetch(`/api/portal/time-off/requests/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        fetchRequests();
      }
    } catch (error) {
      console.error('Error cancelling request:', error);
    } finally {
      setCancellingId(null);
    }
  }

  function getStatusBadge(status: LeaveRequestStatus) {
    const colors = LEAVE_STATUS_COLORS[status] || LEAVE_STATUS_COLORS.pending;
    return `${colors.bg} ${colors.text}`;
  }

  function getStatusText(status: LeaveRequestStatus) {
    return LEAVE_STATUS_LABELS[status] || status;
  }

  function canCancel(status: LeaveRequestStatus) {
    return CANCELLABLE_STATUSES.includes(status);
  }

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/portal/time-off"
          className="mb-6 inline-flex items-center text-sm text-zinc-500 hover:text-zinc-900"
        >
          <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Volver a Time Off
        </Link>

        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900">Historial de solicitudes</h1>
            <p className="mt-1 text-sm text-zinc-500">Todas tus solicitudes de vacaciones y licencias</p>
          </div>
          <Link
            href="/portal/time-off/new"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Nueva solicitud
          </Link>
        </div>

        {/* Filter */}
        <div className="mb-6">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="">Todos los estados</option>
            <option value="pending_leader">Pendiente Líder</option>
            <option value="pending_hr">Pendiente HR</option>
            <option value="approved">Aprobadas</option>
            <option value="rejected_leader">Rechazadas por Líder</option>
            <option value="rejected_hr">Rechazadas por HR</option>
            <option value="cancelled">Canceladas</option>
          </select>
        </div>

        {/* Requests list */}
        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
            </div>
          ) : requests.length === 0 ? (
            <div className="py-12 text-center text-sm text-zinc-500">No hay solicitudes</div>
          ) : (
            <ul className="divide-y divide-zinc-200">
              {requests.map((request) => (
                <li key={request.id} className="px-6 py-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-zinc-900">{request.leave_type_name}</h3>
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusBadge(
                            request.status as LeaveRequestStatus
                          )}`}
                        >
                          {getStatusText(request.status as LeaveRequestStatus)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-zinc-600">
                        {formatDateLocal(request.start_date)} - {formatDateLocal(request.end_date)}
                      </p>
                      <p className="mt-1 text-sm text-zinc-500">
                        {request.days_requested}{' '}
                        {request.count_type === 'weeks' 
                          ? `semana${request.days_requested > 1 ? 's' : ''}`
                          : `día${request.days_requested > 1 ? 's' : ''}`}
                        {request.notes && ` • ${request.notes}`}
                      </p>
                      
                      {/* Two-level approval timeline */}
                      <div className="mt-3 flex flex-wrap items-center gap-4">
                        {/* Leader approval status */}
                        <div className="flex items-center gap-2 text-xs">
                          <span className={`flex h-5 w-5 items-center justify-center rounded-full ${
                            request.leader_approved_at 
                              ? 'bg-green-100 text-green-600' 
                              : request.status === 'rejected_leader'
                              ? 'bg-red-100 text-red-600'
                              : 'bg-zinc-100 text-zinc-400'
                          }`}>
                            {request.leader_approved_at ? (
                              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            ) : request.status === 'rejected_leader' ? (
                              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                            ) : '1'}
                          </span>
                          <span className="text-zinc-600">
                            Líder: {request.leader_name || 'Pendiente'}
                            {request.leader_approved_at && (
                              <span className="text-zinc-400"> ({formatDateLocal(request.leader_approved_at)})</span>
                            )}
                          </span>
                        </div>
                        
                        {/* HR approval status */}
                        <div className="flex items-center gap-2 text-xs">
                          <span className={`flex h-5 w-5 items-center justify-center rounded-full ${
                            request.hr_approved_at && request.status === 'approved'
                              ? 'bg-green-100 text-green-600' 
                              : request.status === 'rejected_hr'
                              ? 'bg-red-100 text-red-600'
                              : 'bg-zinc-100 text-zinc-400'
                          }`}>
                            {request.hr_approved_at && request.status === 'approved' ? (
                              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            ) : request.status === 'rejected_hr' ? (
                              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                            ) : '2'}
                          </span>
                          <span className="text-zinc-600">
                            HR: {request.hr_approver_name || 'Pendiente'}
                            {request.hr_approved_at && (
                              <span className="text-zinc-400"> ({formatDateLocal(request.hr_approved_at)})</span>
                            )}
                          </span>
                        </div>
                      </div>
                      
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
                          <strong>Motivo:</strong> {request.rejection_reason}
                        </p>
                      )}
                    </div>
                    {canCancel(request.status as LeaveRequestStatus) && (
                      <button
                        onClick={() => handleCancel(request.id)}
                        disabled={cancellingId === request.id}
                        className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
                      >
                        {cancellingId === request.id ? 'Cancelando...' : 'Cancelar'}
                      </button>
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

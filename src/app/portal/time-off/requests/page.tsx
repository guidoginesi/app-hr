'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { LeaveRequestWithDetails } from '@/types/time-off';

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

  function getStatusBadge(status: string) {
    switch (status) {
      case 'pending':
        return 'bg-amber-100 text-amber-700';
      case 'approved':
        return 'bg-green-100 text-green-700';
      case 'rejected':
        return 'bg-red-100 text-red-700';
      case 'cancelled':
        return 'bg-zinc-100 text-zinc-600';
      default:
        return 'bg-zinc-100 text-zinc-600';
    }
  }

  function getStatusText(status: string) {
    switch (status) {
      case 'pending':
        return 'Pendiente';
      case 'approved':
        return 'Aprobada';
      case 'rejected':
        return 'Rechazada';
      case 'cancelled':
        return 'Cancelada';
      default:
        return status;
    }
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
            <option value="pending">Pendientes</option>
            <option value="approved">Aprobadas</option>
            <option value="rejected">Rechazadas</option>
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
                            request.status
                          )}`}
                        >
                          {getStatusText(request.status)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-zinc-600">
                        {new Date(request.start_date).toLocaleDateString('es-AR', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}{' '}
                        -{' '}
                        {new Date(request.end_date).toLocaleDateString('es-AR', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </p>
                      <p className="mt-1 text-sm text-zinc-500">
                        {request.days_requested}{' '}
                        {request.count_type === 'weeks' 
                          ? `semana${request.days_requested > 1 ? 's' : ''}`
                          : `día${request.days_requested > 1 ? 's' : ''}`}
                        {request.notes && ` • ${request.notes}`}
                      </p>
                      {request.status === 'rejected' && request.rejection_reason && (
                        <p className="mt-2 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
                          <strong>Motivo:</strong> {request.rejection_reason}
                        </p>
                      )}
                      {request.status === 'approved' && request.approver_name && (
                        <p className="mt-2 text-xs text-zinc-500">
                          Aprobado por {request.approver_name} el{' '}
                          {new Date(request.approved_at!).toLocaleDateString('es-AR')}
                        </p>
                      )}
                    </div>
                    {request.status === 'pending' && (
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

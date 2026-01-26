'use client';

import { useEffect, useState } from 'react';
import { TimeOffShell } from '../TimeOffShell';
import type { LeaveRequestWithDetails, LeaveType } from '@/types/time-off';

export default function TimeOffRequestsPage() {
  const [requests, setRequests] = useState<LeaveRequestWithDetails[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    fetchData();
  }, [statusFilter, typeFilter]);

  async function fetchData() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (typeFilter) params.set('leave_type_id', typeFilter);

      const [requestsRes, typesRes] = await Promise.all([
        fetch(`/api/admin/time-off/requests?${params}`),
        fetch('/api/admin/time-off/leave-types'),
      ]);

      if (requestsRes.ok) {
        const data = await requestsRes.json();
        setRequests(data);
      }
      if (typesRes.ok) {
        const data = await typesRes.json();
        setLeaveTypes(data);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(id: string) {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/time-off/requests/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      });

      if (res.ok) {
        fetchData();
      } else {
        const errorData = await res.json();
        alert(`Error al aprobar: ${errorData.error || 'Error desconocido'}`);
      }
    } catch (error) {
      console.error('Error approving request:', error);
      alert('Error de conexión al aprobar la solicitud');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReject(id: string) {
    if (!rejectReason.trim()) return;

    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/time-off/requests/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected', rejection_reason: rejectReason }),
      });

      if (res.ok) {
        setRejectingId(null);
        setRejectReason('');
        fetchData();
      } else {
        const errorData = await res.json();
        alert(`Error al rechazar: ${errorData.error || 'Error desconocido'}`);
      }
    } catch (error) {
      console.error('Error rejecting request:', error);
      alert('Error de conexión al rechazar la solicitud');
    } finally {
      setActionLoading(null);
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
    <TimeOffShell active="requests">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Solicitudes</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Gestiona las solicitudes de vacaciones y licencias
          </p>
        </div>

        {/* Filters */}
        <div className="flex gap-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          >
            <option value="">Todos los estados</option>
            <option value="pending">Pendientes</option>
            <option value="approved">Aprobadas</option>
            <option value="rejected">Rechazadas</option>
            <option value="cancelled">Canceladas</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          >
            <option value="">Todos los tipos</option>
            {leaveTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-600 border-t-transparent" />
            </div>
          ) : requests.length === 0 ? (
            <div className="py-12 text-center text-sm text-zinc-500">
              No hay solicitudes
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  <th className="px-6 py-3">Empleado</th>
                  <th className="px-6 py-3">Tipo</th>
                  <th className="px-6 py-3">Fechas</th>
                  <th className="px-6 py-3">Días</th>
                  <th className="px-6 py-3">Estado</th>
                  <th className="px-6 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {requests.map((request) => (
                  <tr key={request.id} className="hover:bg-zinc-50">
                    <td className="px-6 py-4">
                      <p className="font-medium text-zinc-900">{request.employee_name}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-600">{request.leave_type_name}</td>
                    <td className="px-6 py-4 text-sm text-zinc-600">
                      {new Date(request.start_date).toLocaleDateString('es-AR')} -{' '}
                      {new Date(request.end_date).toLocaleDateString('es-AR')}
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-600">{request.days_requested}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusBadge(
                          request.status
                        )}`}
                      >
                        {getStatusText(request.status)}
                      </span>
                      {request.rejection_reason && (
                        <p className="mt-1 text-xs text-red-600">{request.rejection_reason}</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {request.status === 'pending' && (
                        <div className="flex gap-2">
                          {rejectingId === request.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder="Motivo de rechazo"
                                className="w-48 rounded border border-zinc-300 px-2 py-1 text-sm"
                              />
                              <button
                                onClick={() => handleReject(request.id)}
                                disabled={!rejectReason.trim() || actionLoading === request.id}
                                className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                              >
                                Confirmar
                              </button>
                              <button
                                onClick={() => {
                                  setRejectingId(null);
                                  setRejectReason('');
                                }}
                                className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
                              >
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <>
                              <button
                                onClick={() => handleApprove(request.id)}
                                disabled={actionLoading === request.id}
                                className="rounded bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                              >
                                {actionLoading === request.id ? '...' : 'Aprobar'}
                              </button>
                              <button
                                onClick={() => setRejectingId(request.id)}
                                className="rounded border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
                              >
                                Rechazar
                              </button>
                            </>
                          )}
                        </div>
                      )}
                      {request.status === 'approved' && request.approver_name && (
                        <span className="text-xs text-zinc-500">
                          por {request.approver_name}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </TimeOffShell>
  );
}

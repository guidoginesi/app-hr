'use client';

import { useEffect, useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { TimeOffShell } from '../TimeOffShell';
import type { LeaveRequestWithDetails, LeaveType } from '@/types/time-off';
import { formatDateLocal, parseLocalDate } from '@/lib/dateUtils';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const NOV_STATUS_LABELS: Record<string, string> = {
  approved: 'Aprobada',
  pending_leader: 'Pend. Líder',
  pending_hr: 'Pend. HR',
  rejected_leader: 'Rechazada Líder',
  rejected_hr: 'Rechazada HR',
  rejected: 'Rechazada',
  cancelled: 'Cancelada',
  pending: 'Pendiente',
};

const NOV_STATUS_COLORS: Record<string, string> = {
  approved: 'bg-emerald-100 text-emerald-800',
  pending_leader: 'bg-amber-100 text-amber-800',
  pending_hr: 'bg-blue-100 text-blue-800',
  rejected_leader: 'bg-red-100 text-red-800',
  rejected_hr: 'bg-red-100 text-red-800',
  rejected: 'bg-red-100 text-red-800',
  cancelled: 'bg-zinc-100 text-zinc-500',
  pending: 'bg-amber-100 text-amber-800',
};

interface Novedad {
  id: string;
  employee_name: string;
  leave_type_name: string;
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

interface NovEmployee { id: string; first_name: string; last_name: string; }

interface BonusAdjustment {
  id: string;
  employee_id: string;
  leave_type_id: string;
  year: number;
  days: number;
  reason: string;
  status: 'active' | 'cancelled';
  created_by: string | null;
  cancelled_by: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  created_at: string;
  employee_name: string;
  leave_type_code: string;
  leave_type_name: string;
  created_by_name: string | null;
  cancelled_by_name: string | null;
}

export default function TimeOffRequestsPage() {
  const [requests, setRequests] = useState<LeaveRequestWithDetails[]>([]);
  const [bonusAdjustments, setBonusAdjustments] = useState<BonusAdjustment[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [nameFilter, setNameFilter] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancellingBonusId, setCancellingBonusId] = useState<string | null>(null);
  const [cancelBonusReason, setCancelBonusReason] = useState('');
  const [activeTab, setActiveTab] = useState<'requests' | 'bonus' | 'novedades'>('requests');
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [resendFeedback, setResendFeedback] = useState<{ id: string; ok: boolean; msg: string } | null>(null);

  // Novedades state
  const now = new Date();
  const [novYear, setNovYear] = useState(now.getFullYear());
  const [novMonth, setNovMonth] = useState(now.getMonth() + 1);
  const [novEmployeeId, setNovEmployeeId] = useState('');
  const [novStatusFilter, setNovStatusFilter] = useState('');
  const [novedades, setNovedades] = useState<Novedad[]>([]);
  const [novEmployees, setNovEmployees] = useState<NovEmployee[]>([]);
  const [novLoading, setNovLoading] = useState(false);
  const [novExpandedRow, setNovExpandedRow] = useState<string | null>(null);

  const currentYear = new Date().getFullYear();

  useEffect(() => { fetchData(); }, [statusFilter, typeFilter]);

  const fetchNovedades = useCallback(async () => {
    setNovLoading(true);
    try {
      const params = new URLSearchParams({ year: String(novYear), month: String(novMonth) });
      if (novEmployeeId) params.set('employee_id', novEmployeeId);
      if (novStatusFilter) params.set('status', novStatusFilter);
      const res = await fetch(`/api/admin/time-off/novedades?${params}`);
      const data = await res.json();
      if (res.ok) {
        setNovedades(data.novedades ?? []);
        setNovEmployees(data.employees ?? []);
      }
    } finally {
      setNovLoading(false);
    }
  }, [novYear, novMonth, novEmployeeId, novStatusFilter]);

  useEffect(() => {
    if (activeTab === 'novedades') fetchNovedades();
  }, [activeTab, fetchNovedades]);

  async function fetchData() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (typeFilter) params.set('leave_type_id', typeFilter);

      const [requestsRes, typesRes, bonusRes] = await Promise.all([
        fetch(`/api/admin/time-off/requests?${params}`),
        fetch('/api/admin/time-off/leave-types'),
        fetch(`/api/admin/time-off/bonus-adjustments?year=${currentYear}`),
      ]);

      if (requestsRes.ok) {
        const data = await requestsRes.json();
        setRequests(data);
      }
      if (typesRes.ok) {
        const data = await typesRes.json();
        setLeaveTypes(data);
      }
      if (bonusRes.ok) {
        const data = await bonusRes.json();
        setBonusAdjustments(data);
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
      case 'pending_leader':
        return 'bg-amber-100 text-amber-700';
      case 'pending_hr':
        return 'bg-blue-100 text-blue-700';
      case 'approved':
        return 'bg-green-100 text-green-700';
      case 'rejected':
      case 'rejected_leader':
      case 'rejected_hr':
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
      case 'pending_leader':
        return 'Pend. Líder';
      case 'pending_hr':
        return 'Pend. HR';
      case 'approved':
        return 'Aprobada';
      case 'rejected':
        return 'Rechazada';
      case 'rejected_leader':
        return 'Rech. Líder';
      case 'rejected_hr':
        return 'Rech. HR';
      case 'cancelled':
        return 'Cancelada';
      default:
        return status;
    }
  }

  // Check if HR can take action on this request
  function canHRApprove(status: string) {
    return ['pending', 'pending_leader', 'pending_hr'].includes(status);
  }

  function buildGCalUrl(request: LeaveRequestWithDetails): string {
    const startDate = request.start_date.replace(/-/g, '');
    // GCal all-day end date is exclusive — add 1 day
    const endObj = new Date(request.end_date + 'T00:00:00');
    endObj.setDate(endObj.getDate() + 1);
    const endDate = endObj.toISOString().slice(0, 10).replace(/-/g, '');
    const title = encodeURIComponent(`${request.leave_type_name} — ${request.employee_name}`);
    const details = encodeURIComponent(
      `Tipo: ${request.leave_type_name}\nEmpleado: ${request.employee_name}\nDuración: ${request.days_requested} ${request.count_type === 'weeks' ? 'semana(s)' : 'día(s)'}`
    );
    const calId = encodeURIComponent('holapow.com_k5bov6etce7tj5nv40kutgni5s@group.calendar.google.com');
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startDate}/${endDate}&details=${details}&src=${calId}`;
  }

  // Check if HR can cancel an approved request (before it starts)
  function canCancel(request: LeaveRequestWithDetails): boolean {
    if (request.status !== 'approved') return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = parseLocalDate(request.start_date);
    return startDate > today;
  }

  async function handleCancel(id: string) {
    if (!cancelReason.trim()) return;

    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/time-off/requests/${id}/cancel`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancellation_reason: cancelReason }),
      });

      if (res.ok) {
        setCancellingId(null);
        setCancelReason('');
        fetchData();
      } else {
        const errorData = await res.json();
        alert(`Error al cancelar: ${errorData.error || 'Error desconocido'}`);
      }
    } catch (error) {
      console.error('Error cancelling request:', error);
      alert('Error de conexión al cancelar la solicitud');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleResendNotification(id: string) {
    setResendingId(id);
    setResendFeedback(null);
    try {
      const res = await fetch(`/api/admin/time-off/requests/${id}/resend-notification`, {
        method: 'POST',
      });
      const data = await res.json();
      setResendFeedback({
        id,
        ok: res.ok,
        msg: res.ok ? (data.message ?? 'Email reenviado') : (data.error ?? 'Error al reenviar'),
      });
      // Auto-hide feedback after 5s
      setTimeout(() => setResendFeedback(null), 5000);
    } catch {
      setResendFeedback({ id, ok: false, msg: 'Error de conexión' });
    } finally {
      setResendingId(null);
    }
  }

  async function handleCancelBonus(id: string) {
    if (!cancelBonusReason.trim()) return;

    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/time-off/bonus-adjustments/${id}/cancel`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancellation_reason: cancelBonusReason }),
      });

      const result = await res.json();

      if (res.ok) {
        alert(result.message);
        setCancellingBonusId(null);
        setCancelBonusReason('');
        fetchData();
      } else {
        alert(`Error al cancelar: ${result.error || 'Error desconocido'}`);
      }
    } catch (error) {
      console.error('Error cancelling bonus adjustment:', error);
      alert('Error de conexión al cancelar el ajuste');
    } finally {
      setActionLoading(null);
    }
  }

  function exportNovedadesXLSX() {
    const periodLabel = `${MONTH_NAMES[novMonth - 1]} ${novYear}`;
    const rows = novedades.map((n) => ({
      Empleado: n.employee_name,
      'Tipo de licencia': n.leave_type_name,
      'Fecha inicio': formatDateLocal(n.start_date),
      'Fecha fin': formatDateLocal(n.end_date),
      Duración: n.count_type === 'weeks'
        ? `${n.days_requested} semana${n.days_requested !== 1 ? 's' : ''}`
        : `${n.days_requested} día${n.days_requested !== 1 ? 's' : ''}`,
      Estado: NOV_STATUS_LABELS[n.status] ?? n.status,
      Observaciones: [n.notes, n.rejection_reason, n.hr_rejection_reason, n.leader_rejection_reason]
        .filter(Boolean).join(' | '),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, periodLabel);
    XLSX.writeFile(wb, `novedades-${novYear}-${String(novMonth).padStart(2, '0')}.xlsx`);
  }

  const activeBonusAdjustments = bonusAdjustments.filter(b => b.status === 'active');
  const cancelledBonusAdjustments = bonusAdjustments.filter(b => b.status === 'cancelled');

  const filteredRequests = nameFilter.trim()
    ? requests.filter((r) =>
        r.employee_name?.toLowerCase().includes(nameFilter.trim().toLowerCase())
      )
    : requests;

  return (
    <TimeOffShell active="requests">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Solicitudes</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Gestiona las solicitudes de vacaciones y licencias
          </p>
        </div>

        {/* Tabs */}
        <div className="border-b border-zinc-200">
          <nav className="-mb-px flex gap-4">
            <button
              onClick={() => setActiveTab('requests')}
              className={`border-b-2 px-1 py-3 text-sm font-medium transition-colors ${
                activeTab === 'requests'
                  ? 'border-amber-500 text-amber-600'
                  : 'border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700'
              }`}
            >
              Solicitudes de licencias
            </button>
            <button
              onClick={() => setActiveTab('bonus')}
              className={`border-b-2 px-1 py-3 text-sm font-medium transition-colors ${
                activeTab === 'bonus'
                  ? 'border-amber-500 text-amber-600'
                  : 'border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700'
              }`}
            >
              Ajustes de días ({activeBonusAdjustments.length} activos)
            </button>
          </nav>
        </div>

        {activeTab === 'requests' && (
          <>
            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              {/* Search by name */}
              <div className="relative">
                <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Buscar por nombre..."
                  value={nameFilter}
                  onChange={(e) => setNameFilter(e.target.value)}
                  className="rounded-lg border border-zinc-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                {nameFilter && (
                  <button
                    onClick={() => setNameFilter('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                <option value="">Todos los estados</option>
                <option value="pending_leader">Pendiente Líder</option>
                <option value="pending_hr">Pendiente HR</option>
                <option value="approved">Aprobadas</option>
                <option value="rejected_leader">Rechazadas por Líder</option>
                <option value="rejected_hr">Rechazadas por HR</option>
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
          ) : filteredRequests.length === 0 ? (
            <div className="py-12 text-center text-sm text-zinc-500">
              {nameFilter ? `Sin resultados para "${nameFilter}"` : 'No hay solicitudes'}
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
                  <th className="px-6 py-3">Comentario</th>
                  <th className="px-6 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {filteredRequests.map((request) => (
                  <tr key={request.id} className="hover:bg-zinc-50">
                    <td className="px-6 py-4">
                      <p className="font-medium text-zinc-900">{request.employee_name}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-600">{request.leave_type_name}</td>
                    <td className="px-6 py-4 text-sm text-zinc-600">
                      {formatDateLocal(request.start_date)} -{' '}
                      {formatDateLocal(request.end_date)}
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
                    </td>
                    <td className="px-6 py-4 max-w-[200px]">
                      {request.notes ? (
                        <p className="text-xs text-zinc-500 italic line-clamp-2" title={request.notes}>
                          "{request.notes}"
                        </p>
                      ) : (
                        <span className="text-xs text-zinc-300">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {canHRApprove(request.status) && (
                        <div className="flex flex-col gap-2">
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
                              <div className="flex gap-2">
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
                              </div>
                              {request.status === 'pending_leader' && (
                                <div className="flex flex-col gap-1">
                                  <span className="text-xs text-amber-600">Saltar aprobación líder</span>
                                  <button
                                    onClick={() => handleResendNotification(request.id)}
                                    disabled={resendingId === request.id}
                                    title="Reenviar email de notificación al líder"
                                    className="flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                                  >
                                    {resendingId === request.id ? (
                                      '...'
                                    ) : (
                                      <>
                                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                        </svg>
                                        Reenviar notif.
                                      </>
                                    )}
                                  </button>
                                  {resendFeedback?.id === request.id && (
                                    <span className={`text-xs ${resendFeedback.ok ? 'text-green-600' : 'text-red-600'}`}>
                                      {resendFeedback.ok ? '✓' : '✗'} {resendFeedback.msg}
                                    </span>
                                  )}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                      {request.status === 'approved' && (
                        <div className="flex flex-col gap-2">
                          <div className="text-xs text-zinc-500">
                            {request.hr_approver_name && <p>HR: {request.hr_approver_name}</p>}
                            {request.leader_name && <p>Líder: {request.leader_name}</p>}
                          </div>
                          <a
                            href={buildGCalUrl(request)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 w-fit"
                          >
                            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-2 .89-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.11-.9-2-2-2zm0 16H5V8h14v11zM9 10H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm-8 4H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z"/>
                            </svg>
                            Google Calendar
                          </a>
                          {canCancel(request) && (
                            <>
                              {cancellingId === request.id ? (
                                <div className="flex flex-col gap-2">
                                  <input
                                    type="text"
                                    value={cancelReason}
                                    onChange={(e) => setCancelReason(e.target.value)}
                                    placeholder="Motivo de cancelación"
                                    className="w-48 rounded border border-zinc-300 px-2 py-1 text-sm"
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleCancel(request.id)}
                                      disabled={!cancelReason.trim() || actionLoading === request.id}
                                      className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                                    >
                                      {actionLoading === request.id ? '...' : 'Confirmar'}
                                    </button>
                                    <button
                                      onClick={() => {
                                        setCancellingId(null);
                                        setCancelReason('');
                                      }}
                                      className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
                                    >
                                      No
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setCancellingId(request.id)}
                                  className="rounded border border-red-300 bg-white px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                                >
                                  Cancelar solicitud
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      )}
                      {(request.status === 'rejected_leader' || request.status === 'rejected_hr') && (
                        <span className="text-xs text-zinc-500 flex items-start gap-1">
                          <span>💬</span>
                          <span className="italic">"{request.leader_rejection_reason || request.hr_rejection_reason || request.rejection_reason}"</span>
                        </span>
                      )}
                      {request.status === 'cancelled' && request.rejection_reason && (
                        <span className="text-xs text-zinc-500 flex items-start gap-1">
                          <span>💬</span>
                          <span className="italic">"{request.rejection_reason}"</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
          </>
        )}

        {activeTab === 'bonus' && (
          <>
            {/* Bonus adjustments info */}
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
              <p>
                <strong>Ajustes de días:</strong> Aquí puedes ver los días extra agregados a los empleados (días Pow, vacaciones, etc.) y cancelarlos si es necesario.
                Al cancelar, los días se restan automáticamente del balance del empleado.
              </p>
            </div>

            {/* Bonus adjustments table */}
            <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-600 border-t-transparent" />
                </div>
              ) : bonusAdjustments.length === 0 ? (
                <div className="py-12 text-center text-sm text-zinc-500">
                  No hay ajustes de días registrados
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                      <th className="px-6 py-3">Empleado</th>
                      <th className="px-6 py-3">Tipo</th>
                      <th className="px-6 py-3">Días</th>
                      <th className="px-6 py-3">Motivo</th>
                      <th className="px-6 py-3">Fecha</th>
                      <th className="px-6 py-3">Estado</th>
                      <th className="px-6 py-3">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {bonusAdjustments.map((adjustment) => (
                      <tr key={adjustment.id} className="hover:bg-zinc-50">
                        <td className="px-6 py-4">
                          <p className="font-medium text-zinc-900">{adjustment.employee_name}</p>
                          {adjustment.created_by_name && (
                            <p className="text-xs text-zinc-400">Por: {adjustment.created_by_name}</p>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            adjustment.leave_type_code === 'pow_days' 
                              ? 'bg-purple-100 text-purple-700' 
                              : adjustment.leave_type_code === 'vacation'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-zinc-100 text-zinc-700'
                          }`}>
                            {adjustment.leave_type_name}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-lg font-bold ${adjustment.days > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {adjustment.days > 0 ? '+' : ''}{adjustment.days}
                          </span>
                        </td>
                        <td className="px-6 py-4 max-w-xs">
                          <p className="text-sm text-zinc-600 truncate" title={adjustment.reason}>
                            {adjustment.reason}
                          </p>
                        </td>
                        <td className="px-6 py-4 text-sm text-zinc-500">
                          {new Date(adjustment.created_at).toLocaleDateString('es-AR')}
                        </td>
                        <td className="px-6 py-4">
                          {adjustment.status === 'active' ? (
                            <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                              Activo
                            </span>
                          ) : (
                            <div>
                              <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600">
                                Cancelado
                              </span>
                              {adjustment.cancellation_reason && (
                                <p className="mt-1 text-xs text-zinc-400 italic">
                                  "{adjustment.cancellation_reason}"
                                </p>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {adjustment.status === 'active' && (
                            <>
                              {cancellingBonusId === adjustment.id ? (
                                <div className="flex flex-col gap-2">
                                  <input
                                    type="text"
                                    value={cancelBonusReason}
                                    onChange={(e) => setCancelBonusReason(e.target.value)}
                                    placeholder="Motivo de cancelación"
                                    className="w-48 rounded border border-zinc-300 px-2 py-1 text-sm"
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleCancelBonus(adjustment.id)}
                                      disabled={!cancelBonusReason.trim() || actionLoading === adjustment.id}
                                      className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                                    >
                                      {actionLoading === adjustment.id ? '...' : 'Confirmar'}
                                    </button>
                                    <button
                                      onClick={() => {
                                        setCancellingBonusId(null);
                                        setCancelBonusReason('');
                                      }}
                                      className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
                                    >
                                      No
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setCancellingBonusId(adjustment.id)}
                                  className="rounded border border-red-300 bg-white px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                                >
                                  Cancelar
                                </button>
                              )}
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Summary */}
            {!loading && bonusAdjustments.length > 0 && (
              <div className="text-sm text-zinc-500">
                {activeBonusAdjustments.length} ajuste{activeBonusAdjustments.length !== 1 ? 's' : ''} activo{activeBonusAdjustments.length !== 1 ? 's' : ''}
                {cancelledBonusAdjustments.length > 0 && `, ${cancelledBonusAdjustments.length} cancelado${cancelledBonusAdjustments.length !== 1 ? 's' : ''}`}
              </div>
            )}
          </>
        )}

        {/* ── NOVEDADES TAB ── */}
        {activeTab === 'novedades' && (
          <>
            {/* Filters */}
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-zinc-500">Mes</label>
                <select value={novMonth} onChange={(e) => setNovMonth(Number(e.target.value))}
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500">
                  {MONTH_NAMES.map((name, i) => <option key={i + 1} value={i + 1}>{name}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-zinc-500">Año</label>
                <select value={novYear} onChange={(e) => setNovYear(Number(e.target.value))}
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500">
                  {Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i).map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1 min-w-[180px]">
                <label className="text-xs font-medium text-zinc-500">Persona</label>
                <select value={novEmployeeId} onChange={(e) => setNovEmployeeId(e.target.value)}
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500">
                  <option value="">Todos</option>
                  {novEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-zinc-500">Estado</label>
                <select value={novStatusFilter} onChange={(e) => setNovStatusFilter(e.target.value)}
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500">
                  <option value="">Todos</option>
                  <option value="approved">Aprobadas</option>
                  <option value="pending_leader">Pend. Líder</option>
                  <option value="pending_hr">Pend. HR</option>
                  <option value="rejected_leader">Rechazadas Líder</option>
                  <option value="rejected_hr">Rechazadas HR</option>
                </select>
              </div>
              <div className="ml-auto flex items-end">
                <button onClick={exportNovedadesXLSX} disabled={novedades.length === 0}
                  className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Exportar XLSX
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
                <p className="text-sm text-zinc-500">
                  {novLoading ? 'Cargando...' : `${novedades.length} novedad${novedades.length !== 1 ? 'es' : ''} — ${MONTH_NAMES[novMonth - 1]} ${novYear}`}
                </p>
              </div>
              {novLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-600 border-t-transparent" />
                </div>
              ) : novedades.length === 0 ? (
                <div className="py-12 text-center text-sm text-zinc-500">Sin novedades para este período</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
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
                        const obs = [n.notes, n.rejection_reason, n.hr_rejection_reason, n.leader_rejection_reason].filter(Boolean).join(' | ');
                        const isExpanded = novExpandedRow === n.id;
                        const duracion = n.count_type === 'weeks'
                          ? `${n.days_requested} sem.`
                          : `${n.days_requested} día${n.days_requested !== 1 ? 's' : ''}`;
                        return (
                          <tr key={n.id} className="hover:bg-zinc-50 transition-colors">
                            <td className="px-6 py-3 font-medium text-zinc-900">{n.employee_name}</td>
                            <td className="px-6 py-3 text-zinc-600">{n.leave_type_name}</td>
                            <td className="px-6 py-3 text-zinc-600">{formatDateLocal(n.start_date)}</td>
                            <td className="px-6 py-3 text-zinc-600">{formatDateLocal(n.end_date)}</td>
                            <td className="px-6 py-3 text-center">
                              <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700">{duracion}</span>
                            </td>
                            <td className="px-6 py-3">
                              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${NOV_STATUS_COLORS[n.status] ?? 'bg-zinc-100 text-zinc-600'}`}>
                                {NOV_STATUS_LABELS[n.status] ?? n.status}
                              </span>
                            </td>
                            <td className="px-6 py-3 max-w-xs">
                              {obs ? (
                                <button onClick={() => setNovExpandedRow(isExpanded ? null : n.id)}
                                  className="flex items-start gap-1 text-left text-zinc-600 hover:text-zinc-900 transition-colors">
                                  <span className={`text-xs leading-relaxed ${isExpanded ? '' : 'line-clamp-1'}`}>{obs}</span>
                                  {obs.length > 60 && (
                                    <svg className={`mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-zinc-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                  )}
                                </button>
                              ) : <span className="text-xs text-zinc-300">—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </TimeOffShell>
  );
}

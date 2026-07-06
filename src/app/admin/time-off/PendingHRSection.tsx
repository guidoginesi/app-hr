'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@pow/ui/components/ui/button';
import type { LeaveRequestWithDetails } from '@/types/time-off';
import { formatDateLocal } from '@/lib/dateUtils';

type PendingHRSectionProps = {
  initialRequests: LeaveRequestWithDetails[];
};

export function PendingHRSection({ initialRequests }: PendingHRSectionProps) {
  const router = useRouter();
  const [requests, setRequests] = useState(initialRequests);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleApprove(id: string) {
    setActionLoading(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/time-off/requests/${id}/approve`, {
        method: 'PUT',
      });

      if (res.ok) {
        setRequests((prev) => prev.filter((r) => r.id !== id));
        router.refresh();
      } else {
        const data = await res.json();
        setError(data.error || 'Error al aprobar');
      }
    } catch (err) {
      console.error('Error approving request:', err);
      setError('Error al aprobar la solicitud');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReject(id: string) {
    if (!rejectReason.trim()) return;

    setActionLoading(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/time-off/requests/${id}/reject`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejection_reason: rejectReason }),
      });

      if (res.ok) {
        setRequests((prev) => prev.filter((r) => r.id !== id));
        setRejectingId(null);
        setRejectReason('');
        router.refresh();
      } else {
        const data = await res.json();
        setError(data.error || 'Error al rechazar');
      }
    } catch (err) {
      console.error('Error rejecting request:', err);
      setError('Error al rechazar la solicitud');
    } finally {
      setActionLoading(null);
    }
  }

  if (requests.length === 0) {
    return (
      <div className="rounded-xl border border-success/20 bg-success-subtle p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success-subtle">
            <svg className="h-5 w-5 text-[var(--green-700)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-[var(--green-700)]">¡Todo al día!</h3>
            <p className="text-sm text-[var(--green-700)]">No hay solicitudes pendientes de aprobación HR</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-white shadow-sm">
      <div className="border-b border-[var(--border)] bg-muted px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Pendientes de tu aprobación ({requests.length})
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Estas solicitudes ya fueron aprobadas por el líder. Tu aprobación es el paso final.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 rounded-lg bg-danger-subtle p-3 text-sm text-[var(--red-600)]">
          {error}
        </div>
      )}

      <ul className="divide-y divide-[var(--border)]">
        {requests.map((request) => (
          <li key={request.id} className="px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4 flex-1">
                {request.employee_photo_url ? (
                  <img
                    src={request.employee_photo_url}
                    alt={request.employee_name}
                    className="h-12 w-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
                    <span className="text-sm font-semibold text-secondary-foreground">
                      {request.employee_name
                        ?.split(' ')
                        .map((n) => n[0])
                        .join('')
                        .slice(0, 2)}
                    </span>
                  </div>
                )}
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-foreground">{request.employee_name}</h4>
                  <p className="mt-1 text-sm font-medium text-secondary-foreground">
                    {request.leave_type_name} • {request.days_requested}{' '}
                    {request.count_type === 'weeks'
                      ? `semana${request.days_requested > 1 ? 's' : ''}`
                      : `día${request.days_requested > 1 ? 's' : ''}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateLocal(request.start_date, 'es-AR', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                    })}{' '}
                    -{' '}
                    {formatDateLocal(request.end_date, 'es-AR', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                  {request.notes && (
                    <p className="mt-2 text-xs text-muted-foreground">"{request.notes}"</p>
                  )}
                  
                  {/* Leader approval info */}
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <svg className="h-3 w-3 text-success" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>
                      Aprobado por líder: {request.leader_name || request.manager_name || 'Líder'}
                      {request.leader_approved_at && (
                        <span className="text-muted-foreground">
                          {' '}({new Date(request.leader_approved_at).toLocaleDateString('es-AR')})
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                {rejectingId === request.id ? (
                  <div className="flex flex-col gap-2">
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Motivo del rechazo..."
                      rows={2}
                      className="w-56 rounded border border-[var(--border)] px-2 py-1 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="destructive"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleReject(request.id)}
                        disabled={!rejectReason.trim() || actionLoading === request.id}
                        loading={actionLoading === request.id}
                      >
                        Rechazar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setRejectingId(null);
                          setRejectReason('');
                        }}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <Button
                      onClick={() => handleApprove(request.id)}
                      loading={actionLoading === request.id}
                    >
                      Aprobar
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setRejectingId(request.id)}
                    >
                      Rechazar
                    </Button>
                    <p className="text-center text-xs text-muted-foreground">
                      Aprobación final
                    </p>
                  </>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

'use client';

import { Spinner } from '@/components/Spinner';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { LeaveRequestWithDetails, LeaveRequestStatus } from '@/types/time-off';
import { formatDateLocal } from '@/lib/dateUtils';
import { PageHeader } from '@pow/ui/components/ui/page-header';
import { Button } from '@pow/ui/components/ui/button';
import { NewRequestButton } from '../NewRequestButton';
import { LeaveRequestRow } from '@/components/time-off/LeaveRequestRow';
import { StatusFilterChips, type ChipValue } from '@/components/time-off/StatusFilterChips';
import { countByBucket, getBucket, BUCKET_LABELS, type StatusBucket } from '@/components/time-off/statusBuckets';

const SECTION_ORDER: StatusBucket[] = ['pending', 'approved', 'rejected'];

export function TeamTimeOffClient() {
  const [requests, setRequests] = useState<LeaveRequestWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ChipValue>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    fetchRequests();
  }, []);

  async function fetchRequests() {
    setLoading(true);
    try {
      const res = await fetch('/api/portal/team/time-off/requests');
      if (res.ok) setRequests(await res.json());
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(id: string) {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/portal/team/time-off/requests/${id}/approve`, { method: 'PUT' });
      if (res.ok) fetchRequests();
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

  const canLeaderAct = (status: LeaveRequestStatus) => status === 'pending_leader' || status === 'pending';

  const counts = useMemo(() => countByBucket(requests), [requests]);
  const pendingCount = useMemo(
    () => requests.filter((r) => canLeaderAct(r.status as LeaveRequestStatus)).length,
    [requests],
  );

  // Agrupa por bucket; dentro de Pendientes, lo accionable (pendiente de tu aprobación) primero.
  const sections = useMemo(() => {
    return SECTION_ORDER.filter((b) => (filter === 'all' || filter === b) && counts[b] > 0).map((bucket) => {
      const rows = requests
        .filter((r) => getBucket(r.status as LeaveRequestStatus) === bucket)
        .sort((a, b) => {
          if (bucket !== 'pending') return 0;
          return Number(canLeaderAct(b.status as LeaveRequestStatus)) - Number(canLeaderAct(a.status as LeaveRequestStatus));
        });
      return { bucket, rows };
    });
  }, [requests, counts, filter]);

  function renderActions(request: LeaveRequestWithDetails) {
    if (!canLeaderAct(request.status as LeaveRequestStatus)) return undefined;

    if (rejectingId === request.id) {
      return (
        <div className="flex w-56 flex-col gap-2">
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Motivo del rechazo…"
            rows={2}
            className="w-full rounded-lg border border-[var(--border)] px-2 py-1 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="destructive"
              loading={actionLoading === request.id}
              disabled={!rejectReason.trim()}
              onClick={() => handleReject(request.id)}
              className="flex-1"
            >
              Rechazar
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setRejectingId(null);
                setRejectReason('');
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      );
    }

    return (
      <>
        <Button size="sm" loading={actionLoading === request.id} onClick={() => handleApprove(request.id)}>
          Aprobar
        </Button>
        <Button size="sm" variant="outline" onClick={() => setRejectingId(request.id)}>
          Rechazar
        </Button>
      </>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Time Off" description="Gestiona las solicitudes de tu equipo" actions={<NewRequestButton />} />

      {/* Tabs */}
      <div className="border-b border-[var(--border)]">
        <nav className="-mb-px flex gap-6">
          <Link
            href="/portal/time-off"
            className="border-b-2 border-transparent px-1 pb-3 text-sm font-medium text-muted-foreground hover:border-[var(--border)] hover:text-foreground"
          >
            Mis solicitudes
          </Link>
          <Link href="/portal/time-off/team" className="border-b-2 border-brand px-1 pb-3 text-sm font-medium text-foreground">
            Mi equipo
            {pendingCount > 0 && (
              <span className="ml-2 inline-flex items-center justify-center rounded-full bg-warning-subtle px-2 py-0.5 text-xs font-medium text-[var(--amber-600)]">
                {pendingCount}
              </span>
            )}
          </Link>
        </nav>
      </div>

      {/* Info about two-level approval */}
      <div className="rounded-xl border border-[var(--border)] bg-muted p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Flujo de aprobación de 2 niveles</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Tu aprobación es el <strong>primer paso</strong>. Luego HR dará la aprobación final.
            </p>
          </div>
        </div>
      </div>

      {/* Filter chips */}
      <StatusFilterChips value={filter} counts={counts} order={SECTION_ORDER} onChange={setFilter} />

      {/* Requests list */}
      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner className="h-8 w-8 text-muted-foreground" />
          </div>
        ) : sections.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No hay solicitudes{filter !== 'all' ? ` ${BUCKET_LABELS[filter].toLowerCase()}` : ''}
          </div>
        ) : (
          sections.map(({ bucket, rows }) => (
            <div key={bucket}>
              <div className="flex items-center gap-2 border-b border-[var(--border)] bg-muted px-4 py-2 sm:px-6">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {bucket === 'pending' ? 'Pendientes de tu aprobación' : BUCKET_LABELS[bucket]}
                </span>
                <span className="text-xs text-muted-foreground/70">{rows.length}</span>
              </div>
              <ul className="divide-y divide-[var(--border)]">
                {rows.map((request) => (
                  <LeaveRequestRow
                    key={request.id}
                    request={request}
                    showEmployee
                    leaderLabel="Tú"
                    actions={renderActions(request)}
                  />
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

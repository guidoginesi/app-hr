'use client';

import { Spinner } from '@/components/Spinner';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { LeaveRequestWithDetails, LeaveRequestStatus } from '@/types/time-off';
import { CANCELLABLE_STATUSES } from '@/types/time-off';
import { Button, buttonVariants } from '@pow/ui/components/ui/button';
import { LeaveRequestRow } from '@/components/time-off/LeaveRequestRow';
import { SickCertificateControl } from '@/components/time-off/SickCertificateControl';
import { StatusFilterChips, type ChipValue } from '@/components/time-off/StatusFilterChips';
import { countByBucket, getBucket, BUCKET_LABELS, type StatusBucket } from '@/components/time-off/statusBuckets';

const SECTION_ORDER: StatusBucket[] = ['pending', 'approved', 'rejected', 'cancelled'];

export default function TimeOffRequestsHistoryPage() {
  const [requests, setRequests] = useState<LeaveRequestWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ChipValue>('all');
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    fetchRequests();
  }, []);

  async function fetchRequests() {
    setLoading(true);
    try {
      const res = await fetch('/api/portal/time-off/requests');
      if (res.ok) setRequests(await res.json());
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
      const res = await fetch(`/api/portal/time-off/requests/${id}`, { method: 'DELETE' });
      if (res.ok) fetchRequests();
    } catch (error) {
      console.error('Error cancelling request:', error);
    } finally {
      setCancellingId(null);
    }
  }

  const canCancel = (status: LeaveRequestStatus) => CANCELLABLE_STATUSES.includes(status);

  const counts = useMemo(() => countByBucket(requests), [requests]);
  const sections = useMemo(
    () =>
      SECTION_ORDER.filter((b) => (filter === 'all' || filter === b) && counts[b] > 0).map((bucket) => ({
        bucket,
        rows: requests.filter((r) => getBucket(r.status as LeaveRequestStatus) === bucket),
      })),
    [requests, counts, filter],
  );

  return (
    <div className="min-h-screen bg-muted px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/portal/time-off"
          className="mb-6 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Volver a Time Off
        </Link>

        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Historial de solicitudes</h1>
            <p className="mt-1 text-sm text-muted-foreground">Todas tus solicitudes de vacaciones y licencias</p>
          </div>
          <Link href="/portal/time-off/new" className={buttonVariants({ variant: 'primary' })}>
            Nueva solicitud
          </Link>
        </div>

        <div className="mb-6">
          <StatusFilterChips value={filter} counts={counts} order={SECTION_ORDER} onChange={setFilter} />
        </div>

        <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner className="h-8 w-8 text-muted-foreground" />
            </div>
          ) : sections.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">No hay solicitudes</div>
          ) : (
            sections.map(({ bucket, rows }) => (
              <div key={bucket}>
                <div className="flex items-center gap-2 border-b border-[var(--border)] bg-muted px-4 py-2 sm:px-6">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {BUCKET_LABELS[bucket]}
                  </span>
                  <span className="text-xs text-muted-foreground/70">{rows.length}</span>
                </div>
                <ul className="divide-y divide-[var(--border)]">
                  {rows.map((request) => (
                    <LeaveRequestRow
                      key={request.id}
                      request={request}
                      actions={
                        request.leave_type_code === 'sick' && request.status === 'approved' ? (
                          <SickCertificateControl request={request} mode="owner" onChange={fetchRequests} />
                        ) : canCancel(request.status as LeaveRequestStatus) ? (
                          <Button
                            size="sm"
                            variant="outline"
                            loading={cancellingId === request.id}
                            onClick={() => handleCancel(request.id)}
                          >
                            Cancelar
                          </Button>
                        ) : undefined
                      }
                    />
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

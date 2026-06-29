import type { LeaveRequestStatus, LeaveRequestWithDetails } from '@/types/time-off';

export type StatusBucket = 'pending' | 'approved' | 'rejected' | 'cancelled';

export function getBucket(status: LeaveRequestStatus): StatusBucket {
  if (status === 'approved') return 'approved';
  if (status === 'cancelled') return 'cancelled';
  if (status === 'rejected' || status === 'rejected_leader' || status === 'rejected_hr') return 'rejected';
  return 'pending';
}

export const BUCKET_LABELS: Record<StatusBucket, string> = {
  pending: 'Pendientes',
  approved: 'Aprobadas',
  rejected: 'Rechazadas',
  cancelled: 'Canceladas',
};

/** Cuenta solicitudes por bucket, respetando un orden estable de secciones. */
export function countByBucket(
  requests: LeaveRequestWithDetails[],
): Record<StatusBucket, number> {
  const counts: Record<StatusBucket, number> = { pending: 0, approved: 0, rejected: 0, cancelled: 0 };
  for (const r of requests) counts[getBucket(r.status as LeaveRequestStatus)]++;
  return counts;
}

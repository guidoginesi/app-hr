import type { LeaveTypeCode } from '@/types/time-off';

/** Leave types that don't consume balance — notification-only (e.g. ART/seguro). */
export const UNLIMITED_LEAVE_TYPE_CODES: LeaveTypeCode[] = ['remote_work_trip'];

/** Leave types that skip leader approval and go directly to HR. */
export const HR_ONLY_APPROVAL_LEAVE_TYPE_CODES: LeaveTypeCode[] = ['remote_work_trip'];

export function isUnlimitedLeaveType(code: string): boolean {
  return UNLIMITED_LEAVE_TYPE_CODES.includes(code as LeaveTypeCode);
}

export function isHrOnlyApprovalType(code: string): boolean {
  return HR_ONLY_APPROVAL_LEAVE_TYPE_CODES.includes(code as LeaveTypeCode);
}

import type { LeaveTypeCode } from '@/types/time-off';

/** Leave types that don't consume balance — notification-only (e.g. ART/seguro). */
export const UNLIMITED_LEAVE_TYPE_CODES: LeaveTypeCode[] = ['remote_work_trip', 'sick'];

/** Leave types that skip leader approval and go directly to HR. */
export const HR_ONLY_APPROVAL_LEAVE_TYPE_CODES: LeaveTypeCode[] = ['remote_work_trip'];

/**
 * Leave types that skip approval entirely: the employee registers them and they
 * are valid on the spot. The leader is NOTIFIED, not asked to approve. Sick
 * leave works this way. Unlike HR-only types, these don't sit in a pending
 * queue — there is no gate.
 */
export const SELF_REGISTERED_LEAVE_TYPE_CODES: LeaveTypeCode[] = ['sick'];

export function isUnlimitedLeaveType(code: string): boolean {
  return UNLIMITED_LEAVE_TYPE_CODES.includes(code as LeaveTypeCode);
}

export function isHrOnlyApprovalType(code: string): boolean {
  return HR_ONLY_APPROVAL_LEAVE_TYPE_CODES.includes(code as LeaveTypeCode);
}

export function isSelfRegisteredType(code: string): boolean {
  return SELF_REGISTERED_LEAVE_TYPE_CODES.includes(code as LeaveTypeCode);
}

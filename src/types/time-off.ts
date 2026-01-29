// Time-Off module types

export type LeaveTypeCode = 'vacation' | 'pow_days' | 'study' | 'remote_work';

// Two-level approval workflow statuses
export type LeaveRequestStatus = 
  | 'pending'          // Legacy - kept for backward compatibility
  | 'pending_leader'   // Initial state - waiting for leader approval
  | 'pending_hr'       // Leader approved - waiting for HR approval
  | 'approved'         // HR approved (final)
  | 'rejected'         // Legacy - kept for backward compatibility
  | 'rejected_leader'  // Leader rejected (final)
  | 'rejected_hr'      // HR rejected (final)
  | 'cancelled';       // Cancelled by employee

export type CountType = 'calendar_days' | 'business_days' | 'weeks';

// Status labels for UI
export const LEAVE_STATUS_LABELS: Record<LeaveRequestStatus, string> = {
  pending: 'Pendiente',
  pending_leader: 'Pendiente Líder',
  pending_hr: 'Pendiente HR',
  approved: 'Aprobada',
  rejected: 'Rechazada',
  rejected_leader: 'Rechazada por Líder',
  rejected_hr: 'Rechazada por HR',
  cancelled: 'Cancelada',
};

// Status colors for UI badges
export const LEAVE_STATUS_COLORS: Record<LeaveRequestStatus, { bg: string; text: string }> = {
  pending: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  pending_leader: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  pending_hr: { bg: 'bg-blue-100', text: 'text-blue-800' },
  approved: { bg: 'bg-green-100', text: 'text-green-800' },
  rejected: { bg: 'bg-red-100', text: 'text-red-800' },
  rejected_leader: { bg: 'bg-red-100', text: 'text-red-800' },
  rejected_hr: { bg: 'bg-red-100', text: 'text-red-800' },
  cancelled: { bg: 'bg-zinc-100', text: 'text-zinc-600' },
};

// Final statuses - no further actions allowed
export const FINAL_STATUSES: LeaveRequestStatus[] = [
  'approved', 'rejected', 'rejected_leader', 'rejected_hr', 'cancelled'
];

// Statuses that allow cancellation by employee
export const CANCELLABLE_STATUSES: LeaveRequestStatus[] = [
  'pending', 'pending_leader', 'pending_hr'
];

export interface LeaveType {
  id: string;
  code: LeaveTypeCode;
  name: string;
  description: string | null;
  is_active: boolean;
  requires_attachment: boolean;
  advance_notice_days: number;
  count_type: CountType;
  is_accumulative: boolean;
  created_at: string;
  updated_at: string;
}

export interface LeaveRequest {
  id: string;
  employee_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  days_requested: number;
  status: LeaveRequestStatus;
  notes: string | null;
  attachment_url: string | null;
  // Legacy fields - kept for backward compatibility
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  // Two-level approval tracking - Leader
  leader_id: string | null;              // Assigned leader at creation time
  leader_approved_at: string | null;     // When leader approved
  leader_rejection_reason: string | null;
  // Two-level approval tracking - HR
  hr_approved_by: string | null;         // HR admin who approved
  hr_approved_at: string | null;         // When HR approved
  hr_rejection_reason: string | null;
  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface LeaveRequestWithDetails extends LeaveRequest {
  leave_type_code: LeaveTypeCode;
  leave_type_name: string;
  count_type: CountType;
  requires_attachment: boolean;
  advance_notice_days: number;
  employee_name: string;
  employee_photo_url: string | null;
  employee_manager_id: string | null;
  manager_name: string | null;
  approver_name: string | null;
  // Two-level approval names
  leader_name: string | null;
  hr_approver_name: string | null;
}

export interface LeaveBalance {
  id: string;
  employee_id: string;
  leave_type_id: string;
  year: number;
  entitled_days: number;
  used_days: number;
  pending_days: number;
  carried_over: number;
  bonus_days: number;
  created_at: string;
  updated_at: string;
}

export interface LeaveBalanceWithDetails extends LeaveBalance {
  leave_type_code: LeaveTypeCode;
  leave_type_name: string;
  count_type: CountType;
  is_accumulative: boolean;
  employee_name: string;
  hire_date: string | null;
  is_studying: boolean;
  available_days: number;
  // bonus_days is inherited from LeaveBalance
}

export interface RemoteWorkWeek {
  id: string;
  employee_id: string;
  year: number;
  week_number: number;
  week_start_date: string;
  week_end_date: string;
  leave_request_id: string;
  created_at: string;
}

// Form data types
export interface CreateLeaveRequestData {
  leave_type_id: string;
  start_date: string;
  end_date: string;
  days_requested: number;
  notes?: string;
  attachment_url?: string;
}

export interface UpdateLeaveRequestData {
  status?: LeaveRequestStatus;
  rejection_reason?: string;
  notes?: string;
}

export interface ApproveRejectData {
  rejection_reason?: string;
}

// API response types
export interface LeaveBalanceSummary {
  vacation: LeaveBalanceWithDetails | null;
  pow_days: LeaveBalanceWithDetails | null;
  study: LeaveBalanceWithDetails | null;
  remote_work: LeaveBalanceWithDetails | null;
}

// Validation types
export interface LeaveRequestValidationError {
  field: string;
  message: string;
}

export interface LeaveRequestValidationResult {
  isValid: boolean;
  errors: LeaveRequestValidationError[];
}

// Stats for admin dashboard
export interface TimeOffStats {
  pendingRequests: number;
  approvedThisMonth: number;
  employeesOnLeaveToday: number;
  upcomingLeaves: number;
}

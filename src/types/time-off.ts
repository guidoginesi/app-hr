// Time-Off module types

export type LeaveTypeCode = 'vacation' | 'pow_days' | 'study' | 'remote_work';
export type LeaveRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type CountType = 'calendar_days' | 'business_days' | 'weeks';

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
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
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

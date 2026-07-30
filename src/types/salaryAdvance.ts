// Tipos del módulo de Adelanto de Sueldos

export type SalaryAdvanceStatus =
  | 'pending_hr'
  | 'pending_admin'
  | 'approved'
  | 'transferred'
  | 'settled'
  | 'rejected'
  | 'blocked';

export type SalaryAdvanceType = 'standard' | 'exception' | 'emergency';

// ---- Motor de reglas ----
export type AdvanceRuleMode = 'auto' | 'manual';
export type AdvanceRuleSeverity = 'eligibility' | 'limit' | 'block';

export type AdvanceRuleResult = {
  n: number;
  label: string;
  mode: AdvanceRuleMode;
  severity: AdvanceRuleSeverity;
  ok: boolean | null; // null = manual (no auto-evaluado)
  detail?: string;
};

export type AdvanceClassification = 'standard' | 'exception' | 'extraordinary';

export type AdvanceEvaluation = {
  rules: AdvanceRuleResult[];
  classification: AdvanceClassification;
  requiresReason: boolean;
  failedAuto: number[];
};

// ---- Filas de DB ----
export type SalaryAdvance = {
  id: string;
  employee_id: string;
  amount: number;
  reason: string | null;
  type: SalaryAdvanceType;
  status: SalaryAdvanceStatus;
  validations: AdvanceEvaluation | Record<string, never>;
  discount_year: number;
  discount_month: number;
  balance_pending: number;
  no_resignation_confirmed: boolean;
  hr_approved_by: string | null;
  hr_approved_at: string | null;
  hr_note: string | null;
  admin_approved_by: string | null;
  admin_approved_at: string | null;
  admin_note: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  transferred_by: string | null;
  transferred_at: string | null;
  settled_at: string | null;
  applied_period_id: string | null;
  requested_at: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type SalaryAdvanceWithDetails = SalaryAdvance & {
  employee_name: string;
  employment_type: string | null;
  hire_date: string | null;
  employee_status: string;
  employee_user_id: string | null;
  employee_email: string | null;
};

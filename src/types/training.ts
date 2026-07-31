// Tipos del módulo de Fondo de Capacitaciones

export type TrainingRequestStatus =
  | 'requested'
  | 'leader_approved'
  | 'hr_approved'
  | 'invoice_uploaded'
  | 'initial_paid'
  | 'certificate_uploaded'
  | 'completed'
  | 'rejected'
  | 'cancelled';

export type TrainingCurrency = 'USD' | 'ARS';
export type TrainingModality = 'online' | 'presencial';

export type TrainingRequest = {
  id: string;
  employee_id: string;
  budget_year: number;
  course_name: string;
  provider: string | null;
  modality: TrainingModality | null;
  hours: number | null;
  start_date: string | null;
  end_date: string | null;
  link: string | null;
  objective: string | null;
  role_relation: string | null;
  cost: number;
  currency: TrainingCurrency;
  cost_usd: number | null;
  mep_at_approval: number | null;
  status: TrainingRequestStatus;
  leader_id: string | null;
  leader_approved_by: string | null;
  leader_approved_at: string | null;
  leader_comment: string | null;
  hr_approved_by: string | null;
  hr_approved_at: string | null;
  hr_comment: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  cancelled_at: string | null;
  invoice_initial_path: string | null;
  invoice_final_path: string | null;
  certificate_path: string | null;
  initial_paid_period_id: string | null;
  initial_paid_amount_ars: number | null;
  initial_paid_mep: number | null;
  initial_paid_at: string | null;
  final_paid_period_id: string | null;
  final_paid_amount_ars: number | null;
  final_paid_mep: number | null;
  final_paid_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type TrainingRequestWithDetails = TrainingRequest & {
  employee_name: string;
  employment_type: string | null;
  hire_date: string | null;
  department_id: string | null;
  employee_user_id: string | null;
  employee_email: string | null;
  leader_name: string | null;
};

export type TrainingBudget = {
  year: number;
  total_usd: number;
  committed_usd: number; // aprobado no ejecutado
  consumed_usd: number; // pagado / finalizado
  available_usd: number; // total − comprometido − consumido
};

// Resultado de la validación de una solicitud (precondiciones)
export type TrainingRequestEval = {
  seniorityOk: boolean;
  budgetOk: boolean; // sólo confiable para USD; para ARS se difiere al aprobar
  perRequestCapOk: boolean;
  budgetCheckDeferred: boolean; // true para ARS (se valida al fijar el USD en la aprobación)
  canRequest: boolean;
  reason?: string;
};

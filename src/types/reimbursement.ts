// Tipos del módulo de Reintegros de gastos.
// Espeja los enums de db/migration-expense-reimbursements.sql.

export type ReimbursementStatus =
  | 'requested'
  | 'leader_approved'
  | 'admin_validated'
  | 'to_pay'
  | 'paid'
  | 'rejected'
  | 'cancelled';

export type ReimbursementCurrency = 'ARS' | 'USD';

/** Motivo del gasto. Configurable desde el admin, no una lista fija en el código. */
export type ExpenseReason = {
  id: string;
  name: string;
  active: boolean;
  sort_order: number;
};

export type ReimbursementReceiptType =
  | 'factura_a'
  | 'factura_b'
  | 'factura_c'
  | 'ticket'
  | 'recibo'
  | 'otro';

export type ReimbursementPaymentMethod = 'payroll' | 'transfer';

export type ExpenseProject = {
  id: string;
  name: string;
  client_name: string | null;
  active: boolean;
};

export type Reimbursement = {
  id: string;
  employee_id: string;
  leader_id: string | null;

  expense_date: string;
  reason_id: string | null;
  /** Nombre del motivo al momento de pedirlo: sobrevive a que se renombre o se retire. */
  reason_label_snapshot: string | null;
  /** Descripción libre de qué se gastó. */
  concept: string;
  amount: number;
  currency: ReimbursementCurrency;

  project_id: string | null;
  project_label_snapshot: string | null;

  receipt_type: ReimbursementReceiptType;
  receipt_number: string | null;
  supplier_cuit: string | null;
  receipt_filename: string | null;

  status: ReimbursementStatus;

  leader_approved_at: string | null;
  leader_comment: string | null;

  admin_validated_at: string | null;
  admin_comment: string | null;
  fiscal_receipt_ok: boolean;
  imputation_ok: boolean;
  /** null = se aprobó el monto pedido completo. */
  approved_amount: number | null;

  rejected_at: string | null;
  rejection_reason: string | null;
  cancelled_at: string | null;

  payment_method: ReimbursementPaymentMethod | null;
  pay_year: number | null;
  pay_month: number | null;
  estimated_payment_date: string | null;
  amount_ars: number | null;
  fx_rate: number | null;
  paid_at: string | null;
  payment_receipt_path: string | null;

  /** Snapshot de las reglas evaluadas al solicitar, y el motivo si hizo falta. */
  validations: {
    rules?: { label: string; ok: boolean; detail?: string }[];
    justification?: string | null;
    evaluated_on?: string;
  } | null;

  created_at: string;
  updated_at: string;
};

/** Fila de la vista expense_reimbursements_with_details. */
export type ReimbursementWithDetails = Reimbursement & {
  employee_name: string;
  employee_email: string | null;
  employee_user_id: string | null;
  department_name: string | null;
  employment_type: string | null;
  leader_name: string | null;
  project_name: string | null;
  project_client: string | null;
  reason_name: string | null;
};

export type ReimbursementEvent = {
  id: string;
  event_type: string;
  from_status: ReimbursementStatus | null;
  to_status: ReimbursementStatus | null;
  actor_name: string | null;
  note: string | null;
  created_at: string;
};

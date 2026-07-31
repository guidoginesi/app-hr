// Motor del Fondo de Capacitaciones: cálculo de budget + validación de solicitud.
// Budget en USD por persona/año. El USD de un curso en ARS se fija al aprobar HR
// (con MEP manual), así que la validación de saldo/tope es exacta para USD y se
// difiere al aprobar para ARS.

import type {
  TrainingBudget,
  TrainingCurrency,
  TrainingRequestEval,
  TrainingRequestStatus,
} from '@/types/training';

// Estados que reservan budget (aprobado no ejecutado)
const COMMITTED_STATUSES: TrainingRequestStatus[] = [
  'hr_approved',
  'invoice_uploaded',
  'initial_paid',
  'certificate_uploaded',
];
// Estado consumido (pagado / finalizado)
const CONSUMED_STATUS: TrainingRequestStatus = 'completed';

type BudgetInputRow = { status: TrainingRequestStatus; cost_usd: number | null };

/**
 * Calcula el budget de una persona para un año: total, comprometido, consumido y
 * disponible. Rechazadas/canceladas y las previas a la aprobación de HR no reservan.
 */
export function computeBudget(totalUsd: number, requests: BudgetInputRow[]): TrainingBudget & { year?: number } {
  let committed = 0;
  let consumed = 0;
  for (const r of requests) {
    const usd = Number(r.cost_usd ?? 0);
    if (COMMITTED_STATUSES.includes(r.status)) committed += usd;
    else if (r.status === CONSUMED_STATUS) consumed += usd;
  }
  const available = Math.max(0, totalUsd - committed - consumed);
  return {
    year: 0,
    total_usd: totalUsd,
    committed_usd: committed,
    consumed_usd: consumed,
    available_usd: available,
  };
}

function monthsBetween(from: Date, to: Date): number {
  return (
    (to.getFullYear() - from.getFullYear()) * 12 +
    (to.getMonth() - from.getMonth()) -
    (to.getDate() < from.getDate() ? 1 : 0)
  );
}

/**
 * Valida las precondiciones de una nueva solicitud:
 * - antigüedad ≥ 6 meses
 * - saldo disponible (para USD: costo ≤ disponible; para ARS: sólo que haya saldo)
 * - tope por solicitud ≤ budget anual (para USD)
 */
export function evaluateTrainingRequest(input: {
  hireDate: string | null;
  now: Date;
  budget: TrainingBudget;
  cost: number;
  currency: TrainingCurrency;
}): TrainingRequestEval {
  const { hireDate, now, budget, cost, currency } = input;

  const seniorityOk = hireDate ? monthsBetween(new Date(hireDate), now) >= 6 : false;
  const perRequestCap = budget.total_usd;

  let budgetOk: boolean;
  let perRequestCapOk: boolean;
  let deferred = false;
  let reason: string | undefined;

  if (currency === 'USD') {
    perRequestCapOk = cost <= perRequestCap;
    budgetOk = cost <= budget.available_usd;
  } else {
    // ARS: el USD se fija al aprobar → sólo exigimos que haya saldo
    deferred = true;
    perRequestCapOk = true;
    budgetOk = budget.available_usd > 0;
  }

  if (!seniorityOk) reason = 'Necesitás al menos 6 meses de antigüedad.';
  else if (currency === 'USD' && !perRequestCapOk)
    reason = `El monto no puede superar USD ${perRequestCap} por solicitud.`;
  else if (!budgetOk)
    reason =
      currency === 'USD'
        ? 'El monto supera tu saldo disponible.'
        : 'No tenés saldo disponible este año.';

  const canRequest = seniorityOk && budgetOk && perRequestCapOk;

  return { seniorityOk, budgetOk, perRequestCapOk, budgetCheckDeferred: deferred, canRequest, reason };
}

// ---------- Labels ----------
export const TRAINING_STATUS_LABELS: Record<TrainingRequestStatus, string> = {
  requested: 'Solicitado',
  leader_approved: 'Aprobado por líder',
  hr_approved: 'Aprobado por HR',
  invoice_uploaded: 'Factura cargada',
  initial_paid: 'En curso (pago 50%)',
  certificate_uploaded: 'Certificado cargado',
  completed: 'Finalizado',
  rejected: 'Rechazado',
  cancelled: 'Cancelado',
};

export const TRAINING_MODALITY_LABELS: Record<string, string> = {
  online: 'Online',
  presencial: 'Presencial',
};

// Pasos del stepper (para el portal), en orden
export const TRAINING_STEPS: { key: TrainingRequestStatus; label: string }[] = [
  { key: 'requested', label: 'Solicitado' },
  { key: 'leader_approved', label: 'Aprob. líder' },
  { key: 'hr_approved', label: 'Aprob. HR' },
  { key: 'invoice_uploaded', label: 'Factura' },
  { key: 'initial_paid', label: 'Pago 50%' },
  { key: 'certificate_uploaded', label: 'Certificado' },
  { key: 'completed', label: 'Pago final' },
];

export const USD = (n: number) =>
  `USD ${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(n)}`;

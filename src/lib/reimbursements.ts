// Reglas, labels y transiciones del módulo de Reintegros de gastos.
//
// Todo lo que decide "qué se puede hacer" vive acá y no en las rutas, para que el
// portal, la cola del líder y el panel de Administración no puedan discrepar.

import type {
  ReimbursementCurrency,
  ReimbursementPaymentMethod,
  ReimbursementReceiptType,
  ReimbursementStatus,
} from '@/types/reimbursement';

// ── Labels ───────────────────────────────────────────────────────────────────

// Los motivos ya NO viven acá: son configurables en la tabla expense_reasons, para
// que People pueda agregar o retirar uno sin un deploy. El label que se muestra en
// un reintegro viejo sale de reason_label_snapshot.

export const RECEIPT_TYPE_LABELS: Record<ReimbursementReceiptType, string> = {
  factura_a: 'Factura A',
  factura_b: 'Factura B',
  factura_c: 'Factura C',
  ticket: 'Ticket',
  recibo: 'Recibo',
  otro: 'Otro',
};

export const RECEIPT_TYPES: { value: ReimbursementReceiptType; label: string }[] = (
  Object.keys(RECEIPT_TYPE_LABELS) as ReimbursementReceiptType[]
).map((value) => ({ value, label: RECEIPT_TYPE_LABELS[value] }));

/**
 * Dos juegos de etiquetas para los mismos estados. El colaborador no tiene por
 * qué leer el organigrama interno en un estado: "Aprobado por tu líder" le dice
 * algo, "leader_approved" no.
 */
export const STATUS_LABELS_EMPLOYEE: Record<ReimbursementStatus, string> = {
  requested: 'Enviado',
  leader_approved: 'Aprobado por tu líder',
  admin_validated: 'Validado por Administración',
  to_pay: 'A pagar',
  paid: 'Pagado',
  rejected: 'Rechazado',
  cancelled: 'Cancelado',
};

export const STATUS_LABELS_ADMIN: Record<ReimbursementStatus, string> = {
  requested: 'Esperando al líder',
  leader_approved: 'A validar',
  admin_validated: 'Validado',
  to_pay: 'A pagar',
  paid: 'Pagado',
  rejected: 'Rechazado',
  cancelled: 'Cancelado',
};

export const PAYMENT_METHOD_LABELS: Record<ReimbursementPaymentMethod, string> = {
  payroll: 'Con la liquidación',
  transfer: 'Transferencia',
};

/** Estados en los que el reintegro sigue en curso. */
export const OPEN_STATUSES: ReimbursementStatus[] = [
  'requested',
  'leader_approved',
  'admin_validated',
  'to_pay',
];

export const TERMINAL_STATUSES: ReimbursementStatus[] = ['paid', 'rejected', 'cancelled'];

/** Pasos del seguimiento que ve el colaborador, en orden. */
export const STEPS: { key: ReimbursementStatus; label: string }[] = [
  { key: 'requested', label: 'Enviado' },
  { key: 'leader_approved', label: 'Aprob. líder' },
  { key: 'admin_validated', label: 'Validado' },
  { key: 'to_pay', label: 'A pagar' },
  { key: 'paid', label: 'Pagado' },
];

// ── Política ─────────────────────────────────────────────────────────────────

/**
 * Días hacia atrás que se aceptan sin justificar. Pasado ese plazo la solicitud
 * NO se bloquea: avanza como excepción y pide motivo, igual que en adelantos.
 * Bloquear haría que un gasto real quede sin reintegrar por un trámite.
 */
export const RETRO_DAYS = 60;

/** Monto a partir del cual se pide justificación, en la moneda del gasto. */
export const JUSTIFY_OVER = { ARS: 300_000, USD: 300 } as const;

/**
 * Día de corte del ciclo de pago: validado hasta el 20 entra en la liquidación de
 * ese mes; después del 20, al mes siguiente.
 */
export const CUTOFF_DAY = 20;

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const ALLOWED_MIMES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

// ── Cálculos ─────────────────────────────────────────────────────────────────

/** Fecha de HOY en Argentina como YYYY-MM-DD, sin depender de la zona del server. */
export function todayInArgentina(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/**
 * Período de pago según el día de corte, y el último día de ese mes como fecha
 * estimada.
 *
 * Se calcula una sola vez, al agendar el pago, y se persiste: si se recalculara
 * en cada lectura, la fecha que vio el solicitante cambiaría sola al pasar el 20.
 */
export function resolvePaymentPeriod(validatedOn: string): {
  pay_year: number;
  pay_month: number;
  estimated_payment_date: string;
} {
  const [y, m, d] = validatedOn.split('-').map(Number);
  let year = y;
  let month = m;
  if (d > CUTOFF_DAY) {
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  // Día 0 del mes siguiente = último día de este mes, sin tabla de meses.
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    pay_year: year,
    pay_month: month,
    estimated_payment_date: `${year}-${pad(month)}-${pad(lastDay)}`,
  };
}

export type ReimbursementEvaluation = {
  /** Reglas informativas: ninguna bloquea, pero las que fallan piden motivo. */
  rules: { label: string; ok: boolean; detail?: string }[];
  requiresReason: boolean;
};

/**
 * Evalúa una solicitud antes de enviarla. Es informativo a propósito: el
 * resultado no impide enviar, sólo obliga a explicar. Quien decide es el líder.
 */
export function evaluateRequest(input: {
  expenseDate: string;
  amount: number;
  currency: ReimbursementCurrency;
  today?: string;
}): ReimbursementEvaluation {
  const today = input.today ?? todayInArgentina();
  const rules: ReimbursementEvaluation['rules'] = [];

  const dias = daysBetween(input.expenseDate, today);
  const dentroDePlazo = dias <= RETRO_DAYS;
  rules.push({
    label: `El gasto es de los últimos ${RETRO_DAYS} días`,
    ok: dentroDePlazo,
    detail: dentroDePlazo ? undefined : `El gasto es de hace ${dias} días`,
  });

  // Un gasto futuro casi siempre es un error de tipeo en la fecha.
  const noEsFuturo = dias >= 0;
  rules.push({ label: 'La fecha del gasto no es futura', ok: noEsFuturo });

  const tope = JUSTIFY_OVER[input.currency];
  const bajoTope = input.amount <= tope;
  rules.push({
    label: `El monto no supera ${input.currency} ${tope.toLocaleString('es-AR')}`,
    ok: bajoTope,
  });

  return { rules, requiresReason: rules.some((r) => !r.ok) };
}

function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

// ── Máquina de estados ───────────────────────────────────────────────────────

export type ReimbursementAction =
  | 'approve_leader'
  | 'reject'
  | 'validate_admin'
  | 'schedule_payment'
  | 'mark_paid'
  | 'cancel';

export type ActorRole = 'employee' | 'leader' | 'admin' | 'administracion';

/**
 * Desde qué estado se puede hacer cada acción y quién puede hacerla.
 *
 * `admin` aparece en las acciones del líder y de Administración a propósito: sin
 * eso, un reintegro de alguien sin líder cargado quedaría trabado para siempre
 * (la decisión fue que esos casos caen en la cola de People).
 */
export const TRANSITIONS: Record<
  ReimbursementAction,
  { from: ReimbursementStatus[]; to: ReimbursementStatus; actors: ActorRole[] }
> = {
  approve_leader: { from: ['requested'], to: 'leader_approved', actors: ['leader', 'admin'] },
  reject: {
    from: ['requested', 'leader_approved', 'admin_validated'],
    to: 'rejected',
    actors: ['leader', 'admin', 'administracion'],
  },
  validate_admin: { from: ['leader_approved'], to: 'admin_validated', actors: ['admin', 'administracion'] },
  schedule_payment: { from: ['admin_validated'], to: 'to_pay', actors: ['admin', 'administracion'] },
  mark_paid: { from: ['to_pay'], to: 'paid', actors: ['admin', 'administracion'] },
  // Sólo antes de que Administración lo valide: después ya está imputado a un
  // período de pago y cancelarlo dejaría la liquidación inconsistente.
  cancel: { from: ['requested', 'leader_approved'], to: 'cancelled', actors: ['employee'] },
};

export function canDo(action: ReimbursementAction, status: ReimbursementStatus, actor: ActorRole): boolean {
  const t = TRANSITIONS[action];
  return t.from.includes(status) && t.actors.includes(actor);
}

/** Monto que efectivamente se reintegra. */
export function payableAmount(r: { amount: number; approved_amount: number | null }): number {
  return r.approved_amount ?? r.amount;
}

export const money = (n: number, currency: ReimbursementCurrency | string = 'ARS') =>
  `${currency} ${new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`;

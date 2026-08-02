// Estado de recepción del recibo de sueldo.
// Registra RECEPCIÓN (que la persona accedió al documento), NO conformidad con lo liquidado.

export type ReceiptStatus = 'no_publicado' | 'no_requiere' | 'pendiente' | 'recibido';

export type ReceiptLike = {
  status?: string | null;
  requires_acknowledgement?: boolean | null;
  acknowledged_at?: string | null;
  pdf_storage_path?: string | null;
  pdf2_storage_path?: string | null;
};

export function hasPdf(s: ReceiptLike): boolean {
  return Boolean(s.pdf_storage_path || s.pdf2_storage_path);
}

/** Estado del acuse para un settlement. */
export function receiptStatus(s: ReceiptLike): ReceiptStatus {
  if (s.status !== 'SENT' || !hasPdf(s)) return 'no_publicado';
  if (s.acknowledged_at) return 'recibido';
  if (s.requires_acknowledgement === false) return 'no_requiere';
  return 'pendiente';
}

/** ¿Cuenta como pendiente para métricas y recordatorios? */
export function isPendingAck(s: ReceiptLike): boolean {
  return receiptStatus(s) === 'pendiente';
}

export const RECEIPT_STATUS_LABELS: Record<ReceiptStatus, string> = {
  no_publicado: 'No publicado',
  no_requiere: 'Sin acuse requerido',
  pendiente: 'Pendiente',
  recibido: 'Recibido',
};

/** Fecha/hora de la constancia, formateada para mostrar al colaborador. */
export function formatAcknowledgedAt(iso: string): string {
  return new Date(iso).toLocaleString('es-AR', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export type PayslipSlot = 1 | 2;

export function parsePayslipSlot(value: string | null | undefined): PayslipSlot {
  return value === '2' ? 2 : 1;
}

export function payslipHasAnyPdf(payslip: {
  pdf_storage_path?: string | null;
  pdf2_storage_path?: string | null;
} | null): boolean {
  return Boolean(payslip?.pdf_storage_path || payslip?.pdf2_storage_path);
}

export function payslipHasBothPdfs(payslip: {
  pdf_storage_path?: string | null;
  pdf2_storage_path?: string | null;
} | null): boolean {
  return Boolean(payslip?.pdf_storage_path && payslip?.pdf2_storage_path);
}

/**
 * Path del PDF en Storage.
 * La versión 1 conserva el path histórico (no se tocan los recibos ya subidos);
 * a partir de la v2 se escribe en un path nuevo para NO pisar el archivo que el
 * colaborador pudo haber confirmado (evidencia).
 */
export function payslipStoragePath(
  employeeId: string,
  periodKey: string,
  slot: PayslipSlot,
  version = 1
): string {
  const suffix = slot === 2 ? '-2' : '';
  const versionSuffix = version > 1 ? `-v${version}` : '';
  return `${employeeId}/${periodKey}${suffix}${versionSuffix}.pdf`;
}

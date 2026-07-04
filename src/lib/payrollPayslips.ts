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

export function payslipStoragePath(
  employeeId: string,
  periodKey: string,
  slot: PayslipSlot
): string {
  return slot === 2
    ? `${employeeId}/${periodKey}-2.pdf`
    : `${employeeId}/${periodKey}.pdf`;
}

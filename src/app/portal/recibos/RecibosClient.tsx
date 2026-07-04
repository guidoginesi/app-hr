'use client';

import { useState } from 'react';
import { Button } from '@pow/ui/components/ui/button';
import { PageHeader } from '@pow/ui/components/ui/page-header';
import { formatPayrollPeriodLabelFromKey, type PayrollPeriodType } from '@/lib/payrollPeriods';
import { payslipHasAnyPdf, type PayslipSlot } from '@/lib/payrollPayslips';

type Settlement = {
  id: string;
  period_year: number;
  period_month: number;
  period_type?: PayrollPeriodType | null;
  pdf_storage_path: string | null;
  pdf_filename: string | null;
  pdf_uploaded_at: string | null;
  pdf2_storage_path: string | null;
  pdf2_filename: string | null;
  pdf2_uploaded_at: string | null;
};

type RecibosClientProps = {
  settlements: Settlement[];
};

function DownloadButton({
  label,
  loading,
  onClick,
  outline = false,
}: {
  label: string;
  loading: boolean;
  onClick: () => void;
  outline?: boolean;
}) {
  return (
    <Button onClick={onClick} loading={loading} variant={outline ? 'outline' : 'primary'}>
      <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
      {label}
    </Button>
  );
}

export function RecibosClient({ settlements }: RecibosClientProps) {
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async (settlementId: string, slot: PayslipSlot, filename: string) => {
    const downloadKey = `${settlementId}-${slot}`;
    setDownloadingKey(downloadKey);
    setError(null);

    try {
      const res = await fetch(`/api/portal/payroll/payslips/${settlementId}?slot=${slot}`);

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Error al descargar el recibo');
        return;
      }

      const contentType = res.headers.get('Content-Type') || '';

      if (contentType.includes('application/pdf')) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || `recibo-${slot}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        const data = await res.json();
        if (data.url) window.open(data.url, '_blank');
        else setError('No se pudo obtener el enlace al recibo');
      }
    } catch {
      setError('Error al descargar el recibo');
    } finally {
      setDownloadingKey(null);
    }
  };

  const settlementsWithPayslips = settlements.filter((s) =>
    payslipHasAnyPdf({
      pdf_storage_path: s.pdf_storage_path,
      pdf2_storage_path: s.pdf2_storage_path,
    })
  );

  const availableSlots = (settlement: Settlement): PayslipSlot[] => {
    const slots: PayslipSlot[] = [];
    if (settlement.pdf_storage_path) slots.push(1);
    if (settlement.pdf2_storage_path) slots.push(2);
    return slots;
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Recibos de sueldo" description="Descargá tus recibos de sueldo mensuales" />

      {error && (
        <div className="rounded-lg border border-danger/20 bg-danger-subtle px-4 py-3">
          <p className="text-sm text-[var(--red-600)]">{error}</p>
        </div>
      )}

      {settlementsWithPayslips.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-white px-6 py-12 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
            <svg className="h-6 w-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="mt-4 text-sm font-medium text-foreground">No hay recibos disponibles</p>
          <p className="mt-1 text-sm text-muted-foreground">Cuando se suban tus recibos de sueldo, aparecerán aquí.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--border)] bg-white shadow-sm">
          <ul className="divide-y divide-[var(--border)]">
            {settlementsWithPayslips.map((settlement) => {
              const slots = availableSlots(settlement);

              return (
                <li key={settlement.id} className="flex items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                      <svg className="h-5 w-5 text-secondary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {formatPayrollPeriodLabelFromKey({
                          year: settlement.period_year,
                          month: settlement.period_month,
                          period_type: settlement.period_type ?? 'MONTHLY',
                        })}
                      </p>
                      {settlement.pdf_uploaded_at && (
                        <p className="text-xs text-muted-foreground">
                          Subido el {new Date(settlement.pdf_uploaded_at).toLocaleDateString('es-AR')}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {slots.map((slot) => {
                      const filename =
                        slot === 1
                          ? settlement.pdf_filename || `recibo-1-${settlement.period_month}-${settlement.period_year}.pdf`
                          : settlement.pdf2_filename || `recibo-2-${settlement.period_month}-${settlement.period_year}.pdf`;
                      const downloadKey = `${settlement.id}-${slot}`;

                      return (
                        <DownloadButton
                          key={slot}
                          label={slots.length > 1 ? `PDF ${slot}` : 'Descargar PDF'}
                          loading={downloadingKey === downloadKey}
                          outline={slot === 2}
                          onClick={() => handleDownload(settlement.id, slot, filename)}
                        />
                      );
                    })}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

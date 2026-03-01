'use client';

import { useState } from 'react';

type Settlement = {
  id: string;
  period_year: number;
  period_month: number;
  pdf_storage_path: string | null;
  pdf_filename: string | null;
  pdf_uploaded_at: string | null;
};

type RecibosClientProps = {
  settlements: Settlement[];
};

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export function RecibosClient({ settlements }: RecibosClientProps) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async (settlementId: string) => {
    setDownloadingId(settlementId);
    setError(null);

    try {
      const res = await fetch(`/api/portal/payroll/payslips/${settlementId}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Error al descargar el recibo');
        return;
      }

      window.open(data.url, '_blank');
    } catch {
      setError('Error al descargar el recibo');
    } finally {
      setDownloadingId(null);
    }
  };

  // Filter settlements that have a payslip uploaded
  const settlementsWithPayslips = settlements.filter((s) => s.pdf_storage_path);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Recibos de sueldo</h1>
        <p className="mt-1 text-sm text-zinc-500">Descargá tus recibos de sueldo mensuales</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {settlementsWithPayslips.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white px-6 py-12 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100">
            <svg className="h-6 w-6 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="mt-4 text-sm font-medium text-zinc-900">No hay recibos disponibles</p>
          <p className="mt-1 text-sm text-zinc-500">Cuando se suban tus recibos de sueldo, aparecerán aquí.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
          <ul className="divide-y divide-zinc-200">
            {settlementsWithPayslips.map((settlement) => (
              <li key={settlement.id} className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100">
                    <svg className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-zinc-900">
                      {MONTH_NAMES[settlement.period_month - 1]} {settlement.period_year}
                    </p>
                    {settlement.pdf_uploaded_at && (
                      <p className="text-xs text-zinc-500">
                        Subido el {new Date(settlement.pdf_uploaded_at).toLocaleDateString('es-AR')}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDownload(settlement.id)}
                  disabled={downloadingId === settlement.id}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                >
                  {downloadingId === settlement.id ? (
                    <>
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Descargando...
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Descargar PDF
                    </>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useRef } from 'react';

type Settlement = {
  id: string;
  employee_id: string;
  period_year: number;
  period_month: number;
  period_key: string;
  period_status: string;
  contract_type_snapshot: string;
  first_name: string;
  last_name: string;
  employee_email: string;
  current_employment_type: string;
  sueldo: number | null;
  monotributo: number | null;
  reintegro_internet: number | null;
  reintegro_extraordinario: number | null;
  plus_vacacional: number | null;
  total_a_facturar: number | null;
  status: string;
  invoice_storage_path: string | null;
  invoice_filename: string | null;
  invoice_uploaded_at: string | null;
};

type LiquidacionesClientProps = {
  settlements: Settlement[];
};

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  }).format(value);
}

function InvoiceSection({ settlement, onUploaded }: { settlement: Settlement; onUploaded: (path: string) => void }) {
  const [invoicePath, setInvoicePath] = useState(settlement.invoice_storage_path);
  const [invoiceFilename, setInvoiceFilename] = useState(settlement.invoice_filename);
  const [invoiceUploadedAt, setInvoiceUploadedAt] = useState(settlement.invoice_uploaded_at);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/portal/payroll/invoices/${settlement.id}`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Error al subir la factura');
        return;
      }
      setInvoicePath(data.invoice_storage_path);
      setInvoiceFilename(data.invoice_filename);
      setInvoiceUploadedAt(data.invoice_uploaded_at);
      onUploaded(data.invoice_storage_path);
    } catch {
      setError('Error al subir la factura');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await fetch(`/api/portal/payroll/invoices/${settlement.id}`);
      if (!res.ok) {
        setError('Error al descargar la factura');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = invoiceFilename || 'factura.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setError('Error al descargar la factura');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-zinc-800">Factura</p>
          {invoicePath ? (
            <p className="mt-0.5 text-xs text-zinc-500">
              {invoiceFilename} · Cargada el{' '}
              {invoiceUploadedAt
                ? new Date(invoiceUploadedAt).toLocaleDateString('es-AR')
                : '-'}
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-zinc-500">Pendiente de carga</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {invoicePath && (
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              {downloading ? 'Descargando...' : 'Ver factura'}
            </button>
          )}
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700">
            {uploading ? 'Subiendo...' : invoicePath ? 'Reemplazar' : 'Adjuntar factura'}
            <input
              ref={inputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
                e.target.value = '';
              }}
            />
          </label>
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function SettlementCard({ settlement }: { settlement: Settlement }) {
  const [expanded, setExpanded] = useState(false);
  const [invoicePath, setInvoicePath] = useState(settlement.invoice_storage_path);

  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
      {/* Header — always visible, clickable to expand/collapse */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-6 py-4 text-left transition-colors hover:bg-zinc-50"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100">
            <svg className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div className="text-left">
            <p className="font-semibold text-zinc-900">
              {MONTH_NAMES[settlement.period_month - 1]} {settlement.period_year}
            </p>
            {settlement.contract_type_snapshot === 'MONOTRIBUTO' && settlement.total_a_facturar != null && (
              <p className="text-xs text-zinc-500">
                Total a facturar: {formatCurrency(settlement.total_a_facturar)}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {settlement.contract_type_snapshot === 'MONOTRIBUTO' && (
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
              invoicePath
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-amber-100 text-amber-700'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${
                invoicePath ? 'bg-emerald-500' : 'bg-amber-500'
              }`} />
              {invoicePath ? 'Factura cargada' : 'Factura pendiente'}
            </span>
          )}
          <svg
            className={`h-4 w-4 text-zinc-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Collapsible body */}
      {expanded && (
        <div className="border-t border-zinc-100 px-6 py-5">
          {settlement.contract_type_snapshot === 'MONOTRIBUTO' ? (
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-600">Sueldo</span>
                  <span className="font-medium text-zinc-900">{formatCurrency(settlement.sueldo)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-600">Monotributo</span>
                  <span className="font-medium text-zinc-900">{formatCurrency(settlement.monotributo)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-600">Reintegro Internet</span>
                  <span className="font-medium text-zinc-900">{formatCurrency(settlement.reintegro_internet)}</span>
                </div>
                {(settlement.reintegro_extraordinario ?? 0) > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-600">Reintegro Extraordinario</span>
                    <span className="font-medium text-zinc-900">{formatCurrency(settlement.reintegro_extraordinario)}</span>
                  </div>
                )}
                {(settlement.plus_vacacional ?? 0) > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-600">Plus Vacacional</span>
                    <span className="font-medium text-zinc-900">{formatCurrency(settlement.plus_vacacional)}</span>
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-indigo-900">Total a Facturar</span>
                  <span className="text-lg font-bold text-indigo-700">{formatCurrency(settlement.total_a_facturar)}</span>
                </div>
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-sm text-amber-800">
                  <span className="font-medium">Recordá:</span> emití la factura por el Total a Facturar y adjuntala aquí dentro de 1 día hábil.
                </p>
              </div>

              <InvoiceSection settlement={settlement} onUploaded={(path) => setInvoicePath(path)} />
            </div>
          ) : (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
              <p className="text-sm text-blue-800">
                Tu recibo está disponible en la sección <strong>Recibos de sueldo</strong>.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function LiquidacionesClient({ settlements }: LiquidacionesClientProps) {
  if (settlements.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Mis Liquidaciones</h1>
          <p className="mt-1 text-sm text-zinc-500">Detalle de tus liquidaciones mensuales</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white px-6 py-12 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100">
            <svg className="h-6 w-6 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="mt-4 text-sm font-medium text-zinc-900">No hay liquidaciones enviadas</p>
          <p className="mt-1 text-sm text-zinc-500">Cuando se procesen tus liquidaciones, aparecerán aquí.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Mis Liquidaciones</h1>
        <p className="mt-1 text-sm text-zinc-500">Detalle de tus liquidaciones mensuales</p>
      </div>

      <div className="space-y-4">
        {settlements.map((settlement) => (
          <SettlementCard key={settlement.id} settlement={settlement} />
        ))}
      </div>
    </div>
  );
}

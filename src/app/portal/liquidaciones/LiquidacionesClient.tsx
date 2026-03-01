'use client';

import Link from 'next/link';

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
          <div
            key={settlement.id}
            className="rounded-xl border border-zinc-200 bg-white shadow-sm"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100">
                  <svg className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-zinc-900">
                    {MONTH_NAMES[settlement.period_month - 1]} {settlement.period_year}
                  </h3>
                </div>
              </div>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  settlement.contract_type_snapshot === 'MONOTRIBUTO'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-blue-100 text-blue-700'
                }`}
              >
                {settlement.contract_type_snapshot === 'MONOTRIBUTO'
                  ? 'Monotributo'
                  : 'Relación de Dependencia'}
              </span>
            </div>

            {/* Body */}
            <div className="px-6 py-5">
              {settlement.contract_type_snapshot === 'MONOTRIBUTO' ? (
                <div className="space-y-4">
                  {/* Breakdown */}
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
                    {(settlement.reintegro_extraordinario !== null && settlement.reintegro_extraordinario !== 0) && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-zinc-600">Reintegro Extraordinario</span>
                        <span className="font-medium text-zinc-900">{formatCurrency(settlement.reintegro_extraordinario)}</span>
                      </div>
                    )}
                    {(settlement.plus_vacacional !== null && settlement.plus_vacacional !== 0) && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-zinc-600">Plus Vacacional</span>
                        <span className="font-medium text-zinc-900">{formatCurrency(settlement.plus_vacacional)}</span>
                      </div>
                    )}
                  </div>

                  {/* Total */}
                  <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-indigo-900">Total a Facturar</span>
                      <span className="text-lg font-bold text-indigo-700">{formatCurrency(settlement.total_a_facturar)}</span>
                    </div>
                  </div>

                  {/* Invoice message */}
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                    <p className="text-sm text-amber-800">
                      <span className="font-medium">Importante:</span> Emití la factura por el Total a Facturar y enviala a{' '}
                      <a href="mailto:manuela@pow.la" className="font-medium underline">manuela@pow.la</a>{' '}
                      dentro de 1 día hábil.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
                  <p className="text-sm text-blue-800">
                    Tu recibo está disponible en la sección{' '}
                    <Link href="/portal/recibos" className="font-medium underline hover:text-blue-900">
                      Recibos de sueldo
                    </Link>
                    .
                  </p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

type PeriodStatus = 'DRAFT' | 'IN_REVIEW' | 'SENT' | 'CLOSED';
type SettlementStatus = 'DRAFT' | 'READY_TO_SEND' | 'SENT';
type ContractType = 'MONOTRIBUTO' | 'RELACION_DEPENDENCIA';
type FilterTab = 'all' | 'MONOTRIBUTO' | 'RELACION_DEPENDENCIA';

type PayrollPeriod = {
  id: string;
  year: number;
  month: number;
  status: PeriodStatus;
};

type Settlement = {
  id: string;
  period_id: string;
  employee_id: string;
  employee_name: string;
  contract_type: ContractType;
  status: SettlementStatus;
  base_salary: number;
  monotributo: number;
  internet_reimbursement: number;
  extra_reimbursement: number;
  vacation_bonus: number;
  total: number;
  payslip_url: string | null;
};

function mapSettlement(raw: any): Settlement {
  return {
    id: raw.id,
    period_id: raw.period_id,
    employee_id: raw.employee_id,
    employee_name: [raw.first_name, raw.last_name].filter(Boolean).join(' ') || raw.employee_name || '—',
    contract_type: raw.contract_type_snapshot || raw.contract_type,
    status: raw.status,
    base_salary: Number(raw.sueldo ?? raw.base_salary ?? 0),
    monotributo: Number(raw.monotributo ?? 0),
    internet_reimbursement: Number(raw.reintegro_internet ?? raw.internet_reimbursement ?? 0),
    extra_reimbursement: Number(raw.reintegro_extraordinario ?? raw.extra_reimbursement ?? 0),
    vacation_bonus: Number(raw.plus_vacacional ?? raw.vacation_bonus ?? 0),
    total: Number(raw.total_a_facturar ?? raw.total ?? 0),
    payslip_url: raw.pdf_storage_path || raw.payslip_url || null,
  };
}

const currencyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const periodStatusConfig: Record<PeriodStatus, { label: string; classes: string }> = {
  DRAFT: { label: 'Borrador', classes: 'bg-zinc-100 text-zinc-700' },
  IN_REVIEW: { label: 'En revisión', classes: 'bg-amber-100 text-amber-700' },
  SENT: { label: 'Enviado', classes: 'bg-emerald-100 text-emerald-700' },
  CLOSED: { label: 'Cerrado', classes: 'bg-zinc-100 text-zinc-600' },
};

const settlementStatusConfig: Record<SettlementStatus, { label: string; classes: string }> = {
  DRAFT: { label: 'Borrador', classes: 'bg-zinc-100 text-zinc-700' },
  READY_TO_SEND: { label: 'Listo para enviar', classes: 'bg-amber-100 text-amber-700' },
  SENT: { label: 'Enviado', classes: 'bg-emerald-100 text-emerald-700' },
};

type PayrollPeriodDetailClientProps = {
  periodId: string;
};

export function PayrollPeriodDetailClient({ periodId }: PayrollPeriodDetailClientProps) {
  const [period, setPeriod] = useState<PayrollPeriod | null>(null);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [editedRows, setEditedRows] = useState<Record<string, Partial<Settlement>>>({});
  const [savingRows, setSavingRows] = useState<Record<string, boolean>>({});
  const [uploadingRows, setUploadingRows] = useState<Record<string, boolean>>({});
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/payroll/periods/${periodId}`);
      if (res.ok) {
        const data = await res.json();
        setPeriod(data.period);
        setSettlements((data.settlements || []).map(mapSettlement));
      } else {
        setMessage({ type: 'error', text: 'Error al cargar el periodo' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Error al cargar el periodo' });
    } finally {
      setLoading(false);
    }
  }, [periodId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredSettlements = useMemo(() => {
    if (activeFilter === 'all') return settlements;
    return settlements.filter((s) => s.contract_type === activeFilter);
  }, [settlements, activeFilter]);

  const isEditable = period?.status !== 'CLOSED';

  const handleFieldChange = (settlementId: string, field: string, value: number) => {
    setEditedRows((prev) => ({
      ...prev,
      [settlementId]: { ...prev[settlementId], [field]: value },
    }));
  };

  const getFieldValue = (settlement: Settlement, field: keyof Settlement): number => {
    const edited = editedRows[settlement.id];
    if (edited && field in edited) {
      return edited[field] as number;
    }
    return settlement[field] as number;
  };

  const getRowTotal = (settlement: Settlement): number => {
    return (
      getFieldValue(settlement, 'base_salary') +
      getFieldValue(settlement, 'monotributo') +
      getFieldValue(settlement, 'internet_reimbursement') +
      getFieldValue(settlement, 'extra_reimbursement') +
      getFieldValue(settlement, 'vacation_bonus')
    );
  };

  const hasRowChanges = (settlementId: string): boolean => {
    return !!editedRows[settlementId] && Object.keys(editedRows[settlementId]).length > 0;
  };

  const handleSaveRow = async (settlementId: string) => {
    const edited = editedRows[settlementId];
    if (!edited) return;

    const apiPayload: Record<string, unknown> = {};
    if ('base_salary' in edited) apiPayload.sueldo = edited.base_salary;
    if ('monotributo' in edited) apiPayload.monotributo = edited.monotributo;
    if ('internet_reimbursement' in edited) apiPayload.reintegro_internet = edited.internet_reimbursement;
    if ('extra_reimbursement' in edited) apiPayload.reintegro_extraordinario = edited.extra_reimbursement;
    if ('vacation_bonus' in edited) apiPayload.plus_vacacional = edited.vacation_bonus;
    if ('status' in edited) apiPayload.status = edited.status;

    setSavingRows((prev) => ({ ...prev, [settlementId]: true }));
    try {
      const res = await fetch(`/api/admin/payroll/settlements/${settlementId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiPayload),
      });

      if (res.ok) {
        const updated = await res.json();
        setSettlements((prev) => prev.map((s) => (s.id === settlementId ? mapSettlement(updated) : s)));
        setEditedRows((prev) => {
          const next = { ...prev };
          delete next[settlementId];
          return next;
        });
        setMessage({ type: 'success', text: 'Liquidación guardada' });
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error || 'Error al guardar' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Error al guardar la liquidación' });
    } finally {
      setSavingRows((prev) => ({ ...prev, [settlementId]: false }));
    }
  };

  const handleUploadPdf = async (settlementId: string, file: File) => {
    setUploadingRows((prev) => ({ ...prev, [settlementId]: true }));
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`/api/admin/payroll/settlements/${settlementId}/payslip`, {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const updated = await res.json();
        setSettlements((prev) => prev.map((s) => (s.id === settlementId ? mapSettlement(updated) : s)));
        setMessage({ type: 'success', text: 'Recibo cargado exitosamente' });
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error || 'Error al subir el recibo' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Error al subir el recibo' });
    } finally {
      setUploadingRows((prev) => ({ ...prev, [settlementId]: false }));
    }
  };

  const handlePeriodAction = async (action: string) => {
    setActionLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/payroll/periods/${periodId}/${action}`, {
        method: 'POST',
      });

      if (res.ok) {
        const data = await res.json();
        setPeriod(data.period);
        if (data.settlements) setSettlements(data.settlements.map(mapSettlement));
        setMessage({ type: 'success', text: data.message || 'Acción realizada exitosamente' });
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error || 'Error al realizar la acción' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Error al realizar la acción' });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-zinc-500">Cargando periodo...</p>
      </div>
    );
  }

  if (!period) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-sm font-medium text-zinc-500">Periodo no encontrado</p>
        <Link href="/admin/payroll" className="mt-2 text-sm text-indigo-600 hover:text-indigo-700">
          Volver a periodos
        </Link>
      </div>
    );
  }

  const periodConfig = periodStatusConfig[period.status];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
              Liquidación {MONTH_NAMES[period.month - 1]} {period.year}
            </h1>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${periodConfig.classes}`}>
              {periodConfig.label}
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            {settlements.length} liquidaciones · {filteredSettlements.length} mostradas
          </p>
        </div>
        <div className="flex items-center gap-2">
          {period.status === 'DRAFT' && (
            <>
              <button
                onClick={() => handlePeriodAction('validate-all')}
                disabled={actionLoading}
                className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
              >
                Validar todo
              </button>
              <button
                onClick={() => handlePeriodAction('mark-in-review')}
                disabled={actionLoading}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                Marcar como En Revisión
              </button>
            </>
          )}
          {period.status === 'IN_REVIEW' && (
            <>
              <button
                onClick={() => handlePeriodAction('reopen')}
                disabled={actionLoading}
                className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              >
                Reabrir (volver a borrador)
              </button>
              <button
                onClick={() => handlePeriodAction('send-all')}
                disabled={actionLoading}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                Enviar a todos
              </button>
            </>
          )}
          {period.status === 'SENT' && (
            <button
              onClick={() => handlePeriodAction('close')}
              disabled={actionLoading}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              Cerrar periodo
            </button>
          )}
          {period.status === 'CLOSED' && (
            <span className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-500">
              Periodo cerrado (solo lectura)
            </span>
          )}
        </div>
      </div>

      {message && (
        <div className={`rounded-lg p-4 text-sm ${
          message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
        }`}>
          {message.text}
          <button onClick={() => setMessage(null)} className="ml-2 text-xs underline">
            Cerrar
          </button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-1 rounded-lg bg-zinc-100 p-1">
        {([
          { key: 'all' as FilterTab, label: 'Todos' },
          { key: 'MONOTRIBUTO' as FilterTab, label: 'Monotributo' },
          { key: 'RELACION_DEPENDENCIA' as FilterTab, label: 'Rel. Dependencia' },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveFilter(tab.key)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-all ${
              activeFilter === tab.key
                ? 'bg-white text-zinc-900 shadow-sm'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Settlements Table */}
      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
        {filteredSettlements.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-zinc-500">No hay liquidaciones para mostrar</p>
            <p className="mt-1 text-xs text-zinc-400">
              {settlements.length === 0
                ? 'No se encontraron liquidaciones en este periodo'
                : 'No hay liquidaciones con el filtro seleccionado'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-left">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Empleado</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Tipo</th>
                  {(activeFilter === 'all' || activeFilter === 'MONOTRIBUTO') && (
                    <>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Sueldo</th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Monotributo</th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Reint. Internet</th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Reint. Extra</th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Plus Vac.</th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Total</th>
                    </>
                  )}
                  {activeFilter === 'RELACION_DEPENDENCIA' && (
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">PDF</th>
                  )}
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Estado</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {filteredSettlements.map((settlement) => (
                  <SettlementRow
                    key={settlement.id}
                    settlement={settlement}
                    activeFilter={activeFilter}
                    isEditable={isEditable && settlement.status !== 'SENT'}
                    editedValues={editedRows[settlement.id]}
                    isSaving={!!savingRows[settlement.id]}
                    isUploading={!!uploadingRows[settlement.id]}
                    hasChanges={hasRowChanges(settlement.id)}
                    onFieldChange={handleFieldChange}
                    getFieldValue={getFieldValue}
                    getRowTotal={getRowTotal}
                    onSave={handleSaveRow}
                    onUploadPdf={handleUploadPdf}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

type SettlementRowProps = {
  settlement: Settlement;
  activeFilter: FilterTab;
  isEditable: boolean;
  editedValues: Partial<Settlement> | undefined;
  isSaving: boolean;
  isUploading: boolean;
  hasChanges: boolean;
  onFieldChange: (id: string, field: string, value: number) => void;
  getFieldValue: (settlement: Settlement, field: keyof Settlement) => number;
  getRowTotal: (settlement: Settlement) => number;
  onSave: (id: string) => void;
  onUploadPdf: (id: string, file: File) => void;
};

function SettlementRow({
  settlement,
  activeFilter,
  isEditable,
  isSaving,
  isUploading,
  hasChanges,
  onFieldChange,
  getFieldValue,
  getRowTotal,
  onSave,
  onUploadPdf,
}: SettlementRowProps) {
  const statusConfig = settlementStatusConfig[settlement.status];
  const isMonotributo = settlement.contract_type === 'MONOTRIBUTO';
  const isRelDep = settlement.contract_type === 'RELACION_DEPENDENCIA';

  const numericFields: { key: keyof Settlement; label: string }[] = [
    { key: 'base_salary', label: 'Sueldo' },
    { key: 'monotributo', label: 'Monotributo' },
    { key: 'internet_reimbursement', label: 'Reint. Internet' },
    { key: 'extra_reimbursement', label: 'Reint. Extra' },
    { key: 'vacation_bonus', label: 'Plus Vac.' },
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadPdf(settlement.id, file);
    }
  };

  return (
    <tr className="transition-colors hover:bg-zinc-50">
      <td className="px-4 py-3 text-sm font-medium text-zinc-900">{settlement.employee_name}</td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
          isMonotributo ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
        }`}>
          {isMonotributo ? 'Monotributo' : 'Rel. Dep.'}
        </span>
      </td>

      {/* Monotributo numeric fields (shown when filter is 'all' or 'MONOTRIBUTO') */}
      {(activeFilter === 'all' || activeFilter === 'MONOTRIBUTO') && (
        <>
          {isMonotributo ? (
            <>
              {numericFields.map((field) => (
                <td key={field.key} className="px-4 py-3">
                  {isEditable ? (
                    <input
                      type="number"
                      value={getFieldValue(settlement, field.key)}
                      onChange={(e) => onFieldChange(settlement.id, field.key, parseFloat(e.target.value) || 0)}
                      className="w-28 rounded-lg border border-zinc-300 px-2 py-1.5 text-right text-sm focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                      min={0}
                      step={1}
                    />
                  ) : (
                    <span className="text-sm text-zinc-600">
                      {currencyFormatter.format(settlement[field.key] as number)}
                    </span>
                  )}
                </td>
              ))}
              <td className="px-4 py-3 text-sm font-semibold text-zinc-900">
                {currencyFormatter.format(isEditable ? getRowTotal(settlement) : settlement.total)}
              </td>
            </>
          ) : (
            <>
              {/* Rel. Dependencia rows in mixed view: show empty cells for numeric columns */}
              <td colSpan={5} className="px-4 py-3 text-center text-xs text-zinc-400">
                —
              </td>
              <td className="px-4 py-3">
                {settlement.payslip_url ? (
                  <a
                    href={settlement.payslip_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-emerald-600 hover:text-emerald-700"
                  >
                    ✓ Cargado
                  </a>
                ) : (
                  <span className="text-sm text-zinc-400">No cargado</span>
                )}
              </td>
            </>
          )}
        </>
      )}

      {/* PDF column for Rel. Dependencia filter */}
      {activeFilter === 'RELACION_DEPENDENCIA' && (
        <td className="px-4 py-3">
          {settlement.payslip_url ? (
            <a
              href={settlement.payslip_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-emerald-600 hover:text-emerald-700"
            >
              ✓ Cargado
            </a>
          ) : (
            <span className="text-sm text-zinc-400">No cargado</span>
          )}
        </td>
      )}

      <td className="px-4 py-3">
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusConfig.classes}`}>
          {statusConfig.label}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {isMonotributo && hasChanges && (
            <button
              onClick={() => onSave(settlement.id)}
              disabled={isSaving}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {isSaving ? 'Guardando...' : 'Guardar'}
            </button>
          )}
          {isRelDep && isEditable && settlement.status !== 'SENT' && (
            <label className="cursor-pointer rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100">
              {isUploading ? 'Subiendo...' : 'Subir PDF'}
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="hidden"
                disabled={isUploading}
              />
            </label>
          )}
        </div>
      </td>
    </tr>
  );
}

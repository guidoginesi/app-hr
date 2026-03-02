'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';

async function openPayslipPdf(settlementId: string): Promise<void> {
  const res = await fetch(`/api/admin/payroll/settlements/${settlementId}/payslip`);
  if (!res.ok) {
    alert('No se pudo obtener el PDF');
    return;
  }
  const contentType = res.headers.get('Content-Type') || '';
  if (contentType.includes('application/pdf')) {
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener,noreferrer');
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  } else {
    const data = await res.json();
    if (data.url) window.open(data.url, '_blank', 'noopener,noreferrer');
    else alert('No se pudo obtener el PDF');
  }
}

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
  invoice_storage_path: string | null;
  invoice_filename: string | null;
  invoice_uploaded_at: string | null;
  email_to: string | null;
};

const currencyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});


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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/payroll/periods/${periodId}`);
      const data = await res.json();
      if (res.ok) {
        setPeriod(data.period);
        setSettlements(data.settlements || []);
      } else {
        setMessage({ type: 'error', text: data.error || `Error ${res.status} al cargar el periodo` });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Error de red al cargar el periodo' });
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

    // Translate client field names → DB column names expected by the API
    const apiPayload: Record<string, number> = {};
    if (edited.base_salary !== undefined)          apiPayload.sueldo = edited.base_salary as number;
    if (edited.monotributo !== undefined)           apiPayload.monotributo = edited.monotributo as number;
    if (edited.internet_reimbursement !== undefined) apiPayload.reintegro_internet = edited.internet_reimbursement as number;
    if (edited.extra_reimbursement !== undefined)   apiPayload.reintegro_extraordinario = edited.extra_reimbursement as number;
    if (edited.vacation_bonus !== undefined)        apiPayload.plus_vacacional = edited.vacation_bonus as number;

    setSavingRows((prev) => ({ ...prev, [settlementId]: true }));
    try {
      const res = await fetch(`/api/admin/payroll/settlements/${settlementId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiPayload),
      });

      if (res.ok) {
        // Merge only the edited numeric fields into the existing row to preserve
        // display fields (employee_name, contract_type, etc.) that come from the view
        setSettlements((prev) =>
          prev.map((s) => {
            if (s.id !== settlementId) return s;
            const merged = { ...s, ...edited };
            // Recalculate total from merged values
            merged.total =
              (merged.base_salary ?? 0) +
              (merged.monotributo ?? 0) +
              (merged.internet_reimbursement ?? 0) +
              (merged.extra_reimbursement ?? 0) +
              (merged.vacation_bonus ?? 0);
            return merged;
          })
        );
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

  const handleDeletePdf = async (settlementId: string) => {
    setSettlements((prev) =>
      prev.map((s) => (s.id === settlementId ? { ...s, payslip_url: null } : s))
    );
    setMessage({ type: 'success', text: 'PDF eliminado correctamente' });
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
        setSettlements((prev) => prev.map((s) => (s.id === settlementId ? updated : s)));
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

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredSettlements.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredSettlements.map((s) => s.id)));
    }
  };

  const handlePeriodAction = async (action: string, ids?: string[]) => {
    setActionLoading(true);
    setMessage(null);
    try {
      const body = ids && ids.length > 0 ? JSON.stringify({ settlement_ids: ids }) : undefined;
      const res = await fetch(`/api/admin/payroll/periods/${periodId}/${action}`, {
        method: 'POST',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.period) setPeriod(data.period);
        if (data.settlements) setSettlements(data.settlements);
        // Refresh data to reflect individual settlement status updates
        if (!data.settlements) await fetchData();
        setSelectedIds(new Set());
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

  const handleExport = async () => {
    if (!period) return;
    try {
      const res = await fetch(`/api/admin/payroll/periods/${periodId}/export-excel`);
      if (!res.ok) { setMessage({ type: 'error', text: 'Error al exportar' }); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `liquidaciones_${MONTH_NAMES[period.month - 1]}_${period.year}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setMessage({ type: 'error', text: 'Error al exportar el Excel' });
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`/api/admin/payroll/periods/${periodId}/import-excel`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: data.message || 'Liquidaciones actualizadas' });
        await fetchData();
      } else {
        setMessage({ type: 'error', text: data.error || 'Error al importar' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Error al procesar el archivo Excel' });
    } finally {
      setImporting(false);
      if (importInputRef.current) importInputRef.current.value = '';
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
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        {message && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800 max-w-md text-center">
            {message.text}
          </div>
        )}
        {!message && (
          <p className="text-sm font-medium text-zinc-500">Periodo no encontrado</p>
        )}
        <Link href="/admin/payroll" className="text-sm text-indigo-600 hover:text-indigo-700">
          Volver a periodos
        </Link>
      </div>
    );
  }

  const isClosed = period.status === 'CLOSED';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Liquidación {MONTH_NAMES[period.month - 1]} {period.year}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {settlements.length} liquidaciones · {filteredSettlements.length} mostradas
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Excel export */}
          <button
            onClick={handleExport}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            ↓ Exportar Excel
          </button>

          {/* Excel import */}
          <label className={`cursor-pointer rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 ${importing ? 'opacity-50 pointer-events-none' : ''}`}>
            {importing ? 'Importando...' : '↑ Importar Excel'}
            <input
              ref={importInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleImportFile}
              disabled={importing}
            />
          </label>

          {!isClosed && (
            <button
              onClick={() => handlePeriodAction('send-all')}
              disabled={actionLoading}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {actionLoading ? 'Enviando...' : 'Enviar a todos'}
            </button>
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

      {/* Selection toolbar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
          <span className="text-sm font-medium text-indigo-700">
            {selectedIds.size} {selectedIds.size === 1 ? 'liquidación seleccionada' : 'liquidaciones seleccionadas'}
          </span>
          <div className="ml-auto flex items-center gap-2">
            {!isClosed && (
              <button
                onClick={() => handlePeriodAction('send-all', Array.from(selectedIds))}
                disabled={actionLoading}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                Enviar seleccionados
              </button>
            )}
            <button
              onClick={() => setSelectedIds(new Set())}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
            >
              Deseleccionar
            </button>
          </div>
        </div>
      )}

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
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filteredSettlements.length && filteredSettlements.length > 0}
                      ref={(el) => {
                        if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < filteredSettlements.length;
                      }}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </th>
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
                  {(activeFilter === 'MONOTRIBUTO' || activeFilter === 'all') && (
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Factura</th>
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
                    isSelected={selectedIds.has(settlement.id)}
                    onToggleSelect={toggleSelect}
                    onFieldChange={handleFieldChange}
                    getFieldValue={getFieldValue}
                    getRowTotal={getRowTotal}
                    onSave={handleSaveRow}
                    onUploadPdf={handleUploadPdf}
                    onDeletePdf={handleDeletePdf}
                    onDownloadInvoice={async () => {
                      const res = await fetch(`/api/admin/payroll/settlements/${settlement.id}/invoice`);
                      if (!res.ok) { alert('No se pudo obtener la factura'); return; }
                      const blob = await res.blob();
                      const url = URL.createObjectURL(blob);
                      window.open(url, '_blank', 'noopener,noreferrer');
                      setTimeout(() => URL.revokeObjectURL(url), 10000);
                    }}
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
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onFieldChange: (id: string, field: string, value: number) => void;
  getFieldValue: (settlement: Settlement, field: keyof Settlement) => number;
  getRowTotal: (settlement: Settlement) => number;
  onSave: (id: string) => void;
  onUploadPdf: (id: string, file: File) => void;
  onDeletePdf: (id: string) => void;
  onDownloadInvoice: () => void;
};

function SettlementRow({
  settlement,
  activeFilter,
  isEditable,
  isSaving,
  isUploading,
  hasChanges,
  isSelected,
  onToggleSelect,
  onFieldChange,
  getFieldValue,
  getRowTotal,
  onSave,
  onUploadPdf,
  onDeletePdf,
  onDownloadInvoice,
}: SettlementRowProps) {
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [deletingPdf, setDeletingPdf] = useState(false);
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);

  const handleViewPdf = async () => {
    setLoadingPdf(true);
    try {
      await openPayslipPdf(settlement.id);
    } finally {
      setLoadingPdf(false);
    }
  };

  const handleDeletePdf = async () => {
    if (!confirm('¿Eliminás el PDF cargado? Esta acción no se puede deshacer.')) return;
    setDeletingPdf(true);
    try {
      const res = await fetch(`/api/admin/payroll/settlements/${settlement.id}/payslip`, {
        method: 'DELETE',
      });
      if (res.ok) {
        onDeletePdf(settlement.id);
      } else {
        const data = await res.json();
        alert(data.error || 'Error al eliminar el PDF');
      }
    } finally {
      setDeletingPdf(false);
    }
  };

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
    <tr className={`transition-colors hover:bg-zinc-50 ${isSelected ? 'bg-indigo-50' : ''}`}>
      <td className="w-10 px-4 py-3">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(settlement.id)}
          className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
        />
      </td>
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
              {/* Rel. Dep. rows in mixed view: span all 6 numeric columns (Sueldo→Total) */}
              <td colSpan={6} className="px-4 py-3 text-center text-xs text-zinc-400">—</td>
            </>
          )}
        </>
      )}

      {/* PDF column for Rel. Dependencia filter */}
      {activeFilter === 'RELACION_DEPENDENCIA' && (
        <td className="px-4 py-3">
          {settlement.payslip_url ? (
            <button
              onClick={handleViewPdf}
              disabled={loadingPdf}
              className="text-xs font-medium text-emerald-600 hover:text-emerald-700 disabled:opacity-50"
            >
              {loadingPdf ? 'Abriendo...' : '✓ Ver PDF'}
            </button>
          ) : (
            <span className="text-xs text-zinc-400">No cargado</span>
          )}
        </td>
      )}

      {/* Factura column for Monotributo and all filters */}
      {(activeFilter === 'MONOTRIBUTO' || activeFilter === 'all') && (
        <td className="px-4 py-3">
          {isMonotributo ? (
            settlement.invoice_storage_path ? (
              <button
                onClick={async () => { setDownloadingInvoice(true); await onDownloadInvoice(); setDownloadingInvoice(false); }}
                disabled={downloadingInvoice}
                className="text-xs font-medium text-emerald-600 hover:text-emerald-700 disabled:opacity-50"
              >
                {downloadingInvoice ? 'Abriendo...' : '✓ Ver factura'}
              </button>
            ) : (
              <span className="text-xs font-medium text-amber-600">Pendiente</span>
            )
          ) : (
            <span className="text-xs text-zinc-300">—</span>
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
            settlement.payslip_url ? (
              <button
                onClick={handleDeletePdf}
                disabled={deletingPdf}
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
              >
                {deletingPdf ? 'Eliminando...' : 'Eliminar PDF'}
              </button>
            ) : (
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
            )
          )}
        </div>
      </td>
    </tr>
  );
}

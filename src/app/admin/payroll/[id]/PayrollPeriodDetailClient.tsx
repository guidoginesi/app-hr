'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  formatPayrollPeriodLabelFromKey,
  type PayrollPeriodType,
} from '@/lib/payrollPeriods';

import { payslipHasBothPdfs, type PayslipSlot } from '@/lib/payrollPayslips';
import { Button } from '@pow/ui/components/ui/button';
import { SkeletonRows } from '@pow/ui/components/ui/skeleton';
import { ReceiptAcknowledgementSection } from './ReceiptAcknowledgementSection';

async function openPayslipPdf(settlementId: string, slot: PayslipSlot = 1): Promise<void> {
  const res = await fetch(`/api/admin/payroll/settlements/${settlementId}/payslip?slot=${slot}`);
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

type PeriodStatus = 'DRAFT' | 'IN_REVIEW' | 'SENT' | 'CLOSED';
type SettlementStatus = 'DRAFT' | 'READY_TO_SEND' | 'SENT';
type ContractType = 'MONOTRIBUTO' | 'RELACION_DEPENDENCIA';
type FilterTab = 'all' | 'MONOTRIBUTO' | 'RELACION_DEPENDENCIA';

type PayrollPeriod = {
  id: string;
  year: number;
  month: number;
  period_type?: PayrollPeriodType;
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
  annual_bonus: number;
  aguinaldo: number;
  salary_advance: number;
  total: number;
  payslip_url: string | null;
  payslip2_url: string | null;
  invoice_storage_path: string | null;
  invoice_filename: string | null;
  invoice_uploaded_at: string | null;
  email_to: string | null;
  employee_email?: string | null;
  employee_user_id?: string | null;
  sent_at?: string | null;
  requires_acknowledgement?: boolean | null;
  acknowledged_at?: string | null;
};

const currencyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});


const settlementStatusConfig: Record<SettlementStatus, { label: string; classes: string }> = {
  DRAFT: { label: 'Borrador', classes: 'bg-secondary text-secondary-foreground' },
  READY_TO_SEND: { label: 'Listo para enviar', classes: 'bg-warning-subtle text-[var(--amber-600)]' },
  SENT: { label: 'Enviado', classes: 'bg-success-subtle text-[var(--green-700)]' },
};

type PayrollPeriodDetailClientProps = {
  periodId: string;
  /** Administración: ve todo, no toca nada. Las rutas lo vuelven a chequear. */
  soloLectura?: boolean;
};

export function PayrollPeriodDetailClient({ periodId, soloLectura = false }: PayrollPeriodDetailClientProps) {
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
  const [claimingInvoices, setClaimingInvoices] = useState(false);
  const [remindingReceipts, setRemindingReceipts] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Settlement; direction: 'asc' | 'desc' } | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const handleSort = (key: keyof Settlement) => {
    setSortConfig((prev) => {
      if (!prev || prev.key !== key) return { key, direction: 'asc' };
      if (prev.direction === 'asc') return { key, direction: 'desc' };
      return null;
    });
  };

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
    const base = activeFilter === 'all' ? settlements : settlements.filter((s) => s.contract_type === activeFilter);
    if (!sortConfig) return base;
    return [...base].sort((a, b) => {
      const aVal = a[sortConfig.key] ?? '';
      const bVal = b[sortConfig.key] ?? '';
      const cmp = typeof aVal === 'number' && typeof bVal === 'number'
        ? aVal - bVal
        : String(aVal).localeCompare(String(bVal), 'es');
      return sortConfig.direction === 'asc' ? cmp : -cmp;
    });
  }, [settlements, activeFilter, sortConfig]);

  const isPeriodOpen = period?.status !== 'CLOSED';
  const isEditable = isPeriodOpen;

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
      getFieldValue(settlement, 'vacation_bonus') +
      getFieldValue(settlement, 'annual_bonus') +
      getFieldValue(settlement, 'aguinaldo') -
      getFieldValue(settlement, 'salary_advance')
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
    if (edited.base_salary !== undefined)            apiPayload.sueldo = edited.base_salary as number;
    if (edited.monotributo !== undefined)            apiPayload.monotributo = edited.monotributo as number;
    if (edited.internet_reimbursement !== undefined) apiPayload.reintegro_internet = edited.internet_reimbursement as number;
    if (edited.extra_reimbursement !== undefined)    apiPayload.reintegro_extraordinario = edited.extra_reimbursement as number;
    if (edited.vacation_bonus !== undefined)         apiPayload.plus_vacacional = edited.vacation_bonus as number;
    if (edited.annual_bonus !== undefined)           apiPayload.bonificacion_anual = edited.annual_bonus as number;
    if (edited.aguinaldo !== undefined)              apiPayload.aguinaldo = edited.aguinaldo as number;
    if (edited.salary_advance !== undefined)         apiPayload.adelanto_sueldo = edited.salary_advance as number;

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
              (merged.vacation_bonus ?? 0) +
              (merged.annual_bonus ?? 0) +
              (merged.aguinaldo ?? 0) -
              (merged.salary_advance ?? 0);
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

  const handleDeletePdf = (settlementId: string, slot: PayslipSlot) => {
    setSettlements((prev) =>
      prev.map((s) => {
        if (s.id !== settlementId) return s;
        const updated =
          slot === 2
            ? { ...s, payslip2_url: null }
            : { ...s, payslip_url: null };
        const stillReady = payslipHasBothPdfs({
          pdf_storage_path: updated.payslip_url,
          pdf2_storage_path: updated.payslip2_url,
        });
        return {
          ...updated,
          status: stillReady ? updated.status : updated.status === 'READY_TO_SEND' ? 'DRAFT' : updated.status,
        };
      })
    );
    setMessage({ type: 'success', text: `PDF ${slot} eliminado correctamente` });
  };

  const handleUploadPdf = async (settlementId: string, file: File, slot: PayslipSlot) => {
    const uploadKey = `${settlementId}-${slot}`;
    // Reemplazo de un recibo ya publicado: pedimos el motivo antes de subir.
    // Genera una versión nueva e invalida la constancia previa del colaborador.
    const target = settlements.find((s) => s.id === settlementId);
    let reason = '';
    if (target?.status === 'SENT') {
      const input = window.prompt(
        'Este recibo ya fue publicado. Se va a generar una versión nueva y el colaborador deberá volver a confirmar la recepción.\n\nMotivo del reemplazo:',
      );
      if (input === null) return; // cancelado
      reason = input.trim();
      if (!reason) {
        setMessage({ type: 'error', text: 'Indicá el motivo del reemplazo.' });
        return;
      }
    }

    setUploadingRows((prev) => ({ ...prev, [uploadKey]: true }));
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (reason) formData.append('reason', reason);

      const res = await fetch(`/api/admin/payroll/settlements/${settlementId}/payslip?slot=${slot}`, {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const payslip = await res.json();
        setSettlements((prev) =>
          prev.map((s) => {
            if (s.id !== settlementId) return s;
            const payslip_url = slot === 1 ? payslip.pdf_storage_path : s.payslip_url;
            const payslip2_url = slot === 2 ? payslip.pdf2_storage_path : s.payslip2_url;
            const ready = payslipHasBothPdfs({
              pdf_storage_path: payslip_url,
              pdf2_storage_path: payslip2_url,
            });
            return {
              ...s,
              payslip_url,
              payslip2_url,
              status: s.status === 'SENT' ? s.status : ready ? 'READY_TO_SEND' : s.status,
            };
          })
        );
        setMessage({ type: 'success', text: `Recibo PDF ${slot} cargado exitosamente` });
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error || 'Error al subir el recibo' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Error al subir el recibo' });
    } finally {
      setUploadingRows((prev) => ({ ...prev, [uploadKey]: false }));
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
      a.download = `liquidaciones_${formatPayrollPeriodLabelFromKey(period).replace(/\s+/g, '_')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setMessage({ type: 'error', text: 'Error al exportar el Excel' });
    }
  };

  const handleClaimInvoices = async () => {
    setClaimingInvoices(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/payroll/periods/${periodId}/claim-invoices`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: data.message || 'Recordatorios enviados' });
      } else {
        setMessage({ type: 'error', text: data.error || 'Error al enviar recordatorios' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Error al enviar recordatorios' });
    } finally {
      setClaimingInvoices(false);
    }
  };

  const handleRemindPending = async () => {
    setRemindingReceipts(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/payroll/periods/${periodId}/remind-pending`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: data.message || 'Recordatorios enviados' });
      } else {
        setMessage({ type: 'error', text: data.error || 'Error al enviar recordatorios' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Error al enviar recordatorios' });
    } finally {
      setRemindingReceipts(false);
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

  const SortableHeader = ({ label, sortKey, className = '' }: { label: string; sortKey: keyof Settlement; className?: string }) => {
    const isActive = sortConfig?.key === sortKey;
    const dir = isActive ? sortConfig!.direction : null;
    return (
      <th
        className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer select-none hover:text-foreground ${className}`}
        onClick={() => handleSort(sortKey)}
      >
        <span className="inline-flex items-center gap-1">
          {label}
          <span className="inline-flex flex-col leading-none">
            <svg className={`h-2.5 w-2.5 ${isActive && dir === 'asc' ? 'text-accent-foreground' : 'text-muted-foreground'}`} viewBox="0 0 10 6" fill="currentColor">
              <path d="M5 0L10 6H0L5 0Z"/>
            </svg>
            <svg className={`h-2.5 w-2.5 ${isActive && dir === 'desc' ? 'text-accent-foreground' : 'text-muted-foreground'}`} viewBox="0 0 10 6" fill="currentColor">
              <path d="M5 6L0 0H10L5 6Z"/>
            </svg>
          </span>
        </span>
      </th>
    );
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <SkeletonRows rows={6} />
      </div>
    );
  }

  if (!period) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        {message && (
          <div className="rounded-lg bg-danger-subtle px-4 py-3 text-sm text-[var(--red-600)] max-w-md text-center">
            {message.text}
          </div>
        )}
        {!message && (
          <p className="text-sm font-medium text-muted-foreground">Periodo no encontrado</p>
        )}
        <Link href="/admin/payroll" className="text-sm font-medium text-foreground hover:text-brand">
          Volver a periodos
        </Link>
      </div>
    );
  }

  const isClosed = period.status === 'CLOSED';

  return (
    <div className="space-y-6">
      {/* Toolbar: contexto del periodo + acciones */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <Link
            href="/admin/payroll"
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            ← Periodos
          </Link>
          <h2 className="mt-1 text-base font-semibold text-foreground">
            {formatPayrollPeriodLabelFromKey(period)}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {settlements.length} liquidaciones · {filteredSettlements.length} mostradas
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Excel export (solo Monotributo) */}
          <Button variant="outline" onClick={handleExport}>
            Excel Monotributo
          </Button>

          {/* Lo que escribe no se le muestra a Administración. El export se
              queda: bajar un Excel es leer. */}
          {!soloLectura && (
            <>
              {/* Excel import */}
              <Button
                variant="outline"
                loading={importing}
                onClick={() => importInputRef.current?.click()}
              >
                Importar Excel
              </Button>
              <input
                ref={importInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleImportFile}
                disabled={importing}
              />

              {/* Reclamar facturas pendientes */}
              <Button variant="outline" loading={claimingInvoices} onClick={handleClaimInvoices}>
                Reclamar facturas
              </Button>

              {!isClosed && (
                <Button loading={actionLoading} onClick={() => handlePeriodAction('send-all')}>
                  Enviar a todos
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {message && (
        <div className={`rounded-lg p-4 text-sm ${
          message.type === 'success' ? 'bg-success-subtle text-[var(--green-700)]' : 'bg-danger-subtle text-[var(--red-600)]'
        }`}>
          {message.text}
          <button onClick={() => setMessage(null)} className="ml-2 text-xs underline">
            Cerrar
          </button>
        </div>
      )}

      {/* Recepción de recibos (relación de dependencia) */}
      <ReceiptAcknowledgementSection
        settlements={settlements}
        onRemind={handleRemindPending}
        reminding={remindingReceipts}
      />

      {/* Filter Tabs */}
      <div className="flex gap-1 rounded-lg bg-secondary p-1">
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
                ? 'bg-white text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Selection toolbar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-[var(--orange-100)] bg-accent px-4 py-3">
          <span className="text-sm font-medium text-accent-foreground">
            {selectedIds.size} {selectedIds.size === 1 ? 'liquidación seleccionada' : 'liquidaciones seleccionadas'}
          </span>
          <div className="ml-auto flex items-center gap-2">
            {!isClosed && !soloLectura && (
              <Button
                size="sm"
                loading={actionLoading}
                onClick={() => handlePeriodAction('send-all', Array.from(selectedIds))}
              >
                Enviar seleccionados
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setSelectedIds(new Set())}>
              Deseleccionar
            </Button>
          </div>
        </div>
      )}

      {/* Settlements Table */}
      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm">
        {filteredSettlements.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-muted-foreground">No hay liquidaciones para mostrar</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {settlements.length === 0
                ? 'No se encontraron liquidaciones en este periodo'
                : 'No hay liquidaciones con el filtro seleccionado'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border)] bg-muted text-left">
                  <th className={`w-10 px-4 py-3 ${soloLectura ? 'hidden' : ''}`}>
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filteredSettlements.length && filteredSettlements.length > 0}
                      ref={(el) => {
                        if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < filteredSettlements.length;
                      }}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-[var(--border)] text-accent-foreground focus:ring-ring"
                    />
                  </th>
                  <SortableHeader label="Empleado" sortKey="employee_name" />
                  <SortableHeader label="Tipo" sortKey="contract_type" />
                  {(activeFilter === 'all' || activeFilter === 'MONOTRIBUTO') && (
                    <>
                      <SortableHeader label="Sueldo" sortKey="base_salary" />
                      <SortableHeader label="Monotributo" sortKey="monotributo" />
                      <SortableHeader label="Reint. Internet" sortKey="internet_reimbursement" />
                      <SortableHeader label="Reint. Extra" sortKey="extra_reimbursement" />
                      <SortableHeader label="Plus Vac." sortKey="vacation_bonus" />
                      <SortableHeader label="Bonif. Anual" sortKey="annual_bonus" />
                      <SortableHeader label="Aguinaldo" sortKey="aguinaldo" />
                      <SortableHeader label="Adelanto" sortKey="salary_advance" />
                      <SortableHeader label="Total" sortKey="total" />
                    </>
                  )}
                  {activeFilter === 'RELACION_DEPENDENCIA' && (
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">PDFs</th>
                  )}
                  {(activeFilter === 'MONOTRIBUTO' || activeFilter === 'all') && (
                    <SortableHeader label="Factura" sortKey="invoice_uploaded_at" />
                  )}
                  <SortableHeader label="Estado" sortKey="status" />
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filteredSettlements.map((settlement) => (
                  <SettlementRow
                    key={settlement.id}
                    settlement={settlement}
                    activeFilter={activeFilter}
                    isEditable={!soloLectura && isEditable && settlement.status !== 'SENT'}
                    isPeriodOpen={!soloLectura && isPeriodOpen}
                    soloLectura={soloLectura}
                    editedValues={editedRows[settlement.id]}
                    isSaving={!!savingRows[settlement.id]}
                    isUploading={!!uploadingRows[`${settlement.id}-1`] || !!uploadingRows[`${settlement.id}-2`]}
                    uploadingRows={uploadingRows}
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
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = settlement.invoice_filename || 'factura.pdf';
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
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
  isPeriodOpen: boolean;
  editedValues: Partial<Settlement> | undefined;
  isSaving: boolean;
  isUploading: boolean;
  uploadingRows: Record<string, boolean>;
  hasChanges: boolean;
  isSelected: boolean;
  soloLectura: boolean;
  onToggleSelect: (id: string) => void;
  onFieldChange: (id: string, field: string, value: number) => void;
  getFieldValue: (settlement: Settlement, field: keyof Settlement) => number;
  getRowTotal: (settlement: Settlement) => number;
  onSave: (id: string) => void;
  onUploadPdf: (id: string, file: File, slot: PayslipSlot) => void;
  onDeletePdf: (id: string, slot: PayslipSlot) => void;
  onDownloadInvoice: () => void;
};

function SettlementRow({
  settlement,
  activeFilter,
  isEditable,
  isPeriodOpen,
  isSaving,
  isUploading,
  hasChanges,
  isSelected,
  soloLectura,
  onToggleSelect,
  onFieldChange,
  getFieldValue,
  getRowTotal,
  onSave,
  onUploadPdf,
  onDeletePdf,
  onDownloadInvoice,
  uploadingRows,
}: SettlementRowProps) {
  const [loadingPdfSlot, setLoadingPdfSlot] = useState<PayslipSlot | null>(null);
  const [deletingPdfSlot, setDeletingPdfSlot] = useState<PayslipSlot | null>(null);
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);

  const handleViewPdf = async (slot: PayslipSlot) => {
    setLoadingPdfSlot(slot);
    try {
      await openPayslipPdf(settlement.id, slot);
    } finally {
      setLoadingPdfSlot(null);
    }
  };

  const handleDeletePdf = async (slot: PayslipSlot) => {
    if (!confirm(`¿Eliminás el PDF ${slot}? Esta acción no se puede deshacer.`)) return;
    setDeletingPdfSlot(slot);
    try {
      const res = await fetch(`/api/admin/payroll/settlements/${settlement.id}/payslip?slot=${slot}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        onDeletePdf(settlement.id, slot);
      } else {
        const data = await res.json();
        alert(data.error || 'Error al eliminar el PDF');
      }
    } finally {
      setDeletingPdfSlot(null);
    }
  };

  const handleFileChange = (slot: PayslipSlot) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadPdf(settlement.id, file, slot);
    }
    e.target.value = '';
  };

  const renderPayslipSlot = (slot: PayslipSlot) => {
    const url = slot === 1 ? settlement.payslip_url : settlement.payslip2_url;
    const uploadKey = `${settlement.id}-${slot}`;
    const isSlotUploading = !!uploadingRows[uploadKey];
    const canUpload = isPeriodOpen && !url;
    const canDelete = isPeriodOpen && settlement.status !== 'SENT' && !!url;

    return (
      <div key={slot} className="flex items-center gap-2">
        <span className="w-10 text-[10px] font-semibold uppercase text-muted-foreground">PDF {slot}</span>
        {url ? (
          <>
            <button
              onClick={() => handleViewPdf(slot)}
              disabled={loadingPdfSlot === slot}
              className="text-xs font-medium text-foreground hover:text-[var(--primary-hover)] disabled:opacity-50"
            >
              {loadingPdfSlot === slot ? 'Abriendo...' : 'Ver'}
            </button>
            {canDelete && (
              <button
                onClick={() => handleDeletePdf(slot)}
                disabled={deletingPdfSlot === slot}
                className="text-xs font-medium text-[var(--red-600)] hover:underline disabled:opacity-50"
              >
                {deletingPdfSlot === slot ? '...' : 'Eliminar'}
              </button>
            )}
          </>
        ) : canUpload ? (
          <label className="cursor-pointer text-xs font-medium text-foreground hover:text-[var(--primary-hover)]">
            {isSlotUploading ? 'Subiendo...' : 'Subir'}
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileChange(slot)}
              className="hidden"
              disabled={isSlotUploading}
            />
          </label>
        ) : (
          <span className="text-xs text-muted-foreground">No cargado</span>
        )}
      </div>
    );
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
    { key: 'annual_bonus', label: 'Bonif. Anual' },
    { key: 'aguinaldo', label: 'Aguinaldo' },
    { key: 'salary_advance', label: 'Adelanto' },
  ];

  return (
    <tr className={`transition-colors hover:bg-muted ${isSelected ? 'bg-accent' : ''}`}>
      <td className={`w-10 px-4 py-3 ${soloLectura ? 'hidden' : ''}`}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(settlement.id)}
          className="h-4 w-4 rounded border-[var(--border)] text-accent-foreground focus:ring-ring"
        />
      </td>
      <td className="px-4 py-3 text-sm font-medium text-foreground">{settlement.employee_name}</td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
          isMonotributo ? 'bg-accent text-accent-foreground' : 'bg-cat-violet-subtle text-cat-violet'
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
                      className="w-28 rounded-lg border border-[var(--border)] px-2 py-1.5 text-right text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-ring"
                      min={0}
                      step={1}
                    />
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      {currencyFormatter.format(settlement[field.key] as number)}
                    </span>
                  )}
                </td>
              ))}
              <td className="px-4 py-3 text-sm font-semibold text-foreground">
                {currencyFormatter.format(isEditable ? getRowTotal(settlement) : settlement.total)}
              </td>
            </>
          ) : (
            <>
              {/* Rel. Dep. rows in mixed view: span all 9 numeric columns (Sueldo→Total) */}
              <td colSpan={9} className="px-4 py-3 text-center text-xs text-muted-foreground">—</td>
            </>
          )}
        </>
      )}

      {/* PDF column for Rel. Dependencia filter */}
      {activeFilter === 'RELACION_DEPENDENCIA' && (
        <td className="px-4 py-3">
          {isRelDep ? (
            <div className="flex flex-col gap-1.5">
              {renderPayslipSlot(1)}
              {renderPayslipSlot(2)}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
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
                className="text-xs font-medium text-foreground hover:text-[var(--primary-hover)] disabled:opacity-50"
              >
                {downloadingInvoice ? 'Abriendo...' : '✓ Ver factura'}
              </button>
            ) : (
              <span className="text-xs font-medium text-[var(--amber-600)]">Pendiente</span>
            )
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
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
            <Button size="sm" loading={isSaving} onClick={() => onSave(settlement.id)}>
              Guardar
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

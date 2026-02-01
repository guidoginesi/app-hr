'use client';

import { useEffect, useState } from 'react';
import { TimeOffShell } from '../TimeOffShell';
import { formatDateLocal } from '@/lib/dateUtils';
import type { LeaveBalanceWithDetails } from '@/types/time-off';

interface EmployeeWithBalances {
  id: string;
  name: string;
  hire_date: string | null;
  is_studying: boolean;
  seniority_years: number;
  balances: {
    vacation: LeaveBalanceWithDetails | null;
    pow_days: LeaveBalanceWithDetails | null;
    study: LeaveBalanceWithDetails | null;
    remote_work: LeaveBalanceWithDetails | null;
  };
}

interface BonusModalState {
  isOpen: boolean;
  employeeId: string;
  employeeName: string;
  leaveTypeId: string;
  leaveTypeName: string;
}

export default function TimeOffBalancesPage() {
  const [employees, setEmployees] = useState<EmployeeWithBalances[]>([]);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [bonusModal, setBonusModal] = useState<BonusModalState>({
    isOpen: false,
    employeeId: '',
    employeeName: '',
    leaveTypeId: '',
    leaveTypeName: '',
  });
  const [bonusDays, setBonusDays] = useState<string>('1');
  const [bonusReason, setBonusReason] = useState('');
  const [addingBonus, setAddingBonus] = useState(false);

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth(); // 0-indexed, October = 9
  const isVacationPeriodOpen = currentMonth >= 9; // October onwards

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      // Fetch employees and balances in parallel
      const [employeesRes, balancesRes] = await Promise.all([
        fetch('/api/admin/employees?status=active'),
        fetch(`/api/admin/time-off/balances?year=${currentYear}`),
      ]);

      const employeesData = employeesRes.ok ? await employeesRes.json() : [];
      const balancesData: LeaveBalanceWithDetails[] = balancesRes.ok ? await balancesRes.json() : [];

      // Group balances by employee
      const balancesByEmployee: Record<string, LeaveBalanceWithDetails[]> = {};
      balancesData.forEach((b) => {
        if (!balancesByEmployee[b.employee_id]) {
          balancesByEmployee[b.employee_id] = [];
        }
        balancesByEmployee[b.employee_id].push(b);
      });

      // Build employee list with balances
      const employeesWithBalances: EmployeeWithBalances[] = employeesData.map((emp: any) => {
        const empBalances = balancesByEmployee[emp.id] || [];
        const hireDate = emp.hire_date ? new Date(emp.hire_date) : null;
        // Calculate seniority at Dec 31 of current year (as per LCT art. 150)
        const endOfYear = new Date(currentYear, 11, 31);
        const seniorityYears = hireDate
          ? Math.floor((endOfYear.getTime() - hireDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25))
          : 0;

        return {
          id: emp.id,
          name: `${emp.first_name} ${emp.last_name}`,
          hire_date: emp.hire_date,
          is_studying: emp.is_studying || false,
          seniority_years: seniorityYears,
          balances: {
            vacation: empBalances.find((b) => b.leave_type_code === 'vacation') || null,
            pow_days: empBalances.find((b) => b.leave_type_code === 'pow_days') || null,
            study: empBalances.find((b) => b.leave_type_code === 'study') || null,
            remote_work: empBalances.find((b) => b.leave_type_code === 'remote_work') || null,
          },
        };
      });

      // Sort by name
      employeesWithBalances.sort((a, b) => a.name.localeCompare(b.name));
      setEmployees(employeesWithBalances);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleRecalculate() {
    if (!confirm('¿Recalcular los balances para todos los empleados activos?')) return;

    setRecalculating(true);
    try {
      const res = await fetch('/api/admin/time-off/balances/recalculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: currentYear }),
      });

      if (res.ok) {
        const result = await res.json();
        alert(`Balances recalculados para ${result.employees_processed} empleados`);
        fetchData();
      }
    } catch (error) {
      console.error('Error recalculating balances:', error);
    } finally {
      setRecalculating(false);
    }
  }

  function openBonusModal(employeeId: string, employeeName: string, leaveTypeId: string, leaveTypeName: string) {
    setBonusModal({
      isOpen: true,
      employeeId,
      employeeName,
      leaveTypeId,
      leaveTypeName,
    });
    setBonusDays('1');
    setBonusReason('');
  }

  function closeBonusModal() {
    setBonusModal({
      isOpen: false,
      employeeId: '',
      employeeName: '',
      leaveTypeId: '',
      leaveTypeName: '',
    });
  }

  async function handleAddBonus() {
    const daysValue = parseFloat(bonusDays);
    
    if (!bonusDays || isNaN(daysValue) || daysValue < 0.5) {
      alert('Por favor ingresa una cantidad válida (mínimo 0.5)');
      return;
    }
    
    if (!bonusReason.trim()) {
      alert('Por favor ingresa un motivo');
      return;
    }

    setAddingBonus(true);
    try {
      const res = await fetch('/api/admin/time-off/balances/bonus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: bonusModal.employeeId,
          leave_type_id: bonusModal.leaveTypeId,
          year: currentYear,
          days: daysValue,
          reason: bonusReason,
        }),
      });

      const result = await res.json();

      if (res.ok) {
        alert(result.message);
        closeBonusModal();
        fetchData();
      } else {
        alert(result.error || 'Error al agregar días');
      }
    } catch (error) {
      console.error('Error adding bonus days:', error);
      alert('Error al agregar días');
    } finally {
      setAddingBonus(false);
    }
  }

  // Calculate vacation days according to LCT (art. 150)
  function getVacationDaysByScale(seniorityYears: number): number {
    if (seniorityYears >= 20) return 35;
    if (seniorityYears >= 10) return 28;
    if (seniorityYears >= 5) return 21;
    return 14;
  }

  // Estimate vacation days for display (simplified - actual calc considers business days)
  // Returns estimated days for current year (only if period is open) or shows "not yet"
  function estimateVacationDays(hireDate: string | null): { 
    days: number; 
    isProportional: boolean;
    periodNotOpen: boolean;
  } {
    // If vacation period not open, current year's entitled days = 0
    if (!isVacationPeriodOpen) {
      return { days: 0, isProportional: false, periodNotOpen: true };
    }

    if (!hireDate) return { days: 14, isProportional: false, periodNotOpen: false };
    
    const hire = new Date(hireDate);
    const startOfYear = new Date(currentYear, 0, 1);
    const endOfYear = new Date(currentYear, 11, 31);
    
    // Seniority at Dec 31
    const seniorityYears = Math.floor((endOfYear.getTime() - hire.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
    const daysByScale = getVacationDaysByScale(seniorityYears);
    
    // Check if started this year
    if (hire > startOfYear) {
      // Estimate business days worked (approx 5/7 of calendar days)
      const calendarDays = Math.floor((endOfYear.getTime() - hire.getTime()) / (1000 * 60 * 60 * 24));
      const businessDaysWorked = Math.floor(calendarDays * 5 / 7);
      const totalBusinessDays = 261; // approx business days in a year
      
      if (businessDaysWorked < totalBusinessDays / 2) {
        // Proportional: 1 day per 20 worked days
        return { days: Math.floor(businessDaysWorked / 20), isProportional: true, periodNotOpen: false };
      }
    }
    
    return { days: daysByScale, isProportional: false, periodNotOpen: false };
  }

  const filteredEmployees = employees.filter((emp) =>
    emp.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <TimeOffShell active="balances">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Balances de Time Off</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Días disponibles por empleado (incluye acumulados de años anteriores)
            </p>
          </div>
          <button
            onClick={handleRecalculate}
            disabled={recalculating}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {recalculating ? 'Recalculando...' : 'Recalcular balances'}
          </button>
        </div>

        {/* Search */}
        <div>
          <input
            type="text"
            placeholder="Buscar empleado..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-64 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </div>

        {/* Info box */}
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          <div><strong>Ley 20.744 - Vacaciones:</strong></div>
          <div className="mt-1">
            <span className="font-medium">Art. 150 (escala):</span> 0-5 años = 14 días | 5-10 = 21 | 10-20 = 28 | +20 = 35 días (antigüedad al 31/12)
          </div>
          <div className="mt-1">
            <span className="font-medium">Art. 151:</span> Debe trabajar al menos la mitad de los días hábiles del año para acceder al tramo completo.
          </div>
          <div className="mt-1">
            <span className="font-medium">Art. 153:</span> Si no llega, proporcional = 1 día cada 20 días trabajados.
          </div>
          <div className="mt-1">
            <span className="font-medium">Período:</span> Las vacaciones del año se habilitan a partir del 1° de octubre (período legal: oct - abril).
          </div>
          <div className="mt-2 text-blue-600">Los días Pow y vacaciones no gozadas se acumulan año a año.</div>
        </div>

        {/* Vacation period status */}
        {!isVacationPeriodOpen && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <strong>Período {currentYear} aún no abierto.</strong> Las vacaciones y días Pow del período {currentYear} se habilitarán a partir del 1° de octubre de {currentYear}.
            Los empleados actualmente pueden usar días acumulados de períodos anteriores.
          </div>
        )}

        {/* Table */}
        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-600 border-t-transparent" />
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="py-12 text-center text-sm text-zinc-500">
              {searchTerm ? 'No se encontraron empleados' : 'No hay empleados activos'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    <th className="px-6 py-3">Empleado</th>
                    <th className="px-6 py-3 text-center">Antigüedad</th>
                    <th className="px-6 py-3 text-center">
                      <div>Vacaciones {currentYear}</div>
                      <div className="text-[10px] font-normal normal-case text-zinc-400">
                        {isVacationPeriodOpen ? 'disponibles / total' : 'acumulados'}
                      </div>
                    </th>
                    <th className="px-6 py-3 text-center">
                      <div>Días Pow {currentYear}</div>
                      <div className="text-[10px] font-normal normal-case text-zinc-400">
                        {isVacationPeriodOpen ? 'disponibles / total' : 'acumulados'}
                      </div>
                    </th>
                    <th className="px-6 py-3 text-center">
                      <div>Estudio</div>
                      <div className="text-[10px] font-normal normal-case text-zinc-400">disponibles / 10</div>
                    </th>
                    <th className="px-6 py-3 text-center">
                      <div>Remoto</div>
                      <div className="text-[10px] font-normal normal-case text-zinc-400">semanas / 8</div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {filteredEmployees.map((emp) => {
                    const vacEstimate = estimateVacationDays(emp.hire_date);
                    const vac = emp.balances.vacation;
                    const pow = emp.balances.pow_days;
                    const study = emp.balances.study;
                    const remote = emp.balances.remote_work;

                    return (
                      <tr key={emp.id} className="hover:bg-zinc-50">
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-medium text-zinc-900">{emp.name}</p>
                            {emp.hire_date && (
                              <p className="text-xs text-zinc-500">
                                Ingreso: {formatDateLocal(emp.hire_date)}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-sm font-medium text-zinc-900">
                            {emp.seniority_years} año{emp.seniority_years !== 1 ? 's' : ''}
                          </span>
                          <p className="text-[10px] text-zinc-400">al 31/12</p>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {vac ? (
                            <div>
                              <span className="text-xl font-bold text-blue-600">
                                {vac.available_days}
                              </span>
                              {(vac.entitled_days > 0 || vac.carried_over > 0 || vac.bonus_days > 0) && (
                                <span className="text-sm text-zinc-400">
                                  {' '}/ {vac.entitled_days + vac.carried_over + (vac.bonus_days || 0)}
                                </span>
                              )}
                              {vac.carried_over > 0 && vac.entitled_days === 0 && !vac.bonus_days && (
                                <p className="text-[10px] text-green-600">solo acum. período anterior</p>
                              )}
                              {vac.carried_over > 0 && vac.entitled_days > 0 && (
                                <p className="text-[10px] text-green-600">+{vac.carried_over} acum.</p>
                              )}
                              {vac.bonus_days > 0 && (
                                <p className="text-[10px] text-blue-600">+{vac.bonus_days} bonus</p>
                              )}
                            </div>
                          ) : (
                            <div className="text-sm text-zinc-400">
                              {vacEstimate.periodNotOpen ? (
                                <span className="text-[10px]">período {currentYear} no abierto</span>
                              ) : (
                                <>
                                  ~{vacEstimate.days}d
                                  {vacEstimate.isProportional && (
                                    <p className="text-[10px] text-amber-500">proporcional</p>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {pow ? (
                            <div className="flex items-center justify-center gap-2">
                              <div>
                                <span className="text-xl font-bold text-purple-600">
                                  {pow.available_days}
                                </span>
                                {(pow.entitled_days > 0 || pow.carried_over > 0 || pow.bonus_days > 0) && (
                                  <span className="text-sm text-zinc-400">
                                    {' '}/ {pow.entitled_days + pow.carried_over + (pow.bonus_days || 0)}
                                  </span>
                                )}
                                {pow.carried_over > 0 && pow.entitled_days === 0 && !pow.bonus_days && (
                                  <p className="text-[10px] text-green-600">solo acum. período anterior</p>
                                )}
                                {pow.carried_over > 0 && pow.entitled_days > 0 && (
                                  <p className="text-[10px] text-green-600">+{pow.carried_over} acum.</p>
                                )}
                                {pow.bonus_days > 0 && (
                                  <p className="text-[10px] text-purple-600">+{pow.bonus_days} bonus</p>
                                )}
                              </div>
                              <button
                                onClick={() => openBonusModal(emp.id, emp.name, pow.leave_type_id, 'Días Pow')}
                                className="rounded-full bg-purple-100 p-1 text-purple-600 hover:bg-purple-200"
                                title="Agregar días bonus"
                              >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                              </button>
                            </div>
                          ) : (
                            <div className="text-sm text-zinc-400">
                              {!isVacationPeriodOpen ? (
                                <span className="text-[10px]">período {currentYear} no abierto</span>
                              ) : (
                                <span>~5d</span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {emp.is_studying ? (
                            study ? (
                              <div>
                                <span className="text-xl font-bold text-amber-600">
                                  {study.available_days}
                                </span>
                                <span className="text-sm text-zinc-400"> / 10</span>
                              </div>
                            ) : (
                              <span className="text-sm text-zinc-400">~10d</span>
                            )
                          ) : (
                            <span className="text-xs text-zinc-300">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {remote ? (
                            <div>
                              <span className="text-xl font-bold text-green-600">
                                {remote.available_days}
                              </span>
                              <span className="text-sm text-zinc-400"> / 8</span>
                            </div>
                          ) : (
                            <span className="text-sm text-zinc-400">~8</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Summary */}
        {!loading && filteredEmployees.length > 0 && (
          <div className="text-sm text-zinc-500">
            {filteredEmployees.length} empleado{filteredEmployees.length !== 1 ? 's' : ''} activo{filteredEmployees.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Modal para agregar días bonus */}
      {bonusModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-zinc-900">
              Agregar {bonusModal.leaveTypeName}
            </h3>
            <p className="mt-1 text-sm text-zinc-500">
              Agregar días bonus a <strong>{bonusModal.employeeName}</strong>
            </p>

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700">
                  Cantidad de días
                </label>
                <input
                  type="number"
                  min="0.5"
                  max="30"
                  step="0.5"
                  value={bonusDays}
                  onChange={(e) => setBonusDays(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700">
                  Motivo <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={bonusReason}
                  onChange={(e) => setBonusReason(e.target.value)}
                  placeholder="Ej: Premio por desempeño Q4 2025"
                  rows={3}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={handleAddBonus}
                disabled={addingBonus || !bonusReason.trim()}
                className="flex-1 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
              >
                {addingBonus ? 'Agregando...' : `Agregar ${bonusDays || '0'} día${parseFloat(bonusDays) !== 1 ? 's' : ''}`}
              </button>
              <button
                onClick={closeBonusModal}
                className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </TimeOffShell>
  );
}

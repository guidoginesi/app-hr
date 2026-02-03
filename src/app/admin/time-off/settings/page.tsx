'use client';

import { useEffect, useState } from 'react';
import { TimeOffShell } from '../TimeOffShell';
import { TimeOffEmailTemplates } from './TimeOffEmailTemplates';
import type { LeaveType } from '@/types/time-off';
import type { Employee } from '@/types/employee';

export default function TimeOffSettingsPage() {
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingType, setSavingType] = useState<string | null>(null);
  const [savingEmployee, setSavingEmployee] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [typesRes, employeesRes] = await Promise.all([
        fetch('/api/admin/time-off/leave-types'),
        fetch('/api/admin/employees?status=active'),
      ]);

      if (typesRes.ok) {
        const data = await typesRes.json();
        setLeaveTypes(data);
      }
      if (employeesRes.ok) {
        const data = await employeesRes.json();
        setEmployees(data);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleType(type: LeaveType) {
    setSavingType(type.id);
    try {
      const res = await fetch('/api/admin/time-off/leave-types', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: type.id, is_active: !type.is_active }),
      });

      if (res.ok) {
        setLeaveTypes((prev) =>
          prev.map((t) => (t.id === type.id ? { ...t, is_active: !t.is_active } : t))
        );
      }
    } catch (error) {
      console.error('Error updating leave type:', error);
    } finally {
      setSavingType(null);
    }
  }

  async function handleUpdateAdvanceNotice(type: LeaveType, days: number) {
    setSavingType(type.id);
    try {
      const res = await fetch('/api/admin/time-off/leave-types', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: type.id, advance_notice_days: days }),
      });

      if (res.ok) {
        setLeaveTypes((prev) =>
          prev.map((t) => (t.id === type.id ? { ...t, advance_notice_days: days } : t))
        );
      }
    } catch (error) {
      console.error('Error updating leave type:', error);
    } finally {
      setSavingType(null);
    }
  }

  async function handleToggleStudying(employee: Employee) {
    setSavingEmployee(employee.id);
    try {
      const res = await fetch(`/api/admin/time-off/employees/${employee.id}/study-status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_studying: !employee.is_studying }),
      });

      if (res.ok) {
        setEmployees((prev) =>
          prev.map((e) => (e.id === employee.id ? { ...e, is_studying: !e.is_studying } : e))
        );
      }
    } catch (error) {
      console.error('Error updating employee:', error);
    } finally {
      setSavingEmployee(null);
    }
  }

  const studyingEmployees = employees.filter((e) => e.is_studying);
  const notStudyingEmployees = employees.filter((e) => !e.is_studying);

  return (
    <TimeOffShell active="settings">
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Configuración</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Administra los tipos de licencia y permisos de empleados
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-600 border-t-transparent" />
          </div>
        ) : (
          <>
            {/* Leave Types */}
            <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
              <div className="border-b border-zinc-200 px-6 py-4">
                <h2 className="text-lg font-semibold text-zinc-900">Tipos de Licencia</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Configura los tipos de licencia disponibles
                </p>
              </div>
              <div className="divide-y divide-zinc-200">
                {leaveTypes.map((type) => (
                  <div key={type.id} className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="font-medium text-zinc-900">{type.name}</h3>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              type.is_active
                                ? 'bg-green-100 text-green-700'
                                : 'bg-zinc-100 text-zinc-500'
                            }`}
                          >
                            {type.is_active ? 'Activo' : 'Inactivo'}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-zinc-500">{type.description}</p>
                        <div className="mt-2 flex flex-wrap gap-4 text-xs text-zinc-500">
                          <span>Tipo: {type.count_type === 'calendar_days' ? 'Días corridos' : type.count_type === 'business_days' ? 'Días hábiles' : 'Semanas'}</span>
                          {type.requires_attachment && <span>Requiere comprobante</span>}
                          {type.is_accumulative && <span>Acumulable</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-zinc-500">Anticipación:</label>
                          <input
                            type="number"
                            min="0"
                            value={type.advance_notice_days}
                            onChange={(e) =>
                              handleUpdateAdvanceNotice(type, parseInt(e.target.value) || 0)
                            }
                            disabled={savingType === type.id}
                            className="w-16 rounded border border-zinc-300 px-2 py-1 text-sm"
                          />
                          <span className="text-xs text-zinc-500">días</span>
                        </div>
                        <button
                          onClick={() => handleToggleType(type)}
                          disabled={savingType === type.id}
                          className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                            type.is_active
                              ? 'border border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50'
                              : 'bg-green-600 text-white hover:bg-green-700'
                          }`}
                        >
                          {savingType === type.id
                            ? '...'
                            : type.is_active
                            ? 'Desactivar'
                            : 'Activar'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Study Status Management */}
            <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
              <div className="border-b border-zinc-200 px-6 py-4">
                <h2 className="text-lg font-semibold text-zinc-900">Licencia por Estudio</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Marca a los empleados que están estudiando para habilitarles la licencia por
                  estudio
                </p>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  {/* Studying */}
                  <div>
                    <h3 className="mb-3 text-sm font-semibold text-zinc-900">
                      Estudiando ({studyingEmployees.length})
                    </h3>
                    <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-green-200 bg-green-50 p-3">
                      {studyingEmployees.length === 0 ? (
                        <p className="text-sm text-zinc-500">No hay empleados marcados como estudiando</p>
                      ) : (
                        studyingEmployees.map((employee) => (
                          <div
                            key={employee.id}
                            className="flex items-center justify-between rounded bg-white p-2 shadow-sm"
                          >
                            <span className="text-sm text-zinc-900">
                              {employee.first_name} {employee.last_name}
                            </span>
                            <button
                              onClick={() => handleToggleStudying(employee)}
                              disabled={savingEmployee === employee.id}
                              className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                            >
                              {savingEmployee === employee.id ? '...' : 'Quitar'}
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Not studying */}
                  <div>
                    <h3 className="mb-3 text-sm font-semibold text-zinc-900">
                      No estudiando ({notStudyingEmployees.length})
                    </h3>
                    <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                      {notStudyingEmployees.map((employee) => (
                        <div
                          key={employee.id}
                          className="flex items-center justify-between rounded bg-white p-2 shadow-sm"
                        >
                          <span className="text-sm text-zinc-900">
                            {employee.first_name} {employee.last_name}
                          </span>
                          <button
                            onClick={() => handleToggleStudying(employee)}
                            disabled={savingEmployee === employee.id}
                            className="rounded px-2 py-1 text-xs font-medium text-green-600 hover:bg-green-50"
                          >
                            {savingEmployee === employee.id ? '...' : 'Marcar'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Email Templates */}
            <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
              <div className="border-b border-zinc-200 px-6 py-4">
                <h2 className="text-lg font-semibold text-zinc-900">Plantillas de Email</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Configura los emails automáticos que se envían durante el proceso de solicitudes
                </p>
              </div>
              <div className="p-6">
                <TimeOffEmailTemplates />
              </div>
            </div>

            {/* Info Box */}
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-6">
              <h3 className="font-semibold text-blue-900">Información sobre licencias</h3>
              <div className="mt-3 space-y-2 text-sm text-blue-800">
                <p>
                  <strong>Vacaciones:</strong> Según Ley 20.744, corresponden 14, 21, 28 o 35 días
                  corridos según antigüedad al 31/12.
                </p>
                <p>
                  <strong>Días Pow:</strong> 5 días hábiles extra anuales para empleados con más de
                  6 meses de antigüedad.
                </p>
                <p>
                  <strong>Licencia por Estudio:</strong> 2 días por examen, máximo 10 días por año.
                  Requiere certificado.
                </p>
                <p>
                  <strong>Trabajo Remoto:</strong> 8 semanas por año, deben ser semanas completas
                  (lunes a domingo).
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </TimeOffShell>
  );
}

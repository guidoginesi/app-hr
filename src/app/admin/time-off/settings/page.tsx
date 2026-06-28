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
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Configuración</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Administra los tipos de licencia y permisos de empleados
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-warning/30 border-t-transparent" />
          </div>
        ) : (
          <>
            {/* Leave Types */}
            <div className="rounded-xl border border-[var(--border)] bg-white shadow-sm">
              <div className="border-b border-[var(--border)] px-6 py-4">
                <h2 className="text-lg font-semibold text-foreground">Tipos de Licencia</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Configura los tipos de licencia disponibles
                </p>
              </div>
              <div className="divide-y divide-[var(--border)]">
                {leaveTypes.map((type) => (
                  <div key={type.id} className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="font-medium text-foreground">{type.name}</h3>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              type.is_active
                                ? 'bg-success-subtle text-[var(--green-700)]'
                                : 'bg-secondary text-muted-foreground'
                            }`}
                          >
                            {type.is_active ? 'Activo' : 'Inactivo'}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{type.description}</p>
                        <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                          <span>Tipo: {type.count_type === 'calendar_days' ? 'Días corridos' : type.count_type === 'business_days' ? 'Días hábiles' : 'Semanas'}</span>
                          {type.requires_attachment && <span>Requiere comprobante</span>}
                          {type.is_accumulative && <span>Acumulable</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-muted-foreground">Anticipación:</label>
                          <input
                            type="number"
                            min="0"
                            value={type.advance_notice_days}
                            onChange={(e) =>
                              handleUpdateAdvanceNotice(type, parseInt(e.target.value) || 0)
                            }
                            disabled={savingType === type.id}
                            className="w-16 rounded border border-[var(--border)] px-2 py-1 text-sm"
                          />
                          <span className="text-xs text-muted-foreground">días</span>
                        </div>
                        <button
                          onClick={() => handleToggleType(type)}
                          disabled={savingType === type.id}
                          className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                            type.is_active
                              ? 'border border-[var(--border)] bg-white text-muted-foreground hover:bg-muted'
                              : 'bg-success text-white hover:bg-success'
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
            <div className="rounded-xl border border-[var(--border)] bg-white shadow-sm">
              <div className="border-b border-[var(--border)] px-6 py-4">
                <h2 className="text-lg font-semibold text-foreground">Licencia por Estudio</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Marca a los empleados que están estudiando para habilitarles la licencia por
                  estudio
                </p>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  {/* Studying */}
                  <div>
                    <h3 className="mb-3 text-sm font-semibold text-foreground">
                      Estudiando ({studyingEmployees.length})
                    </h3>
                    <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-success/20 bg-success-subtle p-3">
                      {studyingEmployees.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No hay empleados marcados como estudiando</p>
                      ) : (
                        studyingEmployees.map((employee) => (
                          <div
                            key={employee.id}
                            className="flex items-center justify-between rounded bg-white p-2 shadow-sm"
                          >
                            <span className="text-sm text-foreground">
                              {employee.first_name} {employee.last_name}
                            </span>
                            <button
                              onClick={() => handleToggleStudying(employee)}
                              disabled={savingEmployee === employee.id}
                              className="rounded px-2 py-1 text-xs font-medium text-[var(--red-600)] hover:bg-danger-subtle"
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
                    <h3 className="mb-3 text-sm font-semibold text-foreground">
                      No estudiando ({notStudyingEmployees.length})
                    </h3>
                    <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-[var(--border)] bg-muted p-3">
                      {notStudyingEmployees.map((employee) => (
                        <div
                          key={employee.id}
                          className="flex items-center justify-between rounded bg-white p-2 shadow-sm"
                        >
                          <span className="text-sm text-foreground">
                            {employee.first_name} {employee.last_name}
                          </span>
                          <button
                            onClick={() => handleToggleStudying(employee)}
                            disabled={savingEmployee === employee.id}
                            className="rounded px-2 py-1 text-xs font-medium text-[var(--green-700)] hover:bg-success-subtle"
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
            <div className="rounded-xl border border-[var(--border)] bg-white shadow-sm">
              <div className="border-b border-[var(--border)] px-6 py-4">
                <h2 className="text-lg font-semibold text-foreground">Plantillas de Email</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Configura los emails automáticos que se envían durante el proceso de solicitudes
                </p>
              </div>
              <div className="p-6">
                <TimeOffEmailTemplates />
              </div>
            </div>

            {/* Info Box */}
            <div className="rounded-xl border border-[var(--orange-100)] bg-accent p-6">
              <h3 className="font-semibold text-accent-foreground">Información sobre licencias</h3>
              <div className="mt-3 space-y-2 text-sm text-accent-foreground">
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

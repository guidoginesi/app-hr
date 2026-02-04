'use client';

import { formatDateLocal } from '@/lib/dateUtils';
import type { EmployeeStatus } from '@/types/employee';

type EmployeeWithRelations = {
  id: string;
  user_id: string | null;
  first_name: string;
  last_name: string;
  personal_email: string;
  work_email: string | null;
  nationality: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  country: string | null;
  legal_entity_id: string | null;
  department_id: string | null;
  manager_id: string | null;
  application_id: string | null;
  status: EmployeeStatus;
  hire_date: string | null;
  termination_date: string | null;
  created_at: string;
  updated_at: string;
  legal_entity: { id: string; name: string } | null;
  department: { id: string; name: string } | null;
  manager: { id: string; first_name: string; last_name: string } | null;
};

type EmployeeModalProps = {
  employee: EmployeeWithRelations;
  onClose: () => void;
  onEdit: () => void;
};

const statusLabels: Record<EmployeeStatus, string> = {
  active: 'Activo',
  inactive: 'Inactivo',
  terminated: 'Desvinculado',
};

const statusColors: Record<EmployeeStatus, string> = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-yellow-100 text-yellow-700',
  terminated: 'bg-red-100 text-red-700',
};

export function EmployeeModal({ employee, onClose, onEdit }: EmployeeModalProps) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={onClose} />

        <div className="relative w-full max-w-2xl rounded-xl bg-white shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
            <div>
              <h2 className="text-xl font-semibold text-zinc-900">
                {employee.first_name} {employee.last_name}
              </h2>
              <p className="mt-1 text-sm text-zinc-500">{employee.personal_email}</p>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${statusColors[employee.status]}`}
              >
                {statusLabels[employee.status]}
              </span>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Personal Information */}
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 mb-3">Información Personal</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-zinc-500">Nombre completo</p>
                  <p className="text-sm font-medium text-zinc-900">
                    {employee.first_name} {employee.last_name}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Nacionalidad</p>
                  <p className="text-sm font-medium text-zinc-900">{employee.nationality || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Email personal</p>
                  <p className="text-sm font-medium text-zinc-900">{employee.personal_email}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Email de trabajo</p>
                  <p className="text-sm font-medium text-zinc-900">{employee.work_email || '-'}</p>
                </div>
              </div>
            </div>

            {/* Address */}
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 mb-3">Dirección</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <p className="text-xs text-zinc-500">Dirección</p>
                  <p className="text-sm font-medium text-zinc-900">{employee.address || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Ciudad</p>
                  <p className="text-sm font-medium text-zinc-900">{employee.city || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Código Postal</p>
                  <p className="text-sm font-medium text-zinc-900">{employee.postal_code || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">País</p>
                  <p className="text-sm font-medium text-zinc-900">{employee.country || '-'}</p>
                </div>
              </div>
            </div>

            {/* Organization */}
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 mb-3">Información Organizacional</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-zinc-500">Sociedad</p>
                  <p className="text-sm font-medium text-zinc-900">
                    {employee.legal_entity?.name || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Departamento</p>
                  <p className="text-sm font-medium text-zinc-900">
                    {employee.department?.name || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Manager</p>
                  <p className="text-sm font-medium text-zinc-900">
                    {employee.manager?.first_name && employee.manager?.last_name
                      ? `${employee.manager.first_name} ${employee.manager.last_name}`
                      : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Cuenta de usuario</p>
                  <p className="text-sm font-medium text-zinc-900">
                    {employee.user_id ? 'Sí' : 'No'}
                  </p>
                </div>
              </div>
            </div>

            {/* Employment */}
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 mb-3">Información de Empleo</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-zinc-500">Fecha de ingreso</p>
                  <p className="text-sm font-medium text-zinc-900">
                    {employee.hire_date
                      ? formatDateLocal(employee.hire_date)
                      : '-'}
                  </p>
                </div>
                {employee.status === 'terminated' && employee.termination_date && (
                  <div>
                    <p className="text-xs text-zinc-500">Fecha de desvinculación</p>
                    <p className="text-sm font-medium text-zinc-900">
                      {formatDateLocal(employee.termination_date)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 border-t border-zinc-200 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={onEdit}
              className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Editar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

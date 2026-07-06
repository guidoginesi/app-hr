'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { formatDateLocal } from '@/lib/dateUtils';
import type { EmployeeStatus } from '@/types/employee';
import { Sheet, SheetContent, SheetClose } from '@pow/ui/components/ui/sheet';
import { Button } from '@pow/ui/components/ui/button';

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
  active: 'bg-success-subtle text-[var(--green-700)]',
  inactive: 'bg-warning-subtle text-[var(--amber-600)]',
  terminated: 'bg-danger-subtle text-[var(--red-600)]',
};

export function EmployeeModal({ employee, onClose, onEdit }: EmployeeModalProps) {
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleResendAccess = async () => {
    setResending(true);
    setResendMsg(null);
    try {
      const res = await fetch(`/api/admin/employees/${employee.id}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true }),
      });
      const data = await res.json();
      if (res.ok) {
        setResendMsg({ type: 'success', text: data.message || 'Email reenviado exitosamente' });
      } else {
        setResendMsg({ type: 'error', text: data.error || 'Error al reenviar' });
      }
    } catch {
      setResendMsg({ type: 'error', text: 'Error de red al reenviar' });
    } finally {
      setResending(false);
    }
  };

  return (
    <Sheet open onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent
        side="right"
        flush
        title={`${employee.first_name} ${employee.last_name}`}
        className="max-w-2xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[var(--border)] px-6 py-4">
          <div>
            <h2 className="type-title">
              {employee.first_name} {employee.last_name}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{employee.personal_email}</p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${statusColors[employee.status]}`}
            >
              {statusLabels[employee.status]}
            </span>
            <SheetClose
              aria-label="Cerrar"
              className="-mr-1.5 grid h-8 w-8 place-items-center rounded-[var(--radius)] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-5 w-5" />
            </SheetClose>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-6 overflow-y-auto p-6">
            {/* Personal Information */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">Información Personal</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Nombre completo</p>
                  <p className="text-sm font-medium text-foreground">
                    {employee.first_name} {employee.last_name}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Nacionalidad</p>
                  <p className="text-sm font-medium text-foreground">{employee.nationality || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Email personal</p>
                  <p className="text-sm font-medium text-foreground">{employee.personal_email}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Email de trabajo</p>
                  <p className="text-sm font-medium text-foreground">{employee.work_email || '-'}</p>
                </div>
              </div>
            </div>

            {/* Address */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">Dirección</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Dirección</p>
                  <p className="text-sm font-medium text-foreground">{employee.address || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Ciudad</p>
                  <p className="text-sm font-medium text-foreground">{employee.city || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Código Postal</p>
                  <p className="text-sm font-medium text-foreground">{employee.postal_code || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">País</p>
                  <p className="text-sm font-medium text-foreground">{employee.country || '-'}</p>
                </div>
              </div>
            </div>

            {/* Organization */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">Información Organizacional</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Sociedad</p>
                  <p className="text-sm font-medium text-foreground">
                    {employee.legal_entity?.name || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Departamento</p>
                  <p className="text-sm font-medium text-foreground">
                    {employee.department?.name || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Manager</p>
                  <p className="text-sm font-medium text-foreground">
                    {employee.manager?.first_name && employee.manager?.last_name
                      ? `${employee.manager.first_name} ${employee.manager.last_name}`
                      : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Cuenta de usuario</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <p className="text-sm font-medium text-foreground">
                      {employee.user_id ? 'Sí' : 'No'}
                    </p>
                    <button
                      type="button"
                      onClick={handleResendAccess}
                      disabled={resending}
                      className="text-xs text-accent-foreground hover:text-accent-foreground underline disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {resending ? 'Enviando…' : 'Reenviar acceso'}
                    </button>
                  </div>
                  {resendMsg && (
                    <p className={`text-xs mt-1 ${resendMsg.type === 'success' ? 'text-[var(--green-700)]' : 'text-[var(--red-600)]'}`}>
                      {resendMsg.text}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Employment */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">Información de Empleo</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Fecha de ingreso</p>
                  <p className="text-sm font-medium text-foreground">
                    {employee.hire_date
                      ? formatDateLocal(employee.hire_date)
                      : '-'}
                  </p>
                </div>
                {employee.status === 'terminated' && employee.termination_date && (
                  <div>
                    <p className="text-xs text-muted-foreground">Fecha de desvinculación</p>
                    <p className="text-sm font-medium text-foreground">
                      {formatDateLocal(employee.termination_date)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 border-t border-[var(--border)] p-4">
            <Button variant="outline" onClick={onClose}>
              Cerrar
            </Button>
            <Button onClick={onEdit}>Editar</Button>
          </div>
      </SheetContent>
    </Sheet>
  );
}

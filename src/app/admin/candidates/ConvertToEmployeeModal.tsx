'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import type { LegalEntity, Department } from '@/types/employee';
import { Sheet, SheetContent, SheetClose } from '@pow/ui/components/ui/sheet';
import { Button } from '@pow/ui/components/ui/button';
import { SelectMenu } from '@pow/ui/components/ui/select-menu';

type DepartmentWithEntity = Department & {
  legal_entity: { id: string; name: string } | null;
};

type ManagerOption = {
  id: string;
  first_name: string;
  last_name: string;
};

type ConvertToEmployeeModalProps = {
  applicationId: string;
  candidateName: string;
  candidateEmail: string;
  onClose: () => void;
  onSuccess: () => void;
};

export function ConvertToEmployeeModal({
  applicationId,
  candidateName,
  candidateEmail,
  onClose,
  onSuccess,
}: ConvertToEmployeeModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Data from API
  const [legalEntities, setLegalEntities] = useState<LegalEntity[]>([]);
  const [departments, setDepartments] = useState<DepartmentWithEntity[]>([]);
  const [managers, setManagers] = useState<ManagerOption[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    legal_entity_id: '',
    department_id: '',
    manager_id: '',
    hire_date: new Date().toISOString().split('T')[0],
    work_email: '',
    create_user_account: true,
  });

  // Load data on mount
  useEffect(() => {
    async function loadData() {
      try {
        const [entitiesRes, depsRes, employeesRes] = await Promise.all([
          fetch('/api/admin/legal-entities'),
          fetch('/api/admin/departments'),
          fetch('/api/admin/employees?status=active'),
        ]);

        if (entitiesRes.ok) {
          const data = await entitiesRes.json();
          setLegalEntities(data);
        }

        if (depsRes.ok) {
          const data = await depsRes.json();
          setDepartments(data);
        }

        if (employeesRes.ok) {
          const data = await employeesRes.json();
          setManagers(data.map((emp: any) => ({
            id: emp.id,
            first_name: emp.first_name,
            last_name: emp.last_name,
          })));
        }
      } catch (err) {
        console.error('Error loading data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // Filter departments based on selected legal entity
  const filteredDepartments = formData.legal_entity_id
    ? departments.filter(
        (d) => !d.legal_entity_id || d.legal_entity_id === formData.legal_entity_id
      )
    : departments;

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));

    // Reset department if legal entity changes
    if (name === 'legal_entity_id' && formData.department_id) {
      const currentDept = departments.find((d) => d.id === formData.department_id);
      if (currentDept?.legal_entity_id && currentDept.legal_entity_id !== value) {
        setFormData((prev) => ({ ...prev, department_id: '' }));
      }
    }
  };

  // Cambio de un campo select preservando el nombre y los efectos secundarios
  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Reset department if legal entity changes
    if (name === 'legal_entity_id' && formData.department_id) {
      const currentDept = departments.find((d) => d.id === formData.department_id);
      if (currentDept?.legal_entity_id && currentDept.legal_entity_id !== value) {
        setFormData((prev) => ({ ...prev, department_id: '' }));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/employees/from-candidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          application_id: applicationId,
          legal_entity_id: formData.legal_entity_id || null,
          department_id: formData.department_id || null,
          manager_id: formData.manager_id || null,
          hire_date: formData.hire_date || null,
          work_email: formData.work_email || null,
          create_user_account: formData.create_user_account,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al crear el empleado');
      }

      router.refresh();
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Parse name into first and last
  const nameParts = candidateName.trim().split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  return (
    <Sheet open onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" flush title="Convertir a Empleado">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[var(--border)] px-6 py-4">
          <div>
            <h2 className="type-title">Convertir a Empleado</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {candidateName} ({candidateEmail})
            </p>
          </div>
          <SheetClose
            aria-label="Cerrar"
            className="-mr-1.5 grid h-8 w-8 place-items-center rounded-[var(--radius)] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-5 w-5" />
          </SheetClose>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex-1 p-6 text-center">
            <p className="text-sm text-muted-foreground">Cargando...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 space-y-4 overflow-y-auto p-6">
                {error && (
                  <div className="rounded-lg bg-danger-subtle p-4 text-sm text-[var(--red-600)]">{error}</div>
                )}

                {/* Preview */}
                <div className="rounded-lg bg-muted p-4 space-y-2">
                  <p className="text-xs text-muted-foreground">Se creará el empleado con estos datos:</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Nombre:</span>{' '}
                      <span className="font-medium">{firstName}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Apellido:</span>{' '}
                      <span className="font-medium">{lastName || '-'}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Email personal:</span>{' '}
                      <span className="font-medium">{candidateEmail}</span>
                    </div>
                  </div>
                </div>

                {/* Form fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-secondary-foreground mb-1">
                      Sociedad
                    </label>
                    <SelectMenu
                      ariaLabel="Sociedad"
                      className="w-full"
                      placeholder="Seleccionar..."
                      value={formData.legal_entity_id}
                      onChange={(v) => handleSelectChange('legal_entity_id', v)}
                      options={[
                        { value: '', label: 'Seleccionar...' },
                        ...legalEntities.filter(e => e.is_active).map((entity) => ({ value: entity.id, label: entity.name })),
                      ]}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-secondary-foreground mb-1">
                      Departamento
                    </label>
                    <SelectMenu
                      ariaLabel="Departamento"
                      className="w-full"
                      placeholder="Seleccionar..."
                      value={formData.department_id}
                      onChange={(v) => handleSelectChange('department_id', v)}
                      options={[
                        { value: '', label: 'Seleccionar...' },
                        ...filteredDepartments.filter(d => d.is_active).map((dept) => ({ value: dept.id, label: dept.name })),
                      ]}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-secondary-foreground mb-1">
                      Manager
                    </label>
                    <SelectMenu
                      ariaLabel="Manager"
                      className="w-full"
                      placeholder="Seleccionar..."
                      value={formData.manager_id}
                      onChange={(v) => handleSelectChange('manager_id', v)}
                      options={[
                        { value: '', label: 'Seleccionar...' },
                        ...managers.map((mgr) => ({ value: mgr.id, label: `${mgr.first_name} ${mgr.last_name}` })),
                      ]}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-secondary-foreground mb-1">
                      Fecha de ingreso
                    </label>
                    <input
                      type="date"
                      name="hire_date"
                      value={formData.hire_date}
                      onChange={handleInputChange}
                      className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-secondary-foreground mb-1">
                      Email de trabajo
                    </label>
                    <input
                      type="email"
                      name="work_email"
                      value={formData.work_email}
                      onChange={handleInputChange}
                      placeholder="nombre@empresa.com"
                      className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        name="create_user_account"
                        checked={formData.create_user_account}
                        onChange={handleInputChange}
                        className="rounded border-[var(--border)] accent-[var(--primary)] focus:ring-ring"
                      />
                      <span className="text-sm text-secondary-foreground">
                        Crear cuenta de usuario para acceder al portal
                      </span>
                    </label>
                    <p className="mt-1 text-xs text-muted-foreground ml-6">
                      Se enviará un email al empleado para configurar su contraseña
                    </p>
                  </div>
                </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 border-t border-[var(--border)] p-4">
              <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
                Cancelar
              </Button>
              <Button type="submit" loading={submitting}>
                Crear Empleado
              </Button>
            </div>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}

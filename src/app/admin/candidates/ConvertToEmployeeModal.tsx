'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { LegalEntity, Department } from '@/types/employee';

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
    <div className="fixed inset-0 z-[60] overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={onClose} />

        <div className="relative w-full max-w-lg rounded-xl bg-white shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
            <div>
              <h2 className="text-xl font-semibold text-zinc-900">Convertir a Empleado</h2>
              <p className="mt-1 text-sm text-zinc-500">
                {candidateName} ({candidateEmail})
              </p>
            </div>
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

          {/* Content */}
          {loading ? (
            <div className="p-6 text-center">
              <p className="text-sm text-zinc-500">Cargando...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-4">
                {error && (
                  <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">{error}</div>
                )}

                {/* Preview */}
                <div className="rounded-lg bg-zinc-50 p-4 space-y-2">
                  <p className="text-xs text-zinc-500">Se creará el empleado con estos datos:</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-zinc-500">Nombre:</span>{' '}
                      <span className="font-medium">{firstName}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500">Apellido:</span>{' '}
                      <span className="font-medium">{lastName || '-'}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-zinc-500">Email personal:</span>{' '}
                      <span className="font-medium">{candidateEmail}</span>
                    </div>
                  </div>
                </div>

                {/* Form fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">
                      Sociedad
                    </label>
                    <select
                      name="legal_entity_id"
                      value={formData.legal_entity_id}
                      onChange={handleInputChange}
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    >
                      <option value="">Seleccionar...</option>
                      {legalEntities.filter(e => e.is_active).map((entity) => (
                        <option key={entity.id} value={entity.id}>
                          {entity.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">
                      Departamento
                    </label>
                    <select
                      name="department_id"
                      value={formData.department_id}
                      onChange={handleInputChange}
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    >
                      <option value="">Seleccionar...</option>
                      {filteredDepartments.filter(d => d.is_active).map((dept) => (
                        <option key={dept.id} value={dept.id}>
                          {dept.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">
                      Manager
                    </label>
                    <select
                      name="manager_id"
                      value={formData.manager_id}
                      onChange={handleInputChange}
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    >
                      <option value="">Seleccionar...</option>
                      {managers.map((mgr) => (
                        <option key={mgr.id} value={mgr.id}>
                          {mgr.first_name} {mgr.last_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">
                      Fecha de ingreso
                    </label>
                    <input
                      type="date"
                      name="hire_date"
                      value={formData.hire_date}
                      onChange={handleInputChange}
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-zinc-700 mb-1">
                      Email de trabajo
                    </label>
                    <input
                      type="email"
                      name="work_email"
                      value={formData.work_email}
                      onChange={handleInputChange}
                      placeholder="nombre@empresa.com"
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        name="create_user_account"
                        checked={formData.create_user_account}
                        onChange={handleInputChange}
                        className="rounded border-zinc-300"
                      />
                      <span className="text-sm text-zinc-700">
                        Crear cuenta de usuario para acceder al portal
                      </span>
                    </label>
                    <p className="mt-1 text-xs text-zinc-500 ml-6">
                      Se enviará un email al empleado para configurar su contraseña
                    </p>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3 border-t border-zinc-200 px-6 py-4">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {submitting ? 'Creando...' : 'Crear Empleado'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

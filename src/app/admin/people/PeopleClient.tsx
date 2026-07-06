'use client';

import { useState, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { formatDateLocal } from '@/lib/dateUtils';
import { useDebounce } from '@/lib/useDebounce';
import type { LegalEntity, Department, EmployeeStatus } from '@/types/employee';
import { Button } from '@pow/ui/components/ui/button';
import { SelectMenu } from '@pow/ui/components/ui/select-menu';

// Lazy load modals for better initial load performance
const EmployeeModal = dynamic(() => import('./EmployeeModal').then(mod => mod.EmployeeModal), {
  loading: () => null,
});
const EmployeeFormModal = dynamic(() => import('./EmployeeFormModal').then(mod => mod.EmployeeFormModal), {
  loading: () => null,
});

type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed' | 'other';
type EducationLevel = 'primary' | 'secondary' | 'tertiary' | 'university' | 'postgraduate';

type EmployeeWithRelations = {
  id: string;
  user_id: string | null;
  first_name: string;
  last_name: string;
  personal_email: string;
  work_email: string | null;
  nationality: string | null;
  birth_date: string | null;
  phone: string | null;
  marital_status: MaritalStatus | null;
  photo_url: string | null;
  cuil: string | null;
  dni: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  country: string | null;
  education_level: EducationLevel | null;
  education_title: string | null;
  languages: string | null;
  emergency_contact_relationship: string | null;
  emergency_contact_first_name: string | null;
  emergency_contact_last_name: string | null;
  emergency_contact_address: string | null;
  emergency_contact_phone: string | null;
  legal_entity_id: string | null;
  department_id: string | null;
  manager_id: string | null;
  job_title: string | null;
  seniority_level: string | null;
  application_id: string | null;
  status: EmployeeStatus;
  hire_date: string | null;
  termination_date: string | null;
  employment_type: string | null;
  created_at: string;
  updated_at: string;
  legal_entity: { id: string; name: string } | null;
  department: { id: string; name: string } | null;
  manager: { id: string; first_name: string; last_name: string } | null;
};

type DepartmentWithEntity = Department & {
  legal_entity: { id: string; name: string } | null;
};

type PeopleClientProps = {
  employees: EmployeeWithRelations[];
  legalEntities: LegalEntity[];
  departments: DepartmentWithEntity[];
};

const ITEMS_PER_PAGE = 25;

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

export function PeopleClient({ employees: initialEmployees, legalEntities, departments }: PeopleClientProps) {
  const [employees, setEmployees] = useState(initialEmployees);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeWithRelations | null>(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeWithRelations | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<EmployeeStatus | 'ALL'>('ALL');
  const [legalEntityFilter, setLegalEntityFilter] = useState<string>('ALL');
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [inviting, setInviting] = useState<string | null>(null);
  const [inviteMessage, setInviteMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Debounce search query for better performance
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Filter employees using debounced search
  const filteredEmployees = useMemo(() => {
    let filtered = employees;

    // Text search (using debounced value)
    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase();
      filtered = filtered.filter(
        (emp) =>
          emp.first_name.toLowerCase().includes(query) ||
          emp.last_name.toLowerCase().includes(query) ||
          emp.personal_email.toLowerCase().includes(query) ||
          (emp.work_email && emp.work_email.toLowerCase().includes(query))
      );
    }

    // Status filter
    if (statusFilter !== 'ALL') {
      filtered = filtered.filter((emp) => emp.status === statusFilter);
    }

    // Legal entity filter
    if (legalEntityFilter !== 'ALL') {
      filtered = filtered.filter((emp) => emp.legal_entity_id === legalEntityFilter);
    }

    // Department filter
    if (departmentFilter !== 'ALL') {
      filtered = filtered.filter((emp) => emp.department_id === departmentFilter);
    }

    return filtered;
  }, [employees, debouncedSearchQuery, statusFilter, legalEntityFilter, departmentFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredEmployees.length / ITEMS_PER_PAGE);
  const paginatedEmployees = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredEmployees.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredEmployees, currentPage]);

  // Reset page when debounced search changes
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  }, []);

  const handleStatusFilterChange = useCallback((value: EmployeeStatus | 'ALL') => {
    setStatusFilter(value);
    setCurrentPage(1);
  }, []);

  const handleLegalEntityFilterChange = useCallback((value: string) => {
    setLegalEntityFilter(value);
    setCurrentPage(1);
  }, []);

  const handleDepartmentFilterChange = useCallback((value: string) => {
    setDepartmentFilter(value);
    setCurrentPage(1);
  }, []);

  const handleEmployeeCreated = (newEmployee: EmployeeWithRelations) => {
    setEmployees((prev) => [...prev, newEmployee].sort((a, b) => a.last_name.localeCompare(b.last_name)));
    setIsFormModalOpen(false);
  };

  const handleEmployeeUpdated = (updatedEmployee: EmployeeWithRelations) => {
    setEmployees((prev) =>
      prev.map((emp) => (emp.id === updatedEmployee.id ? updatedEmployee : emp))
    );
    setEditingEmployee(null);
    setIsFormModalOpen(false);
    if (selectedEmployee?.id === updatedEmployee.id) {
      setSelectedEmployee(updatedEmployee);
    }
  };

  const handleEditClick = (employee: EmployeeWithRelations) => {
    setEditingEmployee(employee);
    setIsFormModalOpen(true);
    setSelectedEmployee(null);
  };

  const handleAddClick = () => {
    setEditingEmployee(null);
    setIsFormModalOpen(true);
  };

  // Get available managers (active employees with seniority >= 3.1, except the one being edited)
  const availableManagers = employees.filter((emp) => {
    if (emp.status !== 'active') return false;
    if (editingEmployee && emp.id === editingEmployee.id) return false;
    
    // Only include employees with seniority level >= 3.1
    if (!emp.seniority_level) return false;
    const seniorityNum = parseFloat(emp.seniority_level);
    return !isNaN(seniorityNum) && seniorityNum >= 3.1;
  });

  // Invite employee to portal
  const handleInvite = async (employeeId: string) => {
    setInviting(employeeId);
    setInviteMessage(null);
    try {
      const res = await fetch(`/api/admin/employees/${employeeId}/invite`, { method: 'POST' });
      const data = await res.json();
      
      if (res.ok) {
        setInviteMessage({ type: 'success', text: data.message });
        // Update the employee in the list to show they now have access
        setEmployees(prev => prev.map(emp => 
          emp.id === employeeId ? { ...emp, user_id: 'invited' } : emp
        ));
      } else {
        setInviteMessage({ type: 'error', text: data.error });
      }
    } catch (error) {
      setInviteMessage({ type: 'error', text: 'Error al enviar la invitación' });
    } finally {
      setInviting(null);
    }
  };

  return (
    <>
      <div className="space-y-6">
        {inviteMessage && (
          <div className={`rounded-lg p-4 text-sm ${
            inviteMessage.type === 'success' ? 'bg-success-subtle text-[var(--green-700)]' : 'bg-danger-subtle text-[var(--red-600)]'
          }`}>
            {inviteMessage.text}
            <button
              onClick={() => setInviteMessage(null)}
              className="ml-2 text-xs underline"
            >
              Cerrar
            </button>
          </div>
        )}

        <div className="rounded-xl border border-[var(--border)] bg-white shadow-sm">
          {/* Filters */}
          <div className="border-b border-[var(--border)] px-6 py-4 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-foreground">Lista de empleados</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {filteredEmployees.length} de {employees.length} empleados
                </p>
              </div>
              <Button onClick={handleAddClick}>Agregar empleado</Button>
            </div>

            <div className="flex flex-col lg:flex-row gap-3">
              {/* Text search */}
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Buscar por nombre, email..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-brand focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              {/* Status filter */}
              <div className="lg:w-48">
                <SelectMenu
                  ariaLabel="Filtrar por estado"
                  className="w-full"
                  value={statusFilter}
                  onChange={(v) => handleStatusFilterChange(v as EmployeeStatus | 'ALL')}
                  options={[
                    { value: 'ALL', label: 'Todos los estados' },
                    { value: 'active', label: 'Activos' },
                    { value: 'inactive', label: 'Inactivos' },
                    { value: 'terminated', label: 'Desvinculados' },
                  ]}
                />
              </div>

              {/* Legal entity filter */}
              <div className="lg:w-48">
                <SelectMenu
                  ariaLabel="Filtrar por sociedad"
                  className="w-full"
                  value={legalEntityFilter}
                  onChange={handleLegalEntityFilterChange}
                  options={[
                    { value: 'ALL', label: 'Todas las sociedades' },
                    ...legalEntities.map((entity) => ({ value: entity.id, label: entity.name })),
                  ]}
                />
              </div>

              {/* Department filter */}
              <div className="lg:w-48">
                <SelectMenu
                  ariaLabel="Filtrar por departamento"
                  className="w-full"
                  value={departmentFilter}
                  onChange={handleDepartmentFilterChange}
                  options={[
                    { value: 'ALL', label: 'Todos los departamentos' },
                    ...departments.map((dept) => ({ value: dept.id, label: dept.name })),
                  ]}
                />
              </div>
            </div>
          </div>

          {/* Employee list */}
          <ul className="divide-y divide-[var(--border)]">
            {paginatedEmployees.length > 0 ? (
              paginatedEmployees.map((employee) => (
                <li key={employee.id} className="px-6 py-4 transition-colors hover:bg-muted">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-foreground">
                          {employee.first_name} {employee.last_name}
                        </h3>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[employee.status]}`}
                        >
                          {statusLabels[employee.status]}
                        </span>
                        {employee.legal_entity && (
                          <>
                            <span className="text-xs text-muted-foreground">·</span>
                            <span className="text-xs text-muted-foreground">{employee.legal_entity.name}</span>
                          </>
                        )}
                        {employee.department && (
                          <>
                            <span className="text-xs text-muted-foreground">·</span>
                            <span className="text-xs text-muted-foreground">{employee.department.name}</span>
                          </>
                        )}
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{employee.personal_email}</span>
                        {employee.work_email && (
                          <>
                            <span className="text-muted-foreground">·</span>
                            <span>{employee.work_email}</span>
                          </>
                        )}
                        {employee.manager?.first_name && employee.manager?.last_name && (
                          <>
                            <span className="text-muted-foreground">·</span>
                            <span>
                              Manager: {employee.manager.first_name} {employee.manager.last_name}
                            </span>
                          </>
                        )}
                        {employee.hire_date && (
                          <>
                            <span className="text-muted-foreground">·</span>
                            <span>
                              Ingreso: {formatDateLocal(employee.hire_date)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!employee.user_id && employee.status === 'active' && (
                        <button
                          type="button"
                          onClick={() => handleInvite(employee.id)}
                          disabled={inviting === employee.id}
                          className="rounded-lg border border-success/20 bg-success-subtle px-3 py-1.5 text-xs font-medium text-[var(--green-700)] transition-colors hover:bg-success-subtle disabled:opacity-50"
                        >
                          {inviting === employee.id ? 'Enviando...' : 'Invitar al portal'}
                        </button>
                      )}
                      {employee.user_id && (
                        <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          Con acceso
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleEditClick(employee)}
                        className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-medium text-secondary-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedEmployee(employee)}
                        className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-medium text-secondary-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        Ver detalle
                      </button>
                    </div>
                  </div>
                </li>
              ))
            ) : (
              <li className="px-6 py-12 text-center">
                <p className="text-sm font-medium text-muted-foreground">
                  {employees.length === 0
                    ? 'No hay empleados registrados todavía'
                    : 'No se encontraron empleados con los filtros aplicados'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {employees.length === 0
                    ? 'Agrega empleados usando el botón de arriba'
                    : 'Intenta cambiar los filtros de búsqueda'}
                </p>
              </li>
            )}
          </ul>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="border-t border-[var(--border)] px-6 py-3 bg-muted">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Mostrando {(currentPage - 1) * ITEMS_PER_PAGE + 1} -{' '}
                  {Math.min(currentPage * ITEMS_PER_PAGE, filteredEmployees.length)} de{' '}
                  {filteredEmployees.length} resultados
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-sm font-medium text-secondary-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-sm font-medium text-secondary-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Employee detail modal */}
      {selectedEmployee && (
        <EmployeeModal
          employee={selectedEmployee}
          onClose={() => setSelectedEmployee(null)}
          onEdit={() => handleEditClick(selectedEmployee)}
        />
      )}

      {/* Employee form modal */}
      {isFormModalOpen && (
        <EmployeeFormModal
          employee={editingEmployee}
          legalEntities={legalEntities}
          departments={departments}
          managers={availableManagers}
          onClose={() => {
            setIsFormModalOpen(false);
            setEditingEmployee(null);
          }}
          onSave={editingEmployee ? handleEmployeeUpdated : handleEmployeeCreated}
        />
      )}
    </>
  );
}

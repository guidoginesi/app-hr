import { redirect } from 'next/navigation';
import { requirePortalAccess } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { PortalShell } from '../PortalShell';

export const dynamic = 'force-dynamic';

export default async function PortalProfilePage() {
  const auth = await requirePortalAccess();
  
  if (!auth || !auth.employee) {
    redirect('/portal/login');
  }

  const { employee, isLeader } = auth;
  const supabase = getSupabaseServer();

  // Get employee with related data
  const { data: employeeData } = await supabase
    .from('employees')
    .select(`
      *,
      legal_entity:legal_entities(id, name),
      department:departments(id, name)
    `)
    .eq('id', employee.id)
    .single();

  // Get manager separately (self-reference can be tricky in Supabase)
  let managerData = null;
  if (employeeData?.manager_id) {
    const { data: manager } = await supabase
      .from('employees')
      .select('id, first_name, last_name')
      .eq('id', employeeData.manager_id)
      .single();
    managerData = manager;
  }

  const fullEmployee = {
    ...(employeeData || employee),
    manager: managerData
  };

  return (
    <PortalShell employee={employee} isLeader={isLeader} active="profile">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Mi Perfil</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tu información personal y laboral
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Personal Information */}
          <div className="rounded-xl border border-[var(--border)] bg-white p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Información Personal</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Nombre</p>
                  <p className="text-sm font-medium text-foreground">{fullEmployee.first_name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Apellido</p>
                  <p className="text-sm font-medium text-foreground">{fullEmployee.last_name}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Email personal</p>
                <p className="text-sm font-medium text-foreground">{fullEmployee.personal_email}</p>
              </div>
              {fullEmployee.work_email && (
                <div>
                  <p className="text-xs text-muted-foreground">Email de trabajo</p>
                  <p className="text-sm font-medium text-foreground">{fullEmployee.work_email}</p>
                </div>
              )}
              {fullEmployee.nationality && (
                <div>
                  <p className="text-xs text-muted-foreground">Nacionalidad</p>
                  <p className="text-sm font-medium text-foreground">{fullEmployee.nationality}</p>
                </div>
              )}
            </div>
          </div>

          {/* Address */}
          <div className="rounded-xl border border-[var(--border)] bg-white p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Dirección</h2>
            <div className="space-y-4">
              {fullEmployee.address ? (
                <>
                  <div>
                    <p className="text-xs text-muted-foreground">Dirección</p>
                    <p className="text-sm font-medium text-foreground">{fullEmployee.address}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Ciudad</p>
                      <p className="text-sm font-medium text-foreground">{fullEmployee.city || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Código Postal</p>
                      <p className="text-sm font-medium text-foreground">{fullEmployee.postal_code || '-'}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">País</p>
                    <p className="text-sm font-medium text-foreground">{fullEmployee.country || '-'}</p>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No hay dirección registrada</p>
              )}
            </div>
          </div>

          {/* Organization */}
          <div className="rounded-xl border border-[var(--border)] bg-white p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Información Organizacional</h2>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground">Sociedad</p>
                <p className="text-sm font-medium text-foreground">
                  {(fullEmployee as any).legal_entity?.name || '-'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Departamento</p>
                <p className="text-sm font-medium text-foreground">
                  {(fullEmployee as any).department?.name || '-'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Manager</p>
                <p className="text-sm font-medium text-foreground">
                  {(fullEmployee as any).manager?.first_name && (fullEmployee as any).manager?.last_name
                    ? `${(fullEmployee as any).manager.first_name} ${(fullEmployee as any).manager.last_name}`
                    : '-'
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Employment */}
          <div className="rounded-xl border border-[var(--border)] bg-white p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Información de Empleo</h2>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground">Estado</p>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  fullEmployee.status === 'active' 
                    ? 'bg-success-subtle text-[var(--green-700)]' 
                    : fullEmployee.status === 'inactive'
                    ? 'bg-warning-subtle text-[var(--amber-600)]'
                    : 'bg-danger-subtle text-[var(--red-600)]'
                }`}>
                  {fullEmployee.status === 'active' ? 'Activo' : fullEmployee.status === 'inactive' ? 'Inactivo' : 'Desvinculado'}
                </span>
              </div>
              {fullEmployee.hire_date && (
                <div>
                  <p className="text-xs text-muted-foreground">Fecha de ingreso</p>
                  <p className="text-sm font-medium text-foreground">
                    {new Date(fullEmployee.hire_date).toLocaleDateString('es-AR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </PortalShell>
  );
}

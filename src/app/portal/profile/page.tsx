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
      department:departments(id, name),
      manager:employees!manager_id(id, first_name, last_name)
    `)
    .eq('id', employee.id)
    .single();

  const fullEmployee = employeeData || employee;

  return (
    <PortalShell employee={employee} isLeader={isLeader} active="profile">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Mi Perfil</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Tu información personal y laboral
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Personal Information */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-zinc-900 mb-4">Información Personal</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-zinc-500">Nombre</p>
                  <p className="text-sm font-medium text-zinc-900">{fullEmployee.first_name}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Apellido</p>
                  <p className="text-sm font-medium text-zinc-900">{fullEmployee.last_name}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Email personal</p>
                <p className="text-sm font-medium text-zinc-900">{fullEmployee.personal_email}</p>
              </div>
              {fullEmployee.work_email && (
                <div>
                  <p className="text-xs text-zinc-500">Email de trabajo</p>
                  <p className="text-sm font-medium text-zinc-900">{fullEmployee.work_email}</p>
                </div>
              )}
              {fullEmployee.nationality && (
                <div>
                  <p className="text-xs text-zinc-500">Nacionalidad</p>
                  <p className="text-sm font-medium text-zinc-900">{fullEmployee.nationality}</p>
                </div>
              )}
            </div>
          </div>

          {/* Address */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-zinc-900 mb-4">Dirección</h2>
            <div className="space-y-4">
              {fullEmployee.address ? (
                <>
                  <div>
                    <p className="text-xs text-zinc-500">Dirección</p>
                    <p className="text-sm font-medium text-zinc-900">{fullEmployee.address}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-zinc-500">Ciudad</p>
                      <p className="text-sm font-medium text-zinc-900">{fullEmployee.city || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Código Postal</p>
                      <p className="text-sm font-medium text-zinc-900">{fullEmployee.postal_code || '-'}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">País</p>
                    <p className="text-sm font-medium text-zinc-900">{fullEmployee.country || '-'}</p>
                  </div>
                </>
              ) : (
                <p className="text-sm text-zinc-500">No hay dirección registrada</p>
              )}
            </div>
          </div>

          {/* Organization */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-zinc-900 mb-4">Información Organizacional</h2>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-zinc-500">Sociedad</p>
                <p className="text-sm font-medium text-zinc-900">
                  {(fullEmployee as any).legal_entity?.name || '-'}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Departamento</p>
                <p className="text-sm font-medium text-zinc-900">
                  {(fullEmployee as any).department?.name || '-'}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Manager</p>
                <p className="text-sm font-medium text-zinc-900">
                  {(fullEmployee as any).manager 
                    ? `${(fullEmployee as any).manager.first_name} ${(fullEmployee as any).manager.last_name}`
                    : '-'
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Employment */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-zinc-900 mb-4">Información de Empleo</h2>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-zinc-500">Estado</p>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  fullEmployee.status === 'active' 
                    ? 'bg-green-100 text-green-700' 
                    : fullEmployee.status === 'inactive'
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  {fullEmployee.status === 'active' ? 'Activo' : fullEmployee.status === 'inactive' ? 'Inactivo' : 'Desvinculado'}
                </span>
              </div>
              {fullEmployee.hire_date && (
                <div>
                  <p className="text-xs text-zinc-500">Fecha de ingreso</p>
                  <p className="text-sm font-medium text-zinc-900">
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

import { redirect } from 'next/navigation';
import { requirePortalAccess } from '@/lib/checkAuth';
import { PortalShell } from './PortalShell';

export const dynamic = 'force-dynamic';

export default async function PortalDashboardPage() {
  const auth = await requirePortalAccess();
  
  if (!auth || !auth.employee) {
    redirect('/portal/login');
  }

  const { employee, isLeader } = auth;

  return (
    <PortalShell employee={employee} isLeader={isLeader} active="dashboard">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Bienvenido, {employee.first_name}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Este es tu portal de empleados
          </p>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Profile Card */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-zinc-900">Mi Perfil</h3>
                <p className="text-sm text-zinc-500">Ver y actualizar tu información</p>
              </div>
            </div>
            <a
              href="/portal/profile"
              className="mt-4 inline-flex items-center text-sm font-medium text-emerald-600 hover:text-emerald-700"
            >
              Ver perfil
              <svg className="ml-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>
          </div>

          {/* Time Off Card */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
                <svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-zinc-900">Time Off</h3>
                <p className="text-sm text-zinc-500">Vacaciones y licencias</p>
              </div>
            </div>
            <a
              href="/portal/time-off"
              className="mt-4 inline-flex items-center text-sm font-medium text-amber-600 hover:text-amber-700"
            >
              Ver mis balances
              <svg className="ml-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>
          </div>

          {/* Evaluaciones Card */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100">
                <svg className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-zinc-900">Evaluaciones</h3>
                <p className="text-sm text-zinc-500">Ver tu desempeño</p>
              </div>
            </div>
            <a
              href="/portal/evaluaciones"
              className="mt-4 inline-flex items-center text-sm font-medium text-purple-600 hover:text-purple-700"
            >
              Ver evaluaciones
              <svg className="ml-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>
          </div>

          {/* Reserva de Salas Card */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-cyan-100">
                <svg className="h-6 w-6 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-zinc-900">Reserva de Salas</h3>
                <p className="text-sm text-zinc-500">Salas de reuniones</p>
              </div>
            </div>
            <a
              href="/portal/room-booking"
              className="mt-4 inline-flex items-center text-sm font-medium text-cyan-600 hover:text-cyan-700"
            >
              Ver disponibilidad
              <svg className="ml-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>
          </div>

          {/* Team Card - Only for leaders */}
          {isLeader && (
            <div className="rounded-xl border border-zinc-200 bg-white p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
                  <svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-zinc-900">Mi Equipo</h3>
                  <p className="text-sm text-zinc-500">Gestionar tu equipo</p>
                </div>
              </div>
              <a
                href="/portal/team"
                className="mt-4 inline-flex items-center text-sm font-medium text-amber-600 hover:text-amber-700"
              >
                Ver equipo
                <svg className="ml-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </a>
            </div>
          )}
        </div>

        {/* Employee Info Summary */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-zinc-900 mb-4">Tu información</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-xs text-zinc-500">Email</p>
              <p className="text-sm font-medium text-zinc-900">{employee.work_email || employee.personal_email}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Estado</p>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                employee.status === 'active' 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-zinc-100 text-zinc-700'
              }`}>
                {employee.status === 'active' ? 'Activo' : employee.status}
              </span>
            </div>
            {employee.hire_date && (
              <div>
                <p className="text-xs text-zinc-500">Fecha de ingreso</p>
                <p className="text-sm font-medium text-zinc-900">
                  {new Date(employee.hire_date).toLocaleDateString('es-AR')}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </PortalShell>
  );
}

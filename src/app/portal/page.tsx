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
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Bienvenido, {employee.first_name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Este es tu portal de empleados
          </p>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Profile Card */}
          <a href="/portal/profile" className="group block rounded-xl border border-[var(--border)] bg-white p-6 transition-all hover:border-[var(--ring)] hover:shadow-md">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
                <svg className="h-6 w-6 text-secondary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">Mi Perfil</h3>
                <p className="text-sm text-muted-foreground">Ver y actualizar tu información</p>
              </div>
            </div>
            <span className="mt-4 inline-flex items-center text-sm font-medium text-accent-foreground">
              Ver perfil
              <svg className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </span></a>

          {/* Time Off Card */}
          <a href="/portal/time-off" className="group block rounded-xl border border-[var(--border)] bg-white p-6 transition-all hover:border-[var(--ring)] hover:shadow-md">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
                <svg className="h-6 w-6 text-secondary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">Time Off</h3>
                <p className="text-sm text-muted-foreground">Vacaciones y licencias</p>
              </div>
            </div>
            <span className="mt-4 inline-flex items-center text-sm font-medium text-accent-foreground">
              Ver mis balances
              <svg className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </span></a>

          {/* Evaluaciones Card */}
          <a href="/portal/evaluaciones" className="group block rounded-xl border border-[var(--border)] bg-white p-6 transition-all hover:border-[var(--ring)] hover:shadow-md">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
                <svg className="h-6 w-6 text-secondary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">Evaluaciones</h3>
                <p className="text-sm text-muted-foreground">Ver tu desempeño</p>
              </div>
            </div>
            <span className="mt-4 inline-flex items-center text-sm font-medium text-accent-foreground">
              Ver evaluaciones
              <svg className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </span></a>

          {/* Reserva de Salas Card */}
          <a href="/portal/room-booking" className="group block rounded-xl border border-[var(--border)] bg-white p-6 transition-all hover:border-[var(--ring)] hover:shadow-md">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
                <svg className="h-6 w-6 text-secondary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">Reserva de Salas</h3>
                <p className="text-sm text-muted-foreground">Salas de reuniones</p>
              </div>
            </div>
            <span className="mt-4 inline-flex items-center text-sm font-medium text-accent-foreground">
              Ver disponibilidad
              <svg className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </span></a>

          {/* Team Card - Only for leaders */}
          {isLeader && (
            <a href="/portal/team" className="group block rounded-xl border border-[var(--border)] bg-white p-6 transition-all hover:border-[var(--ring)] hover:shadow-md">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
                  <svg className="h-6 w-6 text-secondary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground">Mi Equipo</h3>
                  <p className="text-sm text-muted-foreground">Gestionar tu equipo</p>
                </div>
              </div>
              <span className="mt-4 inline-flex items-center text-sm font-medium text-accent-foreground">
                Ver equipo
                <svg className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </span></a>
          )}
        </div>

        {/* Employee Info Summary */}
        <div className="rounded-xl border border-[var(--border)] bg-white p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Tu información</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="text-sm font-medium text-foreground">{employee.work_email || employee.personal_email}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Estado</p>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                employee.status === 'active' 
                  ? 'bg-success-subtle text-[var(--green-700)]' 
                  : 'bg-secondary text-secondary-foreground'
              }`}>
                {employee.status === 'active' ? 'Activo' : employee.status}
              </span>
            </div>
            {employee.hire_date && (
              <div>
                <p className="text-xs text-muted-foreground">Fecha de ingreso</p>
                <p className="text-sm font-medium text-foreground">
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

import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import Link from 'next/link';
import { AdminProfileDropdown } from '@/components/AdminProfileDropdown';

export const dynamic = 'force-dynamic';

export default async function AdminHome() {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) {
    redirect('/admin/login');
  }

  const supabase = getSupabaseServer();

  // Get quick stats for modules
  const [jobsResult, employeesResult, evaluationPeriodsResult, roomsResult] = await Promise.all([
    supabase.from('jobs').select('id', { count: 'exact' }).eq('is_published', true),
    supabase.from('employees').select('id', { count: 'exact' }).eq('status', 'active'),
    supabase.from('evaluation_periods').select('id', { count: 'exact' }).eq('status', 'open'),
    supabase.from('rooms').select('id', { count: 'exact' }).eq('is_active', true),
  ]);

  const activeJobs = jobsResult.count || 0;
  const activeEmployees = employeesResult.count || 0;
  const activeEvaluationPeriods = evaluationPeriodsResult.count || 0;
  const activeRooms = roomsResult.count || 0;

  const modules = [
    {
      id: 'recruiting',
      name: 'Reclutamiento',
      description: 'Gestión de búsquedas, candidatos y proceso de selección',
      href: '/admin/recruiting',
      icon: (
        <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      stats: `${activeJobs} búsquedas activas`,
      color: 'bg-blue-600',
      bgLight: 'bg-blue-50',
      textColor: 'text-blue-600',
      available: true,
    },
    {
      id: 'people',
      name: 'People',
      description: 'Gestión de empleados, sociedades y estructura organizacional',
      href: '/admin/people',
      icon: (
        <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      stats: `${activeEmployees} empleados activos`,
      color: 'bg-emerald-600',
      bgLight: 'bg-emerald-50',
      textColor: 'text-emerald-600',
      available: true,
    },
    {
      id: 'time-off',
      name: 'Time Off',
      description: 'Gestión de vacaciones, licencias y días libres',
      href: '/admin/time-off',
      icon: (
        <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      stats: 'Vacaciones y licencias',
      color: 'bg-amber-600',
      bgLight: 'bg-amber-50',
      textColor: 'text-amber-600',
      available: true,
    },
    {
      id: 'evaluations',
      name: 'Evaluaciones',
      description: 'Evaluaciones de desempeño y feedback 360°',
      href: '/admin/evaluations',
      icon: (
        <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      stats: activeEvaluationPeriods > 0 ? `${activeEvaluationPeriods} período${activeEvaluationPeriods > 1 ? 's' : ''} activo${activeEvaluationPeriods > 1 ? 's' : ''}` : 'Sin períodos activos',
      color: 'bg-purple-600',
      bgLight: 'bg-purple-50',
      textColor: 'text-purple-600',
      available: true,
    },
    {
      id: 'objectives',
      name: 'Objetivos',
      description: 'OKRs y objetivos anuales por equipo y empleado',
      href: '/admin/objectives',
      icon: (
        <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
        </svg>
      ),
      stats: 'Sin objetivos activos',
      color: 'bg-rose-600',
      bgLight: 'bg-rose-50',
      textColor: 'text-rose-600',
      available: true,
    },
    {
      id: 'room-booking',
      name: 'Reserva de Salas',
      description: 'Gestión de salas de reunión y reservas',
      href: '/admin/room-booking',
      icon: (
        <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
      stats: `${activeRooms} salas activas`,
      color: 'bg-cyan-600',
      bgLight: 'bg-cyan-50',
      textColor: 'text-cyan-600',
      available: true,
    },
  ];

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-zinc-900">HR Admin</h1>
              <p className="mt-1 text-sm text-zinc-500">Sistema de Recursos Humanos</p>
            </div>
            <AdminProfileDropdown />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-zinc-900">Módulos</h2>
          <p className="mt-1 text-sm text-zinc-500">Selecciona un módulo para comenzar</p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {modules.map((module) => (
            <div key={module.id} className="relative">
              {module.available ? (
                <Link
                  href={module.href}
                  className="group flex h-full flex-col rounded-xl border border-zinc-200 bg-white p-6 shadow-sm transition-all hover:border-zinc-300 hover:shadow-md"
                >
                  <div className={`inline-flex rounded-lg ${module.bgLight} p-3 self-start`}>
                    <span className={module.textColor}>{module.icon}</span>
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-zinc-900 group-hover:text-black">
                    {module.name}
                  </h3>
                  <p className="mt-2 flex-1 text-sm text-zinc-500">{module.description}</p>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-sm font-medium text-zinc-600">{module.stats}</span>
                    <span className={`inline-flex items-center gap-1 text-sm font-medium ${module.textColor}`}>
                      Ir al módulo
                      <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </div>
                </Link>
              ) : (
                <div className="flex h-full flex-col rounded-xl border border-zinc-200 bg-white p-6 opacity-60">
                  <div className={`inline-flex rounded-lg bg-zinc-100 p-3 self-start`}>
                    <span className="text-zinc-400">{module.icon}</span>
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-zinc-500">{module.name}</h3>
                  <p className="mt-2 flex-1 text-sm text-zinc-400">{module.description}</p>
                  <div className="mt-4">
                    <span className="inline-flex items-center rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-500">
                      Próximamente
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

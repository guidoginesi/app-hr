import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { TimeOffShell } from './TimeOffShell';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function TimeOffDashboardPage() {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) {
    redirect('/admin/login');
  }

  const supabase = getSupabaseServer();
  const today = new Date().toISOString().split('T')[0];
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .split('T')[0];

  // Get stats
  const [pendingResult, approvedResult, onLeaveResult, upcomingResult] = await Promise.all([
    supabase
      .from('leave_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending'),
    supabase
      .from('leave_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved')
      .gte('approved_at', startOfMonth),
    supabase
      .from('leave_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved')
      .lte('start_date', today)
      .gte('end_date', today),
    supabase
      .from('leave_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved')
      .gt('start_date', today),
  ]);

  const pendingRequests = pendingResult.count || 0;
  const approvedThisMonth = approvedResult.count || 0;
  const employeesOnLeaveToday = onLeaveResult.count || 0;
  const upcomingLeaves = upcomingResult.count || 0;

  // Get recent pending requests
  const { data: recentPending } = await supabase
    .from('leave_requests_with_details')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(5);

  // Get employees on leave today
  const { data: onLeaveToday } = await supabase
    .from('leave_requests_with_details')
    .select('*')
    .eq('status', 'approved')
    .lte('start_date', today)
    .gte('end_date', today)
    .limit(5);

  return (
    <TimeOffShell active="dashboard">
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Dashboard de Time Off</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Resumen general de vacaciones y licencias
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Pendientes</p>
            <p className="mt-3 text-4xl font-bold text-amber-600">{pendingRequests}</p>
            <p className="mt-2 text-xs text-zinc-500">Solicitudes por aprobar</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Aprobadas</p>
            <p className="mt-3 text-4xl font-bold text-green-600">{approvedThisMonth}</p>
            <p className="mt-2 text-xs text-zinc-500">Este mes</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">De licencia hoy</p>
            <p className="mt-3 text-4xl font-bold text-blue-600">{employeesOnLeaveToday}</p>
            <p className="mt-2 text-xs text-zinc-500">Empleados</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Próximas</p>
            <p className="mt-3 text-4xl font-bold text-purple-600">{upcomingLeaves}</p>
            <p className="mt-2 text-xs text-zinc-500">Licencias programadas</p>
          </div>
        </div>

        {/* Pending requests banner */}
        {pendingRequests > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-amber-900">
                  {pendingRequests} solicitud{pendingRequests > 1 ? 'es' : ''} pendiente{pendingRequests > 1 ? 's' : ''}
                </h2>
                <p className="mt-1 text-sm text-amber-700">
                  Hay solicitudes esperando aprobación
                </p>
              </div>
              <Link
                href="/admin/time-off/requests?status=pending"
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
              >
                Ver solicitudes
              </Link>
            </div>
          </div>
        )}

        {/* Two columns */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Recent pending */}
          <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-200 px-6 py-4">
              <h3 className="text-base font-semibold text-zinc-900">Solicitudes pendientes</h3>
            </div>
            {recentPending && recentPending.length > 0 ? (
              <ul className="divide-y divide-zinc-200">
                {recentPending.map((request) => (
                  <li key={request.id} className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-zinc-900">{request.employee_name}</p>
                        <p className="text-sm text-zinc-500">
                          {request.leave_type_name} • {new Date(request.start_date).toLocaleDateString('es-AR')} - {new Date(request.end_date).toLocaleDateString('es-AR')}
                        </p>
                      </div>
                      <span className="text-sm font-medium text-amber-600">
                        {request.days_requested}{' '}
                        {request.count_type === 'weeks' 
                          ? `semana${request.days_requested > 1 ? 's' : ''}`
                          : `día${request.days_requested > 1 ? 's' : ''}`}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-6 py-8 text-center text-sm text-zinc-500">
                No hay solicitudes pendientes
              </div>
            )}
            {recentPending && recentPending.length > 0 && (
              <div className="border-t border-zinc-200 px-6 py-3">
                <Link
                  href="/admin/time-off/requests?status=pending"
                  className="text-sm font-medium text-amber-600 hover:text-amber-700"
                >
                  Ver todas las pendientes →
                </Link>
              </div>
            )}
          </div>

          {/* On leave today */}
          <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-200 px-6 py-4">
              <h3 className="text-base font-semibold text-zinc-900">De licencia hoy</h3>
            </div>
            {onLeaveToday && onLeaveToday.length > 0 ? (
              <ul className="divide-y divide-zinc-200">
                {onLeaveToday.map((request) => (
                  <li key={request.id} className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-zinc-900">{request.employee_name}</p>
                        <p className="text-sm text-zinc-500">
                          {request.leave_type_name}
                        </p>
                      </div>
                      <span className="text-sm text-zinc-500">
                        hasta {new Date(request.end_date).toLocaleDateString('es-AR')}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-6 py-8 text-center text-sm text-zinc-500">
                No hay empleados de licencia hoy
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h3 className="text-base font-semibold text-zinc-900">Acciones rápidas</h3>
          <p className="mt-1 text-sm text-zinc-500">Administra balances y configuración</p>
          <div className="mt-4 flex gap-3">
            <Link
              href="/admin/time-off/balances"
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Ver balances
            </Link>
            <Link
              href="/admin/time-off/settings"
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Configuración
            </Link>
          </div>
        </div>
      </div>
    </TimeOffShell>
  );
}

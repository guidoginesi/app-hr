import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { TimeOffShell } from './TimeOffShell';
import Link from 'next/link';
import { PendingHRSection } from './PendingHRSection';
import type { LeaveRequestWithDetails } from '@/types/time-off';
import { formatDateLocal } from '@/lib/dateUtils';

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

  // Get stats - count pending_hr for HR approval queue
  const [pendingHRResult, pendingLeaderResult, approvedResult, onLeaveResult, upcomingResult] = await Promise.all([
    supabase
      .from('leave_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending_hr'),
    supabase
      .from('leave_requests')
      .select('*', { count: 'exact', head: true })
      .in('status', ['pending', 'pending_leader']),
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

  const pendingHRRequests = pendingHRResult.count || 0;
  const pendingLeaderRequests = pendingLeaderResult.count || 0;
  const approvedThisMonth = approvedResult.count || 0;
  const employeesOnLeaveToday = onLeaveResult.count || 0;
  const upcomingLeaves = upcomingResult.count || 0;

  // Get pending HR requests (for approval section)
  const { data: pendingHR } = await supabase
    .from('leave_requests_with_details')
    .select('*')
    .eq('status', 'pending_hr')
    .order('created_at', { ascending: false })
    .limit(10);

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
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Pendientes HR</p>
            <p className="mt-3 text-4xl font-bold text-blue-700">{pendingHRRequests}</p>
            <p className="mt-2 text-xs text-blue-600">Tu aprobación final</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Pendientes Líder</p>
            <p className="mt-3 text-4xl font-bold text-amber-600">{pendingLeaderRequests}</p>
            <p className="mt-2 text-xs text-zinc-500">Esperando primera aprobación</p>
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

        {/* HR Approval Section */}
        <PendingHRSection initialRequests={(pendingHR || []) as LeaveRequestWithDetails[]} />

        {/* Workflow info */}
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6">
          <h3 className="text-sm font-semibold text-zinc-900">Flujo de aprobación de 2 niveles</h3>
          <div className="mt-3 flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700">1</span>
              <span className="text-zinc-600">Líder aprueba</span>
            </div>
            <svg className="h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">2</span>
              <span className="text-zinc-600">HR aprueba (final)</span>
            </div>
            <svg className="h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-xs font-bold text-green-700">✓</span>
              <span className="text-zinc-600">Solicitud aprobada</span>
            </div>
          </div>
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
                      hasta {formatDateLocal(request.end_date)}
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

        {/* Quick Actions */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h3 className="text-base font-semibold text-zinc-900">Acciones rápidas</h3>
          <p className="mt-1 text-sm text-zinc-500">Administra balances y configuración</p>
          <div className="mt-4 flex gap-3">
            <Link
              href="/admin/time-off/requests"
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Todas las solicitudes
            </Link>
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

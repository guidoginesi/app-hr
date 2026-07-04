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
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard de Time Off</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Resumen general de vacaciones y licencias
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <div className="rounded-xl border border-[var(--orange-100)] bg-accent p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-accent-foreground">Pendientes HR</p>
            <p className="mt-3 text-4xl font-bold text-accent-foreground">{pendingHRRequests}</p>
            <p className="mt-2 text-xs text-accent-foreground">Tu aprobación final</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pendientes Líder</p>
            <p className="mt-3 text-4xl font-bold text-[var(--amber-600)]">{pendingLeaderRequests}</p>
            <p className="mt-2 text-xs text-muted-foreground">Esperando primera aprobación</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Aprobadas</p>
            <p className="mt-3 text-4xl font-bold text-[var(--green-700)]">{approvedThisMonth}</p>
            <p className="mt-2 text-xs text-muted-foreground">Este mes</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">De licencia hoy</p>
            <p className="mt-3 text-4xl font-bold text-accent-foreground">{employeesOnLeaveToday}</p>
            <p className="mt-2 text-xs text-muted-foreground">Empleados</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Próximas</p>
            <p className="mt-3 text-4xl font-bold text-cat-violet">{upcomingLeaves}</p>
            <p className="mt-2 text-xs text-muted-foreground">Licencias programadas</p>
          </div>
        </div>

        {/* HR Approval Section */}
        <PendingHRSection initialRequests={(pendingHR || []) as LeaveRequestWithDetails[]} />

        {/* Workflow info */}
        <div className="rounded-xl border border-[var(--border)] bg-muted p-6">
          <h3 className="text-sm font-semibold text-foreground">Flujo de aprobación de 2 niveles</h3>
          <div className="mt-3 flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-warning-subtle text-xs font-bold text-[var(--amber-600)]">1</span>
              <span className="text-muted-foreground">Líder aprueba</span>
            </div>
            <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">2</span>
              <span className="text-muted-foreground">HR aprueba (final)</span>
            </div>
            <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-success-subtle text-xs font-bold text-[var(--green-700)]">✓</span>
              <span className="text-muted-foreground">Solicitud aprobada</span>
            </div>
          </div>
        </div>

        {/* On leave today */}
        <div className="rounded-xl border border-[var(--border)] bg-white shadow-sm">
          <div className="border-b border-[var(--border)] px-6 py-4">
            <h3 className="text-base font-semibold text-foreground">De licencia hoy</h3>
          </div>
          {onLeaveToday && onLeaveToday.length > 0 ? (
            <ul className="divide-y divide-[var(--border)]">
              {onLeaveToday.map((request) => (
                <li key={request.id} className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">{request.employee_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {request.leave_type_name}
                      </p>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      hasta {formatDateLocal(request.end_date)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-6 py-8 text-center text-sm text-muted-foreground">
              No hay empleados de licencia hoy
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
          <h3 className="text-base font-semibold text-foreground">Acciones rápidas</h3>
          <p className="mt-1 text-sm text-muted-foreground">Administra balances y configuración</p>
          <div className="mt-4 flex gap-3">
            <Link
              href="/admin/time-off/requests"
              className="rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-muted"
            >
              Todas las solicitudes
            </Link>
            <Link
              href="/admin/time-off/balances"
              className="rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-muted"
            >
              Ver balances
            </Link>
            <Link
              href="/admin/time-off/settings"
              className="rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-muted"
            >
              Configuración
            </Link>
          </div>
        </div>
      </div>
    </TimeOffShell>
  );
}

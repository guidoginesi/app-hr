import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { TimeOffLayout } from './TimeOffLayout';
import Link from 'next/link';
import { PendingHRSection } from './PendingHRSection';
import type { LeaveRequestWithDetails } from '@/types/time-off';
import { formatDateLocal } from '@/lib/dateUtils';
import { Stat } from '@pow/ui/components/ui/stat';
import { Clock, CheckCircle2, Plane, CalendarClock } from 'lucide-react';

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
    <TimeOffLayout active="dashboard">
      <div className="space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <Stat
            icon={<Clock className="h-6 w-6" />}
            label="Pendientes HR"
            value={String(pendingHRRequests)}
            sub="Tu aprobación final"
            tone={pendingHRRequests > 0 ? 'warning' : 'default'}
          />
          <Stat
            icon={<Clock className="h-6 w-6" />}
            label="Pendientes Líder"
            value={String(pendingLeaderRequests)}
            sub="Esperando primera aprobación"
          />
          <Stat icon={<CheckCircle2 className="h-6 w-6" />} label="Aprobadas" value={String(approvedThisMonth)} sub="Este mes" />
          <Stat icon={<Plane className="h-6 w-6" />} label="De licencia hoy" value={String(employeesOnLeaveToday)} sub="Empleados" />
          <Stat icon={<CalendarClock className="h-6 w-6" />} label="Próximas" value={String(upcomingLeaves)} sub="Licencias programadas" />
        </div>

        {/* HR Approval Section */}
        <PendingHRSection initialRequests={(pendingHR || []) as LeaveRequestWithDetails[]} />

        {/* Workflow info */}
        <div className="rounded-xl border border-[var(--border)] bg-muted p-6">
          <h3 className="text-sm font-semibold text-foreground">Flujo de aprobación de 2 niveles</h3>
          <div className="mt-3 flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground">1</span>
              <span className="text-muted-foreground">Líder aprueba</span>
            </div>
            <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground">2</span>
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
                      <p className="text-sm font-medium text-foreground">{request.employee_name}</p>
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
    </TimeOffLayout>
  );
}

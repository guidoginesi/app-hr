import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requirePortalAccess, getDirectReports } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { getSupabaseAuthServer } from '@/lib/supabaseAuthServer';
import { PortalShell } from './PortalShell';
import { PageHeader } from '@pow/ui/components/ui/page-header';
import { Stat } from '@pow/ui/components/ui/stat';
import { LeaveRequestRow } from '@/components/time-off/LeaveRequestRow';
import type { LeaveRequestWithDetails } from '@/types/time-off';

export const dynamic = 'force-dynamic';

export default async function PortalDashboardPage() {
  const auth = await requirePortalAccess();

  if (!auth || !auth.employee) {
    redirect('/portal/login');
  }

  const { employee, isLeader } = auth;
  const supabase = getSupabaseServer();
  const currentYear = new Date().getFullYear();
  const now = new Date();

  // Balances de Time Off (año en curso)
  const { data: balances } = await supabase
    .from('leave_balances_with_details')
    .select('*')
    .eq('employee_id', employee.id)
    .eq('year', currentYear);
  const balByType: Record<string, any> = {};
  (balances || []).forEach((b: any) => { balByType[b.leave_type_code] = b; });
  const totalOf = (t: string) =>
    Number(balByType[t]?.entitled_days ?? 0) + Number(balByType[t]?.carried_over ?? 0) + Number(balByType[t]?.bonus_days ?? 0);
  const vacAvail = Number(balByType['vacation']?.available_days ?? 0);
  const powAvail = Number(balByType['pow_days']?.available_days ?? 0);
  const remoteAvail = Number(balByType['remote_work']?.available_days ?? 0);
  const remoteTotal = Number(balByType['remote_work']?.entitled_days ?? 0);

  const balanceBars = [
    { label: 'Vacaciones', avail: vacAvail, total: totalOf('vacation'), unit: 'días' },
    { label: 'Días Pow', avail: powAvail, total: totalOf('pow_days'), unit: 'días' },
    { label: 'Trabajo Remoto', avail: remoteAvail, total: remoteTotal, unit: 'semanas' },
  ];

  // Solicitudes recientes
  const { data: recentRequests } = await supabase
    .from('leave_requests_with_details')
    .select('*')
    .eq('employee_id', employee.id)
    .order('created_at', { ascending: false })
    .limit(4);
  const requests = (recentRequests || []) as LeaveRequestWithDetails[];

  // Mensajes sin leer
  let unreadMessages = 0;
  try {
    const supabaseAuth = await getSupabaseAuthServer();
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (user) {
      const { data: recips } = await supabase
        .from('message_recipients')
        .select('read_at, messages(status, expires_at)')
        .eq('user_id', user.id);
      unreadMessages = ((recips ?? []) as any[]).filter((r) => {
        const m = r.messages;
        if (r.read_at || !m || m.status !== 'published') return false;
        if (m.expires_at && new Date(m.expires_at) <= now) return false;
        return true;
      }).length;
    }
  } catch { /* ignore */ }

  // Solicitudes de Time Off pendientes de tu aprobación (líderes)
  let pendingApprovals = 0;
  if (isLeader) {
    const directReports = await getDirectReports(employee.id);
    const ids = directReports.map((e) => e.id);
    if (ids.length > 0) {
      const { count } = await supabase
        .from('leave_requests')
        .select('*', { count: 'exact', head: true })
        .in('employee_id', ids)
        .in('status', ['pending_leader', 'pending']);
      pendingApprovals = count || 0;
    }
  }

  const stats: { label: string; value: string; sub?: string; tone?: 'default' | 'warning' | 'success' | 'danger'; href: string }[] = [
    { label: 'Vacaciones', value: `${vacAvail}`, sub: 'días disponibles', href: '/portal/time-off' },
    { label: 'Días Pow', value: `${powAvail}`, sub: 'días disponibles', href: '/portal/time-off' },
    isLeader
      ? {
          label: 'Pendientes de aprobar',
          value: `${pendingApprovals}`,
          sub: 'Time Off',
          tone: pendingApprovals > 0 ? 'warning' : 'default',
          href: '/portal/time-off/team',
        }
      : { label: 'Trabajo Remoto', value: `${remoteAvail}`, sub: 'semanas disponibles', href: '/portal/time-off' },
    { label: 'Mensajes sin leer', value: `${unreadMessages}`, sub: unreadMessages === 1 ? 'mensaje' : 'mensajes', href: '/portal/messages' },
  ];

  const cards: { href: string; title: string; desc: string; icon: string }[] = [
    { href: '/portal/evaluaciones', title: 'Evaluaciones', desc: 'Ver tu desempeño', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
    { href: '/portal/objetivos', title: 'Objetivos', desc: 'Tus objetivos del período', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
    { href: '/portal/recibos', title: 'Recibos de sueldo', desc: 'Descargá tus recibos', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { href: '/portal/room-booking', title: 'Reserva de Salas', desc: 'Salas de reuniones', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
    { href: '/portal/certificates', title: 'Certificados', desc: 'Cargá tus certificados', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { href: '/portal/referidos', title: 'Referidos', desc: 'Recomendá talento', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
  ];

  return (
    <PortalShell employee={employee} isLeader={isLeader} active="dashboard">
      <div className="space-y-6">
        <PageHeader title={`Hola, ${employee.first_name}`} description="Este es tu portal de empleados" />

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map((s) => (
            <a key={s.label} href={s.href} className="block rounded-[var(--radius)] transition-shadow hover:shadow-md">
              <Stat label={s.label} value={s.value} sub={s.sub} tone={s.tone} />
            </a>
          ))}
        </div>

        {/* Balances + solicitudes recientes */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Balances con barras */}
          <div className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-secondary-foreground">Mis balances de Time Off</h3>
            <div className="space-y-4">
              {balanceBars.map((b) => (
                <div key={b.label}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-secondary-foreground">{b.label}</span>
                    <span className="font-medium text-foreground">
                      {b.avail} <span className="font-normal text-muted-foreground">de {b.total} {b.unit} disponibles</span>
                    </span>
                  </div>
                  {/* Track = disponible (naranja claro del sidebar) · fill = consumido (naranja marca) */}
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-accent">
                    <div
                      className="h-2 rounded-full bg-brand transition-all"
                      style={{ width: `${b.total > 0 ? Math.min(100, Math.round(((b.total - b.avail) / b.total) * 100)) : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Solicitudes recientes */}
          <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
              <h3 className="text-sm font-semibold text-secondary-foreground">Mis solicitudes recientes</h3>
              <Link href="/portal/time-off" className="text-sm font-medium text-foreground hover:text-[var(--primary-hover)]">
                Ver todas →
              </Link>
            </div>
            {requests.length > 0 ? (
              <ul className="divide-y divide-[var(--border)]">
                {requests.map((r) => (
                  <LeaveRequestRow key={r.id} request={r} showTrail={false} />
                ))}
              </ul>
            ) : (
              <p className="px-6 py-8 text-center text-sm text-muted-foreground">No tenés solicitudes recientes</p>
            )}
          </div>
        </div>

        {/* Accesos rápidos */}
        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Accesos rápidos</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((c) => (
              <a
                key={c.href}
                href={c.href}
                className="group relative block rounded-xl border border-[var(--border)] bg-white p-5 shadow-sm transition-all hover:border-[var(--ring)] hover:shadow-md"
              >
                <svg className="absolute right-4 top-4 h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                  <svg className="h-5 w-5 text-secondary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={c.icon} />
                  </svg>
                </div>
                <h3 className="text-sm font-medium text-foreground">{c.title}</h3>
                <p className="mt-0.5 text-[13px] text-muted-foreground">{c.desc}</p>
              </a>
            ))}
          </div>
        </div>

        {/* Tu información */}
        <div className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tu información</h2>
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="text-sm font-medium text-foreground">{employee.work_email || employee.personal_email}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Estado</p>
              <span className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
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

import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import Link from 'next/link';
import { AdminShell } from '@/app/admin/AdminShell';
import { PageHeader } from '@pow/ui/components/ui/page-header';
import { Card, CardContent, CardFooter } from '@pow/ui/components/ui/card';

export const dynamic = 'force-dynamic';

export default async function AdminHome() {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) {
    redirect('/admin/login');
  }

  const supabase = getSupabaseServer();

  // Get quick stats for modules
  const [jobsResult, employeesResult, evaluationPeriodsResult, payrollPeriodsResult, roomsResult] = await Promise.all([
    supabase.from('jobs').select('id', { count: 'exact' }).eq('is_published', true),
    supabase.from('employees').select('id', { count: 'exact' }).eq('status', 'active'),
    supabase.from('evaluation_periods').select('id', { count: 'exact' }).eq('status', 'open'),
    supabase.from('payroll_periods').select('id', { count: 'exact' }).in('status', ['DRAFT', 'IN_REVIEW']),
    supabase.from('rooms').select('id', { count: 'exact' }).eq('is_active', true),
  ]);

  const activeJobs = jobsResult.count || 0;
  const activeEmployees = employeesResult.count || 0;
  const activeEvaluationPeriods = evaluationPeriodsResult.count || 0;
  const activePayrollPeriods = payrollPeriodsResult.count || 0;
  const activeRooms = roomsResult.count || 0;

  const modules = [
    {
      id: 'recruiting',
      name: 'Reclutamiento',
      description: 'Gestión de búsquedas, candidatos y proceso de selección',
      href: '/admin/recruiting',
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      stats: `${activeJobs} búsquedas activas`,
      available: true,
    },
    {
      id: 'people',
      name: 'People',
      description: 'Gestión de empleados, sociedades y estructura organizacional',
      href: '/admin/people',
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      stats: `${activeEmployees} empleados activos`,
      available: true,
    },
    {
      id: 'time-off',
      name: 'Time Off',
      description: 'Gestión de vacaciones, licencias y días libres',
      href: '/admin/time-off',
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      stats: 'Vacaciones y licencias',
      available: true,
    },
    {
      id: 'evaluations',
      name: 'Evaluaciones',
      description: 'Evaluaciones de desempeño y feedback 360°',
      href: '/admin/evaluations',
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      stats: activeEvaluationPeriods > 0 ? `${activeEvaluationPeriods} período${activeEvaluationPeriods > 1 ? 's' : ''} activo${activeEvaluationPeriods > 1 ? 's' : ''}` : 'Sin períodos activos',
      available: true,
    },
    {
      id: 'objectives',
      name: 'Objetivos',
      description: 'OKRs y objetivos anuales por equipo y empleado',
      href: '/admin/objectives',
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
        </svg>
      ),
      stats: 'Sin objetivos activos',
      available: true,
    },
    {
      id: 'entrenamiento-ia',
      name: 'Entrenamiento IA',
      description: 'Ranking de capacitaciones internas y carga de puntajes',
      href: '/admin/entrenamiento-ia',
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      ),
      stats: 'Ranking de capacitaciones',
      available: true,
    },
    {
      id: 'payroll',
      name: 'Liquidaciones',
      description: 'Liquidaciones mensuales, recibos de sueldo y monotributo',
      href: '/admin/payroll',
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
        </svg>
      ),
      stats: activePayrollPeriods > 0 ? `${activePayrollPeriods} periodo${activePayrollPeriods !== 1 ? 's' : ''} abierto${activePayrollPeriods !== 1 ? 's' : ''}` : 'Sin periodos abiertos',
      available: true,
    },
    {
      id: 'room-booking',
      name: 'Reserva de Salas',
      description: 'Gestión de salas de reuniones y reservas del equipo',
      href: '/admin/room-booking',
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      stats: `${activeRooms} sala${activeRooms !== 1 ? 's' : ''} activa${activeRooms !== 1 ? 's' : ''}`,
      available: true,
    },
    {
      id: 'messages',
      name: 'Mensajes',
      description: 'Anuncios y comunicaciones masivas a empleados',
      href: '/admin/messages',
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      ),
      stats: 'Centro de comunicación',
      available: true,
    },
  ];

  return (
    <AdminShell active="dashboard">
      <div className="space-y-6">
        <PageHeader
          title="HR Admin"
          description="Sistema de Recursos Humanos"
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {modules.map((module) => (
            <Link key={module.id} href={module.href} className="group block">
              <Card className="flex h-full flex-col transition-all hover:border-[var(--ring)] hover:shadow-md">
                <CardContent className="flex flex-1 flex-col pt-5">
                  <div className="inline-flex self-start rounded-[var(--radius)] bg-accent p-3 text-accent-foreground">
                    {module.icon}
                  </div>
                  <h3 className="mt-4 font-display text-base font-semibold tracking-tight text-foreground">
                    {module.name}
                  </h3>
                  <p className="mt-1 flex-1 text-sm text-muted-foreground">{module.description}</p>
                </CardContent>
                <CardFooter className="justify-between">
                  <span className="text-sm text-muted-foreground">{module.stats}</span>
                  <svg className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </CardFooter>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </AdminShell>
  );
}

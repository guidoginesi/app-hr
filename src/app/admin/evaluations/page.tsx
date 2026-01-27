import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { EvaluationsShell } from './EvaluationsShell';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

// Helper to format date without timezone issues
function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('es-AR');
}

export default async function EvaluationsDashboardPage() {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) {
    redirect('/admin/login');
  }

  const supabase = getSupabaseServer();

  // Get stats
  const [periodsResult, activePeriodResult, evaluationsResult] = await Promise.all([
    supabase.from('evaluation_periods').select('*').order('year', { ascending: false }),
    supabase.from('evaluation_periods').select('*').eq('status', 'open').single(),
    supabase.from('evaluations').select('id, status, type', { count: 'exact' }),
  ]);

  const periods = periodsResult.data || [];
  const activePeriod = activePeriodResult.data;
  const evaluations = evaluationsResult.data || [];

  const totalEvaluations = evaluations.length;
  const submittedEvaluations = evaluations.filter(e => e.status === 'submitted').length;
  const selfEvaluations = evaluations.filter(e => e.type === 'self').length;
  const leaderEvaluations = evaluations.filter(e => e.type === 'leader').length;

  return (
    <EvaluationsShell active="dashboard">
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Dashboard de Evaluaciones</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Resumen general del módulo de evaluaciones de desempeño
          </p>
        </div>

        {/* Active Period Banner */}
        {activePeriod ? (
          <div className="rounded-xl border border-purple-200 bg-purple-50 p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700">
                    Activo
                  </span>
                  <h2 className="text-lg font-semibold text-purple-900">{activePeriod.name}</h2>
                </div>
                <p className="mt-1 text-sm text-purple-700">
                  {formatDate(activePeriod.start_date)} - {formatDate(activePeriod.end_date)}
                </p>
              </div>
              <Link
                href={`/admin/evaluations/periods`}
                className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
              >
                Gestionar período
              </Link>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-amber-900">No hay período activo</h2>
                <p className="mt-1 text-sm text-amber-700">
                  Crea y activa un período de evaluación para comenzar
                </p>
              </div>
              <Link
                href="/admin/evaluations/periods"
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
              >
                Crear período
              </Link>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Total Evaluaciones</p>
            <p className="mt-3 text-4xl font-bold text-zinc-900">{totalEvaluations}</p>
            <p className="mt-2 text-xs text-zinc-500">En todos los períodos</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Completadas</p>
            <p className="mt-3 text-4xl font-bold text-green-600">{submittedEvaluations}</p>
            <p className="mt-2 text-xs text-zinc-500">Enviadas</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Autoevaluaciones</p>
            <p className="mt-3 text-4xl font-bold text-blue-600">{selfEvaluations}</p>
            <p className="mt-2 text-xs text-zinc-500">De colaboradores</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Eval. Líderes</p>
            <p className="mt-3 text-4xl font-bold text-purple-600">{leaderEvaluations}</p>
            <p className="mt-2 text-xs text-zinc-500">De líderes</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h3 className="text-base font-semibold text-zinc-900">Configuración</h3>
            <p className="mt-1 text-sm text-zinc-500">Administra períodos y dimensiones de evaluación</p>
            <div className="mt-4 flex gap-3">
              <Link
                href="/admin/evaluations/periods"
                className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Períodos
              </Link>
              <Link
                href="/admin/evaluations/dimensions"
                className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Dimensiones
              </Link>
            </div>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h3 className="text-base font-semibold text-zinc-900">Seguimiento</h3>
            <p className="mt-1 text-sm text-zinc-500">Visualiza todas las evaluaciones del sistema</p>
            <div className="mt-4">
              <Link
                href="/admin/evaluations/all"
                className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Ver todas las evaluaciones
              </Link>
            </div>
          </div>
        </div>

        {/* Recent Periods */}
        {periods.length > 0 && (
          <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-200 px-6 py-4">
              <h3 className="text-base font-semibold text-zinc-900">Períodos recientes</h3>
            </div>
            <ul className="divide-y divide-zinc-200">
              {periods.slice(0, 5).map((period) => (
                <li key={period.id} className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-zinc-900">{period.name}</p>
                      <p className="text-sm text-zinc-500">
                        {formatDate(period.start_date)} - {formatDate(period.end_date)}
                      </p>
                    </div>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      period.status === 'open' 
                        ? 'bg-green-100 text-green-700'
                        : period.status === 'closed'
                        ? 'bg-zinc-100 text-zinc-600'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {period.status === 'open' ? 'Abierto' : period.status === 'closed' ? 'Cerrado' : 'Borrador'}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </EvaluationsShell>
  );
}

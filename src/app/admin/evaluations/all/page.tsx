import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { EvaluationsShell } from '../EvaluationsShell';

export const dynamic = 'force-dynamic';

export default async function AllEvaluationsPage() {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) {
    redirect('/admin/login');
  }

  const supabase = getSupabaseServer();

  const { data: evaluations } = await supabase
    .from('evaluations')
    .select(`
      *,
      period:evaluation_periods(id, name, year),
      employee:employees!employee_id(id, first_name, last_name, job_title),
      evaluator:employees!evaluator_id(id, first_name, last_name)
    `)
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <EvaluationsShell active="all">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Todas las Evaluaciones</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Lista completa de evaluaciones en el sistema
          </p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
          {!evaluations || evaluations.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm text-zinc-500">No hay evaluaciones registradas aún.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50">
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                      Empleado
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                      Tipo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                      Evaluador
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                      Período
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                      Puntaje
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                      Fecha
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {evaluations.map((evaluation: any) => (
                    <tr key={evaluation.id} className="hover:bg-zinc-50">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-zinc-900">
                            {evaluation.employee?.first_name} {evaluation.employee?.last_name}
                          </p>
                          <p className="text-xs text-zinc-500">{evaluation.employee?.job_title || '-'}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          evaluation.type === 'self'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-purple-100 text-purple-700'
                        }`}>
                          {evaluation.type === 'self' ? 'Autoevaluación' : 'Líder'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-zinc-600">
                        {evaluation.evaluator?.first_name} {evaluation.evaluator?.last_name}
                      </td>
                      <td className="px-6 py-4 text-sm text-zinc-600">
                        {evaluation.period?.name}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          evaluation.status === 'submitted'
                            ? 'bg-green-100 text-green-700'
                            : evaluation.status === 'in_progress'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-zinc-100 text-zinc-600'
                        }`}>
                          {evaluation.status === 'submitted' ? 'Enviada' : evaluation.status === 'in_progress' ? 'En progreso' : 'Borrador'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-zinc-600">
                        {evaluation.total_score ? `${evaluation.total_score.toFixed(1)}/10` : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-zinc-500">
                        {new Date(evaluation.created_at).toLocaleDateString('es-AR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </EvaluationsShell>
  );
}

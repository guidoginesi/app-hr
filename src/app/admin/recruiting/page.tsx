import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { RecruitingShell } from './RecruitingShell';
import { PipelineDashboard } from '../dashboard/PipelineDashboard';
import { STAGE_ORDER } from '@/types/funnel';

export const dynamic = 'force-dynamic';

export default async function RecruitingDashboardPage() {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) {
    redirect('/admin/login');
  }

  try {
    const supabase = getSupabaseServer();
    const { data: jobs, error: jobsError } = await supabase
      .from('jobs')
      .select('id,title,department,location,is_published,created_at')
      .order('created_at', { ascending: false });

    if (jobsError) {
      console.error('Error fetching jobs:', jobsError);
    }

    // Obtener estadísticas del pipeline
    const publishedJobIds = (jobs || []).filter((j) => j.is_published).map((j) => j.id);
    let pipelineStats: any[] = [];

    if (publishedJobIds.length > 0) {
      const { data: applications, error: appsError } = await supabase
        .from('applications')
        .select('id, job_id')
        .in('job_id', publishedJobIds);

      if (appsError) {
        console.error('Error fetching applications:', appsError);
      }

      const applicationIds = (applications || []).map((app: any) => app.id);

      let stageHistory: any[] = [];
      if (applicationIds.length > 0) {
        const { data: historyData, error: historyError } = await supabase
          .from('stage_history')
          .select('application_id, to_stage, status')
          .in('application_id', applicationIds)
          .order('changed_at', { ascending: true });

        if (historyError) {
          console.error('Error fetching stage history:', historyError);
        }
        stageHistory = historyData || [];
      }

      const applicationsByJob = new Map<string, any[]>();
      (applications || []).forEach((app: any) => {
        if (!applicationsByJob.has(app.job_id)) {
          applicationsByJob.set(app.job_id, []);
        }
        applicationsByJob.get(app.job_id)!.push(app.id);
      });

      pipelineStats = (jobs || [])
        .filter((j) => j.is_published)
        .map((job) => {
          const jobApplicationIds = applicationsByJob.get(job.id) || [];

          const stage_counts: Record<string, number> = {};
          STAGE_ORDER.forEach((stage) => {
            stage_counts[stage] = 0;
          });

          const total = jobApplicationIds.length;
          stage_counts[STAGE_ORDER[0]] = total;

          jobApplicationIds.forEach((appId) => {
            const appHistory = stageHistory.filter((h) => h.application_id === appId);
            STAGE_ORDER.slice(1).forEach((stage) => {
              const passedThrough = appHistory.some((h) => h.to_stage === stage);
              if (passedThrough) {
                stage_counts[stage] = (stage_counts[stage] || 0) + 1;
              }
            });
          });

          return {
            job_id: job.id,
            job_title: job.title,
            job_department: job.department,
            stage_counts,
            total,
          };
        })
        .filter((stat) => stat.total > 0);
    }

    // Get total candidates count
    const { count: totalCandidates } = await supabase
      .from('candidates')
      .select('id', { count: 'exact' });

    const totalApplications = pipelineStats.reduce((acc, stat) => acc + stat.total, 0);

    return (
      <RecruitingShell active="dashboard">
        <div className="space-y-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Dashboard de Reclutamiento</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Resumen general del proceso de selección
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="group rounded-xl border border-zinc-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Candidatos registrados</p>
              <p className="mt-3 text-4xl font-bold text-zinc-900">{totalCandidates || 0}</p>
              <p className="mt-2 text-xs text-zinc-500">Total en el sistema</p>
            </div>
            <div className="group rounded-xl border border-zinc-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Búsquedas abiertas</p>
              <p className="mt-3 text-4xl font-bold text-black">{jobs?.filter((j) => j.is_published).length ?? 0}</p>
              <p className="mt-2 text-xs text-zinc-500">Publicadas actualmente</p>
            </div>
            <div className="group rounded-xl border border-zinc-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Aplicaciones activas</p>
              <p className="mt-3 text-4xl font-bold text-zinc-900">{totalApplications}</p>
              <p className="mt-2 text-xs text-zinc-500">En proceso de selección</p>
            </div>
          </div>

          {/* Pipeline Dashboard */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-zinc-900 mb-4">Pipeline por Búsqueda</h2>
            <PipelineDashboard stats={pipelineStats} />
          </div>
        </div>
      </RecruitingShell>
    );
  } catch (error: any) {
    if (error?.digest?.startsWith('NEXT_REDIRECT') || error?.message === 'NEXT_REDIRECT') {
      throw error;
    }
    console.error('Error in RecruitingDashboard:', error);
    return (
      <RecruitingShell active="dashboard">
        <div className="space-y-8">
          <div className="rounded-xl border border-red-200 bg-red-50 p-6">
            <h2 className="text-lg font-semibold text-red-900">Error al cargar el dashboard</h2>
            <p className="mt-2 text-sm text-red-700">
              {error?.message || 'Ocurrió un error inesperado. Por favor intenta recargar la página.'}
            </p>
          </div>
        </div>
      </RecruitingShell>
    );
  }
}

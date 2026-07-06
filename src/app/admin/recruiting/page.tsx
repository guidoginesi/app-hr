import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { RecruitingLayout } from './RecruitingLayout';
import { PipelineDashboard } from '../dashboard/PipelineDashboard';
import { STAGE_ORDER } from '@/types/funnel';
import { Stat } from '@pow/ui/components/ui/stat';
import { Card, CardContent } from '@pow/ui/components/ui/card';
import { Users, Briefcase, FileText } from 'lucide-react';

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
      <RecruitingLayout active="dashboard">
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Stat
              icon={<Users className="h-6 w-6" />}
              label="Candidatos registrados"
              value={String(totalCandidates || 0)}
              sub="Total en el sistema"
            />
            <Stat
              icon={<Briefcase className="h-6 w-6" />}
              label="Búsquedas abiertas"
              value={String(jobs?.filter((j) => j.is_published).length ?? 0)}
              sub="Publicadas actualmente"
            />
            <Stat
              icon={<FileText className="h-6 w-6" />}
              label="Aplicaciones activas"
              value={String(totalApplications)}
              sub="En proceso de selección"
            />
          </div>

          {/* Pipeline Dashboard */}
          <Card>
            <CardContent className="p-6">
              <h2 className="type-title font-semibold text-foreground mb-4">Pipeline por Búsqueda</h2>
              <PipelineDashboard stats={pipelineStats} />
            </CardContent>
          </Card>
        </div>
      </RecruitingLayout>
    );
  } catch (error: any) {
    if (error?.digest?.startsWith('NEXT_REDIRECT') || error?.message === 'NEXT_REDIRECT') {
      throw error;
    }
    console.error('Error in RecruitingDashboard:', error);
    return (
      <RecruitingLayout active="dashboard">
        <div className="rounded-[var(--radius)] border border-danger/20 bg-danger-subtle p-6">
          <h2 className="type-title font-semibold text-[var(--red-600)]">Error al cargar el dashboard</h2>
          <p className="mt-2 text-sm text-[var(--red-600)]">
            {error?.message || 'Ocurrió un error inesperado. Por favor intenta recargar la página.'}
          </p>
        </div>
      </RecruitingLayout>
    );
  }
}

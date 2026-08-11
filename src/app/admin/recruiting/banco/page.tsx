import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { RecruitingLayout } from '../RecruitingLayout';
import { TalentPoolClient, type TalentPoolRow } from './TalentPoolClient';
import type { TalentPoolStatus } from '@/lib/talentPool';

export const dynamic = 'force-dynamic';

export default async function TalentPoolPage() {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) redirect('/admin/login');

  const supabase = getSupabaseServer();

  const [entriesRes, jobsRes, areasRes] = await Promise.all([
    supabase
      .from('talent_pool_entries')
      .select(
        'id, candidate_id, areas, seniority, message, status, created_at, last_submitted_at, resubmitted_at, submissions_count, assigned_job_id, assigned_at',
      )
      .order('created_at', { ascending: false }),
    supabase.from('jobs').select('id, title, department, is_published'),
    supabase.from('talent_pool_areas').select('name').eq('active', true).order('sort_order'),
  ]);

  const entries = entriesRes.data ?? [];
  const jobs = jobsRes.data ?? [];
  const candidateIds = entries.map((e) => e.candidate_id as string);

  // Las postulaciones se traen sólo de esta gente: el banco es chico y la tabla
  // de postulaciones tiene 1700 filas.
  const [candidatesRes, applicationsRes] = await Promise.all([
    candidateIds.length
      ? supabase.from('candidates').select('id, name, email, linkedin_url').in('id', candidateIds)
      : Promise.resolve({ data: [] as any[] }),
    candidateIds.length
      ? supabase
          .from('applications')
          .select('candidate_id, job_id, current_stage, current_stage_status, final_outcome')
          .in('candidate_id', candidateIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const candidatesById = new Map(
    (candidatesRes.data ?? []).map((c: any) => [c.id as string, c]),
  );
  const jobsById = new Map(jobs.map((j: any) => [j.id as string, j]));

  // "Proceso activo" = ni cerrado ni descartado. Es lo que hace falta saber para
  // no mandar a alguien a una búsqueda cuando ya está en otra.
  const activeByCandidate = new Map<string, string[]>();
  for (const app of applicationsRes.data ?? []) {
    const cerrado =
      app.final_outcome !== null ||
      app.current_stage === 'CLOSED' ||
      app.current_stage_status === 'DISCARDED_IN_STAGE';
    if (cerrado) continue;
    const title = jobsById.get(app.job_id as string)?.title ?? 'una búsqueda';
    const list = activeByCandidate.get(app.candidate_id as string) ?? [];
    if (!list.includes(title)) list.push(title);
    activeByCandidate.set(app.candidate_id as string, list);
  }

  const rows: TalentPoolRow[] = entries.map((e: any) => {
    const candidate = candidatesById.get(e.candidate_id as string);
    return {
      id: e.id,
      name: candidate?.name ?? 'Sin nombre',
      email: candidate?.email ?? '',
      linkedinUrl: candidate?.linkedin_url ?? null,
      areas: (e.areas as string[]) ?? [],
      seniority: e.seniority ?? null,
      message: e.message ?? null,
      status: e.status as TalentPoolStatus,
      createdAt: e.created_at,
      lastSubmittedAt: e.last_submitted_at,
      resubmitted: !!e.resubmitted_at,
      submissionsCount: e.submissions_count ?? 1,
      assignedJobTitle: e.assigned_job_id ? (jobsById.get(e.assigned_job_id)?.title ?? null) : null,
      assignedAt: e.assigned_at ?? null,
      activeApplications: activeByCandidate.get(e.candidate_id as string) ?? [],
    };
  });

  return (
    <RecruitingLayout active="banco">
      <TalentPoolClient
        rows={rows}
        areas={(areasRes.data ?? []).map((a: any) => a.name as string)}
        openJobs={jobs
          .filter((j: any) => j.is_published)
          .map((j: any) => ({ id: j.id, title: j.title }))}
      />
    </RecruitingLayout>
  );
}

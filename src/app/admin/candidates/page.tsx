import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/checkAdmin';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { AdminShell } from '../AdminShell';
import { CandidatesClient } from './CandidatesClient';

export const dynamic = 'force-dynamic';

type Application = {
	id: string;
	job_id: string;
	job_title: string;
	job_department: string | null;
	status: string;
	ai_score: number | null;
	resume_url: string;
	created_at: string;
	salary_expectation?: string | null;
	english_level?: string | null;
	ai_extracted?: any;
	ai_reasons?: string[] | null;
	ai_match_highlights?: string[] | null;
};

type Candidate = {
	id: string;
	name: string;
	email: string;
	phone: string | null;
	linkedin_url: string | null;
	created_at: string;
	applications: Application[];
};

export default async function AdminCandidatesPage() {
	const { isAdmin } = await requireAdmin();
	if (!isAdmin) {
		redirect('/admin/login');
	}

	const supabase = getSupabaseServer();

	// Obtener búsquedas activas para el select
	const { data: activeJobs } = await supabase
		.from('jobs')
		.select('id,title,department')
		.eq('is_published', true)
		.order('created_at', { ascending: false });

	// Obtener todos los candidatos
	const { data: candidates } = await supabase
		.from('candidates')
		.select('id,name,email,phone,linkedin_url,created_at')
		.order('created_at', { ascending: false });

	// Obtener todas las aplicaciones con información de IA y funnel
	const { data: applications } = await supabase
		.from('applications')
		.select('id,candidate_id,job_id,status,ai_score,resume_url,created_at,salary_expectation,english_level,ai_extracted,ai_reasons,ai_match_highlights,current_stage,current_stage_status,offer_status,final_outcome,final_rejection_reason')
		.order('created_at', { ascending: false });

	// Obtener todos los jobs para hacer el join
	const jobIds = [...new Set((applications || []).map((app: any) => app.job_id))];
	let jobs: any[] = [];
	if (jobIds.length > 0) {
		const { data: jobsData } = await supabase
			.from('jobs')
			.select('id,title,department')
			.in('id', jobIds);
		jobs = jobsData || [];
	}

	// Crear un mapa de jobs para acceso rápido
	const jobsMap = new Map(jobs.map((job: any) => [job.id, job]));

	// Agrupar aplicaciones por candidato, eliminando duplicados (mismo job_id)
	// Si hay duplicados, mantener solo la más reciente
	const candidatesWithApps: Candidate[] = (candidates || []).map((candidate) => {
		const allCandidateApplications = (applications || [])
			.filter((app: any) => app.candidate_id === candidate.id)
			.map((app: any) => {
				const job = jobsMap.get(app.job_id);
				return {
					id: app.id,
					job_id: app.job_id,
					job_title: job?.title || 'Búsqueda eliminada',
					job_department: job?.department || null,
					status: app.status,
					ai_score: app.ai_score,
					resume_url: app.resume_url,
					created_at: app.created_at,
					salary_expectation: app.salary_expectation,
					english_level: app.english_level,
					ai_extracted: app.ai_extracted,
					ai_reasons: app.ai_reasons,
					ai_match_highlights: app.ai_match_highlights,
					current_stage: app.current_stage,
					current_stage_status: app.current_stage_status,
					offer_status: app.offer_status,
					final_outcome: app.final_outcome,
					final_rejection_reason: app.final_rejection_reason
				};
			});

		// Agrupar por job_id y mantener solo la más reciente de cada grupo
		const applicationsByJob = new Map<string, typeof allCandidateApplications[0]>();
		for (const app of allCandidateApplications) {
			const existing = applicationsByJob.get(app.job_id);
			if (!existing || new Date(app.created_at) > new Date(existing.created_at)) {
				applicationsByJob.set(app.job_id, app);
			}
		}

		return {
			...candidate,
			applications: Array.from(applicationsByJob.values())
		};
	});

	return (
		<AdminShell active="candidatos">
			<CandidatesClient candidates={candidatesWithApps} jobs={activeJobs || []} />
		</AdminShell>
	);
}


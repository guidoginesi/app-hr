import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/checkAdmin';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { Stage, STAGE_ORDER } from '@/types/funnel';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
	try {
		const { isAdmin } = await requireAdmin();
		if (!isAdmin) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const supabase = getSupabaseServer();

		// Obtener todas las búsquedas activas
		const { data: jobs } = await supabase
			.from('jobs')
			.select('id, title, department')
			.eq('is_published', true)
			.order('created_at', { ascending: false });

		if (!jobs || jobs.length === 0) {
			return NextResponse.json({ stats: [] });
		}

		const jobIds = jobs.map((j) => j.id);

		// Obtener todas las aplicaciones para estas búsquedas
		const { data: applications } = await supabase
			.from('applications')
			.select('id, job_id, current_stage')
			.in('job_id', jobIds);

		// Agrupar por job y contar por etapa
		const stats = jobs.map((job) => {
			const jobApplications = (applications || []).filter((app) => app.job_id === job.id);
			
			// Inicializar contadores para todas las etapas
			const stage_counts: Record<Stage, number> = {} as Record<Stage, number>;
			STAGE_ORDER.forEach((stage) => {
				stage_counts[stage] = 0;
			});

			// Contar aplicaciones por etapa
			jobApplications.forEach((app) => {
				if (app.current_stage) {
					stage_counts[app.current_stage as Stage] = (stage_counts[app.current_stage as Stage] || 0) + 1;
				}
			});

			return {
				job_id: job.id,
				job_title: job.title,
				job_department: job.department,
				stage_counts,
				total: jobApplications.length
			};
		});

		// Filtrar solo las búsquedas que tienen candidatos
		const statsWithCandidates = stats.filter((stat) => stat.total > 0);

		return NextResponse.json({ stats: statsWithCandidates });
	} catch (error: any) {
		console.error('Error fetching pipeline stats:', error);
		return NextResponse.json(
			{ error: error?.message ?? 'Failed to fetch pipeline stats' },
			{ status: 400 }
		);
	}
}


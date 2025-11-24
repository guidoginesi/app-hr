import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/checkAdmin';
import { getSupabaseServer } from '@/lib/supabaseServer';

export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { isAdmin } = await requireAdmin();
		if (!isAdmin) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { id } = await params;
		const candidateId = id;

		const supabase = getSupabaseServer();

		// Obtener el candidato
		const { data: candidate, error: candidateError } = await supabase
			.from('candidates')
			.select('id,name,email,phone,provincia,linkedin_url,created_at')
			.eq('id', candidateId)
			.single();

		if (candidateError || !candidate) {
			return NextResponse.json(
				{ error: 'Candidate not found' },
				{ status: 404 }
			);
		}

		// Obtener todas las aplicaciones del candidato
		const { data: applications } = await supabase
			.from('applications')
			.select(
				'id,candidate_id,job_id,status,ai_score,resume_url,created_at,salary_expectation,english_level,ai_extracted,ai_reasons,ai_match_highlights,current_stage,current_stage_status,offer_status,final_outcome,final_rejection_reason'
			)
			.eq('candidate_id', candidateId)
			.order('created_at', { ascending: false });

	// Obtener el historial de etapas para cada aplicación
	const applicationIds = (applications || []).map((app: any) => app.id);
	let stageHistory: any[] = [];
	let recruiterNotes: any[] = [];
	let emailLogs: any[] = [];
	
	if (applicationIds.length > 0) {
		const { data: historyData, error: historyError } = await supabase
			.from('stage_history')
			.select('*')
			.in('application_id', applicationIds)
			.order('changed_at', { ascending: false });
		
		if (historyError) {
			console.error('Error fetching stage_history:', historyError);
		}
		stageHistory = historyData || [];

		// Obtener notas del reclutador
		const { data: notesData, error: notesError } = await supabase
			.from('recruiter_notes')
			.select('*')
			.in('application_id', applicationIds)
			.order('created_at', { ascending: false});
		
		if (notesError) {
			console.error('Error fetching recruiter_notes:', notesError);
		}
		recruiterNotes = notesData || [];

		// Obtener emails enviados
		const { data: emailData, error: emailError } = await supabase
			.from('email_logs')
			.select('*')
			.in('application_id', applicationIds)
			.order('sent_at', { ascending: false });
		
		if (emailError) {
			console.error('Error fetching email_logs:', emailError);
		}
		emailLogs = emailData || [];
	}

		// Obtener los jobs
		const jobIds = [...new Set((applications || []).map((app: any) => app.job_id))];
		let jobs: any[] = [];
		if (jobIds.length > 0) {
			const { data: jobsData } = await supabase
				.from('jobs')
				.select('id,title,department')
				.in('id', jobIds);
			jobs = jobsData || [];
		}

		const jobsMap = new Map(jobs.map((job: any) => [job.id, job]));

	// Mapear aplicaciones con información de jobs, historial y notas
	const historyMap = new Map<string, any[]>();
	for (const history of stageHistory) {
		const appId = history.application_id;
		if (!historyMap.has(appId)) {
			historyMap.set(appId, []);
		}
		historyMap.get(appId)!.push(history);
	}

	const notesMap = new Map<string, any[]>();
	for (const note of recruiterNotes) {
		const appId = note.application_id;
		if (!notesMap.has(appId)) {
			notesMap.set(appId, []);
		}
		notesMap.get(appId)!.push(note);
	}

	const emailsMap = new Map<string, any[]>();
	for (const email of emailLogs) {
		const appId = email.application_id;
		if (!emailsMap.has(appId)) {
			emailsMap.set(appId, []);
		}
		emailsMap.get(appId)!.push(email);
	}

	const applicationsWithJobs = (applications || []).map((app: any) => {
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
		final_rejection_reason: app.final_rejection_reason,
		stage_history: historyMap.get(app.id) || [],
		recruiter_notes: notesMap.get(app.id) || [],
		email_logs: emailsMap.get(app.id) || []
	};
});

		// Agrupar por job_id y mantener solo la más reciente
		const applicationsByJob = new Map<string, typeof applicationsWithJobs[0]>();
		for (const app of applicationsWithJobs) {
			const existing = applicationsByJob.get(app.job_id);
			if (!existing || new Date(app.created_at) > new Date(existing.created_at)) {
				applicationsByJob.set(app.job_id, app);
			}
		}

		return NextResponse.json({
			...candidate,
			applications: Array.from(applicationsByJob.values())
		});
	} catch (error: any) {
		console.error('Error fetching candidate:', error);
		return NextResponse.json(
			{ error: error?.message ?? 'Failed to fetch candidate' },
			{ status: 400 }
		);
	}
}


import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/checkAdmin';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { Stage, StageStatus } from '@/types/funnel';

const CreateCandidateSchema = z.object({
	name: z.string().min(1),
	email: z.string().email(),
	linkedinUrl: z
		.string()
		.optional()
		.nullable()
		.transform((val) => {
			if (!val || val.trim() === '') return null;
			try {
				new URL(val);
				return val;
			} catch {
				return null;
			}
		}),
	jobId: z.string().min(1),
	resume: z.any().optional()
});

const BUCKET = 'resumes';

export async function POST(req: NextRequest) {
	try {
		const { isAdmin, user } = await requireAdmin();
		if (!isAdmin || !user) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}
		const userId = user.id;

		const formData = await req.formData();
		const linkedinUrlValue = formData.get('linkedinUrl');
		const resumeFile = formData.get('resume') as File | null;
		
		const candidateJson = {
			name: String(formData.get('name') || '').trim(),
			email: String(formData.get('email') || '').trim(),
			linkedinUrl: linkedinUrlValue ? String(linkedinUrlValue).trim() : null,
			jobId: String(formData.get('jobId') || '').trim(),
			resume: resumeFile && resumeFile.size > 0 ? resumeFile : undefined
		};

		console.log('Received candidate data:', { ...candidateJson, resume: resumeFile?.name });

		const parsed = CreateCandidateSchema.safeParse(candidateJson);
		if (!parsed.success) {
			console.error('Validation error:', parsed.error);
			return NextResponse.json(
				{ error: `Error de validación: ${parsed.error.issues.map(e => e.message).join(', ')}` },
				{ status: 400 }
			);
		}

		const { name, email, linkedinUrl, jobId, resume } = parsed.data;

		const supabase = getSupabaseServer();

		// Verificar si el candidato ya existe
		const { data: existingCandidate } = await supabase
			.from('candidates')
			.select('id')
			.eq('email', email)
			.maybeSingle();

		// Si el candidato existe, verificar si ya se postuló a este puesto
		if (existingCandidate) {
			const { data: existingApplication } = await supabase
				.from('applications')
				.select('id')
				.eq('candidate_id', existingCandidate.id)
				.eq('job_id', jobId)
				.maybeSingle();

			if (existingApplication) {
				return NextResponse.json(
					{ error: 'Este candidato ya se postuló a esta búsqueda' },
					{ status: 400 }
				);
			}
		}

		// Crear o actualizar candidato
		const { data: candidate, error: candErr } = await supabase
			.from('candidates')
			.upsert({ email, name, linkedin_url: linkedinUrl }, { onConflict: 'email' })
			.select('id')
			.single();
		if (candErr) throw candErr;

		// Si hay CV, subirlo y crear aplicación
		if (resume && resume.size > 0) {
			await supabase.storage.createBucket(BUCKET, { public: true }).catch(() => {});

			const ext = resume.name.split('.').pop() || 'pdf';
			const objectPath = `${jobId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
			const arrayBuffer = await resume.arrayBuffer();
			const { data: uploadData, error: uploadError } = await supabase.storage
				.from(BUCKET)
				.upload(objectPath, Buffer.from(arrayBuffer), {
					contentType: resume.type || 'application/pdf',
					upsert: false
				});
			if (uploadError) throw uploadError;

			const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(uploadData.path);
			const resumeUrl = publicUrlData.publicUrl;

			// Crear aplicación con CV usando nuevo modelo
			// CV_RECEIVED se completa automáticamente y pasa a HR_REVIEW
			const { data: application, error: appErr } = await supabase
				.from('applications')
				.insert({
					candidate_id: candidate.id,
					job_id: jobId,
					resume_url: resumeUrl,
					current_stage: Stage.HR_REVIEW,
					current_stage_status: StageStatus.PENDING,
					status: 'Recibido' // Legacy
				})
				.select('id')
				.single();
			if (appErr) throw appErr;

			// Crear historial: CV_RECEIVED (completed) -> HR_REVIEW (pending)
			await supabase.from('stage_history').insert([
				{
					application_id: application.id,
					from_stage: null,
					to_stage: Stage.CV_RECEIVED,
					status: StageStatus.COMPLETED,
					changed_by_user_id: userId,
					notes: 'CV recibido - aplicación creada manualmente por admin',
					changed_at: new Date().toISOString()
				},
				{
					application_id: application.id,
					from_stage: Stage.CV_RECEIVED,
					to_stage: Stage.HR_REVIEW,
					status: StageStatus.PENDING,
					changed_by_user_id: userId,
					notes: 'Avance automático a revisión HR',
					changed_at: new Date().toISOString()
				}
			]);
		} else {
			// Crear aplicación sin CV (solo referencia) - va directo a HR_REVIEW
			const { data: application, error: appErr } = await supabase
				.from('applications')
				.insert({
					candidate_id: candidate.id,
					job_id: jobId,
					resume_url: 'manual-entry', // Placeholder para aplicaciones manuales sin CV
					current_stage: Stage.HR_REVIEW,
					current_stage_status: StageStatus.PENDING,
					status: 'Pendiente de Revisión HR' // Legacy
				})
				.select('id')
				.single();
			if (appErr) throw appErr;

			// Crear historial inicial
			await supabase.from('stage_history').insert({
				application_id: application.id,
				from_stage: null,
				to_stage: Stage.HR_REVIEW,
				status: StageStatus.PENDING,
				changed_by_user_id: userId,
				notes: 'Aplicación creada manualmente por admin (sin CV)',
				changed_at: new Date().toISOString()
			});
		}

		return NextResponse.json({ ok: true });
	} catch (error: any) {
		console.error('Error in POST /api/admin/candidates:', error);
		return NextResponse.json(
			{ error: error?.message ?? 'Error al crear el candidato. Por favor intenta nuevamente.' },
			{ status: 400 }
		);
	}
}


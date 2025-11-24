import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { Stage, StageStatus } from '@/types/funnel';
import { sendTemplatedEmail } from '@/lib/emailService';

const FormSchema = z.object({
	name: z.string().min(1),
	email: z.string().email(),
	phone: z.string().optional().nullable(),
	provincia: z.enum(['CABA', 'GBA', 'OTRA']),
	linkedinUrl: z.string().url().optional().nullable(),
	jobId: z.string().min(1),
	salaryExpectation: z.string().optional().nullable(),
	englishLevel: z.string().optional().nullable()
});

const BUCKET = 'resumes';

export async function POST(req: NextRequest) {
	try {
		const accept = req.headers.get('accept') || '';
		const wantsHtml = accept.includes('text/html');

		const formData = await req.formData();
		const candidateJson = {
			name: String(formData.get('name') || ''),
			email: String(formData.get('email') || ''),
			phone: formData.get('phone') ? String(formData.get('phone')) : null,
			provincia: String(formData.get('provincia') || ''),
			linkedinUrl: formData.get('linkedinUrl') ? String(formData.get('linkedinUrl')) : null,
			jobId: String(formData.get('jobId') || ''),
			salaryExpectation: formData.get('salaryExpectation') ? String(formData.get('salaryExpectation')) : null,
			englishLevel: formData.get('englishLevel') ? String(formData.get('englishLevel')) : null
		};
		const { name, email, phone, provincia, linkedinUrl, jobId, salaryExpectation, englishLevel } = FormSchema.parse(candidateJson);
		const file = formData.get('resume') as File | null;
		if (!file) {
			return NextResponse.json({ error: 'Missing resume file' }, { status: 400 });
		}

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
				if (wantsHtml) {
					return NextResponse.redirect(new URL('/jobs?error=already_applied', req.nextUrl));
				}
				return NextResponse.json(
					{ error: 'Ya te postulaste para este puesto' },
					{ status: 400 }
				);
			}
		}

		// Ensure bucket exists (idempotent)
		await supabase.storage.createBucket(BUCKET, { public: true }).catch(() => {});

		const ext = file.name.split('.').pop() || 'pdf';
		const objectPath = `${jobId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
		const arrayBuffer = await file.arrayBuffer();
		const { data: uploadData, error: uploadError } = await supabase.storage
			.from(BUCKET)
			.upload(objectPath, Buffer.from(arrayBuffer), {
				contentType: file.type || 'application/pdf',
				upsert: false
			});
		if (uploadError) throw uploadError;

		const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(uploadData.path);
		const resumeUrl = publicUrlData.publicUrl;

		// Create or upsert candidate
		const { data: candidate, error: candErr } = await supabase
			.from('candidates')
			.upsert({ email, name, phone, provincia, linkedin_url: linkedinUrl }, { onConflict: 'email' })
			.select('id')
			.single();
		if (candErr) throw candErr;

		// TRIGGER 3: Si provincia es OTRA, descartar automáticamente
		const shouldAutoReject = provincia === 'OTRA';
		
		// Create application with new funnel model
		// Si provincia = OTRA, va directo a CV_RECEIVED con estado DISCARDED_IN_STAGE
		// Sino, CV_RECEIVED se completa automáticamente y pasa a HR_REVIEW
		const { data: application, error: appErr } = await supabase
			.from('applications')
			.insert({
				candidate_id: candidate.id,
				job_id: jobId,
				resume_url: resumeUrl,
				salary_expectation: salaryExpectation,
				english_level: englishLevel,
				current_stage: shouldAutoReject ? Stage.CV_RECEIVED : Stage.HR_REVIEW,
				current_stage_status: shouldAutoReject ? StageStatus.DISCARDED_IN_STAGE : StageStatus.PENDING,
				status: shouldAutoReject ? 'Descartado - Ubicación' : 'Recibido' // Legacy field for compatibility
			})
			.select('id,resume_url')
			.single();
		if (appErr) throw appErr;

		// Create stage history basado en si fue descartado o no
		if (shouldAutoReject) {
			// Si se descarta por provincia, solo crear el registro de CV_RECEIVED con DISCARDED
			await supabase.from('stage_history').insert({
				application_id: application.id,
				from_stage: null,
				to_stage: Stage.CV_RECEIVED,
				status: StageStatus.DISCARDED_IN_STAGE,
				changed_by_user_id: null,
				notes: 'Descartado automáticamente - Provincia fuera del rango requerido (CABA/GBA)',
				changed_at: new Date().toISOString()
			});
			
			// Enviar email de descarte por ubicación
			await sendTemplatedEmail({
				templateKey: 'candidate_rejected_location',
				to: email,
				variables: {
					candidateName: name,
					jobTitle: 'la posición',
					provincia: provincia
				},
				applicationId: application.id
			}).catch(err => {
				console.error('Error sending location rejection email:', err);
			});
		} else {
			// Flujo normal: CV_RECEIVED (completed) -> HR_REVIEW (pending)
			// Usar timestamps secuenciales para reflejar la progresión real
			const cvReceivedDate = new Date();
			const hrReviewDate = new Date(cvReceivedDate.getTime() + 100); // 100ms después
			
			await supabase.from('stage_history').insert([
				{
					application_id: application.id,
					from_stage: null,
					to_stage: Stage.CV_RECEIVED,
					status: StageStatus.COMPLETED,
					changed_by_user_id: null,
					notes: 'CV recibido automáticamente',
					changed_at: cvReceivedDate.toISOString()
				},
				{
					application_id: application.id,
					from_stage: Stage.CV_RECEIVED,
					to_stage: Stage.HR_REVIEW,
					status: StageStatus.PENDING,
					changed_by_user_id: null,
					notes: 'Avance automático a revisión HR',
					changed_at: hrReviewDate.toISOString()
				}
			]);
		}

		// Kick off AI pipelines sequentially for now (separate functions) [[memory:4421972]]
		// 1) Extraction
		const extractRes = await fetch(new URL('/api/ai/extract', req.nextUrl).toString(), {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ resumeUrl })
		});
		const extracted = extractRes.ok ? (await extractRes.json()).extracted : null;

		// 2) Scoring
		const scoreRes = await fetch(new URL('/api/ai/score', req.nextUrl).toString(), {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ resumeUrl, jobId })
		});
		const score = scoreRes.ok ? (await scoreRes.json()).result : null;

		// Persist AI outputs if available (solo si no fue descartado automáticamente)
		// Note: El análisis de IA no cambia la etapa, solo agrega información
		if (!shouldAutoReject) {
			await supabase
				.from('applications')
				.update({
					ai_extracted: extracted || null,
					ai_score: score?.score ?? null,
					ai_reasons: score?.reasons ?? null,
					ai_match_highlights: score?.matchHighlights ?? null,
					status: 'Analizado por IA' // Legacy field
				})
				.eq('id', application.id);
		}

		if (wantsHtml) {
			// Si viene desde un form del sitio, redirigimos a la landing con mensaje
			return NextResponse.redirect(new URL('/jobs?submitted=1', req.nextUrl));
		}

		// Respuesta JSON para llamadas programáticas
		return NextResponse.json({
			applicationId: application.id,
			resumeUrl,
			extracted,
			score
		});
	} catch (error: any) {
		return NextResponse.json({ error: error?.message ?? 'Failed to create application' }, { status: 400 });
	}
}



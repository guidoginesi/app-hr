import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseServer } from '@/lib/supabaseServer';

const FormSchema = z.object({
	name: z.string().min(1),
	email: z.string().email(),
	linkedinUrl: z.string().url().optional().nullable(),
	jobId: z.string().min(1)
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
			linkedinUrl: formData.get('linkedinUrl') ? String(formData.get('linkedinUrl')) : null,
			jobId: String(formData.get('jobId') || '')
		};
		const { name, email, linkedinUrl, jobId } = FormSchema.parse(candidateJson);
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
			.upsert({ email, name, linkedin_url: linkedinUrl }, { onConflict: 'email' })
			.select('id')
			.single();
		if (candErr) throw candErr;

		// Create application
		const { data: application, error: appErr } = await supabase
			.from('applications')
			.insert({
				candidate_id: candidate.id,
				job_id: jobId,
				resume_url: resumeUrl,
				status: 'Recibido'
			})
			.select('id,resume_url')
			.single();
		if (appErr) throw appErr;

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

		// Persist AI outputs if available
		await supabase
			.from('applications')
			.update({
				ai_extracted: extracted || null,
				ai_score: score?.score ?? null,
				ai_reasons: score?.reasons ?? null,
				ai_match_highlights: score?.matchHighlights ?? null,
				status: 'Analizado por IA'
			})
			.eq('id', application.id);

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



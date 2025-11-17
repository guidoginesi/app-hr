import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getOpenAI } from '@/lib/openai';
import { ScoreResultSchema } from '@/types/candidate';
import { getSupabaseServer } from '@/lib/supabaseServer';

const BodySchema = z.object({
	resumeUrl: z.string().url(),
	jobId: z.string().min(1)
});

// Function 2: Score candidate vs job description (separate endpoint per user preference) [[memory:4421972]]
export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const { resumeUrl, jobId } = BodySchema.parse(body);

		// Fetch job description from DB
		const supabase = getSupabaseServer();
		const { data: job, error } = await supabase
			.from('jobs')
			.select('id,title,description,requirements')
			.eq('id', jobId)
			.single();
		if (error) throw error;
		if (!job) throw new Error('Job not found');

		const openai = getOpenAI();
		const system = [
			'You are an HR assistant that scores resumes against a job description.',
			'Return a score from 0 to 100, and concise reasons and matchHighlights.'
		].join(' ');
		const user = [
			`Resume URL: ${resumeUrl}`,
			`Job Title: ${job.title}`,
			`Job Description: ${job.description ?? ''}`,
			`Requirements: ${job.requirements ?? ''}`,
			'Provide:',
			'- score (0-100)',
			'- reasons (array of short bullet strings)',
			'- matchHighlights (array of short bullet strings)'
		].join('\n');

		const resp = await openai.chat.completions.create({
			model: 'gpt-4o-mini',
			temperature: 0.2,
			messages: [
				{ role: 'system', content: system },
				{ role: 'user', content: user }
			],
			response_format: { type: 'json_object' }
		});

		const content = resp.choices?.[0]?.message?.content ?? '{}';
		const parsed = ScoreResultSchema.parse(JSON.parse(content));
		return NextResponse.json({ result: parsed });
	} catch (error: any) {
		return NextResponse.json({ error: error?.message ?? 'Scoring failed' }, { status: 400 });
	}
}



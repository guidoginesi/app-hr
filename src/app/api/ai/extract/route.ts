import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getOpenAI } from '@/lib/openai';
import { CandidateAutoFieldsSchema } from '@/types/candidate';

const BodySchema = z.object({
	resumeUrl: z.string().url()
});

// Function 1: Extract candidate info from resume (separate endpoint per user preference) [[memory:4421972]]
export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const { resumeUrl } = BodySchema.parse(body);
		const openai = getOpenAI();

		// Use structured output via JSON schema-style prompt
		const system = [
			'You are an assistant that extracts structured candidate information from resumes.',
			'Return concise fields suitable for filtering. Use null when unknown.'
		].join(' ');

		const user = [
			`Resume URL: ${resumeUrl}`,
			'Extract the following JSON fields:',
			'- linkedinUrl (string | null)',
			'- currentRole (string | null)',
			'- yearsOfExperience (number | null)',
			'- education (string[] | null)',
			'- certifications (string[] | null)',
			'- technicalSkills (string[] | null)',
			'- softSkills (string[] | null)',
			'- englishLevel (string | null)',
			'- salaryExpectation (string | null)',
			'- province (string | null)'
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
		const parsed = CandidateAutoFieldsSchema.parse(JSON.parse(content));
		return NextResponse.json({ extracted: parsed });
	} catch (error: any) {
		return NextResponse.json({ error: error?.message ?? 'Extraction failed' }, { status: 400 });
	}
}



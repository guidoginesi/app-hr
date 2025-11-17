import { z } from 'zod';

export const CandidateAutoFieldsSchema = z.object({
	linkedinUrl: z.string().url().nullable().optional(),
	currentRole: z.string().nullable().optional(),
	yearsOfExperience: z.number().nullable().optional(),
	education: z.array(z.string()).nullable().optional(),
	certifications: z.array(z.string()).nullable().optional(),
	technicalSkills: z.array(z.string()).nullable().optional(),
	softSkills: z.array(z.string()).nullable().optional(),
	englishLevel: z.string().nullable().optional(),
	salaryExpectation: z.string().nullable().optional(),
	province: z.string().nullable().optional()
});

export type CandidateAutoFields = z.infer<typeof CandidateAutoFieldsSchema>;

export const ScoreResultSchema = z.object({
	score: z.number().min(0).max(100),
	reasons: z.array(z.string()).default([]),
	matchHighlights: z.array(z.string()).default([])
});

export type ScoreResult = z.infer<typeof ScoreResultSchema>;

export const CreateApplicationSchema = z.object({
	name: z.string().min(1),
	email: z.string().email(),
	linkedinUrl: z.string().url().optional().nullable(),
	jobId: z.string().min(1),
	resumeFileName: z.string().min(1),
	resumePath: z.string().min(1)
});

export type CreateApplication = z.infer<typeof CreateApplicationSchema>;



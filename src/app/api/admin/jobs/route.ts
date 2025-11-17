import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/checkAdmin';
import { getSupabaseServer } from '@/lib/supabaseServer';

const CreateJobSchema = z.object({
	title: z.string().min(1),
	department: z.string().optional().nullable(),
	location: z.string().optional().nullable(),
	description: z.string().optional().nullable(),
	requirements: z.string().optional().nullable(),
	is_published: z.union([z.string(), z.boolean()]).transform((v) => {
		if (typeof v === 'boolean') return v;
		return v === 'true';
	})
});

export async function GET() {
	const { isAdmin } = await requireAdmin();
	if (!isAdmin) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}
	const supabase = getSupabaseServer();
	const { data, error } = await supabase
		.from('jobs')
		.select('*')
		.order('created_at', { ascending: false });
	if (error) return NextResponse.json({ error: error.message }, { status: 400 });
	return NextResponse.json({ jobs: data ?? [] });
}

export async function POST(req: NextRequest) {
	const { isAdmin } = await requireAdmin();
	if (!isAdmin) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}
	// The admin form sends application/x-www-form-urlencoded, so always use formData here
	const form = await req.formData();
	const parsed = CreateJobSchema.parse({
		title: String(form.get('title') || ''),
		department: form.get('department') ? String(form.get('department')) : null,
		location: form.get('location') ? String(form.get('location')) : null,
		description: form.get('description') ? String(form.get('description')) : null,
		requirements: form.get('requirements') ? String(form.get('requirements')) : null,
		is_published: String(form.get('is_published') ?? 'true')
	});
	const supabase = getSupabaseServer();
	
	// Verificar si ya existe una búsqueda con el mismo título (evitar duplicados)
	const { data: existingJob } = await supabase
		.from('jobs')
		.select('id')
		.eq('title', parsed.title.trim())
		.maybeSingle();
	
	if (existingJob) {
		return NextResponse.json(
			{ error: 'Ya existe una búsqueda con este título. Por favor usa un título diferente.' },
			{ status: 400 }
		);
	}
	
	const { error } = await supabase.from('jobs').insert({
		title: parsed.title.trim(),
		department: parsed.department?.trim() || null,
		location: parsed.location?.trim() || null,
		description: parsed.description?.trim() || null,
		requirements: parsed.requirements?.trim() || null,
		is_published: parsed.is_published
	});
	if (error) return NextResponse.json({ error: error.message }, { status: 400 });
	return NextResponse.json({ ok: true });
}



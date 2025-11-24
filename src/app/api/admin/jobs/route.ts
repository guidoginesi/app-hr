import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/checkAdmin';
import { getSupabaseServer } from '@/lib/supabaseServer';

const CreateJobSchema = z.object({
	title: z.string().min(1),
	department: z.string().optional().nullable(),
	location: z.string().optional().nullable(),
	work_mode: z.enum(['Remota', 'Híbrida', 'Presencial']).optional().nullable(),
	description: z.string().optional().nullable(),
	responsibilities: z.string().optional().nullable(),
	requirements: z.string().optional().nullable(),
	max_salary: z.union([z.string(), z.number()]).optional().nullable().transform((v) => {
		if (v === null || v === undefined || v === '') return null;
		const num = typeof v === 'number' ? v : parseFloat(v);
		return isNaN(num) ? null : num;
	}),
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
		work_mode: form.get('work_mode') ? String(form.get('work_mode')) : 'Remota',
		description: form.get('description') ? String(form.get('description')) : null,
		responsibilities: form.get('responsibilities') ? String(form.get('responsibilities')) : null,
		requirements: form.get('requirements') ? String(form.get('requirements')) : null,
		max_salary: form.get('max_salary') ? String(form.get('max_salary')) : null,
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
	
	// Intentar insertar con todas las columnas, si falla por columnas inexistentes, usar solo las básicas
	const insertData: any = {
		title: parsed.title.trim(),
		department: parsed.department?.trim() || null,
		location: parsed.location?.trim() || null,
		description: parsed.description?.trim() || null,
		requirements: parsed.requirements?.trim() || null,
		is_published: parsed.is_published
	};
	
	// Agregar columnas nuevas solo si existen (se intentará insertar, si falla se omitirán)
	if (parsed.work_mode) insertData.work_mode = parsed.work_mode;
	// Siempre incluir responsibilities (puede ser null o string vacío)
	// Si es una cadena vacía después de trim, guardar como null, sino guardar el valor
	insertData.responsibilities = parsed.responsibilities && parsed.responsibilities.trim() 
		? parsed.responsibilities.trim() 
		: null;
	// Agregar max_salary si tiene valor
	if (parsed.max_salary !== null) insertData.max_salary = parsed.max_salary;
	
	const { error } = await supabase.from('jobs').insert(insertData);
	if (error) {
		// Si falla por columnas inexistentes, intentar sin ellas
		if (error.message.includes('column') && (error.message.includes('work_mode') || error.message.includes('responsibilities'))) {
			const basicData = {
				title: parsed.title.trim(),
				department: parsed.department?.trim() || null,
				location: parsed.location?.trim() || null,
				description: parsed.description?.trim() || null,
				requirements: parsed.requirements?.trim() || null,
				is_published: parsed.is_published
			};
			const { error: basicError } = await supabase.from('jobs').insert(basicData);
			if (basicError) return NextResponse.json({ error: basicError.message }, { status: 400 });
		} else {
			return NextResponse.json({ error: error.message }, { status: 400 });
		}
	}
	return NextResponse.json({ ok: true });
}



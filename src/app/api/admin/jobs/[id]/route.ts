import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/checkAdmin';
import { getSupabaseServer } from '@/lib/supabaseServer';

const UpdateJobSchema = z.object({
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

export async function PUT(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { isAdmin } = await requireAdmin();
	if (!isAdmin) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	const { id } = await params;
	const form = await req.formData();
	
	// Debug: ver todos los campos del formulario
	const allFormData: Record<string, any> = {};
	for (const [key, value] of form.entries()) {
		allFormData[key] = value;
	}
	console.log('[API] All form data received:', JSON.stringify(allFormData, null, 2));
	
	const responsibilitiesValue = form.get('responsibilities');
	console.log('[API] Raw responsibilities value:', responsibilitiesValue, 'Type:', typeof responsibilitiesValue);
	
	const responsibilitiesStr = responsibilitiesValue !== null && responsibilitiesValue !== undefined 
		? String(responsibilitiesValue).trim() 
		: null;
	console.log('[API] Processed responsibilities:', responsibilitiesStr);
	
	const parsed = UpdateJobSchema.parse({
		title: String(form.get('title') || ''),
		department: form.get('department') ? String(form.get('department')) : null,
		location: form.get('location') ? String(form.get('location')) : null,
		work_mode: form.get('work_mode') ? String(form.get('work_mode')) : 'Remota',
		description: form.get('description') ? String(form.get('description')) : null,
		responsibilities: responsibilitiesStr || null,
		requirements: form.get('requirements') ? String(form.get('requirements')) : null,
		max_salary: form.get('max_salary') ? String(form.get('max_salary')) : null,
		is_published: String(form.get('is_published') ?? 'true')
	});
	
	console.log('[API] Parsed responsibilities:', parsed.responsibilities);

	const supabase = getSupabaseServer();

	// Verificar si ya existe otra búsqueda con el mismo título (excluyendo la actual)
	const { data: existingJob } = await supabase
		.from('jobs')
		.select('id')
		.eq('title', parsed.title.trim())
		.neq('id', id)
		.maybeSingle();

	if (existingJob) {
		return NextResponse.json(
			{ error: 'Ya existe otra búsqueda con este título. Por favor usa un título diferente.' },
			{ status: 400 }
		);
	}

	// Intentar actualizar con todas las columnas, si falla por columnas inexistentes, usar solo las básicas
	const updateData: any = {
		title: parsed.title.trim(),
		department: parsed.department?.trim() || null,
		location: parsed.location?.trim() || null,
		description: parsed.description?.trim() || null,
		requirements: parsed.requirements?.trim() || null,
		is_published: parsed.is_published
	};
	
	// Agregar columnas nuevas
	if (parsed.work_mode) updateData.work_mode = parsed.work_mode;
	// Siempre incluir responsibilities (puede ser null o string)
	// Si es una cadena vacía después de trim, guardar como null, sino guardar el valor
	updateData.responsibilities = parsed.responsibilities && parsed.responsibilities.trim() 
		? parsed.responsibilities.trim() 
		: null;
	// Agregar max_salary (puede ser null)
	updateData.max_salary = parsed.max_salary;
	
	console.log('[API] Update data being sent to DB:', JSON.stringify(updateData, null, 2));
	
	const { data: updatedJob, error } = await supabase
		.from('jobs')
		.update(updateData)
		.eq('id', id)
		.select()
		.single();
	
	if (error) {
		console.error('[API] Error updating job:', error);
		return NextResponse.json({ error: error.message }, { status: 400 });
	}

	// Incluir responsibilities en la respuesta para verificar
	return NextResponse.json({ 
		ok: true, 
		job: updatedJob,
		debug: {
			responsibilitiesReceived: responsibilitiesValue,
			responsibilitiesProcessed: responsibilitiesStr,
			responsibilitiesParsed: parsed.responsibilities,
			responsibilitiesInUpdateData: updateData.responsibilities,
			responsibilitiesInDB: updatedJob?.responsibilities
		}
	});
}


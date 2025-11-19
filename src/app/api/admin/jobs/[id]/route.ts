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
	
	const responsibilitiesValue = form.get('responsibilities');
	const responsibilitiesStr = responsibilitiesValue !== null && responsibilitiesValue !== undefined 
		? String(responsibilitiesValue).trim() 
		: null;
	
	const parsed = UpdateJobSchema.parse({
		title: String(form.get('title') || ''),
		department: form.get('department') ? String(form.get('department')) : null,
		location: form.get('location') ? String(form.get('location')) : null,
		work_mode: form.get('work_mode') ? String(form.get('work_mode')) : 'Remota',
		description: form.get('description') ? String(form.get('description')) : null,
		responsibilities: responsibilitiesStr || null,
		requirements: form.get('requirements') ? String(form.get('requirements')) : null,
		is_published: String(form.get('is_published') ?? 'true')
	});

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
	
	const { data: updatedJob, error } = await supabase
		.from('jobs')
		.update(updateData)
		.eq('id', id)
		.select()
		.single();
	
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
			const { error: basicError } = await supabase
				.from('jobs')
				.update(basicData)
				.eq('id', id);
			if (basicError) {
				return NextResponse.json({ 
					error: `Error al actualizar: ${basicError.message}. Nota: La columna 'responsibilities' puede no existir en la base de datos.` 
				}, { status: 400 });
			}
			// Si se actualizó sin responsibilities, devolver éxito pero con advertencia
			return NextResponse.json({ 
				ok: true, 
				warning: 'La columna responsibilities no existe en la base de datos. Por favor aplica la migración SQL.' 
			});
		} else {
			return NextResponse.json({ error: error.message }, { status: 400 });
		}
	}

	return NextResponse.json({ ok: true, job: updatedJob });
}


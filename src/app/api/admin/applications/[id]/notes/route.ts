import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/checkAdmin';
import { getSupabaseServer } from '@/lib/supabaseServer';

const NoteSchema = z.object({
	content: z.string().min(1, 'El contenido de la nota no puede estar vacío')
});

// GET - Obtener todas las notas de una aplicación
export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { isAdmin } = await requireAdmin();
		if (!isAdmin) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { id } = await params;
		const applicationId = id;

		const supabase = getSupabaseServer();

		// Obtener todas las notas de esta aplicación
		const { data: notes, error } = await supabase
			.from('recruiter_notes')
			.select('id, content, created_at, updated_at, user_id')
			.eq('application_id', applicationId)
			.order('created_at', { ascending: false });

		if (error) {
			console.error('Error fetching notes:', error);
			return NextResponse.json(
				{ error: 'Failed to fetch notes' },
				{ status: 500 }
			);
		}

		return NextResponse.json({ notes: notes || [] });
	} catch (error: any) {
		console.error('Error in GET notes:', error);
		return NextResponse.json(
			{ error: error?.message ?? 'Failed to fetch notes' },
			{ status: 400 }
		);
	}
}

// POST - Crear o actualizar nota
export async function POST(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { isAdmin, user } = await requireAdmin();
		if (!isAdmin || !user) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { id } = await params;
		const applicationId = id;
		const body = await req.json();
		const parsed = NoteSchema.parse(body);

		const supabase = getSupabaseServer();

		// Crear nueva nota
		const { data: note, error } = await supabase
			.from('recruiter_notes')
			.insert({
				application_id: applicationId,
				user_id: user.id,
				content: parsed.content
			})
			.select('id, content, created_at, updated_at, user_id')
			.single();

		if (error) {
			console.error('Error creating note:', error);
			return NextResponse.json(
				{ error: 'Failed to create note' },
				{ status: 500 }
			);
		}

		return NextResponse.json({ note });
	} catch (error: any) {
		console.error('Error in POST note:', error);
		return NextResponse.json(
			{ error: error?.message ?? 'Failed to create note' },
			{ status: 400 }
		);
	}
}

// PUT - Crear nueva nota (siempre crea una nueva para mantener historial)
export async function PUT(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { isAdmin, user } = await requireAdmin();
		if (!isAdmin || !user) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { id } = await params;
		const applicationId = id;
		const body = await req.json();
		const parsed = NoteSchema.parse(body);

		const supabase = getSupabaseServer();

		// Siempre crear una nueva nota para mantener historial completo
		const { data: note, error } = await supabase
			.from('recruiter_notes')
			.insert({
				application_id: applicationId,
				user_id: user.id,
				content: parsed.content
			})
			.select('id, content, created_at, updated_at, user_id')
			.single();

		if (error) {
			console.error('Error creating note:', error);
			return NextResponse.json(
				{ error: 'Failed to create note' },
				{ status: 500 }
			);
		}

		return NextResponse.json({ note });
	} catch (error: any) {
		console.error('Error in PUT note:', error);
		return NextResponse.json(
			{ error: error?.message ?? 'Failed to save note' },
			{ status: 400 }
		);
	}
}


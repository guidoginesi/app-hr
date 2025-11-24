import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/checkAdmin';
import { getSupabaseServer } from '@/lib/supabaseServer';

const UpdateRatingSchema = z.object({
	rating: z.number().int().min(1).max(5)
});

export async function PUT(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { isAdmin, user } = await requireAdmin();
		if (!isAdmin || !user) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { id: applicationId } = await params;
		const body = await req.json();
		const parsed = UpdateRatingSchema.parse(body);

		const supabase = getSupabaseServer();

		// Actualizar la calificación de la aplicación
		const { data, error } = await supabase
			.from('applications')
			.update({ recruiter_rating: parsed.rating })
			.eq('id', applicationId)
			.select()
			.single();

		if (error) {
			console.error('Error updating rating:', error);
			return NextResponse.json({ error: error.message }, { status: 500 });
		}

		return NextResponse.json({ ok: true, application: data });
	} catch (error: any) {
		console.error('Error in PUT /api/admin/applications/[id]/rating:', error);
		return NextResponse.json(
			{ error: error?.message ?? 'Failed to update rating' },
			{ status: 400 }
		);
	}
}

export async function DELETE(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { isAdmin, user } = await requireAdmin();
		if (!isAdmin || !user) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { id: applicationId } = await params;
		const supabase = getSupabaseServer();

		// Eliminar la calificación (set to null)
		const { data, error } = await supabase
			.from('applications')
			.update({ recruiter_rating: null })
			.eq('id', applicationId)
			.select()
			.single();

		if (error) {
			console.error('Error deleting rating:', error);
			return NextResponse.json({ error: error.message }, { status: 500 });
		}

		return NextResponse.json({ ok: true, application: data });
	} catch (error: any) {
		console.error('Error in DELETE /api/admin/applications/[id]/rating:', error);
		return NextResponse.json(
			{ error: error?.message ?? 'Failed to delete rating' },
			{ status: 400 }
		);
	}
}


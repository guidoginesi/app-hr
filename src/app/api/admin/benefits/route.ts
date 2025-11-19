import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/checkAdmin';
import { getSupabaseServer } from '@/lib/supabaseServer';

const BenefitsSchema = z.object({
	items: z.array(
		z.object({
			id: z.string().optional(),
			text: z.string().min(1),
			display_order: z.number()
		})
	)
});

export async function GET() {
	const { isAdmin } = await requireAdmin();
	if (!isAdmin) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	const supabase = getSupabaseServer();

	// Get the first (and only) benefits record
	const { data: benefits, error: benefitsError } = await supabase
		.from('benefits')
		.select('id')
		.limit(1)
		.single();

	if (benefitsError && benefitsError.code !== 'PGRST116') {
		return NextResponse.json({ error: benefitsError.message }, { status: 400 });
	}

	let items: any[] = [];

	if (benefits) {
		const { data: benefitItems, error: itemsError } = await supabase
			.from('benefit_items')
			.select('id, text, display_order')
			.eq('benefit_id', benefits.id)
			.order('display_order', { ascending: true });

		if (itemsError) {
			return NextResponse.json({ error: itemsError.message }, { status: 400 });
		}

		items = benefitItems || [];
	}

	return NextResponse.json({ items });
}

export async function PUT(req: NextRequest) {
	const { isAdmin } = await requireAdmin();
	if (!isAdmin) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	const body = await req.json();
	const parsed = BenefitsSchema.parse(body);

	const supabase = getSupabaseServer();

	// Get or create the benefits record
	let { data: benefits, error: benefitsError } = await supabase
		.from('benefits')
		.select('id')
		.limit(1)
		.single();

	if (benefitsError && benefitsError.code === 'PGRST116') {
		// No benefits record exists, create one
		const { data: newBenefits, error: createError } = await supabase
			.from('benefits')
			.insert({ title: 'Beneficios de Pow' })
			.select('id')
			.single();

		if (createError) {
			return NextResponse.json({ error: createError.message }, { status: 400 });
		}

		benefits = newBenefits;
	} else if (benefitsError) {
		return NextResponse.json({ error: benefitsError.message }, { status: 400 });
	}

	if (!benefits) {
		return NextResponse.json({ error: 'Failed to get or create benefits record' }, { status: 400 });
	}

	// Delete all existing items
	const { error: deleteError } = await supabase
		.from('benefit_items')
		.delete()
		.eq('benefit_id', benefits.id);

	if (deleteError) {
		return NextResponse.json({ error: deleteError.message }, { status: 400 });
	}

	// Insert new items
	if (parsed.items.length > 0) {
		const itemsToInsert = parsed.items.map((item) => ({
			benefit_id: benefits.id,
			text: item.text.trim(),
			display_order: item.display_order
		}));

		const { error: insertError } = await supabase
			.from('benefit_items')
			.insert(itemsToInsert);

		if (insertError) {
			return NextResponse.json({ error: insertError.message }, { status: 400 });
		}
	}

	return NextResponse.json({ ok: true });
}


import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

export async function GET() {
	try {
		const supabase = getSupabaseServer();

		// Get the first (and only) benefits record
		const { data: benefits, error: benefitsError } = await supabase
			.from('benefits')
			.select('id')
			.limit(1)
			.single();

		if (benefitsError && benefitsError.code !== 'PGRST116') {
			// Return empty array if table doesn't exist yet
			return NextResponse.json({ items: [] });
		}

		let items: any[] = [];

		if (benefits) {
			const { data: benefitItems, error: itemsError } = await supabase
				.from('benefit_items')
				.select('id, text, display_order')
				.eq('benefit_id', benefits.id)
				.order('display_order', { ascending: true });

			if (!itemsError && benefitItems) {
				items = benefitItems;
			}
		}

		return NextResponse.json({ items });
	} catch (err) {
		// Return empty array on error to keep page functional
		return NextResponse.json({ items: [] });
	}
}


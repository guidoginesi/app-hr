import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';

export async function GET() {
	try {
		const supabase = getSupabaseServer();
		const { data, error } = await supabase
			.from('jobs')
			.select('id,title,department,location,description,is_published')
			.eq('is_published', true)
			.order('created_at', { ascending: false });
		if (error) throw error;
		return NextResponse.json({ jobs: data ?? [] });
	} catch (err: any) {
		// Return empty list if misconfigured to keep landing functional
		return NextResponse.json({ jobs: [] }, { status: 200 });
	}
}



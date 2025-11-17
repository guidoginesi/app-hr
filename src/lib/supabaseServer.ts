import { createClient } from '@supabase/supabase-js';

export function getSupabaseServer() {
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
	if (!url || !serviceKey) {
		throw new Error('Supabase URL or Service Role Key not configured');
	}
	return createClient(url, serviceKey, {
		auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
	});
}



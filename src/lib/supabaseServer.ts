import { createClient } from '@supabase/supabase-js';

export function getSupabaseServer() {
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
	if (!url || !serviceKey) {
		console.error('Missing Supabase server env vars:', {
			hasUrl: !!url,
			hasServiceKey: !!serviceKey,
			envKeys: Object.keys(process.env).filter(k => k.includes('SUPABASE'))
		});
		throw new Error('Supabase URL or Service Role Key not configured. Please check your Vercel environment variables.');
	}
	return createClient(url, serviceKey, {
		auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
	});
}



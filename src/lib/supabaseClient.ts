import { createBrowserClient } from '@supabase/ssr';

export function getSupabaseBrowser() {
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
	if (!url || !anonKey) {
		throw new Error('Supabase URL or Anon Key not configured');
	}
	
	return createBrowserClient(url, anonKey, {
		auth: {
			// Persist session in localStorage for longer-lived sessions
			persistSession: true,
			// Automatically refresh tokens before they expire
			autoRefreshToken: true,
			// Detect OAuth redirects
			detectSessionInUrl: true,
		},
	});
}



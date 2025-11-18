import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

// In Server Components we can only READ cookies, not modify them.
// Auth cookies are written on the client (browser) side.
export async function getSupabaseAuthServer() {
	const cookieStore = await cookies();
	const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

	if (!supabaseUrl || !supabaseAnonKey) {
		console.error('Missing Supabase env vars:', {
			hasUrl: !!supabaseUrl,
			hasAnonKey: !!supabaseAnonKey,
			envKeys: Object.keys(process.env).filter(k => k.includes('SUPABASE'))
		});
		throw new Error(
			'Missing Supabase environment variables. Please check your Vercel project settings have NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY configured for Production environment.'
		);
	}

	return createServerClient(supabaseUrl, supabaseAnonKey, {
		cookies: {
			get(name: string) {
				return cookieStore.get(name)?.value;
			},
			// No-ops in Server Components: cookies can only be set in Route Handlers / Server Actions
			set() {},
			remove() {}
		}
	});
}



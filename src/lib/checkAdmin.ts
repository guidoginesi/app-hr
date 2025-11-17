import { getSupabaseAuthServer } from '@/lib/supabaseAuthServer';

export async function requireAdmin() {
	const supabase = await getSupabaseAuthServer();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) {
		return { user: null, isAdmin: false };
	}
	const { data, error } = await supabase
		.from('admins')
		.select('user_id')
		.eq('user_id', user.id)
		.maybeSingle();
	if (error) {
		return { user: null, isAdmin: false };
	}
	return { user, isAdmin: !!data };
}



import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/checkAdmin';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { AdminShell } from '../AdminShell';
import { JobsClient } from './JobsClient';

export const dynamic = 'force-dynamic';

export default async function AdminJobsPage() {
	const { isAdmin } = await requireAdmin();
	if (!isAdmin) {
		redirect('/admin/login');
	}

	const supabase = getSupabaseServer();
	const { data: jobs, error } = await supabase
		.from('jobs')
		.select('*')
		.order('created_at', { ascending: false });
	
	if (error) {
		console.error('Error fetching jobs:', error);
	}

	return (
		<AdminShell active="busquedas">
			<JobsClient jobs={jobs || []} />
		</AdminShell>
	);
}


import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/checkAdmin';
import { AdminShell } from '../AdminShell';
import { ConfiguracionClient } from './ConfiguracionClient';

export const dynamic = 'force-dynamic';

export default async function AdminConfiguracionPage() {
	const { isAdmin } = await requireAdmin();
	if (!isAdmin) {
		redirect('/admin/login');
	}

	return (
		<AdminShell active="configuracion">
			<ConfiguracionClient />
		</AdminShell>
	);
}


import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/checkAuth';
import { AdminShell } from '../AdminShell';
import { ConsultasAdminClient } from './ConsultasAdminClient';

export const dynamic = 'force-dynamic';

export default async function AdminConsultasPage() {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) redirect('/admin/login');

  return (
    <AdminShell>
      <ConsultasAdminClient />
    </AdminShell>
  );
}

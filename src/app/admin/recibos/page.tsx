import { redirect } from 'next/navigation';
import { requirePayrollReceiptsViewer } from '@/lib/checkAuth';
import { AdminShell } from '../AdminShell';
import { RecibosAdminClient } from './RecibosAdminClient';

export const dynamic = 'force-dynamic';

export default async function AdminRecibosPage() {
  const auth = await requirePayrollReceiptsViewer();
  if (!auth?.user) redirect('/admin/login');

  // Administración ve la nav recortada (igual que en Adelantos).
  const advancesOnly = !auth.isAdmin;

  return (
    <AdminShell advancesOnly={advancesOnly}>
      <RecibosAdminClient />
    </AdminShell>
  );
}

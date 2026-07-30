import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/checkAuth';
import { SalaryAdvancesLayout } from './SalaryAdvancesLayout';
import { SalaryAdvancesClient } from './SalaryAdvancesClient';

export const dynamic = 'force-dynamic';

export default async function AdminSalaryAdvancesPage() {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) redirect('/admin');

  return (
    <SalaryAdvancesLayout>
      <SalaryAdvancesClient />
    </SalaryAdvancesLayout>
  );
}

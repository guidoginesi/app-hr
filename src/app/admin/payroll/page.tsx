import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/checkAuth';
import { PayrollLayout } from './PayrollLayout';
import { PayrollPeriodsClient } from './PayrollPeriodsClient';

export const dynamic = 'force-dynamic';

export default async function PayrollPeriodsPage() {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) {
    redirect('/admin/login');
  }

  return (
    <PayrollLayout>
      <PayrollPeriodsClient />
    </PayrollLayout>
  );
}

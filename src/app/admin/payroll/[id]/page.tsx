import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/checkAuth';
import { PayrollShell } from '../PayrollShell';
import { PayrollPeriodDetailClient } from './PayrollPeriodDetailClient';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function PayrollPeriodDetailPage({ params }: PageProps) {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) {
    redirect('/admin/login');
  }

  const { id } = await params;

  return (
    <PayrollShell active="detail">
      <PayrollPeriodDetailClient periodId={id} />
    </PayrollShell>
  );
}

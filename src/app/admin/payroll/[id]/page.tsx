import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/checkAuth';
import { PayrollLayout } from '../PayrollLayout';
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
    <PayrollLayout>
      <PayrollPeriodDetailClient periodId={id} />
    </PayrollLayout>
  );
}

import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/checkAuth';
import { PayrollLayout } from '../PayrollLayout';
import { PayrollPeriodDetailClient } from './PayrollPeriodDetailClient';
import { PeriodAdvancesSection } from './PeriodAdvancesSection';

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
      <div className="space-y-6">
        <PayrollPeriodDetailClient periodId={id} />
        <PeriodAdvancesSection periodId={id} />
      </div>
    </PayrollLayout>
  );
}

import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/checkAuth';
import { TimeOffLayout } from '../TimeOffLayout';
import { SickKpiClient } from './SickKpiClient';

export const dynamic = 'force-dynamic';

export default async function SickAbsenteeismPage() {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) redirect('/admin/login');

  return (
    <TimeOffLayout active="ausentismo">
      <SickKpiClient />
    </TimeOffLayout>
  );
}

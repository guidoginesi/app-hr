import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/checkAuth';
import { RecruitingLayout } from '../RecruitingLayout';
import { ConfigClient } from './ConfigClient';

export const dynamic = 'force-dynamic';

export default async function RecruitingConfigPage() {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) {
    redirect('/admin/login');
  }

  return (
    <RecruitingLayout active="configuracion">
      <ConfigClient />
    </RecruitingLayout>
  );
}

import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/checkAuth';
import { TrainingLayout } from './TrainingLayout';
import { TrainingClient } from './TrainingClient';

export const dynamic = 'force-dynamic';

export default async function AdminTrainingPage() {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) redirect('/admin');

  return (
    <TrainingLayout>
      <TrainingClient />
    </TrainingLayout>
  );
}

import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/checkAuth';
import { NovedadesClient } from './NovedadesClient';

export const dynamic = 'force-dynamic';

export default async function NovedadesPage() {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) redirect('/admin');

  return <NovedadesClient />;
}

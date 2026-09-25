import { redirect } from 'next/navigation';
import { requireNovedadesViewer } from '@/lib/checkAuth';
import { NovedadesClient } from './NovedadesClient';

export const dynamic = 'force-dynamic';

export default async function NovedadesPage() {
  // Admin completo edita; Administración sólo lee y exporta.
  const auth = await requireNovedadesViewer();
  if (!auth) redirect('/admin');

  return <NovedadesClient soloLectura={!auth.isAdmin} />;
}

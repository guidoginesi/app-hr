import { redirect } from 'next/navigation';
import { requirePortalAccess } from '@/lib/checkAuth';
import { PortalShell } from '../PortalShell';
import { ConsultasClient } from './ConsultasClient';

export const dynamic = 'force-dynamic';

export default async function PortalConsultasPage() {
  const auth = await requirePortalAccess();
  if (!auth || !auth.employee) redirect('/portal/login');

  return (
    <PortalShell employee={auth.employee} isLeader={auth.isLeader} active={'consultas' as any}>
      <ConsultasClient />
    </PortalShell>
  );
}

import { redirect } from 'next/navigation';
import { requirePortalAccess } from '@/lib/checkAuth';
import { PortalShell } from '../PortalShell';
import { CapacitacionesClient } from './CapacitacionesClient';

export const dynamic = 'force-dynamic';

export default async function CapacitacionesPortalPage() {
  const auth = await requirePortalAccess();
  if (!auth || !auth.employee) {
    redirect('/portal/login');
  }

  return (
    <PortalShell employee={auth.employee} isLeader={auth.isLeader} active="capacitaciones">
      <CapacitacionesClient />
    </PortalShell>
  );
}

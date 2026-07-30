import { redirect } from 'next/navigation';
import { requirePortalAccess } from '@/lib/checkAuth';
import { PortalShell } from '../PortalShell';
import { AdelantosClient } from './AdelantosClient';

export const dynamic = 'force-dynamic';

export default async function AdelantosPortalPage() {
  const auth = await requirePortalAccess();
  if (!auth || !auth.employee) {
    redirect('/portal/login');
  }

  return (
    <PortalShell employee={auth.employee} isLeader={auth.isLeader} active="adelantos">
      <AdelantosClient />
    </PortalShell>
  );
}

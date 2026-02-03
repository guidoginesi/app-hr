import { redirect } from 'next/navigation';
import { requirePortalAccess } from '@/lib/checkAuth';
import { PortalShell } from '../../PortalShell';
import { TeamTimeOffClient } from './TeamTimeOffClient';

export const dynamic = 'force-dynamic';

export default async function TeamTimeOffPage() {
  const auth = await requirePortalAccess();

  if (!auth || !auth.employee) {
    redirect('/portal/login');
  }

  // Only leaders can access this page
  if (!auth.isLeader) {
    redirect('/portal/time-off');
  }

  const { employee, isLeader } = auth;

  return (
    <PortalShell employee={employee} isLeader={isLeader} active="time-off">
      <TeamTimeOffClient />
    </PortalShell>
  );
}

import { redirect } from 'next/navigation';
import { requirePortalAccess } from '@/lib/checkAuth';
import { PortalShell } from '../../PortalShell';
import { TeamReintegrosClient } from './TeamReintegrosClient';

export const dynamic = 'force-dynamic';

export default async function TeamReintegrosPage() {
  const auth = await requirePortalAccess();
  if (!auth || !auth.employee) redirect('/portal/login');
  // La cola es del líder: alguien sin reportes no tiene nada que decidir acá.
  if (!auth.isLeader) redirect('/portal');

  return (
    <PortalShell employee={auth.employee} isLeader={auth.isLeader} active="reintegros-equipo">
      <TeamReintegrosClient />
    </PortalShell>
  );
}

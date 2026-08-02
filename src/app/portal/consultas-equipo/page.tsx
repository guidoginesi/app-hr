import { redirect } from 'next/navigation';
import { requirePortalAccess } from '@/lib/checkAuth';
import { PortalShell } from '../PortalShell';
import { ConsultasEquipoClient } from './ConsultasEquipoClient';

export const dynamic = 'force-dynamic';

export default async function ConsultasEquipoPage() {
  const auth = await requirePortalAccess();
  if (!auth || !auth.employee) redirect('/portal/login');

  return (
    <PortalShell employee={auth.employee} isLeader={auth.isLeader} active={'consultas-equipo' as any}>
      <ConsultasEquipoClient />
    </PortalShell>
  );
}

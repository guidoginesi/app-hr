import { redirect } from 'next/navigation';
import { requirePortalAccess } from '@/lib/checkAuth';
import { PortalShell } from '../PortalShell';
import { hasReimbursementAccess } from '@/lib/reimbursementAccess';
import { ReintegrosClient } from './ReintegrosClient';

export const dynamic = 'force-dynamic';

export default async function PortalReintegrosPage() {
  const auth = await requirePortalAccess();
  if (!auth || !auth.employee) redirect('/portal/login');

  // La habilitación se chequea también acá, no sólo en la sidebar: alguien con el
  // link entraría igual a una pantalla que no le corresponde.
  const enabled = await hasReimbursementAccess(auth.employee.id);

  return (
    <PortalShell employee={auth.employee} isLeader={auth.isLeader} active="reintegros">
      <ReintegrosClient enabled={enabled} />
    </PortalShell>
  );
}

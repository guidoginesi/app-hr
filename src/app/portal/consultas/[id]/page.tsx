import { redirect } from 'next/navigation';
import { requirePortalAccess } from '@/lib/checkAuth';
import { PortalShell } from '@/app/portal/PortalShell';
import { ConsultaDetailClient } from './ConsultaDetailClient';

export const dynamic = 'force-dynamic';

export default async function ConsultaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePortalAccess();
  if (!auth || !auth.employee) redirect('/portal/login');
  const { id } = await params;

  return (
    <PortalShell employee={auth.employee} isLeader={auth.isLeader} active={'consultas' as any}>
      <ConsultaDetailClient inquiryId={id} />
    </PortalShell>
  );
}

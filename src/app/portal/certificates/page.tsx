import { redirect } from 'next/navigation';
import { requirePortalAccess } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { PortalShell } from '../PortalShell';
import { CertificatesClient } from './CertificatesClient';

export const dynamic = 'force-dynamic';

export default async function CertificatesPage() {
  const auth = await requirePortalAccess();
  if (!auth?.employee) {
    redirect('/portal/login');
  }

  const { employee, isLeader } = auth;
  const supabase = getSupabaseServer();

  const { data: certificates } = await supabase
    .from('employee_certificates')
    .select('*')
    .eq('employee_id', employee.id)
    .order('uploaded_at', { ascending: false });

  return (
    <PortalShell employee={employee} isLeader={isLeader} active="certificates">
      <CertificatesClient initialCertificates={certificates || []} />
    </PortalShell>
  );
}

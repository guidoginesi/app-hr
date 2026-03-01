import { redirect } from 'next/navigation';
import { getAuthResult, checkIsLeader } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { PortalShell } from '../PortalShell';
import { RecibosClient } from './RecibosClient';

export const dynamic = 'force-dynamic';

export default async function PortalRecibosPage() {
  const auth = await getAuthResult();

  if (!auth.user) {
    redirect('/portal/login');
  }

  if (!auth.employee) {
    redirect('/portal');
  }

  const supabase = getSupabaseServer();
  const employeeId = auth.employee.id;

  // Check if user is a leader
  const isLeader = auth.isLeader || await checkIsLeader(employeeId);

  // Fetch SENT settlements where contract_type_snapshot = RELACION_DEPENDENCIA
  const { data: settlements } = await supabase
    .from('payroll_settlements_with_details')
    .select('*, pdf_storage_path, pdf_filename, pdf_uploaded_at')
    .eq('employee_id', employeeId)
    .eq('status', 'SENT')
    .eq('contract_type_snapshot', 'RELACION_DEPENDENCIA')
    .order('period_year', { ascending: false })
    .order('period_month', { ascending: false });

  return (
    <PortalShell employee={auth.employee} isLeader={isLeader} active={"recibos" as any}>
      <RecibosClient settlements={settlements || []} />
    </PortalShell>
  );
}

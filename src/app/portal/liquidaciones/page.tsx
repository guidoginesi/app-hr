import { redirect } from 'next/navigation';
import { getAuthResult, checkIsLeader } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { PortalShell } from '../PortalShell';
import { LiquidacionesClient } from './LiquidacionesClient';

export const dynamic = 'force-dynamic';

export default async function PortalLiquidacionesPage() {
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

  // Fetch SENT settlements for this employee
  const { data: settlements } = await supabase
    .from('payroll_settlements_with_details')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('status', 'SENT')
    .order('period_year', { ascending: false })
    .order('period_month', { ascending: false });

  return (
    <PortalShell employee={auth.employee} isLeader={isLeader} active={"liquidaciones" as any}>
      <LiquidacionesClient settlements={settlements || []} />
    </PortalShell>
  );
}

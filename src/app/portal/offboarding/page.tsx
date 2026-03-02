import { redirect } from 'next/navigation';
import { requirePortalAccess } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { PortalShell } from '../PortalShell';
import { OffboardingClient } from './OffboardingClient';

export const dynamic = 'force-dynamic';

export default async function PortalOffboardingPage() {
  const auth = await requirePortalAccess();
  
  if (!auth || !auth.employee) {
    redirect('/portal/login');
  }

  const { employee, isLeader } = auth;
  const supabase = getSupabaseServer();

  // Get employee with offboarding data
  const { data: employeeData } = await supabase
    .from('employees')
    .select('id, first_name, last_name, status, termination_date, offboarding_enabled, offboarding_completed_at')
    .eq('id', employee.id)
    .single();

  // If not terminated, redirect to home
  if (!employeeData || employeeData.status !== 'terminated') {
    redirect('/portal');
  }

  // Get existing offboarding response
  const { data: offboardingResponse } = await supabase
    .from('offboarding_responses')
    .select('*')
    .eq('employee_id', employee.id)
    .maybeSingle();

  return (
    <PortalShell employee={employee} isLeader={isLeader} active="offboarding">
      <OffboardingClient
        employee={{
          id: employeeData.id,
          firstName: employeeData.first_name,
          lastName: employeeData.last_name,
          terminationDate: employeeData.termination_date,
          offboardingEnabled: employeeData.offboarding_enabled,
          offboardingCompletedAt: employeeData.offboarding_completed_at,
        }}
        offboardingResponse={offboardingResponse}
      />
    </PortalShell>
  );
}

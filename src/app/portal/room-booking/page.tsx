import { redirect } from 'next/navigation';
import { requirePortalAccess } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { PortalShell } from '@/app/portal/PortalShell';
import { RoomBookingPortalClient } from './RoomBookingPortalClient';

export const dynamic = 'force-dynamic';

export default async function RoomBookingPortalPage() {
  const auth = await requirePortalAccess();
  if (!auth || !auth.employee) redirect('/portal/login');

  const supabase = getSupabaseServer();
  const { data: rooms } = await supabase
    .from('rooms')
    .select('*')
    .eq('is_active', true)
    .order('name');

  return (
    <PortalShell employee={auth.employee} isLeader={auth.isLeader} active="room-booking">
      <RoomBookingPortalClient
        rooms={(rooms ?? []) as any}
        employeeId={auth.employee.id}
        employeeName={`${auth.employee.first_name} ${auth.employee.last_name}`}
      />
    </PortalShell>
  );
}

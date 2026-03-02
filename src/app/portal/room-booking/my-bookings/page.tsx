import { redirect } from 'next/navigation';
import { requirePortalAccess } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { PortalShell } from '@/app/portal/PortalShell';
import { MyBookingsClient } from './MyBookingsClient';

export const dynamic = 'force-dynamic';

export default async function MyBookingsPage() {
  const auth = await requirePortalAccess();

  if (!auth || !auth.employee) {
    redirect('/portal/login');
  }

  const { employee, isLeader } = auth;
  const supabase = getSupabaseServer();

  // Get all bookings for this employee
  const { data: bookings } = await supabase
    .from('room_bookings_with_details')
    .select('*')
    .eq('employee_id', employee.id)
    .order('start_at', { ascending: false });

  return (
    <PortalShell employee={employee} isLeader={isLeader} active="room-booking">
      <MyBookingsClient bookings={bookings || []} />
    </PortalShell>
  );
}

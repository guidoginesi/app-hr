import { redirect } from 'next/navigation';
import { requirePortalAccess } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { PortalShell } from '@/app/portal/PortalShell';
import { RoomBookingPortalClient } from './RoomBookingPortalClient';

export const dynamic = 'force-dynamic';

export default async function RoomBookingPortalPage() {
  const auth = await requirePortalAccess();

  if (!auth || !auth.employee) {
    redirect('/portal/login');
  }

  const { employee, isLeader } = auth;
  const supabase = getSupabaseServer();

  const today = new Date().toISOString().split('T')[0];

  // Get active rooms
  const { data: rooms } = await supabase
    .from('rooms')
    .select('*')
    .eq('is_active', true)
    .order('name');

  // Get today's bookings
  const startOfDay = `${today}T00:00:00`;
  const endOfDay = `${today}T23:59:59`;

  const { data: todayBookings } = await supabase
    .from('room_bookings_with_details')
    .select('*')
    .gte('start_at', startOfDay)
    .lte('start_at', endOfDay)
    .eq('status', 'confirmed')
    .order('start_at');

  return (
    <PortalShell employee={employee} isLeader={isLeader} active="room-booking">
      <RoomBookingPortalClient
        employeeId={employee.id}
        rooms={rooms || []}
        initialBookings={todayBookings || []}
        initialDate={today}
      />
    </PortalShell>
  );
}

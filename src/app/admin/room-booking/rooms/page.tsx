import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/checkAuth';
import { RoomBookingShell } from '../RoomBookingShell';
import { RoomsClient } from './RoomsClient';

export const dynamic = 'force-dynamic';

export default async function RoomsPage() {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) {
    redirect('/admin/login');
  }

  return (
    <RoomBookingShell active="rooms">
      <RoomsClient />
    </RoomBookingShell>
  );
}

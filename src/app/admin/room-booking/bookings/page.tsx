import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/checkAuth';
import { RoomBookingShell } from '../RoomBookingShell';
import { BookingsClient } from './BookingsClient';

export const dynamic = 'force-dynamic';

export default async function BookingsPage() {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) {
    redirect('/admin/login');
  }

  return (
    <RoomBookingShell active="bookings">
      <BookingsClient />
    </RoomBookingShell>
  );
}

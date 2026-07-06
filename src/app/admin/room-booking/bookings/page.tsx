import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/checkAuth';
import { RoomBookingLayout } from '../RoomBookingLayout';
import { BookingsClient } from './BookingsClient';

export const dynamic = 'force-dynamic';

export default async function BookingsPage() {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) {
    redirect('/admin/login');
  }

  return (
    <RoomBookingLayout active="bookings">
      <BookingsClient />
    </RoomBookingLayout>
  );
}

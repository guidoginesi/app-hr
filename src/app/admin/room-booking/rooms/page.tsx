import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/checkAuth';
import { RoomBookingLayout } from '../RoomBookingLayout';
import { RoomsClient } from './RoomsClient';

export const dynamic = 'force-dynamic';

export default async function RoomsPage() {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) {
    redirect('/admin/login');
  }

  return (
    <RoomBookingLayout active="rooms">
      <RoomsClient />
    </RoomBookingLayout>
  );
}

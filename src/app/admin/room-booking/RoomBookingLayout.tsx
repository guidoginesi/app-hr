import { ReactNode } from 'react';
import { AdminShell } from '@/app/admin/AdminShell';
import { PageHeader } from '@pow/ui/components/ui/page-header';
import { RoomBookingTabs } from './RoomBookingTabs';

type RoomBookingTab = 'dashboard' | 'rooms' | 'bookings';

export function RoomBookingLayout({
  active,
  actions,
  children,
}: {
  active: RoomBookingTab;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <AdminShell active="room-booking">
      <div className="space-y-6">
        <PageHeader
          title="Reserva de Salas"
          description="Salas de reuniones y reservas del equipo"
          actions={actions}
        />
        <RoomBookingTabs active={active} />
        {children}
      </div>
    </AdminShell>
  );
}

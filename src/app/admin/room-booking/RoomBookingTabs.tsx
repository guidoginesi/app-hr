'use client';

import { useRouter } from 'next/navigation';
import { TabNav } from '@pow/ui/components/ui/tab-nav';

const TABS = [
  { value: 'dashboard', label: 'Dashboard', href: '/admin/room-booking' },
  { value: 'rooms', label: 'Salas', href: '/admin/room-booking/rooms' },
  { value: 'bookings', label: 'Reservas', href: '/admin/room-booking/bookings' },
] as const;

type RoomBookingTab = (typeof TABS)[number]['value'];

export function RoomBookingTabs({ active }: { active: RoomBookingTab }) {
  const router = useRouter();
  return (
    <TabNav<RoomBookingTab>
      aria-label="Secciones de Reserva de Salas"
      value={active}
      onChange={(v) => {
        const tab = TABS.find((t) => t.value === v);
        if (tab) router.push(tab.href);
      }}
      options={TABS.map((t) => ({ value: t.value, label: t.label }))}
    />
  );
}

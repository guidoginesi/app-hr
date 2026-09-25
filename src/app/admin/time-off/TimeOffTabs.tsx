'use client';

import { useRouter } from 'next/navigation';
import { TabNav } from '@pow/ui/components/ui/tab-nav';

const TABS = [
  { value: 'dashboard', label: 'Dashboard', href: '/admin/time-off' },
  { value: 'requests', label: 'Solicitudes', href: '/admin/time-off/requests' },
  { value: 'balances', label: 'Balances', href: '/admin/time-off/balances' },
  { value: 'novedades', label: 'Novedades', href: '/admin/time-off/novedades' },
  { value: 'ausentismo', label: 'Ausentismo', href: '/admin/time-off/ausentismo' },
  { value: 'certificates', label: 'Certificados', href: '/admin/time-off/certificates' },
  { value: 'settings', label: 'Configuración', href: '/admin/time-off/settings' },
] as const;

export type TimeOffTab = (typeof TABS)[number]['value'];

export function TimeOffTabs({ active, soloNovedades = false }: { active: TimeOffTab; soloNovedades?: boolean }) {
  const router = useRouter();
  // Administración entra sólo a Novedades: mostrarle las otras pestañas sería
  // ofrecerle lo que el middleware le rebota.
  const tabs = soloNovedades ? TABS.filter((t) => t.value === 'novedades') : TABS;
  return (
    <TabNav<TimeOffTab>
      aria-label="Secciones de Time Off"
      value={active}
      onChange={(v) => {
        const tab = tabs.find((t) => t.value === v);
        if (tab) router.push(tab.href);
      }}
      options={tabs.map((t) => ({ value: t.value, label: t.label }))}
    />
  );
}

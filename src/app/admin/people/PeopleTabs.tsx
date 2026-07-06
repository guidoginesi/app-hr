'use client';

import { useRouter } from 'next/navigation';
import { TabNav } from '@pow/ui/components/ui/tab-nav';

const TABS = [
  { value: 'dashboard', label: 'Dashboard', href: '/admin/people/dashboard' },
  { value: 'empleados', label: 'Empleados', href: '/admin/people' },
  { value: 'organizacion', label: 'Organización', href: '/admin/people/organizacion' },
  { value: 'organigrama', label: 'Organigrama', href: '/admin/people/organigrama' },
] as const;

type PeopleTab = (typeof TABS)[number]['value'];

export function PeopleTabs({ active }: { active: PeopleTab }) {
  const router = useRouter();
  return (
    <TabNav<PeopleTab>
      aria-label="Secciones de People"
      value={active}
      onChange={(v) => {
        const tab = TABS.find((t) => t.value === v);
        if (tab) router.push(tab.href);
      }}
      options={TABS.map((t) => ({ value: t.value, label: t.label }))}
    />
  );
}

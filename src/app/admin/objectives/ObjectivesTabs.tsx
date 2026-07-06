'use client';

import { useRouter } from 'next/navigation';
import { TabNav } from '@pow/ui/components/ui/tab-nav';

const TABS = [
  { value: 'dashboard', label: 'Dashboard', href: '/admin/objectives' },
  { value: 'config', label: 'Objetivos Corporativos', href: '/admin/objectives/config' },
  { value: 'periods', label: 'Períodos', href: '/admin/objectives/periods' },
  { value: 'bonos', label: 'Bonos', href: '/admin/objectives/bonos' },
] as const;

type ObjectivesTab = (typeof TABS)[number]['value'];

export function ObjectivesTabs({ active }: { active: ObjectivesTab }) {
  const router = useRouter();
  return (
    <TabNav<ObjectivesTab>
      aria-label="Secciones de Objetivos"
      value={active}
      onChange={(v) => {
        const tab = TABS.find((t) => t.value === v);
        if (tab) router.push(tab.href);
      }}
      options={TABS.map((t) => ({ value: t.value, label: t.label }))}
    />
  );
}

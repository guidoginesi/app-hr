'use client';

import { useRouter } from 'next/navigation';
import { TabNav } from '@pow/ui/components/ui/tab-nav';

const TABS = [
  { value: 'dashboard', label: 'Dashboard', href: '/admin/recruiting' },
  { value: 'busquedas', label: 'Búsquedas', href: '/admin/recruiting/jobs' },
  { value: 'candidatos', label: 'Candidatos', href: '/admin/recruiting/candidates' },
  { value: 'configuracion', label: 'Configuración', href: '/admin/recruiting/config' },
] as const;

type RecruitingTab = (typeof TABS)[number]['value'];

export function RecruitingTabs({ active }: { active: RecruitingTab }) {
  const router = useRouter();
  return (
    <TabNav<RecruitingTab>
      aria-label="Secciones de Reclutamiento"
      value={active}
      onChange={(v) => {
        const tab = TABS.find((t) => t.value === v);
        if (tab) router.push(tab.href);
      }}
      options={TABS.map((t) => ({ value: t.value, label: t.label }))}
    />
  );
}

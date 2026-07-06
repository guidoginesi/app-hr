'use client';

import { useRouter } from 'next/navigation';
import { TabNav } from '@pow/ui/components/ui/tab-nav';

const TABS = [
  { value: 'mensajes', label: 'Mensajes', href: '/admin/messages' },
  { value: 'configuracion', label: 'Configuración', href: '/admin/messages/config' },
] as const;

type MessagesTab = (typeof TABS)[number]['value'];

export function MessagesTabs({ active }: { active: MessagesTab }) {
  const router = useRouter();
  return (
    <TabNav<MessagesTab>
      aria-label="Secciones de Mensajes"
      value={active}
      onChange={(v) => {
        const tab = TABS.find((t) => t.value === v);
        if (tab) router.push(tab.href);
      }}
      options={TABS.map((t) => ({ value: t.value, label: t.label }))}
    />
  );
}

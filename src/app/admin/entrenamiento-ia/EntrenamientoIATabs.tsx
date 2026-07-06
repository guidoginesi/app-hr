'use client';

import { useRouter } from 'next/navigation';
import { TabNav } from '@pow/ui/components/ui/tab-nav';

const TABS = [
  { value: 'ranking', label: 'Ranking', href: '/admin/entrenamiento-ia' },
  { value: 'puntuacion', label: 'Cargar puntos', href: '/admin/entrenamiento-ia/puntuacion' },
  { value: 'sessions', label: 'Sesiones', href: '/admin/entrenamiento-ia/sessions' },
] as const;

type EntrenamientoIATab = (typeof TABS)[number]['value'];

export function EntrenamientoIATabs({ active }: { active: EntrenamientoIATab }) {
  const router = useRouter();
  return (
    <TabNav<EntrenamientoIATab>
      aria-label="Secciones de Entrenamiento IA"
      value={active}
      onChange={(v) => {
        const tab = TABS.find((t) => t.value === v);
        if (tab) router.push(tab.href);
      }}
      options={TABS.map((t) => ({ value: t.value, label: t.label }))}
    />
  );
}

'use client';

import { useRouter } from 'next/navigation';
import { TabNav } from '@pow/ui/components/ui/tab-nav';

const TABS = [
  { value: 'dashboard', label: 'Dashboard', href: '/admin/evaluations' },
  { value: 'periods', label: 'Períodos', href: '/admin/evaluations/periods' },
  { value: 'dimensions', label: 'Dimensiones', href: '/admin/evaluations/dimensions' },
  { value: 'open_questions', label: 'Preguntas abiertas', href: '/admin/evaluations/open-questions' },
  { value: 'all', label: 'Todas las evaluaciones', href: '/admin/evaluations/all' },
  { value: 'recategorizations', label: 'Recategorizaciones', href: '/admin/evaluations/recategorizations' },
] as const;

export type EvaluationsTab = (typeof TABS)[number]['value'];

export function EvaluationsTabs({ active }: { active: EvaluationsTab }) {
  const router = useRouter();
  return (
    <TabNav<EvaluationsTab>
      aria-label="Secciones de Evaluaciones"
      value={active}
      onChange={(v) => {
        const tab = TABS.find((t) => t.value === v);
        if (tab) router.push(tab.href);
      }}
      options={TABS.map((t) => ({ value: t.value, label: t.label }))}
    />
  );
}

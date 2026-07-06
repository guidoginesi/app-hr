import { ReactNode } from 'react';
import { AdminShell } from '@/app/admin/AdminShell';
import { PageHeader } from '@pow/ui/components/ui/page-header';
import { EntrenamientoIATabs } from './EntrenamientoIATabs';

type EntrenamientoIATab = 'ranking' | 'puntuacion' | 'sessions';

export function EntrenamientoIALayout({
  active,
  actions,
  children,
}: {
  active: EntrenamientoIATab;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <AdminShell active="entrenamiento-ia">
      <div className="space-y-6">
        <PageHeader
          title="Entrenamiento IA"
          description="Ranking de capacitaciones y puntajes"
          actions={actions}
        />
        <EntrenamientoIATabs active={active} />
        {children}
      </div>
    </AdminShell>
  );
}

import { ReactNode } from 'react';
import { AdminShell } from '@/app/admin/AdminShell';
import { PageHeader } from '@pow/ui/components/ui/page-header';
import { ObjectivesTabs } from './ObjectivesTabs';

type ObjectivesTab = 'dashboard' | 'config' | 'periods' | 'bonos';

export function ObjectivesLayout({
  active,
  actions,
  children,
}: {
  active: ObjectivesTab;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <AdminShell active="objectives">
      <div className="space-y-6">
        <PageHeader
          title="Objetivos"
          description="OKRs y objetivos por equipo y empleado"
          actions={actions}
        />
        <ObjectivesTabs active={active} />
        {children}
      </div>
    </AdminShell>
  );
}

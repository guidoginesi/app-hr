import { ReactNode } from 'react';
import { AdminShell } from '@/app/admin/AdminShell';
import { PageHeader } from '@pow/ui/components/ui/page-header';
import { PeopleTabs } from './PeopleTabs';

type PeopleTab = 'empleados' | 'dashboard' | 'organizacion' | 'organigrama';

export function PeopleLayout({
  active,
  actions,
  children,
}: {
  active: PeopleTab;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <AdminShell active="people">
      <div className="space-y-6">
        <PageHeader
          title="People"
          description="Gestión de empleados y estructura organizacional"
          actions={actions}
        />
        <PeopleTabs active={active} />
        {children}
      </div>
    </AdminShell>
  );
}

import { ReactNode } from 'react';
import { AdminShell } from '@/app/admin/AdminShell';
import { PageHeader } from '@pow/ui/components/ui/page-header';
import { TimeOffTabs, type TimeOffTab } from './TimeOffTabs';

export function TimeOffLayout({
  active,
  actions,
  children,
}: {
  active: TimeOffTab;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <AdminShell active="time-off">
      <div className="space-y-6">
        <PageHeader
          title="Time Off"
          description="Vacaciones, licencias y días libres"
          actions={actions}
        />
        <TimeOffTabs active={active} />
        {children}
      </div>
    </AdminShell>
  );
}

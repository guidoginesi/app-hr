import { ReactNode } from 'react';
import { AdminShell } from '@/app/admin/AdminShell';
import { PageHeader } from '@pow/ui/components/ui/page-header';
import { TimeOffTabs, type TimeOffTab } from './TimeOffTabs';

export function TimeOffLayout({
  active,
  actions,
  children,
  soloNovedades = false,
}: {
  active: TimeOffTab;
  actions?: ReactNode;
  children: ReactNode;
  /** Perfil Administración: ve sólo la pestaña de Novedades. */
  soloNovedades?: boolean;
}) {
  return (
    <AdminShell active="time-off">
      <div className="space-y-6">
        <PageHeader
          title="Time Off"
          description="Vacaciones, licencias y días libres"
          actions={actions}
        />
        <TimeOffTabs active={active} soloNovedades={soloNovedades} />
        {children}
      </div>
    </AdminShell>
  );
}

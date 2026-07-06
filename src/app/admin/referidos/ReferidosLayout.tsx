import { ReactNode } from 'react';
import { AdminShell } from '@/app/admin/AdminShell';
import { PageHeader } from '@pow/ui/components/ui/page-header';

export function ReferidosLayout({
  actions,
  children,
}: {
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <AdminShell active="referidos">
      <div className="space-y-6">
        <PageHeader
          title="Referidos"
          description="Programa de referidos del equipo"
          actions={actions}
        />
        {children}
      </div>
    </AdminShell>
  );
}
